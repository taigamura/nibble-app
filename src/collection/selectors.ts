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

export type MapPointKind = 'want' | 'been';

export interface MapPoint {
  place: Place;
  kind: MapPointKind;
}

/**
 * Want + Been places with known coordinates, ready for the map view. Places
 * missing lat/lng (possible for hand-authored fixtures without geo data)
 * are dropped rather than plotted at a guessed location.
 */
export function getMapPoints(graph: TasteGraph): MapPoint[] {
  const hasCoords = (place: Place) => place.lat !== undefined && place.lng !== undefined;
  const want = getWantPlaces(graph)
    .filter(hasCoords)
    .map((place): MapPoint => ({ place, kind: 'want' }));
  const been = getBeenEntries(graph)
    .map((entry) => entry.place)
    .filter(hasCoords)
    .map((place): MapPoint => ({ place, kind: 'been' }));
  return [...want, ...been];
}
