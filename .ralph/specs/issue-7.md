# Collection & history (Want / Been lists, stats, map)

> GitHub issue #7 | Labels: ready-for-agent, P1 | https://github.com/taigamura/nibble-app/issues/7

## Parent

#1 — Nibble MVP: taste-graph swipe app.

## What to build

The collection and history surfaces that make the graph feel like a growing personal artifact — and Nibble's answer to "the app's own list is the source of truth." Two persistent lists from swipe actions: a **Want** list (everywhere swiped right) and a **Been** food-history (everywhere marked visited, with ratings from #4 when present). Add simple category stats (counts by cuisine/type — cafes, ramen, sushi…) and a map view showing both Want and Been places.

End-to-end: swipe/rating actions persist to the `Store`; the collection screens read from it; the map plots the same records.

## Acceptance criteria

- [x] A Want list shows every right-swiped place and persists across sessions.
- [x] A Been list shows every visited place (with rating when available) and persists across sessions.
- [x] Simple category stats summarize the Been history (counts by type).
- [x] A map view plots Want and Been places, visually distinguishable.
- [x] Opening any collection item shows its place detail.
- [x] The lists are the source of truth (independent of any Google saved list).

## Blocked by

- #2 — Swipe loop over fixtures with live taste-engine.

