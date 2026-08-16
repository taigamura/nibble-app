import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Appearance } from '../theme';

const DEFAULT_APPEARANCE_KEY = 'nibble.appearance.v1';

const VALID: readonly Appearance[] = ['system', 'light', 'dark'];

/**
 * Device-local record of the user's appearance preference (System / Light /
 * Dark). Like `OnboardingState`, this is a per-device UI concern, not
 * per-account taste data, so it stays out of the cloud sync path and is
 * readable at cold start without an auth round-trip -- read early so the app
 * paints in the chosen scheme instead of flashing light first.
 *
 * Deliberately NOT cleared by "Reset all data": appearance is a device display
 * preference, not user data (see the settings spec).
 */
export class AppearanceState {
  constructor(private readonly storageKey: string = DEFAULT_APPEARANCE_KEY) {}

  /** Resolves the stored preference, defaulting to 'system' when unset/corrupt. */
  async get(): Promise<Appearance> {
    const raw = await AsyncStorage.getItem(this.storageKey);
    return VALID.includes(raw as Appearance) ? (raw as Appearance) : 'system';
  }

  /** Persists the chosen preference so later launches paint in the same scheme. */
  async set(appearance: Appearance): Promise<void> {
    await AsyncStorage.setItem(this.storageKey, appearance);
  }
}
