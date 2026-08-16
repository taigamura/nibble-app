import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GeoPoint } from '../providers/types';

const DEFAULT_HOME_LOCATION_KEY = 'nibble.homeLocation.v1';

/** Guards against corrupt/partial JSON in storage before trusting a parsed value as a GeoPoint. */
function isValidGeoPoint(value: unknown): value is GeoPoint {
  if (value === null || typeof value !== 'object') return false;
  const candidate = value as Partial<GeoPoint>;
  return Number.isFinite(candidate.lat) && Number.isFinite(candidate.lng);
}

/**
 * Device-local record of the user's single "Home" location: a frozen GPS
 * snapshot the user opts into (via "Use current location as Home"), not a
 * live-tracked position. Surfaces as a selectable chip in the deck's area
 * picker.
 *
 * Unlike `AppearanceState` (a display preference deliberately preserved
 * across resets), Home is user location data, so it IS cleared by
 * "Reset all data".
 */
export class HomeLocationState {
  constructor(private readonly storageKey: string = DEFAULT_HOME_LOCATION_KEY) {}

  /** Resolves the stored Home point, or `null` when unset or the stored JSON is corrupt/invalid. */
  async get(): Promise<GeoPoint | null> {
    const raw = await AsyncStorage.getItem(this.storageKey);
    if (raw === null) return null;

    try {
      const parsed = JSON.parse(raw);
      return isValidGeoPoint(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  /** Freezes the given point as the user's Home location. */
  async set(point: GeoPoint): Promise<void> {
    await AsyncStorage.setItem(this.storageKey, JSON.stringify(point));
  }

  /** Un-sets Home entirely (e.g. "Clear Home" or "Reset all data"). */
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(this.storageKey);
  }
}
