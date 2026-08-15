import * as Location from 'expo-location';

import type { GeoPoint, LocationProvider } from './types';

/**
 * Requests foreground location permission and reads the device's current
 * position via expo-location. Any denial, error, or missing permission
 * resolves to `null` rather than throwing, so callers (the onboarding grid)
 * can fall back to an unfiltered/default view instead of blocking the user.
 */
export class ExpoLocationProvider implements LocationProvider {
  async getCurrentLocation(): Promise<GeoPoint | null> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }
      const position = await Location.getCurrentPositionAsync({});
      return { lat: position.coords.latitude, lng: position.coords.longitude };
    } catch {
      return null;
    }
  }
}
