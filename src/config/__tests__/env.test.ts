jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: {} } },
}));

import Constants from 'expo-constants';

import {
  isMisconfiguredRelease,
  isRealBackendConfigured,
  loadConfig,
  missingBackendKeys,
  type AppConfig,
} from '../env';

const FULL: AppConfig = {
  googlePlacesApiKey: 'key',
  supabaseUrl: 'https://x.supabase.co',
  supabaseAnonKey: 'anon',
};

describe('loadConfig', () => {
  it('reads the three EXPO_PUBLIC vars from the injected env', () => {
    expect(
      loadConfig({
        EXPO_PUBLIC_GOOGLE_PLACES_API_KEY: 'g',
        EXPO_PUBLIC_SUPABASE_URL: 'u',
        EXPO_PUBLIC_SUPABASE_ANON_KEY: 'a',
      }),
    ).toEqual({ googlePlacesApiKey: 'g', supabaseUrl: 'u', supabaseAnonKey: 'a' });
  });

  it('defaults to the backend keys baked into the manifest extra (release builds)', () => {
    // In an EAS local release build process.env.EXPO_PUBLIC_* is undefined at
    // bundle time; the values survive in Constants.expoConfig.extra instead.
    const original = Constants.expoConfig;
    (Constants as { expoConfig: unknown }).expoConfig = {
      extra: {
        googlePlacesApiKey: 'g-extra',
        supabaseUrl: 'u-extra',
        supabaseAnonKey: 'a-extra',
      },
    };

    try {
      expect(loadConfig()).toEqual({
        googlePlacesApiKey: 'g-extra',
        supabaseUrl: 'u-extra',
        supabaseAnonKey: 'a-extra',
      });
    } finally {
      (Constants as { expoConfig: unknown }).expoConfig = original;
    }
  });
});

describe('isRealBackendConfigured', () => {
  it('is true only when all three keys are present', () => {
    expect(isRealBackendConfigured(FULL)).toBe(true);
    expect(isRealBackendConfigured({ ...FULL, supabaseUrl: undefined })).toBe(false);
    expect(isRealBackendConfigured({})).toBe(false);
  });
});

describe('missingBackendKeys', () => {
  it('lists exactly the absent EXPO_PUBLIC var names', () => {
    expect(missingBackendKeys(FULL)).toEqual([]);
    expect(missingBackendKeys({ googlePlacesApiKey: 'g' })).toEqual([
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    ]);
  });
});

describe('isMisconfiguredRelease', () => {
  it('blocks a release build that is missing backend config', () => {
    expect(isMisconfiguredRelease({}, /* isDev */ false)).toBe(true);
  });

  it('does not block a dev build (fixture fallback is intentional)', () => {
    expect(isMisconfiguredRelease({}, /* isDev */ true)).toBe(false);
  });

  it('does not block a release build that is fully configured', () => {
    expect(isMisconfiguredRelease(FULL, /* isDev */ false)).toBe(false);
  });
});
