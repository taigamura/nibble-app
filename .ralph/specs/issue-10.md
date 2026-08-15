# Radius / area context control

> GitHub issue #10 | Labels: ready-for-agent, P2 | https://github.com/taigamura/nibble-app/issues/10

## Parent

#1 — Nibble MVP: taste-graph swipe app.

## What to build

Radius / area context control so the deck isn't locked to "1km around me right now." Add UI to widen the radius or relocate the deck's center to a different area ("I'm headed to Shimokitazawa Saturday"). `rankDeck` already takes a `context`; this slice lets the user set that context, and the deck re-serves real places for the chosen area/radius while keeping the same 70/30 fit-vs-wildcard ordering.

End-to-end: change radius/area → deck re-queries the curated DB for that context → cards update.

## Acceptance criteria

- [x] The user can widen/narrow the deck radius from the default ~1km.
- [x] The user can move the deck's center to a different central-Tokyo area.
- [x] The deck re-serves places for the selected context and honors the same fit/wildcard ordering.
- [x] Changing context does not corrupt the taste graph (context affects candidate set, not learned taste).

## Blocked by

- #3 — Real place data: Google Places ingest + curated DB.

