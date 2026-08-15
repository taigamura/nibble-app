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
