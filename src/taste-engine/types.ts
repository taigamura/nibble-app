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
  photoUrl: string;
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
}
