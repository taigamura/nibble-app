import type { Place, TasteGraph } from '../taste-engine';

export interface GeoPoint {
  lat: number;
  lng: number;
}

/**
 * Where the deck is centered and how far it reaches (issue #10). Both fields
 * are optional so a caller can override just the radius, just the center, or
 * neither -- providers fall back to their own default location/radius when a
 * field is omitted. Only affects the candidate set fetched from
 * `PlacesProvider`; it is never persisted into `TasteGraph`, so switching
 * context can never corrupt learned taste.
 */
export interface DeckContext {
  center?: GeoPoint;
  radiusMeters?: number;
}

/**
 * Sources the deck of candidate places for a session. The fixture
 * implementation is in-memory; issue #3 adds a real Google Places-backed
 * implementation behind this same interface. `context` (issue #10) lets the
 * caller widen/narrow the radius or re-center the deck on a different area.
 */
export interface PlacesProvider {
  getCandidates(context?: DeckContext): Promise<Place[]>;
}

/**
 * Requests OS location permission and resolves the device's current
 * position. Resolves to `null` (rather than throwing) when permission is
 * denied or location is otherwise unavailable, so onboarding can degrade
 * gracefully instead of blocking the user from reaching the deck.
 */
export interface LocationProvider {
  getCurrentLocation(): Promise<GeoPoint | null>;
  /** Reads the current foreground-location permission WITHOUT prompting. */
  getPermissionStatus(): Promise<LocationPermissionStatus>;
}

export type LocationPermissionStatus = 'granted' | 'denied' | 'undetermined';

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
 * only for the process lifetime; `LocalStore` (issue #9) backs this with
 * on-device storage for anonymous users, and `SupabaseStore` backs it with
 * the cloud for signed-in ones, without changing call sites.
 */
export interface Store {
  getGraph(): Promise<TasteGraph>;
  saveGraph(graph: TasteGraph): Promise<void>;
}

/** An authenticated identity, scoping which cloud `Store` rows belong to this user. */
export interface AuthSession {
  userId: string;
  accessToken: string;
}

/**
 * Anonymous-first auth (issue #9): a new user never sees this until they
 * choose to sign in. `getSession` restores a previously-established session
 * (e.g. after an app restart); it resolves to `null` rather than throwing
 * when there is none, mirroring `LocationProvider`'s graceful-degrade shape.
 */
export interface AuthProvider {
  getSession(): Promise<AuthSession | null>;
  signInWithApple(): Promise<AuthSession>;
  /** Clears the current session locally (in-memory + persisted). Does not revoke the token server-side. */
  signOut(): Promise<void>;
}
