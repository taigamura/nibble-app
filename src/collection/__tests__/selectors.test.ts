import { emptyTasteGraph, updateTaste } from '../../taste-engine';
import type { Place, SwipeEvent, TasteGraph } from '../../taste-engine';
import { getBeenCategoryStats, getBeenEntries, getMapPoints, getWantPlaces } from '../selectors';

function place(overrides: Partial<Place> & Pick<Place, 'id' | 'category'>): Place {
  return {
    name: overrides.id,
    tags: [],
    priceBand: '$',
    rating: 4,
    distanceMeters: 100,
    photoUrl: 'https://example.com/photo.jpg',
    ...overrides,
  };
}

const WANT_PLACE = place({ id: 'w1', category: 'ramen', lat: 35.0, lng: 139.0 });
const BEEN_PLACE = place({ id: 'b1', category: 'sushi', lat: 35.1, lng: 139.1 });
const BEEN_PLACE_NO_GEO = place({ id: 'b2', category: 'sushi' });
const NOPE_PLACE = place({ id: 'n1', category: 'izakaya' });

function graphWith(events: SwipeEvent[]): TasteGraph {
  return events.reduce(updateTaste, emptyTasteGraph());
}

describe('getWantPlaces', () => {
  it('returns only right-swiped places', () => {
    const graph = graphWith([
      { place: WANT_PLACE, action: 'want', timestamp: 1 },
      { place: BEEN_PLACE, action: 'been', timestamp: 2 },
      { place: NOPE_PLACE, action: 'nope', timestamp: 3 },
    ]);
    expect(getWantPlaces(graph)).toEqual([WANT_PLACE]);
  });
});

describe('getBeenEntries', () => {
  it('attaches the submitted rating when present', () => {
    let graph = graphWith([{ place: BEEN_PLACE, action: 'been', timestamp: 1, rating: 5 }]);
    expect(getBeenEntries(graph)).toEqual([{ place: BEEN_PLACE, rating: 5 }]);
  });

  it('omits rating when the been event was skipped', () => {
    const graph = graphWith([{ place: BEEN_PLACE, action: 'been', timestamp: 1 }]);
    expect(getBeenEntries(graph)).toEqual([{ place: BEEN_PLACE, rating: undefined }]);
  });
});

describe('getBeenCategoryStats', () => {
  it('counts been places by category, most-visited first', () => {
    const graph = graphWith([
      { place: BEEN_PLACE, action: 'been', timestamp: 1 },
      { place: place({ id: 'b3', category: 'sushi' }), action: 'been', timestamp: 2 },
      { place: place({ id: 'b4', category: 'ramen' }), action: 'been', timestamp: 3 },
      { place: WANT_PLACE, action: 'want', timestamp: 4 },
    ]);
    expect(getBeenCategoryStats(graph)).toEqual([
      { category: 'sushi', count: 2 },
      { category: 'ramen', count: 1 },
    ]);
  });
});

describe('getMapPoints', () => {
  it('combines want and been places, dropping those without coordinates', () => {
    const graph = graphWith([
      { place: WANT_PLACE, action: 'want', timestamp: 1 },
      { place: BEEN_PLACE, action: 'been', timestamp: 2 },
      { place: BEEN_PLACE_NO_GEO, action: 'been', timestamp: 3 },
    ]);
    expect(getMapPoints(graph)).toEqual([
      { place: WANT_PLACE, kind: 'want' },
      { place: BEEN_PLACE, kind: 'been' },
    ]);
  });
});
