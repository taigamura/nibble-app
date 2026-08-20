/**
 * Runtime configuration for the real (Google Places + Supabase) backend.
 * All three values must be present to use the real providers; App.tsx
 * falls back to the in-memory fixtures when any are missing so the app
 * stays runnable without deployment secrets.
 */
import Constants from 'expo-constants';

export interface AppConfig {
  googlePlacesApiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

function nonEmpty(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

/**
 * The default source for {@link loadConfig}: the backend keys baked into the
 * app manifest's `extra` at build time (see `app.config.js`), falling back to
 * the statically-inlined `process.env.EXPO_PUBLIC_*` values for Metro-served
 * dev builds (Expo Go, `expo start`).
 *
 * The `extra` path is what makes EAS *local* release builds work: at Metro
 * bundle time `process.env.EXPO_PUBLIC_*` is undefined there (the hosted env
 * vars don't reach Xcode's bundle phase), so it would inline as `undefined`.
 * `app.config.js` captures the values earlier, where they ARE present.
 */
function manifestEnv(): Record<string, string | undefined> {
  const extra = (Constants.expoConfig?.extra ?? {}) as Record<string, unknown>;
  return {
    EXPO_PUBLIC_GOOGLE_PLACES_API_KEY:
      nonEmpty(extra.googlePlacesApiKey) ?? process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
    EXPO_PUBLIC_SUPABASE_URL: nonEmpty(extra.supabaseUrl) ?? process.env.EXPO_PUBLIC_SUPABASE_URL,
    EXPO_PUBLIC_SUPABASE_ANON_KEY:
      nonEmpty(extra.supabaseAnonKey) ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function loadConfig(env: Record<string, string | undefined> = manifestEnv()): AppConfig {
  return {
    googlePlacesApiKey: env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
    supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function isRealBackendConfigured(config: AppConfig): boolean {
  return Boolean(config.googlePlacesApiKey && config.supabaseUrl && config.supabaseAnonKey);
}

/** Names of the backend vars that are missing from `config`, for diagnostics. */
export function missingBackendKeys(config: AppConfig): string[] {
  const missing: string[] = [];
  if (!config.googlePlacesApiKey) missing.push('EXPO_PUBLIC_GOOGLE_PLACES_API_KEY');
  if (!config.supabaseUrl) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!config.supabaseAnonKey) missing.push('EXPO_PUBLIC_SUPABASE_ANON_KEY');
  return missing;
}

/**
 * The fail-loud tripwire. True when a *release* build (not the Metro dev
 * client) is about to fall back to fixture data because the real backend
 * isn't configured. A fixture build reaching TestFlight/App Store is always a
 * mistake -- it once shipped generic photos and wrong-area places because the
 * `EXPO_PUBLIC_*` vars were undefined at bundle time -- so App.tsx renders a
 * blocking error screen instead of silently degrading. In dev the fixture
 * fallback is intentional (no `.env` needed to run), so this stays false.
 *
 * `isDev` is injected (defaulting to the React Native `__DEV__` global) so
 * tests can drive both branches without a native build.
 */
export function isMisconfiguredRelease(
  config: AppConfig,
  isDev: boolean = typeof __DEV__ !== 'undefined' ? __DEV__ : false,
): boolean {
  return !isDev && !isRealBackendConfigured(config);
}
