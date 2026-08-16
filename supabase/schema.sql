-- Curated places table backing SupabasePlacesProvider + scripts/ingestPlaces.ts.
--
-- `place_id` and `tags` are the only permanently-owned data (our own
-- enrichment tags land here via issue #4). `rating`, `price_band`, and
-- `photo_reference` are Google-sourced cacheable fields refreshed on a
-- <=30-day cycle per Google Places TOS -- never treat them as permanent.
create table if not exists places (
  place_id text primary key,
  name text not null,
  category text not null,
  tags jsonb not null default '[]'::jsonb,
  price_band text not null,
  rating numeric not null default 0,
  lat double precision not null,
  lng double precision not null,
  photo_reference text,
  -- Ordered gallery of Google photo references (hero first) powering the swipe
  -- card's multi-photo carousel. `photo_reference` remains the first element
  -- for one-image readers; refreshed on the same <=30-day Google TOS cycle.
  photo_references jsonb not null default '[]'::jsonb,
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Backfill the column on tables created before the gallery existed.
alter table places add column if not exists photo_references jsonb not null default '[]'::jsonb;

create index if not exists places_lat_lng_idx on places (lat, lng);

-- `places` is curated, non-personal public data. RLS is enabled to match
-- Supabase's secure-by-default posture, with a single permissive policy that
-- lets the app's anon (and authenticated) role read the deck. Writes stay
-- restricted to the service-role key used by scripts/ingestPlaces.ts, which
-- bypasses RLS -- so no write policy is needed here. Without this policy the
-- anon SELECT returns zero rows (no error), which surfaces as an empty deck.
alter table places enable row level security;

drop policy if exists "Places are publicly readable" on places;
create policy "Places are publicly readable"
  on places
  for select
  using (true);

-- One row per signed-in user, backing SupabaseStore (issue #9). Anonymous
-- users never get a row here -- their graph stays in on-device AsyncStorage
-- (see src/providers/localStore.ts) until they sign in with Apple, at which
-- point migrateLocalDataToCloud merges local history into this table.
create table if not exists taste_graphs (
  user_id uuid primary key references auth.users (id) on delete cascade,
  graph jsonb not null default '{"vector":{},"actionedPlaceIds":[],"history":[],"ratings":{}}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table taste_graphs enable row level security;

create policy "Users manage their own taste graph"
  on taste_graphs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
