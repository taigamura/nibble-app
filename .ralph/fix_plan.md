# Ralph Fix Plan (queue item)

## Current Task
- [x] Implement GitHub issue #8
  - Spec: .ralph/specs/issue-8.md

Notes:
- Added src/screens/googleMapsLinks.ts with buildDirectionsUrl / buildWriteReviewUrl pure helpers (tested), keyed off the stored Google Place ID only.
- PlaceDetailModal now renders Directions / Write a review buttons that call Linking.openURL with those helpers.
- Card gained an optional onInfoPress affordance (ⓘ button) so the swipe screen can open the same PlaceDetailModal that Collection already used.
