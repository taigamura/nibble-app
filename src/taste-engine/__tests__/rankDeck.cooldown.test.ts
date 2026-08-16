import { DEFAULT_NOPE_COOLDOWN_MS, emptyTasteGraph, rankDeck, updateTaste } from '..';
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

function swipeAt(p: Place, action: SwipeEvent['action'], timestamp: number): SwipeEvent {
  return { place: p, action, timestamp };
}

describe('rankDeck soft-recycle (Nope cooldown)', () => {
  const places: Place[] = [
    place({ id: 'ramen-1', category: 'ramen' }),
    place({ id: 'ramen-2', category: 'ramen' }),
    place({ id: 'ramen-3', category: 'ramen' }),
  ];

  it('keeps a Noped place hidden while inside the cooldown window', () => {
    const now = 10_000_000;
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'nope', now - 1000));

    const deck = rankDeck(graph, places, { seed: 1, now });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeUndefined();
  });

  it('lets a Noped place reappear once the cooldown has elapsed', () => {
    const now = 10_000_000;
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'nope', now - DEFAULT_NOPE_COOLDOWN_MS - 1));

    const deck = rankDeck(graph, places, { seed: 1, now });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeDefined();
  });

  it('falls back to excluding all Nopes when no `now` is provided (safe default)', () => {
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'nope', 0));

    const deck = rankDeck(graph, places, { seed: 1 });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeUndefined();
  });

  it('nopeCooldownMs: 0 with `now` set reveals all Nopes immediately ("Reset seen")', () => {
    const now = 10_000_000;
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'nope', now - 1));

    const deck = rankDeck(graph, places, { seed: 1, now, nopeCooldownMs: 0 });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeDefined();
  });

  it('never resurfaces a Want, even long past the Nope cooldown window', () => {
    const now = 10_000_000;
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'want', now - DEFAULT_NOPE_COOLDOWN_MS - 1_000_000));

    const deck = rankDeck(graph, places, { seed: 1, now });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeUndefined();
  });

  it('never resurfaces a Been, even long past the Nope cooldown window', () => {
    const now = 10_000_000;
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'been', now - DEFAULT_NOPE_COOLDOWN_MS - 1_000_000));

    const deck = rankDeck(graph, places, { seed: 1, now });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeUndefined();
  });

  it('a Nope later overridden by a Want stays permanently excluded', () => {
    const now = 10_000_000;
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'nope', now - DEFAULT_NOPE_COOLDOWN_MS - 1_000_000));
    graph = updateTaste(graph, swipeAt(places[0], 'want', now - 100));

    const deck = rankDeck(graph, places, { seed: 1, now });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeUndefined();
  });

  it('a Nope later overridden by a Been stays permanently excluded', () => {
    const now = 10_000_000;
    let graph = emptyTasteGraph();
    graph = updateTaste(graph, swipeAt(places[0], 'nope', now - DEFAULT_NOPE_COOLDOWN_MS - 1_000_000));
    graph = updateTaste(graph, swipeAt(places[0], 'been', now - 100));

    const deck = rankDeck(graph, places, { seed: 1, now });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeUndefined();
  });

  it('a place that only ever got a Want swipe is excluded regardless of `now`', () => {
    const graph: TasteGraph = { ...emptyTasteGraph(), actionedPlaceIds: [] };
    const updated = updateTaste(graph, swipeAt(places[0], 'want', 0));

    const deck = rankDeck(updated, places, { seed: 1, now: 5_000_000_000 });

    expect(deck.find((p) => p.id === 'ramen-1')).toBeUndefined();
  });
});
