import type { Place, TasteVector } from '../taste-engine';

/**
 * Ranks the user's Want list for the "Where should I go tonight?" sheet.
 *
 * Deliberately *not* random: the primary sort is nearest-first (you want to
 * decide where to go right now), so "not tonight" just walks outward to the
 * next-closest spot. Ties in distance are broken by taste fit so the pick
 * still feels personal, then by id for a stable, testable order.
 */
function fitScore(vector: TasteVector, place: Place): number {
  const signals = [place.category, ...place.tags];
  return signals.reduce((sum, signal) => sum + (vector[signal] ?? 0), 0);
}

export function rankTonight(wantPlaces: readonly Place[], vector: TasteVector): Place[] {
  return [...wantPlaces].sort(
    (a, b) =>
      a.distanceMeters - b.distanceMeters ||
      fitScore(vector, b) - fitScore(vector, a) ||
      a.id.localeCompare(b.id)
  );
}
