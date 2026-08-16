/**
 * Core domain types for the taste-engine. This module is pure — no I/O,
 * no timers, no randomness other than what's passed in via an injected seed.
 */

export type SwipeAction = 'nope' | 'been' | 'want';

export type PriceBand = '$' | '$$' | '$$$' | '$$$$';

export interface Place {
  id: string;
  name: string;
  category: string;
  tags: string[];
  priceBand: PriceBand;
  rating: number;
  distanceMeters: number;
  /** Primary hero photo. Used everywhere a single image is shown (collection
   * row, detail modal, onboarding tile) and as the first frame of the swipe
   * card's gallery. Always present, even when `photoUrls` is empty. */
  photoUrl: string;
  /**
   * Optional ordered gallery (hero first) shown as a tap-to-page carousel on
   * the swipe card, so a place is recognizable from more than one angle. When
   * absent or single-element, the card just shows `photoUrl`. Curated rows
   * carry several; hand-authored fixtures may carry one.
   */
  photoUrls?: string[];
  /**
   * Optional coordinates, present when the source provider has real geo data
   * (curated DB rows always do; hand-authored fixtures may omit them). The
   * collection map view skips any place missing these rather than guessing.
   */
  lat?: number;
  lng?: number;
}

export interface SwipeEvent {
  place: Place;
  action: SwipeAction;
  timestamp: number;
  /**
   * Optional 1-5 star rating, only meaningful on a 'been' event. Ratings are
   * deferrable: a 'been' event may land with no rating (skipped), then later
   * be amended via `applyRating` once the user submits one.
   */
  rating?: number;
  /**
   * Optional user-affirmed tags from an in-app review ("great ramen", "cozy"),
   * only meaningful on a 'been' event. Each is a subset of the place's own
   * tags; a review adds an extra positive nudge to those specific signals on
   * top of the rating weight (see `updateTaste`). Amended via `applyReview`,
   * and replay-safe because it lives in history like `rating`.
   */
  reviewTags?: string[];
}

/**
 * A sparse tag -> weight preference vector. Positive weight means the user
 * tends to like places carrying that tag; negative means they tend to avoid it.
 */
export type TasteVector = Record<string, number>;

export interface TasteGraph {
  vector: TasteVector;
  actionedPlaceIds: string[];
  history: SwipeEvent[];
  /** Submitted ratings (1-5) keyed by place id, retrievable independent of history order. */
  ratings: Record<string, number>;
}

export interface RankContext {
  /** Injected seed so ranking (the wildcard slice) is deterministic in tests. */
  seed: number;
  /** Fraction of the deck ordered by fit score vs. shuffled-in wildcards, e.g. 0.7. */
  fitRatio?: number;
  /**
   * Current epoch ms, injected for determinism (no Date.now() inside pure
   * functions). Used to decide whether a Nope's cooldown has elapsed. When
   * omitted, there's no time context to reason with, so all Nopes are
   * excluded (the safe default) -- callers in the app pass a real `now`.
   */
  now?: number;
  /**
   * How long a Nope suppresses a place from resurfacing, in ms. Defaults to
   * `DEFAULT_NOPE_COOLDOWN_MS`. Only meaningful when `now` is provided; a
   * value of 0 with `now` set immediately clears all Nopes (the "Reset seen"
   * escape hatch).
   */
  nopeCooldownMs?: number;
}
