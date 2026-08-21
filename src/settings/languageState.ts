import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Language } from '../i18n/language';

const DEFAULT_LANGUAGE_KEY = 'nibble.language.v1';

const VALID: readonly Language[] = ['system', 'ja', 'en'];

/**
 * Device-local record of the user's UI language preference (System / 日本語 /
 * English). Like `AppearanceState`, this is a per-device display concern, not
 * user data, so it's deliberately NOT cleared by "Reset all data".
 */
export class LanguageState {
  constructor(private readonly storageKey: string = DEFAULT_LANGUAGE_KEY) {}

  /** Resolves the stored preference, defaulting to 'ja' when unset/corrupt (the app defaults to Japanese). */
  async get(): Promise<Language> {
    const raw = await AsyncStorage.getItem(this.storageKey);
    return VALID.includes(raw as Language) ? (raw as Language) : 'ja';
  }

  /** Persists the chosen preference so later launches honor the same language. */
  async set(language: Language): Promise<void> {
    await AsyncStorage.setItem(this.storageKey, language);
  }
}
