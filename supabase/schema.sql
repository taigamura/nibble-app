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
  refreshed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists places_lat_lng_idx on places (lat, lng);

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
