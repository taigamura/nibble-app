// Dynamic app config that bridges the backend keys from the build environment
// into `extra`, so they are embedded in the standalone app manifest
// (EXConstants.bundle/app.config) and readable at runtime via `expo-constants`
// -- see src/config/env.ts.
//
// Why this exists instead of relying on `process.env.EXPO_PUBLIC_*` inlining:
// in an EAS *local* build the hosted environment variables reach eas-cli's
// app-config resolution step (where this function runs) but do NOT propagate
// into Xcode's "Bundle React Native code and images" phase. So at Metro bundle
// time `process.env.EXPO_PUBLIC_*` is undefined and babel-preset-expo inlines
// it as `undefined` -- the app then silently fell back to fixture data and
// shipped generic photos to TestFlight. Resolving the values here, where they
// ARE present, and reading them back through `Constants.expoConfig.extra`
// closes that gap. All other config still lives in app.json.
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    googlePlacesApiKey: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY,
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  },
});
