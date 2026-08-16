import { Platform } from 'react-native';

import type { Place } from '../taste-engine';

/**
 * Deep links into the platform's native maps app, built from the stored
 * Google Place ID / name / coordinates only -- no live Google content
 * (photos, review text, etc.) is fetched or cached to produce these, so
 * there's nothing here that can run afoul of the Places TOS caching limits.
 */

/**
 * Opens `place` in the platform-native maps app: Apple Maps on iOS, Google
 * Maps everywhere else (Android/web). iOS ships Apple Maps as the system
 * default, so routing there feels native instead of bouncing through a
 * Google Maps install prompt.
 */
export function buildMapUrl(place: Place): string {
  if (Platform.OS === 'ios') {
    const query = encodeURIComponent(place.name);
    if (place.lat !== undefined && place.lng !== undefined) {
      return `http://maps.apple.com/?q=${query}&ll=${place.lat},${place.lng}`;
    }
    return `http://maps.apple.com/?q=${query}`;
  }
  const destination = encodeURIComponent(place.name);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&destination_place_id=${place.id}`;
}

export function buildWriteReviewUrl(place: Place): string {
  return `https://search.google.com/local/writereview?placeid=${place.id}`;
}
