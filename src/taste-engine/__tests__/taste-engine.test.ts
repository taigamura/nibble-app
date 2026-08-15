import { applyRating, emptyTasteGraph, rankDeck, updateTaste, whySurfaced } from '..';
import type { Place, SwipeEvent, TasteGraph } from '../types';

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

function swipe(p: Place, action: SwipeEvent['action']): SwipeEvent {
  return { place: p, action, timestamp: 0 };
}

describe('updateTaste', () => {
  it('folds a swipe into the vector for the place category and tags', () => {
    const p = place({ id: 'p1', category: 'ramen', tags: ['tonkotsu'] });
    const graph = updateTaste(emptyTasteGraph(), swipe(p, 'want'));

    expect(graph.vector.ramen).toBe(1);
    expect(graph.vector.tonkotsu).toBe(1);
    expect(graph.actionedPlaceIds).toEqual(['p1']);
    expect(graph.history).toHaveLength(1);
  });

  it('weights been above want above nope', () => {
    const been = updateTaste(emptyTasteGraph(), swipe(place({ id: 'a', category: 'sushi' }), 'been'));
    const want = updateTaste(emptyTasteGraph(), swipe(place({ id: 'b', category: 'sushi' }), 'want'));
    const nope = updateTaste(emptyTasteGraph(), swipe(place({ id: 'c', category: 'sushi' }), 'nope'));

    expect(been.vector.sushi).toBeGreaterThan(want.vector.sushi);
    expect(want.vector.sushi).toBeGreaterThan(nope.vector.sushi);
  });

  it('does not mutate the input graph', () => {
    const graph = emptyTasteGraph();
    updateTaste(graph, swipe(place({ id: 'p1' }), 'want'));

    expect(graph.vector).toEqual({});
    expect(graph.actionedPlaceIds).toEqual([]);
  });

  it('accumulates repeated signals across multiple events', () => {
    const p1 = place({ id: 'p1', category: 'ramen' });
    const p2 = place({ id: 'p2', category: 'ramen' });
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipe(p1, 'want'));
    graph = updateTaste(graph, swipe(p2, 'want'));

    expect(graph.vector.ramen).toBe(2);
    expect(graph.actionedPlaceIds).toEqual(['p1', 'p2']);
  });

  it('a highly-rated Been moves the vector more than a Want, which moves it more than a Nope', () => {
    const beenRated = updateTaste(
      emptyTasteGraph(),
      { ...swipe(place({ id: 'a', category: 'sushi' }), 'been'), rating: 5 }
    );
    const want = updateTaste(emptyTasteGraph(), swipe(place({ id: 'b', category: 'sushi' }), 'want'));
    const nope = updateTaste(emptyTasteGraph(), swipe(place({ id: 'c', category: 'sushi' }), 'nope'));

    expect(beenRated.vector.sushi).toBeGreaterThan(want.vector.sushi);
    expect(want.vector.sushi).toBeGreaterThan(nope.vector.sushi);
  });

  it('a poorly-rated Been pushes the vector negative harder than a plain Nope', () => {
    const beenBadRated = updateTaste(
      emptyTasteGraph(),
      { ...swipe(place({ id: 'a', category: 'dive-bar' }), 'been'), rating: 1 }
    );
    const nope = updateTaste(emptyTasteGraph(), swipe(place({ id: 'b', category: 'dive-bar' }), 'nope'));

    expect(beenBadRated.vector['dive-bar']).toBeLessThan(nope.vector['dive-bar']);
  });

  it('records a submitted rating retrievable per place', () => {
    const p = place({ id: 'p1' });
    const graph = updateTaste(emptyTasteGraph(), { ...swipe(p, 'been'), rating: 4 });

    expect(graph.ratings.p1).toBe(4);
  });
});

describe('applyRating', () => {
  it('amends a deferred (unrated) Been into a rated one, recomputing the vector', () => {
    const p = place({ id: 'p1', category: 'ramen' });
    const deferred = updateTaste(emptyTasteGraph(), swipe(p, 'been'));
    expect(deferred.ratings.p1).toBeUndefined();

    const rated = applyRating(deferred, 'p1', 5);

    expect(rated.ratings.p1).toBe(5);
    expect(rated.vector.ramen).toBeGreaterThan(deferred.vector.ramen);
    expect(rated.actionedPlaceIds).toEqual(deferred.actionedPlaceIds);
    expect(rated.history).toHaveLength(1);
  });

  it('does not mutate the input graph', () => {
    const p = place({ id: 'p1', category: 'ramen' });
    const deferred = updateTaste(emptyTasteGraph(), swipe(p, 'been'));
    applyRating(deferred, 'p1', 5);

    expect(deferred.ratings.p1).toBeUndefined();
  });
});

describe('rankDeck', () => {
  const places: Place[] = [
    place({ id: 'ramen-1', category: 'ramen', tags: ['tonkotsu'] }),
    place({ id: 'ramen-2', category: 'ramen', tags: ['shoyu'] }),
    place({ id: 'ramen-3', category: 'ramen', tags: ['miso'] }),
    place({ id: 'bar-1', category: 'cocktail-bar', tags: ['speakeasy'] }),
    place({ id: 'bar-2', category: 'cocktail-bar', tags: ['dive-bar'] }),
    place({ id: 'sushi-1', category: 'sushi', tags: ['omakase'] }),
    place({ id: 'sushi-2', category: 'sushi', tags: ['conveyor'] }),
    place({ id: 'izakaya-1', category: 'izakaya', tags: ['yakitori'] }),
    place({ id: 'izakaya-2', category: 'izakaya', tags: ['group-friendly'] }),
    place({ id: 'shabu-1', category: 'shabu-shabu', tags: ['all-you-can-eat'] }),
  ];

  it('excludes already-actioned places', () => {
    const graph: TasteGraph = { ...emptyTasteGraph(), actionedPlaceIds: ['ramen-1', 'bar-1'] };
    const deck = rankDeck(graph, places, { seed: 1 });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeUndefined();
    expect(deck.find((p) => p.id === 'bar-1')).toBeUndefined();
    expect(deck).toHaveLength(places.length - 2);
  });

  it('is deterministic for a fixed injected seed', () => {
    const graph = updateTaste(emptyTasteGraph(), swipe(places[0], 'been'));
    const deckA = rankDeck(graph, places, { seed: 42 });
    const deckB = rankDeck(graph, places, { seed: 42 });

    expect(deckA.map((p) => p.id)).toEqual(deckB.map((p) => p.id));
  });

  it('produces a different wildcard order for a different seed', () => {
    const deckA = rankDeck(emptyTasteGraph(), places, { seed: 1 });
    const deckB = rankDeck(emptyTasteGraph(), places, { seed: 2 });

    expect(deckA.map((p) => p.id)).not.toEqual(deckB.map((p) => p.id));
  });

  it('cold start (empty vector) still returns every candidate exactly once', () => {
    const deck = rankDeck(emptyTasteGraph(), places, { seed: 7 });

    expect(deck).toHaveLength(places.length);
    expect(new Set(deck.map((p) => p.id)).size).toBe(places.length);
  });

  it('splits the deck ~70% fit-ranked / ~30% wildcard', () => {
    const deck = rankDeck(emptyTasteGraph(), places, { seed: 3, fitRatio: 0.7 });
    const expectedFitCount = Math.round(places.length * 0.7);

    // The fit-ranked slice occupies the first `expectedFitCount` slots.
    expect(deck.slice(0, expectedFitCount)).toHaveLength(expectedFitCount);
    expect(deck.slice(expectedFitCount)).toHaveLength(places.length - expectedFitCount);
  });

  it('improves with signal: a strong taste profile surfaces matching places at the top', () => {
    let graph = emptyTasteGraph();
    // Strongly prefer ramen via several "been" swipes on other ramen places.
    graph = updateTaste(graph, swipe(place({ id: 'seed-1', category: 'ramen' }), 'been'));
    graph = updateTaste(graph, swipe(place({ id: 'seed-2', category: 'ramen' }), 'been'));
    graph = updateTaste(graph, swipe(place({ id: 'seed-3', category: 'cocktail-bar' }), 'nope'));

    const deck = rankDeck(graph, places, { seed: 9 });
    const fitCount = Math.round(places.length * 0.7);
    const topCategories = deck.slice(0, fitCount).map((p) => p.category);

    expect(topCategories.filter((c) => c === 'ramen')).toHaveLength(3);
    expect(topCategories.slice(0, 3).every((c) => c === 'ramen')).toBe(true);
  });

  it('surfaces real enrichment vibe/specialty tags to the top for a synthetic taste profile', () => {
    const enrichedPlaces: Place[] = [
      place({
        id: 'coffee-1',
        category: 'cafe',
        tags: ['minimal', 'third-wave espresso', 'good-for:solo', 'quiet'],
      }),
      place({
        id: 'coffee-2',
        category: 'cafe',
        tags: ['minimal', 'third-wave espresso', 'good-for:solo', 'quiet'],
      }),
      place({ id: 'chain-1', category: 'cafe', tags: ['chain', 'good-for:groups', 'loud'] }),
      place({ id: 'bar-1', category: 'cocktail-bar', tags: ['speakeasy', 'date-night'] }),
    ];

    let graph = emptyTasteGraph();
    graph = updateTaste(
      graph,
      swipe(place({ id: 'seed-1', category: 'cafe', tags: ['minimal', 'third-wave espresso', 'good-for:solo', 'quiet'] }), 'been'),
    );

    const deck = rankDeck(graph, enrichedPlaces, { seed: 5 });
    expect(deck[0].id).toBe('coffee-1');
    expect(deck[1].id).toBe('coffee-2');
  });

  it('measurably reorders the deck after a few rated Been swipes for a synthetic user', () => {
    const shabuPlaces: Place[] = [
      place({ id: 'shabu-a', category: 'shabu-shabu' }),
      place({ id: 'shabu-b', category: 'shabu-shabu' }),
      place({ id: 'ramen-a', category: 'ramen' }),
    ];

    const before = rankDeck(emptyTasteGraph(), [...places, ...shabuPlaces], { seed: 4 });
    const beforeFitCount = Math.round(before.length * 0.7);
    expect(before.slice(0, beforeFitCount).map((p) => p.category)).not.toContain('shabu-shabu');

    let graph = emptyTasteGraph();
    graph = updateTaste(graph, { ...swipe(place({ id: 'seed-1', category: 'shabu-shabu' }), 'been'), rating: 5 });
    graph = updateTaste(graph, { ...swipe(place({ id: 'seed-2', category: 'shabu-shabu' }), 'been'), rating: 5 });

    const after = rankDeck(graph, [...places, ...shabuPlaces], { seed: 4 });
    const afterFitCount = Math.round(after.length * 0.7);

    expect(after.slice(0, afterFitCount).map((p) => p.category).filter((c) => c === 'shabu-shabu')).toHaveLength(3);
  });
});

describe('whySurfaced', () => {
  it('names the top matching signals in the taste vector', () => {
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipe(place({ id: 'seed', category: 'cafe', tags: ['minimal', 'quiet'] }), 'been'));

    const candidate = place({ id: 'p1', category: 'cafe', tags: ['minimal', 'quiet', 'loud'] });
    expect(whySurfaced(graph.vector, candidate)).toBe('Because you like cafe + minimal');
  });

  it('returns undefined when nothing in the vector matches', () => {
    const candidate = place({ id: 'p1', category: 'izakaya', tags: ['group-friendly'] });
    expect(whySurfaced({}, candidate)).toBeUndefined();
  });
});
