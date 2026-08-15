# Real place data: Google Places ingest + curated DB

> GitHub issue #3 | Labels: ready-for-agent, P0 | https://github.com/taigamura/nibble-app/issues/3

## Parent

#1 — Nibble MVP: taste-graph swipe app.

## What to build

Replace the fixture places from #2 with real central-Tokyo place data served from our own curated DB. A one-time ingestion pulls cafes + restaurants in the beachhead area (Shibuya–Meguro–Setagaya belt) via a real `PlacesProvider` (Google Places) into a Supabase-backed `Store`, storing **Place IDs and structured place records permanently** and refreshing Google's cacheable content fields on a rolling ≤30-day cycle (TOS compliance).

The swipe deck now serves real places within a ~1km radius of the user, ordered by the same `taste-engine` from #2. Hero photos are fetched **lazily** — one per card as it surfaces, not the whole deck up front — and a live Google call happens only on demand. The app's `Store` is the source of truth for places and (later) user data.

## Acceptance criteria

- [ ] A one-time ingest populates Supabase with real central-Tokyo cafes + restaurants (Place IDs stored permanently). — script written + tested (`scripts/ingestPlaces.ts`), but not run against a live Google/Supabase project: this sandbox has no API key, no Supabase project, and no unattended network egress. Left unchecked; running it is an operational step (see `.env.example`).
- [x] `PlacesProvider` implements search/details/photos against Google Places; cacheable fields refreshed on a ≤30-day cycle.
- [x] The swipe deck serves real places from the curated DB within ~1km of the user's location.
- [x] Hero photos load lazily per surfaced card; the deck stays smooth and does not pre-fetch the whole set.
- [x] Live Google calls occur only on intent (surfacing a card's photo / opening a place), not on every deck computation.
- [x] The `taste-engine` from #2 consumes real place records unchanged (providers swapped, engine untouched).

## Blocked by

- #2 — Swipe loop over fixtures with live taste-engine.

