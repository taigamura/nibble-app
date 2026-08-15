# Ralph Fix Plan (queue item)

## Current Task
- [x] Implement GitHub issue #6
  - Spec: .ralph/specs/issue-6.md

Notes: Onboarding "been" grid landed as `src/screens/OnboardingScreen.tsx` (wired
in App.tsx ahead of SwipeScreen), backed by a new `LocationProvider` interface
(`src/providers/types.ts`) + `ExpoLocationProvider` (`src/providers/location.ts`,
using the newly added `expo-location` dependency) and a pure
`seedBeenSignals` helper (`src/onboarding/seedBeenSignals.ts`) that folds
selected places into `updateTaste` as Been events. Location permission is
requested once per session via a memoized resolver in App.tsx and reused by
both onboarding and the real Supabase-backed places provider; denial/GPS
failure degrades to a default Shibuya coordinate rather than blocking. Added
the `expo-location` config plugin to app.json with a rationale string.
