import type { Place, TasteVector } from './types';

/**
 * Short human-readable explanation of why a place was surfaced, derived from
 * the taste tags (category + enrichment tags) with the strongest positive
 * weight in the user's preference vector. Pure — same seam as rankDeck.
 */
export function whySurfaced(vector: TasteVector, place: Place, limit = 2): string | undefined {
  const signals = [place.category, ...place.tags];

  const matches = signals
    .map((signal) => ({ signal, weight: vector[signal] ?? 0 }))
    .filter((entry) => entry.weight > 0)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
    .map((entry) => entry.signal);

  if (matches.length === 0) return undefined;
  return `Because you like ${matches.join(' + ')}`;
}
