import { seededShuffle } from './rng';
import type { Place, RankContext, TasteGraph } from './types';

const DEFAULT_FIT_RATIO = 0.7;

/** How long a Nope suppresses a place before it's eligible to resurface. */
export const DEFAULT_NOPE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

function fitScore(vector: TasteGraph['vector'], place: Place): number {
  const signals = [place.category, ...place.tags];
  return signals.reduce((sum, signal) => sum + (vector[signal] ?? 0), 0);
}

/**
 * Derives the set of place ids to exclude from the deck: a Want or Been
 * event permanently excludes its place (the user already committed), while
 * a Nope excludes only until its cooldown elapses -- "a maybe isn't a
 * permanent no". Only the latest event per place is considered, so a Nope
 * later overridden by a Want/Been stays permanently excluded.
 */
function excludedPlaceIds(graph: TasteGraph, context: RankContext): Set<string> {
  const latestByPlace = new Map<string, TasteGraph['history'][number]>();
  for (const event of graph.history) {
    latestByPlace.set(event.place.id, event);
  }

  const { now, nopeCooldownMs = DEFAULT_NOPE_COOLDOWN_MS } = context;
  const excluded = new Set<string>();

  for (const event of latestByPlace.values()) {
    if (event.action === 'want' || event.action === 'been') {
      excluded.add(event.place.id);
      continue;
    }
    // event.action === 'nope'
    if (now === undefined) {
      // No time context to reason with -- fall back to the safe default.
      excluded.add(event.place.id);
      continue;
    }
    if (now - event.timestamp < nopeCooldownMs) {
      excluded.add(event.place.id);
    }
  }

  return excluded;
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
  const excluded = excludedPlaceIds(graph, context);
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
