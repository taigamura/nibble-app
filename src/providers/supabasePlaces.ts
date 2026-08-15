import type { Place } from '../taste-engine';
import { toPlace, type CuratedPlaceRow, type GeoPoint } from './curatedPlace';
import type { PlacesProvider } from './types';

const DEFAULT_RADIUS_METERS = 1000;
/** Rough meters-per-degree-latitude, used only to size the cheap SQL bounding-box
 * pre-filter; the exact radius cut happens client-side via haversineMeters. */
const METERS_PER_DEGREE_LAT = 111_000;

export interface SupabasePlacesProviderOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  googlePlacesApiKey: string;
  /** Injected so callers (and tests) control where "nearby" is measured from. */
  getUserLocation: () => Promise<GeoPoint>;
  /** Injected fetch, defaulting to the global — mirrors the taste-engine's injected-seed pattern for testability. */
  fetchImpl?: typeof fetch;
  radiusMeters?: number;
}

/**
 * Serves the swipe deck from the curated Supabase `places` table, filtered
 * to a radius around the user. Google is never called from this class —
 * hero photo URLs are pure string constructions (see curatedPlace.ts) that
 * only resolve into an actual network request when the card's <Image>
 * mounts, keeping live Google calls on-demand rather than deck-wide.
 */
export class SupabasePlacesProvider implements PlacesProvider {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: SupabasePlacesProviderOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async getCandidates(): Promise<Place[]> {
    const {
      supabaseUrl,
      supabaseAnonKey,
      googlePlacesApiKey,
      getUserLocation,
      radiusMeters = DEFAULT_RADIUS_METERS,
    } = this.options;

    const location = await getUserLocation();
    const degreeSpan = radiusMeters / METERS_PER_DEGREE_LAT;

    const url = new URL(`${supabaseUrl}/rest/v1/places`);
    url.searchParams.set('select', '*');
    url.searchParams.append('lat', `gte.${location.lat - degreeSpan}`);
    url.searchParams.append('lat', `lte.${location.lat + degreeSpan}`);
    url.searchParams.append('lng', `gte.${location.lng - degreeSpan}`);
    url.searchParams.append('lng', `lte.${location.lng + degreeSpan}`);

    const response = await this.fetchImpl(url.toString(), {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Supabase places query failed with status ${response.status}`);
    }

    const rows = (await response.json()) as CuratedPlaceRow[];

    return rows
      .map((row) => toPlace(row, location, googlePlacesApiKey))
      .filter((place) => place.distanceMeters <= radiusMeters)
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
  }
}
