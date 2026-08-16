/**
 * One-time (re-runnable) ingest: pulls cafes + restaurants across the
 * Kinshicho-Sumida beachhead (the default deck center) from Google Places
 * (New) and upserts them into the curated Supabase `places` table (see
 * supabase/schema.sql).
 *
 * Run with real credentials (loads .env, then `npm run ingest`), e.g.:
 *   GOOGLE_PLACES_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     npm run ingest
 *
 * Re-running is safe: rows younger than 30 days are left untouched (their
 * `place_id` and our own `tags` are the only permanent Google-derived data;
 * everything else is refreshed to respect Google's TOS caching limit), pass
 * --force to refresh everything regardless of age.
 */
import type { CuratedPlaceRow, GeoPoint } from '../src/providers/curatedPlace';
import { MAX_GALLERY_PHOTOS, needsRefresh } from '../src/providers/curatedPlace';
import type { PriceBand } from '../src/taste-engine';

/**
 * The Kinshicho-Sumida beachhead as a bounding box that encloses every
 * re-center preset in src/config/areas.ts (Kinshicho, Kameido, Ryogoku,
 * Oshiage, Sumiyoshi) with a small margin. We tile this box with a grid of
 * overlapping search circles (see `buildSeedGrid`) instead of a handful of
 * hand-placed points. Nearby Search caps each call at 20 results, so a few
 * wide circles over a dense area only ever return the 20 most prominent places
 * per circle -- small independent spots never make the cut. More, tighter,
 * overlapping circles sample the core from several directions and surface that
 * long tail. `runIngest` dedupes places seen from multiple circles, so the
 * overlap costs nothing but API calls.
 */
const BEACHHEAD_BOUNDS = {
  minLat: 35.681,
  maxLat: 35.712,
  minLng: 139.791,
  maxLng: 139.828,
} as const;

// Grid step in degrees, ~600m at this latitude (~35.7degN): 600/111_000 for
// latitude, 600/(111_320 * cos 35.7deg) for longitude. Paired with an 800m
// search radius so adjacent circles overlap and no place falls between them.
const GRID_STEP_LAT = 0.0054;
const GRID_STEP_LNG = 0.0066;
const INGEST_RADIUS_METERS = 800;

/**
 * Tiles a bounding box with an evenly spaced grid of points, inclusive of both
 * edges. Pure and deterministic so it's unit-testable. The caller pairs each
 * point with `INGEST_RADIUS_METERS`; the resulting overlap between circles is
 * intentional (see `BEACHHEAD_BOUNDS`).
 */
export function buildSeedGrid(
  bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
  stepLat: number,
  stepLng: number,
): GeoPoint[] {
  const points: GeoPoint[] = [];
  // A tiny epsilon keeps the top/right edge in despite float accumulation.
  for (let lat = bounds.minLat; lat <= bounds.maxLat + 1e-9; lat += stepLat) {
    for (let lng = bounds.minLng; lng <= bounds.maxLng + 1e-9; lng += stepLng) {
      points.push({ lat: Number(lat.toFixed(6)), lng: Number(lng.toFixed(6)) });
    }
  }
  return points;
}

export const SEED_POINTS: GeoPoint[] = buildSeedGrid(BEACHHEAD_BOUNDS, GRID_STEP_LAT, GRID_STEP_LNG);

/**
 * Google's `searchNearby` `includedTypes` filter admits any place that
 * *carries* a cafe/restaurant type, even when its **primary** type is
 * something else -- a hotel, supermarket, convenience store, or gas station
 * that happens to have a food counter. Those leak into the onboarding grid as
 * non-food tiles. We keep only rows whose primary type is an actual
 * food-and-drink type. Any `*_restaurant` subtype (japanese_restaurant,
 * ramen_restaurant, ...) is accepted by suffix; the rest are listed here.
 */
const FOOD_PRIMARY_TYPES = new Set([
  'restaurant',
  'cafe',
  'coffee_shop',
  'bakery',
  'bar',
  'bar_and_grill',
  'pub',
  'wine_bar',
  'tea_house',
  'cafeteria',
  'deli',
  'diner',
  'food_court',
  'ice_cream_shop',
  'dessert_shop',
  'dessert_restaurant',
  'donut_shop',
  'bagel_shop',
  'sandwich_shop',
  'juice_shop',
  'acai_shop',
  'cat_cafe',
  'dog_cafe',
  'confectionery',
  'candy_store',
  'chocolate_shop',
  'steak_house',
  'meal_takeaway',
  'meal_delivery',
]);

/**
 * The `includedTypes` we ask Nearby Search for. Deriving it from
 * FOOD_PRIMARY_TYPES keeps the fetch net and the keep filter
 * (`isFoodPrimaryType`) in lockstep. Previously the fetch asked only for
 * `cafe`/`restaurant`, so dessert shops, coffee shops (kissaten), bakeries,
 * and bars -- all of which we happily *keep* -- were dropped by Google before
 * our code ever saw them. `restaurant` already matches every `*_restaurant`
 * subtype (they carry the generic type too), so this concrete list suffices.
 */
const INCLUDED_TYPES = Array.from(FOOD_PRIMARY_TYPES);

/**
 * True when a Google `primaryType` is a food-and-drink establishment we want
 * on the deck. A missing primaryType is kept: the place already matched the
 * food-type `includedTypes` filter, Google just didn't classify it.
 */
export function isFoodPrimaryType(primaryType: string | undefined): boolean {
  if (!primaryType) return true;
  return primaryType.endsWith('_restaurant') || FOOD_PRIMARY_TYPES.has(primaryType);
}

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
  if (!isFoodPrimaryType(result.primaryType)) return null;

  // Keep several photo references so the card can show a small gallery; the
  // first doubles as the legacy single `photo_reference` for one-image readers.
  const photoReferences = (result.photos ?? [])
    .map((photo) => photo.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, MAX_GALLERY_PHOTOS);

  return {
    place_id: result.id,
    name: result.displayName.text,
    category: result.primaryType ?? 'restaurant',
    tags: existingTags,
    price_band: PRICE_LEVEL_TO_BAND[result.priceLevel ?? ''] ?? '$$',
    rating: result.rating ?? 0,
    lat: result.location.latitude,
    lng: result.location.longitude,
    photo_reference: photoReferences[0] ?? null,
    photo_references: photoReferences,
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
      // Ask for the *nearest* 20 rather than the most prominent 20 (the
      // default): in a dense core, popularity ranking buries small independent
      // spots behind chains, while distance ranking (paired with the tight
      // grid of circles) surfaces what's actually next to each seed point.
      rankPreference: 'DISTANCE',
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
    // Surface PostgREST's error body -- it names the offending column/constraint
    // (e.g. a missing `photo_references` column when supabase/schema.sql hasn't
    // been applied), which a bare status code hides.
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Supabase places upsert failed with status ${response.status}${detail ? `: ${detail}` : ''}`,
    );
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
