import type { GeoPoint } from '../providers/types';

export interface Area {
  id: string;
  name: string;
  center: GeoPoint;
}

/**
 * Named central-Tokyo areas the user can re-center the deck on (issue #10).
 * Coordinates are the area's station/center point -- close enough for a
 * "deck center", not meant for turn-by-turn precision.
 */
export const CENTRAL_TOKYO_AREAS: Area[] = [
  { id: 'shibuya', name: 'Shibuya', center: { lat: 35.6595, lng: 139.7005 } },
  { id: 'shimokitazawa', name: 'Shimokitazawa', center: { lat: 35.6613, lng: 139.6683 } },
  { id: 'ebisu', name: 'Ebisu', center: { lat: 35.6467, lng: 139.71 } },
  { id: 'nakameguro', name: 'Nakameguro', center: { lat: 35.6438, lng: 139.6989 } },
  { id: 'shinjuku', name: 'Shinjuku', center: { lat: 35.6896, lng: 139.6995 } },
  { id: 'kichijoji', name: 'Kichijoji', center: { lat: 35.7032, lng: 139.5798 } },
];

/** Radius presets offered by the deck's context control, widest last. */
export const RADIUS_OPTIONS_METERS = [500, 1000, 2000, 5000] as const;

export const DEFAULT_RADIUS_METERS = 1000;
