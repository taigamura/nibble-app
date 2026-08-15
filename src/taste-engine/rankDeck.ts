import { seededShuffle } from './rng';
import type { Place, RankContext, TasteGraph } from './types';

const DEFAULT_FIT_RATIO = 0.7;

function fitScore(vector: TasteGraph['vector'], place: Place): number {
  const signals = [place.category, ...place.tags];
  return signals.reduce((sum, signal) => sum + (vector[signal] ?? 0), 0);
}

/**
 * Orders candidate places for the swipe deck: already-actioned places are
 * excluded, then the remainder is split ~70% fit-ranked / ~30% wildcard.
 * The wildcard slice is shuffled with an injected seed so ranking is
 * deterministic under test while still surfacing serendipity in the app.
 */
export function rankDeck(
  graph: TasteGraph,
  candidatePlaces: readonly Place[],
  context: RankContext
): Place[] {
  const fitRatio = context.fitRatio ?? DEFAULT_FIT_RATIO;
  const actioned = new Set(graph.actionedPlaceIds);
  const unseen = candidatePlaces.filter((place) => !actioned.has(place.id));

  const fitOrder = unseen
    .map((place, index) => ({ place, index, score: fitScore(graph.vector, place) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.place);

  const fitCount = Math.round(fitOrder.length * fitRatio);
  const fitSlice = fitOrder.slice(0, fitCount);
  const wildcardSlice = seededShuffle(fitOrder.slice(fitCount), context.seed);

  return [...fitSlice, ...wildcardSlice];
}
