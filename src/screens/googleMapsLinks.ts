import type { Place } from '../taste-engine';

/**
 * Deep links into the Google Maps app/website, built from the stored Google
 * Place ID only — no live Google content (photos, review text, etc.) is
 * fetched or cached to produce these, so there's nothing here that can run
 * afoul of the Places TOS caching limits.
 */

export function buildDirectionsUrl(place: Place): string {
  const destination = encodeURIComponent(place.name);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&destination_place_id=${place.id}`;
}

export function buildWriteReviewUrl(place: Place): string {
  return `https://search.google.com/local/writereview?placeid=${place.id}`;
}
