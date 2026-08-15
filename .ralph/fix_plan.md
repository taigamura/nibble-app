# Ralph Fix Plan (queue item)

## Current Task
- [x] Implement GitHub issue #7
  - Spec: .ralph/specs/issue-7.md

Notes: Collection & history landed as a new `src/collection/` pure-selector
module (`getWantPlaces`, `getBeenEntries`, `getBeenCategoryStats`,
`getMapPoints` — all derived straight from `TasteGraph.history`/`ratings`, no
separate collection store) plus `mapProjection.ts` (pure lat/lng ->
0-1-square projection, unit tested). `Place` gained optional `lat`/`lng`
(`src/taste-engine/types.ts`); `curatedPlace.ts#toPlace` now carries them
through from curated rows, and fixtures got approximate real Tokyo
coordinates so the map has something to plot in fixture/dev mode. UI:
`CollectionScreen.tsx` (Want/Been/Map tabs + Been category-count chips),
`CollectionMap.tsx` (custom-drawn pin canvas — deliberately not
react-native-maps, which needs a config plugin and a native build this repo
can't verify headlessly), and `PlaceDetailModal.tsx` (shared detail sheet for
list rows and map pins). Wired into `App.tsx` behind a new bottom Swipe/
Collection tab bar, sharing the existing `store` instance so it reflects
same-session swipes immediately. Verify gate: `tsc --noEmit` clean, full
jest suite green (61 tests), `expo export --platform ios` builds.
