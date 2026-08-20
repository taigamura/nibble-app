import type { Place, PriceBand } from '../taste-engine';
import type { GeoPoint } from './types';

/**
 * Row shape of the curated `places` table (see supabase/schema.sql). This is
 * the permanent record: `place_id` and `tags` never expire. `rating`,
 * `price_band`, and `photo_reference` are Google-sourced cacheable fields
 * refreshed on a <=30-day cycle by scripts/ingestPlaces.ts, per Google
 * Places TOS (no permanent caching of Google content beyond photo/place IDs).
 */
export interface CuratedPlaceRow {
  place_id: string;
  name: string;
  category: string;
  tags: string[];
  price_band: PriceBand;
  rating: number;
  lat: number;
  lng: number;
  photo_reference: string | null;
  /**
   * Ordered gallery of Google photo references (hero first) powering the swipe
   * card's multi-photo carousel. `photo_reference` stays as the first element
   * for readers that only want one image; older rows written before this
   * column existed have `[]` here and fall back to `photo_reference`.
   * Optional at the type level because a row read from the DB before the
   * backfill ran can arrive without the field; `toPlace` degrades gracefully.
   */
  photo_references?: string[];
  refreshed_at: string;
}

/** Max gallery photos surfaced per place -- enough to recognize a spot, few
 * enough to page through without fatigue (and to bound photo-media requests). */
export const MAX_GALLERY_PHOTOS = 5;

export type { GeoPoint } from './types';

const EARTH_RADIUS_METERS = 6_371_000;

/** Great-circle distance between two lat/lng points, in meters. */
export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/**
 * Builds a direct Google Places (New) photo media URL from a stored photo
 * reference. This is a pure string construction — no network call happens
 * here. The actual HTTP GET only fires when an <Image> that uses this URL
 * is mounted, which is what makes hero photo loading lazy per surfaced card.
 */
export function buildPhotoUrl(photoReference: string, apiKey: string, maxWidthPx = 800): string {
  return `https://places.googleapis.com/v1/${photoReference}/media?maxWidthPx=${maxWidthPx}&key=${apiKey}`;
}

/** Stock placeholder used when a curated row has no real Google photo reference. */
export const FALLBACK_PHOTO_URL = 'https://picsum.photos/seed/nibble-placeholder/600/800';

/** Maps a curated DB row + the viewer's location into the taste-engine's Place shape. */
export function toPlace(row: CuratedPlaceRow, userLocation: GeoPoint, googlePlacesApiKey: string): Place {
  // Prefer the gallery column; fall back to the legacy single reference for
  // rows written before `photo_references` existed. Dedupe (the hero often
  // repeats as element 0) and cap so we never over-fetch photo media.
  const references = (row.photo_references?.length ? row.photo_references : [row.photo_reference])
    .filter((ref): ref is string => Boolean(ref));
  const photoUrls = Array.from(new Set(references))
    .slice(0, MAX_GALLERY_PHOTOS)
    .map((ref) => buildPhotoUrl(ref, googlePlacesApiKey));

  return {
    id: row.place_id,
    name: row.name,
    category: row.category,
    tags: row.tags,
    priceBand: row.price_band,
    rating: row.rating,
    distanceMeters: Math.round(haversineMeters(userLocation, { lat: row.lat, lng: row.lng })),
    lat: row.lat,
    lng: row.lng,
    photoUrl: photoUrls[0] ?? FALLBACK_PHOTO_URL,
    photoUrls: photoUrls.length > 0 ? photoUrls : [FALLBACK_PHOTO_URL],
  };
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/** True when a row's Google-sourced fields are due for a refresh (>30 days old). */
export function needsRefresh(row: Pick<CuratedPlaceRow, 'refreshed_at'>, now: Date = new Date()): boolean {
  return now.getTime() - new Date(row.refreshed_at).getTime() > THIRTY_DAYS_MS;
}
