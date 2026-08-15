/**
 * Runtime configuration for the real (Google Places + Supabase) backend.
 * All three values must be present to use the real providers; App.tsx
 * falls back to the in-memory fixtures when any are missing so the app
 * stays runnable without deployment secrets.
 */
export interface AppConfig {
  googlePlacesApiKey?: string;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return {
    googlePlacesApiKey: env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
    supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
}

export function isRealBackendConfigured(config: AppConfig): boolean {
  return Boolean(config.googlePlacesApiKey && config.supabaseUrl && config.supabaseAnonKey);
}
