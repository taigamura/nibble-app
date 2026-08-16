import type { Place, TasteVector } from '../../taste-engine';
import { rankTonight } from '../tonight';

function place(overrides: Partial<Place> & Pick<Place, 'id'>): Place {
  return {
    name: overrides.id,
    category: 'ramen',
    tags: [],
    priceBand: '$',
    rating: 4,
    distanceMeters: 100,
    photoUrl: 'https://example.com/photo.jpg',
    ...overrides,
  };
}

describe('rankTonight', () => {
  it('orders the Want list nearest-first', () => {
    const near = place({ id: 'near', distanceMeters: 200 });
    const far = place({ id: 'far', distanceMeters: 2000 });
    const mid = place({ id: 'mid', distanceMeters: 900 });

    expect(rankTonight([far, near, mid], {}).map((p) => p.id)).toEqual(['near', 'mid', 'far']);
  });

  it('breaks distance ties by taste fit', () => {
    const a = place({ id: 'a', distanceMeters: 500, category: 'sushi' });
    const b = place({ id: 'b', distanceMeters: 500, category: 'ramen' });
    const vector: TasteVector = { ramen: 5, sushi: 1 };

    // Same distance, so the better-fitting 'ramen' place comes first.
    expect(rankTonight([a, b], vector).map((p) => p.id)).toEqual(['b', 'a']);
  });

  it('does not mutate the input array', () => {
    const input = [place({ id: 'b', distanceMeters: 900 }), place({ id: 'a', distanceMeters: 100 })];
    rankTonight(input, {});
    expect(input.map((p) => p.id)).toEqual(['b', 'a']);
  });
});
