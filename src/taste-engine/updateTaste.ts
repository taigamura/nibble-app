import type { Place, SwipeAction, SwipeEvent, TasteGraph } from './types';

/**
 * Been is the strongest positive signal (you actually went), Want is a
 * weaker positive signal (you'd like to), Nope is negative. A rated Been
 * (see RATING_NEUTRAL/RATING_STEP below) overrides this base weight — the
 * gold ground-truth signal should dominate photo-driven Want/Nope swipes.
 */
const ACTION_WEIGHT: Record<SwipeAction, number> = {
  been: 2,
  want: 1,
  nope: -1,
};

/**
 * A submitted Been rating is centered on 3 stars (neutral, ~equivalent to no
 * signal) and scaled so a great visit (4-5 stars) outweighs even a Want, while
 * a bad one (1-2 stars) pushes the vector negative harder than a Nope — you
 * actually went and it was bad, which is stronger evidence than a photo pass.
 */
const RATING_NEUTRAL = 3;
const RATING_STEP = 2;

/**
 * Extra positive weight added to each tag the user explicitly affirmed in an
 * in-app review (the tag chips on the collection detail sheet). It sharpens
 * taste toward the specific attributes they called out ("great ramen") on top
 * of the visit's rating weight, without letting one review swamp the vector.
 */
const REVIEW_TAG_BONUS = 2;

function signalsFor(place: Place): string[] {
  return [place.category, ...place.tags];
}

function weightFor(event: SwipeEvent): number {
  if (event.action === 'been' && event.rating !== undefined) {
    return (event.rating - RATING_NEUTRAL) * RATING_STEP;
  }
  return ACTION_WEIGHT[event.action];
}

export function emptyTasteGraph(): TasteGraph {
  return { vector: {}, actionedPlaceIds: [], history: [], ratings: {} };
}

/**
 * Folds one swipe event into the taste graph, returning a new graph
 * (does not mutate the input). Pure — safe to unit test without I/O.
 */
export function updateTaste(graph: TasteGraph, event: SwipeEvent): TasteGraph {
  const weight = weightFor(event);
  const vector = { ...graph.vector };

  for (const signal of signalsFor(event.place)) {
    vector[signal] = (vector[signal] ?? 0) + weight;
  }

  // In-app review chips add a focused bonus to the affirmed tags (which are
  // already part of `signalsFor`, so this stacks on their base weight).
  if (event.reviewTags) {
    for (const tag of event.reviewTags) {
      vector[tag] = (vector[tag] ?? 0) + REVIEW_TAG_BONUS;
    }
  }

  const actionedPlaceIds = graph.actionedPlaceIds.includes(event.place.id)
    ? graph.actionedPlaceIds
    : [...graph.actionedPlaceIds, event.place.id];

  const ratings =
    event.action === 'been' && event.rating !== undefined
      ? { ...graph.ratings, [event.place.id]: event.rating }
      : graph.ratings;

  return {
    vector,
    actionedPlaceIds,
    history: [...graph.history, event],
    ratings,
  };
}

/**
 * Amends a place's Been event with a submitted rating (or changes an earlier
 * rating), then replays the full history from scratch so the vector reflects
 * the rated weight instead of the original unrated/deferred one.
 */
export function applyRating(graph: TasteGraph, placeId: string, rating: number): TasteGraph {
  const history = graph.history.map((event) =>
    event.action === 'been' && event.place.id === placeId ? { ...event, rating } : event
  );
  return history.reduce(updateTaste, emptyTasteGraph());
}

export interface Review {
  rating: number;
  /** Subset of the place's tags the user affirmed. Empty is allowed (stars only). */
  reviewTags: string[];
}

/**
 * Amends a place's Been event with a full in-app review (rating + affirmed
 * tags), then replays history so the vector reflects both the rating weight
 * and the per-tag review bonus. Mirrors `applyRating` -- this is the richer
 * review path used from the collection detail sheet, where `applyRating` is
 * the lightweight swipe-time star prompt.
 */
export function applyReview(graph: TasteGraph, placeId: string, review: Review): TasteGraph {
  const history = graph.history.map((event) =>
    event.action === 'been' && event.place.id === placeId
      ? { ...event, rating: review.rating, reviewTags: review.reviewTags }
      : event
  );
  return history.reduce(updateTaste, emptyTasteGraph());
}

/**
 * Promotes a Want to a Been ("I actually went"), optionally with a rating.
 * Rewrites the place's 'want' event in place to 'been' (keeping its original
 * timestamp, like applyRating/applyReview do), then replays history from
 * scratch so the vector reflects the stronger Been weight. A no-op if no
 * 'want' event exists for the place.
 */
export function markBeen(graph: TasteGraph, placeId: string, rating?: number): TasteGraph {
  const hasWant = graph.history.some(
    (event) => event.action === 'want' && event.place.id === placeId
  );
  if (!hasWant) {
    return graph;
  }

  const history = graph.history.map((event) =>
    event.action === 'want' && event.place.id === placeId
      ? { ...event, action: 'been' as const, ...(rating !== undefined ? { rating } : {}) }
      : event
  );
  return history.reduce(updateTaste, emptyTasteGraph());
}
