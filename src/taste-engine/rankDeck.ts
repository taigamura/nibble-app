import { seededShuffle } from './rng';
import type { Place, RankContext, TasteGraph } from './types';

const DEFAULT_FIT_RATIO = 0.7;

function fitScore(vector: TasteGraph['vector'], place: Place): number {
  const signals = [place.category, ...place.tags];
  return signals.reduce((sum, signal) => sum + (vector[signal] ?? 0), 0);
}

/**
 * Derives the set of place ids to exclude from the deck: any place the user
 * has already actioned -- Nope, Want, or Been -- stays out. Once you've made
 * a call on a place it doesn't resurface on its own; a Nope is as durable as
 * a Want or Been. The only way a Noped place returns is the deliberate "bring
 * back passed places" action, which strips the Nope events from the graph (see
 * `clearNopes`), so a place with no surviving history is eligible again.
 */
function excludedPlaceIds(graph: TasteGraph): Set<string> {
  return new Set(graph.history.map((event) => event.place.id));
}

/**
 * Orders candidate places for the swipe deck: excluded places (see
 * `excludedPlaceIds`) are filtered out, then the remainder is split ~70%
 * fit-ranked / ~30% wildcard. The wildcard slice is shuffled with an
 * injected seed so ranking is deterministic under test while still
 * surfacing serendipity in the app.
 */
export function rankDeck(
  graph: TasteGraph,
  candidatePlaces: readonly Place[],
  context: RankContext
): Place[] {
  const fitRatio = context.fitRatio ?? DEFAULT_FIT_RATIO;
  const excluded = excludedPlaceIds(graph);
  const unseen = candidatePlaces.filter((place) => !excluded.has(place.id));

  const fitOrder = unseen
    .map((place, index) => ({ place, index, score: fitScore(graph.vector, place) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.place);

  const fitCount = Math.round(fitOrder.length * fitRatio);
  const fitSlice = fitOrder.slice(0, fitCount);
  const wildcardSlice = seededShuffle(fitOrder.slice(fitCount), context.seed);

  return [...fitSlice, ...wildcardSlice];
}
