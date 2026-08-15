# Ralph Fix Plan (queue item)

## Current Task
- [x] Implement GitHub issue #5
  - Spec: .ralph/specs/issue-5.md

Notes: Implemented the rating flow end-to-end. `updateTaste`/`applyRating` in
`src/taste-engine/updateTaste.ts` weight a rated Been (1-5 stars, centered on
3 as neutral) so a good rating outweighs a Want and a bad one goes more
negative than a Nope; ratings live in `TasteGraph.ratings` (keyed by place
id) and persist through the existing `Store.saveGraph`/`getGraph`, so no new
Store methods were needed. `SwipeScreen` shows a new `RatingPrompt` overlay
after a Been swipe (bottom-strip, `pointerEvents="box-none"`, Skip button) that
never blocks the card underneath. Engine tests cover the weighting hierarchy
and a deck-reorder scenario.
