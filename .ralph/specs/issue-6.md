# Onboarding 'been' grid + location permission

> GitHub issue #6 | Labels: ready-for-agent, P1 | https://github.com/taigamura/nibble-app/issues/6

## Parent

#1 — Nibble MVP: taste-graph swipe app.

## What to build

The cold-start onboarding: a fast "tap everywhere you've been" grid that seeds the taste graph with real ground truth before the first swipe. On first launch, request location permission (with a clear reason), then show a location-aware grid of popular/nearby central-Tokyo places; the user taps everywhere they've already been in ~60–90 seconds. Each tap is folded into `updateTaste` as a Been signal so the deck already feels informed on the first card.

The grid must feel like a quick game, be skippable/shortenable, and never block reaching the deck.

## Acceptance criteria

- [x] First launch requests location permission with a clear rationale and degrades gracefully if denied.
- [x] A grid of popular/nearby real places lets the user multi-tap their visited spots quickly.
- [x] Tapped places seed the graph as Been signals via `updateTaste`.
- [x] The grid is skippable and shortenable; the user is never blocked from the swipe deck.
- [x] After completing the grid, the first deck reflects the seeded taste (not a cold/random order).

## Blocked by

- #3 — Real place data: Google Places ingest + curated DB.

