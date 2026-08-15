export interface GeoCoord {
  lat: number;
  lng: number;
}

export interface ProjectedPoint {
  /** 0-1 horizontal position within the plotted bounds. */
  x: number;
  /** 0-1 vertical position within the plotted bounds (0 = north/top). */
  y: number;
}

const SINGLE_POINT_CENTER = 0.5;

/**
 * Projects lat/lng coordinates onto a 0-1 square via a simple equirectangular
 * (linear) fit to the points' own bounding box — no map tiles, no native
 * dependency. Good enough for "roughly where these places sit relative to
 * each other," which is all the collection map view needs. A single point,
 * or points sharing one axis, is centered on that axis rather than dividing
 * by a zero-width/height span.
 */
export function projectPoints(coords: GeoCoord[]): ProjectedPoint[] {
  if (coords.length === 0) return [];

  const lats = coords.map((c) => c.lat);
  const lngs = coords.map((c) => c.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = maxLat - minLat;
  const lngSpan = maxLng - minLng;

  return coords.map(({ lat, lng }) => ({
    x: lngSpan === 0 ? SINGLE_POINT_CENTER : (lng - minLng) / lngSpan,
    // Latitude increases northward; screen y increases downward, so flip it.
    y: latSpan === 0 ? SINGLE_POINT_CENTER : (maxLat - lat) / latSpan,
  }));
}
