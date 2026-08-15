# Google Maps handoff (directions + write-a-review)

> GitHub issue #8 | Labels: ready-for-agent, P1 | https://github.com/taigamura/nibble-app/issues/8

## Parent

#1 — Nibble MVP: taste-graph swipe app.

## What to build

The Google Maps handoff — the only Google *integration* (as opposed to data ingestion), since there is no API to write Google's saved lists. A place-detail screen (reachable from a card or a collection item) exposes two deep links into the Google Maps app: **directions** to the place, and **write a review** for a place the user has been to. The app hosts no reviews of its own; it routes the user to Maps where the review counts.

End-to-end: open a place → detail screen → tap Directions or Write Review → Google Maps opens to the right place/screen.

## Acceptance criteria

- [x] A place-detail screen is reachable from a swipe card and from collection items.
- [x] A Directions action deep-links into Google Maps navigation for that place.
- [x] A Write-a-review action deep-links into the Google Maps review screen for that place.
- [x] Handoff uses the stored Place ID; no live Google content is cached beyond TOS limits.
- [x] The app does not attempt to host reviews or write to Google saved lists.

## Blocked by

- #3 — Real place data: Google Places ingest + curated DB.

