# Ralph Fix Plan (queue item)

## Current Task
- [x] Implement GitHub issue #3
  - Spec: .ralph/specs/issue-3.md

## Loop #8 (2026-08-15): issue #3 implemented — real place data, code-complete

Added a real `PlacesProvider` behind the existing interface (architecture
fence respected, taste-engine untouched):

- `src/providers/curatedPlace.ts` — pure mapping/distance/photo-URL helpers,
  including the <=30-day Google-content refresh check (TOS compliance:
  only `place_id` + our own `tags` are permanent).
- `src/providers/supabasePlaces.ts` — `SupabasePlacesProvider`, queries the
  curated Supabase `places` table via PostgREST within a radius (default
  1km) of an injected `getUserLocation`, sorted by distance. Hero photo
  URLs are pure string constructions pointing at Google's Photo media
  endpoint; they only trigger a real network fetch when a card's `<Image>`
  actually mounts (SwipeScreen already mounts just the top two cards), so
  Google is called lazily/on-demand rather than for the whole deck.
- `scripts/ingestPlaces.ts` — re-runnable one-time ingest: Google Places
  (New) `searchNearby` over 5 seed points across the
  Shibuya-Meguro-Setagaya belt, upserts into Supabase, skips rows refreshed
  within 30 days unless `--force`.
- `supabase/schema.sql` — curated `places` table.
- `src/config/env.ts` + `.env.example` — `EXPO_PUBLIC_*` env vars select
  the real provider; `App.tsx` falls back to `FixturePlacesProvider` when
  unset so the app stays runnable without secrets.
- Tests for all new pure logic (distance, photo URL, refresh cutoff, row
  mapping, radius filtering, error handling): 23/23 passing.

**What could not be done in this sandbox:** the sandbox has no Google
Places API key, no Supabase project, and outbound network calls (`curl`
etc., beyond the `npm` registry) require interactive approval that isn't
available in an unattended loop — so the one-time ingest could not actually
be *run* against live services this loop. The code is written and tested
against the documented Google Places (New) and Supabase PostgREST APIs,
and falls back safely (fixtures) when unconfigured. Running
`scripts/ingestPlaces.ts` with real credentials (see `.env.example`) is an
operational step for whoever provisions the Supabase project + API key.

Verify gate: `npm run typecheck` clean, `npm test` 23/23 passing,
`npx expo export --platform ios` succeeds.
