# Swipe loop over fixtures with live taste-engine

> GitHub issue #2 | Labels: ready-for-agent, P0 | https://github.com/taigamura/nibble-app/issues/2

## Parent

#1 — Nibble MVP: taste-graph swipe app.

## What to build

The foundational tracer bullet: a runnable Expo / React Native iOS app where you can swipe a deck of **fixture** places and watch the taste graph respond — no Google, no Supabase, no LLM yet. This exists to prove the riskiest part of the product (does the engine feel smart + does the swipe feel good) before any external wiring.

End-to-end path: a card screen shows one fixture place at a time (photo, name, category, price band, rating, distance); the user swipes left = **Nope**, up = **Been**, right = **Want**, with equivalent tap-button affordances and an undo for the last swipe. Each action flows into the pure `taste-engine` module — `updateTaste(graph, event) → graph` and `rankDeck(graph, candidatePlaces, context) → orderedDeck` — which reorders the remaining deck using a ~70% fit / ~30% wildcard blend with an **injected seed**. State is held in an in-memory `Store` over a set of hardcoded fixture places. Actioned places never reappear in the session.

This slice establishes the single tested seam for the whole codebase: pure engine functions with all I/O behind injected provider interfaces (`PlacesProvider`, `EnrichmentProvider`, `Store`) that later slices implement for real.

## Acceptance criteria

- [ ] Expo/RN app launches on iOS and shows a swipeable card deck of fixture places.
- [ ] Card follows the finger and springs/snaps; left/up/right map to Nope/Been/Want; tap-buttons and undo work.
- [ ] `updateTaste` folds Nope/Been/Want events into a preference vector; Been weighted above Want above Nope.
- [ ] `rankDeck` orders candidates ~70/30 fit-vs-wildcard, deterministic under a fixed injected seed, and excludes already-actioned places.
- [ ] The deck visibly reorders across a session for a synthetic user with a known taste profile.
- [ ] `taste-engine` unit tests (in-memory fixtures, injected seed) cover `updateTaste`, `rankDeck`, the 70/30 split, cold-start, and the "improves with signal" property.
- [ ] `PlacesProvider`, `EnrichmentProvider`, `Store` exist as interfaces; this slice uses in-memory/fixture implementations only.

## Blocked by

None - can start immediately.

