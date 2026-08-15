import { updateTaste } from '../taste-engine';
import type { Place, SwipeEvent, TasteGraph } from '../taste-engine';

/**
 * Folds a batch of onboarding-grid taps into the taste graph as 'been'
 * signals, one `updateTaste` call per place. Pure — the timestamp base is
 * injected so this stays deterministic in tests, and each event gets a
 * distinct timestamp (base + index) so history ordering is stable even
 * though the taps happened within the same UI tick.
 */
export function seedBeenSignals(graph: TasteGraph, places: Place[], now: number = Date.now()): TasteGraph {
  return places.reduce((current, place, index) => {
    const event: SwipeEvent = { place, action: 'been', timestamp: now + index };
    return updateTaste(current, event);
  }, graph);
}
