import { emptyTasteGraph, markBeen, updateTaste } from '..';
import { getBeenEntries, getWantPlaces } from '../../collection/selectors';
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

function swipe(p: Place, action: SwipeEvent['action']): SwipeEvent {
  return { place: p, action, timestamp: 0 };
}

describe('markBeen', () => {
  it('promotes a Want to a Been, moving it from the Want list to the Been list', () => {
    const p = place({ id: 'p1', category: 'ramen' });
    const wanted = updateTaste(emptyTasteGraph(), swipe(p, 'want'));

    const graph = markBeen(wanted, 'p1');

    expect(getWantPlaces(graph)).toHaveLength(0);
    expect(getBeenEntries(graph).map((e) => e.place.id)).toEqual(['p1']);
  });

  it('applies a rating when provided', () => {
    const p = place({ id: 'p1', category: 'ramen' });
    const wanted = updateTaste(emptyTasteGraph(), swipe(p, 'want'));

    const graph = markBeen(wanted, 'p1', 5);

    expect(graph.ratings.p1).toBe(5);
    expect(getBeenEntries(graph)[0].rating).toBe(5);
  });

  it('correctly recomputes vector weights (Been-weighted, not Want-weighted)', () => {
    const p = place({ id: 'p1', category: 'ramen' });
    const wanted = updateTaste(emptyTasteGraph(), swipe(p, 'want'));
    const wantVectorValue = wanted.vector.ramen;

    const graph = markBeen(wanted, 'p1');

    expect(graph.vector.ramen).toBeGreaterThan(wantVectorValue);
  });

  it('a rated markBeen uses the rating-based weight, not the flat Been weight', () => {
    const p = place({ id: 'p1', category: 'sushi' });
    const wanted = updateTaste(emptyTasteGraph(), swipe(p, 'want'));

    const unrated = markBeen(wanted, 'p1');
    const highlyRated = markBeen(wanted, 'p1', 5);

    expect(highlyRated.vector.sushi).toBeGreaterThan(unrated.vector.sushi);
  });

  it('is a no-op when there is no matching Want event', () => {
    const graph = emptyTasteGraph();
    const result = markBeen(graph, 'missing');

    expect(result).toBe(graph);
  });

  it('is a no-op when the place was Noped, not Wanted', () => {
    const p = place({ id: 'p1', category: 'ramen' });
    const noped = updateTaste(emptyTasteGraph(), swipe(p, 'nope'));

    const result = markBeen(noped, 'p1');

    expect(result).toBe(noped);
  });

  it('does not mutate the input graph', () => {
    const p = place({ id: 'p1', category: 'ramen' });
    const wanted = updateTaste(emptyTasteGraph(), swipe(p, 'want'));
    markBeen(wanted, 'p1', 5);

    expect(getWantPlaces(wanted).map((pl) => pl.id)).toEqual(['p1']);
    expect(getBeenEntries(wanted)).toHaveLength(0);
  });

  it('preserves the original event timestamp', () => {
    const p = place({ id: 'p1', category: 'ramen' });
    const wanted = updateTaste(emptyTasteGraph(), { ...swipe(p, 'want'), timestamp: 12345 });

    const graph = markBeen(wanted, 'p1');

    expect(graph.history.find((e) => e.place.id === 'p1')?.timestamp).toBe(12345);
  });
});
