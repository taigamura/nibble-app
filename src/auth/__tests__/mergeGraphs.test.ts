import { updateTaste } from '../../taste-engine';
import type { Place, SwipeEvent, TasteGraph } from '../../taste-engine';
import { mergeTasteGraphs } from '../mergeGraphs';

function place(id: string): Place {
  return {
    id,
    name: id,
    category: 'ramen',
    tags: ['spicy'],
    priceBand: '$',
    rating: 4,
    distanceMeters: 100,
    photoUrl: 'https://example.com/photo.jpg',
  };
}

function graphFrom(events: SwipeEvent[]): TasteGraph {
  return events.reduce(updateTaste, { vector: {}, actionedPlaceIds: [], history: [], ratings: {} });
}

describe('mergeTasteGraphs', () => {
  it('unions history from both graphs with no loss', () => {
    const local = graphFrom([{ place: place('a'), action: 'want', timestamp: 1 }]);
    const cloud = graphFrom([{ place: place('b'), action: 'been', timestamp: 2, rating: 5 }]);

    const merged = mergeTasteGraphs(local, cloud);

    expect(merged.history.map((e) => e.place.id)).toEqual(['a', 'b']);
    expect(merged.actionedPlaceIds.sort()).toEqual(['a', 'b']);
    expect(merged.ratings.b).toBe(5);
  });

  it('keeps the later duplicate event for the same place + action', () => {
    const local = graphFrom([{ place: place('a'), action: 'been', timestamp: 1, rating: 2 }]);
    const cloud = graphFrom([{ place: place('a'), action: 'been', timestamp: 2, rating: 5 }]);

    const merged = mergeTasteGraphs(local, cloud);

    expect(merged.history).toHaveLength(1);
    expect(merged.ratings.a).toBe(5);
  });

  it('re-derives vector/ratings from merged history rather than combining them directly', () => {
    const local = graphFrom([{ place: place('a'), action: 'want', timestamp: 1 }]);
    const cloud = graphFrom([{ place: place('a'), action: 'want', timestamp: 1 }]);

    const merged = mergeTasteGraphs(local, cloud);

    expect(merged.history).toHaveLength(1);
    expect(merged.vector.ramen).toBe(1);
  });

  it('is order-independent', () => {
    const local = graphFrom([{ place: place('a'), action: 'want', timestamp: 1 }]);
    const cloud = graphFrom([{ place: place('b'), action: 'nope', timestamp: 2 }]);

    expect(mergeTasteGraphs(local, cloud)).toEqual(mergeTasteGraphs(cloud, local));
  });
});
