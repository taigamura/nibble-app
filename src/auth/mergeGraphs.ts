import { emptyTasteGraph, updateTaste } from '../taste-engine';
import type { SwipeEvent, TasteGraph } from '../taste-engine';

function eventKey(event: SwipeEvent): string {
  return `${event.place.id}:${event.action}`;
}

/**
 * Combines two taste graphs' history (e.g. the local-anonymous graph and
 * whatever the cloud already holds from a prior sign-in on another device)
 * into one without dropping either side's swipes. The same place can appear
 * on both sides for the same action (actioned locally pre-signup, then again
 * post-signup before this ran) -- the later timestamp wins. `vector` and
 * `ratings` are never merged directly; they're re-derived by replaying the
 * combined history through `updateTaste`, the same "replay from scratch"
 * pattern `applyRating` uses, so they can never drift from history.
 */
export function mergeTasteGraphs(a: TasteGraph, b: TasteGraph): TasteGraph {
  const byKey = new Map<string, SwipeEvent>();
  for (const event of [...a.history, ...b.history]) {
    const key = eventKey(event);
    const existing = byKey.get(key);
    if (!existing || event.timestamp >= existing.timestamp) {
      byKey.set(key, event);
    }
  }
  const merged = [...byKey.values()].sort((x, y) => x.timestamp - y.timestamp);
  return merged.reduce(updateTaste, emptyTasteGraph());
}
