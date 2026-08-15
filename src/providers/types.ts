import type { Place, TasteGraph } from '../taste-engine';

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Sources the deck of candidate places for a session. The fixture
 * implementation is in-memory; issue #3 adds a real Google Places-backed
 * implementation behind this same interface.
 */
export interface PlacesProvider {
  getCandidates(): Promise<Place[]>;
}

/**
 * Requests OS location permission and resolves the device's current
 * position. Resolves to `null` (rather than throwing) when permission is
 * denied or location is otherwise unavailable, so onboarding can degrade
 * gracefully instead of blocking the user from reaching the deck.
 */
export interface LocationProvider {
  getCurrentLocation(): Promise<GeoPoint | null>;
}

/**
 * Produces taste tags for a place (LLM-derived vibe/flavor tags in the real
 * implementation). The no-op implementation passes through whatever tags
 * the place already carries; issue #4 adds the LLM-backed implementation.
 */
export interface EnrichmentProvider {
  enrich(place: Place): Promise<string[]>;
}

/**
 * Persists session state (taste graph). The in-memory implementation lives
 * only for the process lifetime; a later slice can back this with device
 * storage or Supabase without changing call sites.
 */
export interface Store {
  getGraph(): Promise<TasteGraph>;
  saveGraph(graph: TasteGraph): Promise<void>;
}
