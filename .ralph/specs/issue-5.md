# Issue #5: Rating flow (the gold ground-truth signal)

## Parent

#1 — Nibble MVP: taste-graph swipe app.

## What to build

The rating flow — the "gold" ground-truth signal. When a user marks a place **Been** (up-swipe or tap), prompt a quick, low-friction rating that can be deferred. A submitted rating flows into `updateTaste` with heavy weight relative to Want/Nope swipes, so a rated Been dominates photo-driven signals. The next deck visibly shifts in response.

End-to-end: Been action → quick rating UI → `updateTaste(graph, ratingEvent)` → reordered deck. Rating must be skippable without blocking the swipe loop, and a place's rating is retrievable for the collection/history views built later.

## Acceptance criteria

- [ ] Marking a place Been triggers a quick rating prompt that can be dismissed/deferred without blocking swiping.
- [ ] A submitted Been rating moves the preference vector more than a Want, which moves it more than a Nope.
- [ ] The deck measurably reorders after a few Been ratings for a synthetic user.
- [ ] Ratings persist in the `Store` and are retrievable per place.
- [ ] Engine tests cover the relative weighting of Been+rating vs Want vs Nope.

## Blocked by

- #2 — Swipe loop over fixtures with live taste-engine.

