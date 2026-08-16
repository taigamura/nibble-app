import type { Place, TasteGraph } from '../taste-engine';

/**
 * Pure derivations of the Want/Been collection surfaces from the taste
 * graph's history — no separate collection store. `history` plus
 * `ratings` (already the source of truth for swipe outcomes) is enough:
 * each place is actioned at most once (see `updateTaste`'s
 * `actionedPlaceIds` dedupe), so filtering by action never needs to resolve
 * conflicting duplicate events for the same place.
 */

export interface BeenEntry {
  place: Place;
  rating?: number;
}

/** Every right-swiped (Want) place, in the order it was swiped. */
export function getWantPlaces(graph: TasteGraph): Place[] {
  return graph.history.filter((event) => event.action === 'want').map((event) => event.place);
}

/** Every visited (Been) place, with its submitted rating when one exists. */
export function getBeenEntries(graph: TasteGraph): BeenEntry[] {
  return graph.history
    .filter((event) => event.action === 'been')
    .map((event) => ({ place: event.place, rating: graph.ratings[event.place.id] }));
}

/**
 * The tags a user affirmed in an in-app review of a Been place, so the detail
 * sheet can re-open with those chips already selected. Derived from history
 * (like the Want/Been surfaces) rather than a separate store field.
 */
export function getReviewTags(graph: TasteGraph, placeId: string): string[] {
  const event = graph.history.find(
    (e) => e.action === 'been' && e.place.id === placeId && e.reviewTags !== undefined
  );
  return event?.reviewTags ?? [];
}

export interface CategoryStat {
  category: string;
  count: number;
}

/** Been-history counts by place category, most-visited first. */
export function getBeenCategoryStats(graph: TasteGraph): CategoryStat[] {
  const counts = new Map<string, number>();
  for (const { place } of getBeenEntries(graph)) {
    counts.set(place.category, (counts.get(place.category) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}
