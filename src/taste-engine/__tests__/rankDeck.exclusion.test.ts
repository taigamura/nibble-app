import { clearNopes, emptyTasteGraph, rankDeck, updateTaste } from '..';
import type { Place, SwipeEvent } from '../types';

function place(overrides: Partial<Place>): Place {
  return {
    id: 'x',
    name: 'Test Place',
    category: 'ramen',
    tags: [],
    priceBand: '$',
    rating: 4,
    distanceMeters: 100,
    photoUrl: 'https://example.com/photo.jpg',
    ...overrides,
  };
}

function swipeAt(p: Place, action: SwipeEvent['action'], timestamp: number): SwipeEvent {
  return { place: p, action, timestamp };
}

describe('rankDeck exclusion (Nope never resurfaces on its own)', () => {
  const places: Place[] = [
    place({ id: 'ramen-1', category: 'ramen' }),
    place({ id: 'ramen-2', category: 'ramen' }),
    place({ id: 'ramen-3', category: 'ramen' }),
  ];

  it('keeps a Noped place out of the deck permanently, no matter how old the Nope', () => {
    const veryOld = Date.now() - 10 * 365 * 24 * 60 * 60 * 1000;
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'nope', veryOld));

    const deck = rankDeck(graph, places, { seed: 1 });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeUndefined();
  });

  it('keeps a Want out of the deck permanently', () => {
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'want', 0));

    const deck = rankDeck(graph, places, { seed: 1 });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeUndefined();
  });

  it('keeps a Been out of the deck permanently', () => {
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'been', 0));

    const deck = rankDeck(graph, places, { seed: 1 });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeUndefined();
  });

  it('clearNopes brings every Noped place back into the deck', () => {
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'nope', 0));
    graph = updateTaste(graph, swipeAt(places[1], 'nope', 0));

    const refreshed = clearNopes(graph);
    const deck = rankDeck(refreshed, places, { seed: 1 });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeDefined();
    expect(deck.find((p) => p.id === 'ramen-2')).toBeDefined();
  });

  it('clearNopes leaves Want/Been exclusions in place', () => {
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'nope', 0));
    graph = updateTaste(graph, swipeAt(places[1], 'want', 0));
    graph = updateTaste(graph, swipeAt(places[2], 'been', 0));

    const refreshed = clearNopes(graph);
    const deck = rankDeck(refreshed, places, { seed: 1 });

    // The Noped place returns; the Want and Been stay excluded.
    expect(deck.find((p) => p.id === 'ramen-1')).toBeDefined();
    expect(deck.find((p) => p.id === 'ramen-2')).toBeUndefined();
    expect(deck.find((p) => p.id === 'ramen-3')).toBeUndefined();
  });

  it('clearNopes unwinds the negative taste weight of the cleared Nopes', () => {
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(place({ id: 'r', category: 'ramen' }), 'nope', 0));

    expect(graph.vector.ramen).toBeLessThan(0);

    const refreshed = clearNopes(graph);
    expect(refreshed.vector.ramen ?? 0).toBe(0);
  });

  it('clearNopes is a no-op (same reference) when there are no Nopes', () => {
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'want', 0));

    expect(clearNopes(graph)).toBe(graph);
  });

  it('a Nope later overridden by a Want stays excluded (the Want holds it out)', () => {
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'nope', 0));
    graph = updateTaste(graph, swipeAt(places[0], 'want', 100));

    const deck = rankDeck(graph, places, { seed: 1 });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeUndefined();

    // Even after clearing Nopes, the surviving Want keeps it out.
    const deckAfter = rankDeck(clearNopes(graph), places, { seed: 1 });
    expect(deckAfter.find((p) => p.id === 'ramen-1')).toBeUndefined();
  });
});
