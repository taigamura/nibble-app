import type { Place, SwipeAction, SwipeEvent, TasteGraph } from './types';

/**
 * Been is the strongest positive signal (you actually went), Want is a
 * weaker positive signal (you'd like to), Nope is negative.
 */
const ACTION_WEIGHT: Record<SwipeAction, number> = {
  been: 2,
  want: 1,
  nope: -1,
};

function signalsFor(place: Place): string[] {
  return [place.category, ...place.tags];
}

export function emptyTasteGraph(): TasteGraph {
  return { vector: {}, actionedPlaceIds: [], history: [] };
}

/**
 * Folds one swipe event into the taste graph, returning a new graph
 * (does not mutate the input). Pure — safe to unit test without I/O.
 */
export function updateTaste(graph: TasteGraph, event: SwipeEvent): TasteGraph {
  const weight = ACTION_WEIGHT[event.action];
  const vector = { ...graph.vector };

  for (const signal of signalsFor(event.place)) {
    vector[signal] = (vector[signal] ?? 0) + weight;
  }

  const actionedPlaceIds = graph.actionedPlaceIds.includes(event.place.id)
    ? graph.actionedPlaceIds
    : [...graph.actionedPlaceIds, event.place.id];

  return {
    vector,
    actionedPlaceIds,
    history: [...graph.history, event],
  };
}
