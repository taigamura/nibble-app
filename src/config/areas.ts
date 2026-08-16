import type { GeoPoint } from '../providers/types';

export interface Area {
  id: string;
  name: string;
  center: GeoPoint;
}

/**
 * Named east-Tokyo areas the user can re-center the deck on (issue #10).
 * These cover the Kinshicho / Sumida beachhead around the default deck
 * center, and line up with the ingest seed points in scripts/ingestPlaces.ts
 * so every preset has curated places behind it. Coordinates are the area's
 * station/center point -- close enough for a "deck center", not meant for
 * turn-by-turn precision.
 */
export const DECK_AREAS: Area[] = [
  { id: 'kinshicho', name: 'Kinshicho', center: { lat: 35.6969, lng: 139.8146 } },
  { id: 'kameido', name: 'Kameido', center: { lat: 35.6976, lng: 139.8267 } },
  { id: 'ryogoku', name: 'Ryogoku', center: { lat: 35.6958, lng: 139.7933 } },
  { id: 'oshiage', name: 'Oshiage', center: { lat: 35.7101, lng: 139.8107 } },
  { id: 'sumiyoshi', name: 'Sumiyoshi', center: { lat: 35.6839, lng: 139.8175 } },
];

/** Radius presets offered by the deck's context control, widest last. */
export const RADIUS_OPTIONS_METERS = [500, 1000, 2000, 5000] as const;

export const DEFAULT_RADIUS_METERS = 1000;
