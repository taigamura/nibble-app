/**
 * One-time (re-runnable) ingest: pulls cafes + restaurants across the
 * Shibuya-Meguro-Setagaya beachhead from Google Places (New) and upserts
 * them into the curated Supabase `places` table (see supabase/schema.sql).
 *
 * Run with real credentials, e.g.:
 *   GOOGLE_PLACES_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npx ts-node scripts/ingestPlaces.ts
 *
 * Re-running is safe: rows younger than 30 days are left untouched (their
 * `place_id` and our own `tags` are the only permanent Google-derived data;
 * everything else is refreshed to respect Google's TOS caching limit), pass
 * --force to refresh everything regardless of age.
 */
import type { CuratedPlaceRow, GeoPoint } from '../src/providers/curatedPlace';
import { needsRefresh } from '../src/providers/curatedPlace';
import type { PriceBand } from '../src/taste-engine';

/** Seed points spaced ~1.4km apart, covering the Shibuya-Meguro-Setagaya belt. */
export const SEED_POINTS: GeoPoint[] = [
  { lat: 35.6595, lng: 139.7005 }, // Shibuya
  { lat: 35.6465, lng: 139.6989 }, // Ebisu / Daikanyama
  { lat: 35.6339, lng: 139.6979 }, // Meguro
  { lat: 35.6203, lng: 139.6699 }, // Setagaya / Sangenjaya
  { lat: 35.6461, lng: 139.6656 }, // Shimokitazawa
];

const INGEST_RADIUS_METERS = 1500;
const INCLUDED_TYPES = ['cafe', 'restaurant'];

interface GooglePlaceResult {
  id: string;
  displayName?: { text: string };
  primaryType?: string;
  priceLevel?: string;
  rating?: number;
  location?: { latitude: number; longitude: number };
  photos?: Array<{ name: string }>;
}

interface GoogleSearchNearbyResponse {
  places?: GooglePlaceResult[];
}

const PRICE_LEVEL_TO_BAND: Record<string, PriceBand> = {
  PRICE_LEVEL_FREE: '$',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

/**
 * Pure mapping, kept separate from the network call so it's unit-testable.
 * `existingTags` carries forward any tags already assigned by the offline
 * enrichment pipeline (issue #4) so a re-ingest refresh cycle never wipes
 * them back to empty.
 */
export function mapGoogleResultToRow(
  result: GooglePlaceResult,
  now: Date = new Date(),
  existingTags: string[] = [],
): CuratedPlaceRow | null {
  if (!result.displayName?.text || !result.location) return null;

  return {
    place_id: result.id,
    name: result.displayName.text,
    category: result.primaryType ?? 'restaurant',
    tags: existingTags,
    price_band: PRICE_LEVEL_TO_BAND[result.priceLevel ?? ''] ?? '$$',
    rating: result.rating ?? 0,
    lat: result.location.latitude,
    lng: result.location.longitude,
    photo_reference: result.photos?.[0]?.name ?? null,
    refreshed_at: now.toISOString(),
  };
}

async function searchNearby(
  point: GeoPoint,
  apiKey: string,
  fetchImpl: typeof fetch,
): Promise<GooglePlaceResult[]> {
  const response = await fetchImpl('https://places.googleapis.com/v1/places:searchNearby', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.primaryType,places.priceLevel,places.rating,places.location,places.photos',
    },
    body: JSON.stringify({
      includedTypes: INCLUDED_TYPES,
      maxResultCount: 20,
      locationRestriction: {
        circle: {
          center: { latitude: point.lat, longitude: point.lng },
          radius: INGEST_RADIUS_METERS,
        },
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Google Places searchNearby failed with status ${response.status}`);
  }

  const body = (await response.json()) as GoogleSearchNearbyResponse;
  return body.places ?? [];
}

interface ExistingPlaceInfo {
  refreshed_at: string;
  tags: string[];
}

async function fetchExistingPlaces(
  supabaseUrl: string,
  serviceRoleKey: string,
  fetchImpl: typeof fetch,
): Promise<Map<string, ExistingPlaceInfo>> {
  const url = new URL(`${supabaseUrl}/rest/v1/places`);
  url.searchParams.set('select', 'place_id,refreshed_at,tags');

  const response = await fetchImpl(url.toString(), {
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
  });
  if (!response.ok) {
    throw new Error(`Supabase places lookup failed with status ${response.status}`);
  }
  const rows = (await response.json()) as Array<{ place_id: string; refreshed_at: string; tags: string[] }>;
  return new Map(rows.map((row) => [row.place_id, { refreshed_at: row.refreshed_at, tags: row.tags }]));
}

async function upsertRows(
  rows: CuratedPlaceRow[],
  supabaseUrl: string,
  serviceRoleKey: string,
  fetchImpl: typeof fetch,
): Promise<void> {
  if (rows.length === 0) return;

  const response = await fetchImpl(`${supabaseUrl}/rest/v1/places`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });

  if (!response.ok) {
    throw new Error(`Supabase places upsert failed with status ${response.status}`);
  }
}

export async function runIngest(options: {
  googlePlacesApiKey: string;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  force?: boolean;
  fetchImpl?: typeof fetch;
  seedPoints?: GeoPoint[];
}): Promise<{ upserted: number; skipped: number }> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const seedPoints = options.seedPoints ?? SEED_POINTS;

  const existing = await fetchExistingPlaces(options.supabaseUrl, options.supabaseServiceRoleKey, fetchImpl);

  const seen = new Set<string>();
  const rowsToUpsert: CuratedPlaceRow[] = [];
  let skipped = 0;

  for (const point of seedPoints) {
    const results = await searchNearby(point, options.googlePlacesApiKey, fetchImpl);
    for (const result of results) {
      const existingInfo = existing.get(result.id);
      const row = mapGoogleResultToRow(result, undefined, existingInfo?.tags ?? []);
      if (!row || seen.has(row.place_id)) continue;
      seen.add(row.place_id);

      const priorRefresh = existingInfo?.refreshed_at;
      const dueForRefresh = !priorRefresh || needsRefresh({ refreshed_at: priorRefresh });
      if (!options.force && !dueForRefresh) {
        skipped += 1;
        continue;
      }
      rowsToUpsert.push(row);
    }
  }

  await upsertRows(rowsToUpsert, options.supabaseUrl, options.supabaseServiceRoleKey, fetchImpl);
  return { upserted: rowsToUpsert.length, skipped };
}

/* eslint-disable no-console */
if (require.main === module) {
  const googlePlacesApiKey = process.env.GOOGLE_PLACES_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const force = process.argv.includes('--force');

  if (!googlePlacesApiKey || !supabaseUrl || !supabaseServiceRoleKey) {
    console.error(
      'Missing required env vars: GOOGLE_PLACES_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY',
    );
    process.exit(1);
  }

  runIngest({ googlePlacesApiKey, supabaseUrl, supabaseServiceRoleKey, force })
    .then(({ upserted, skipped }) => {
      console.log(`Ingest complete: ${upserted} upserted, ${skipped} skipped (fresh within 30 days).`);
    })
    .catch((error) => {
      console.error('Ingest failed:', error);
      process.exit(1);
    });
}
