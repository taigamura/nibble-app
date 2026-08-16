import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_ONBOARDING_KEY = 'nibble.onboarded.v1';

/**
 * Device-local record of whether the user has finished onboarding (the "been"
 * grid + location permission). This is deliberately *not* part of the `Store`
 * / `TasteGraph`: it is a per-device UI concern ("has this device seen the
 * intro?"), not per-account taste data, so it stays out of the cloud sync path
 * and is readable at cold start without an auth round-trip.
 *
 * Without this, `onboarded` lived only in React state (`useState(false)`), so
 * every cold start dropped the user back into onboarding.
 */
export class OnboardingState {
  constructor(private readonly storageKey: string = DEFAULT_ONBOARDING_KEY) {}

  /** Resolves `true` once the user has completed onboarding on this device. */
  async hasOnboarded(): Promise<boolean> {
    const raw = await AsyncStorage.getItem(this.storageKey);
    return raw === 'true';
  }

  /** Persists that onboarding is complete so later launches skip straight to the deck. */
  async setOnboarded(): Promise<void> {
    await AsyncStorage.setItem(this.storageKey, 'true');
  }

  /** Clears the flag (e.g. for a full local reset), sending the next launch back to onboarding. */
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(this.storageKey);
  }
}
