# Ralph Fix Plan (queue item)

## Current Task
- [x] Implement GitHub issue #10
  - Spec: .ralph/specs/issue-10.md

Notes: Added `DeckContext` (`center?`, `radiusMeters?`) to `PlacesProvider.getCandidates`,
wired through `SupabasePlacesProvider` (overrides `getUserLocation`/`radiusMeters` when
given) and `FixturePlacesProvider` (accepted for interface parity, no-op). New
`src/config/areas.ts` holds the central-Tokyo area list + radius presets. New
`DeckContextControl` modal lets the user pick radius/area from `SwipeScreen`, which
re-fetches candidates on context change without touching `graph` state. Verify gate
(`npm run typecheck`, `npm test`) is green.
