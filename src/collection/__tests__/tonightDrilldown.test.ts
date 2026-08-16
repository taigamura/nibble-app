import type { Place } from '../../taste-engine';
import { STOP_AT, applyAnswer, distinctValues, nextQuestion } from '../tonightDrilldown';

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

describe('distinctValues', () => {
  it('dedupes and sorts cuisine values', () => {
    const pool = [
      place({ id: 'a', category: 'sushi' }),
      place({ id: 'b', category: 'ramen' }),
      place({ id: 'c', category: 'ramen' }),
    ];

    expect(distinctValues(pool, 'cuisine')).toEqual(['ramen', 'sushi']);
  });

  it('flattens and dedupes tags for vibe', () => {
    const pool = [
      place({ id: 'a', tags: ['cozy', 'date-night'] }),
      place({ id: 'b', tags: ['date-night', 'loud'] }),
    ];

    expect(distinctValues(pool, 'vibe')).toEqual(['cozy', 'date-night', 'loud']);
  });

  it('dedupes and sorts price bands', () => {
    const pool = [
      place({ id: 'a', priceBand: '$$' }),
      place({ id: 'b', priceBand: '$' }),
      place({ id: 'c', priceBand: '$$' }),
    ];

    expect(distinctValues(pool, 'price')).toEqual(['$', '$$']);
  });
});

describe('applyAnswer', () => {
  it('filters by cuisine', () => {
    const pool = [
      place({ id: 'a', category: 'sushi' }),
      place({ id: 'b', category: 'ramen' }),
    ];

    expect(applyAnswer(pool, 'cuisine', 'ramen').map((p) => p.id)).toEqual(['b']);
  });

  it('filters by price', () => {
    const pool = [
      place({ id: 'a', priceBand: '$' }),
      place({ id: 'b', priceBand: '$$' }),
    ];

    expect(applyAnswer(pool, 'price', '$$').map((p) => p.id)).toEqual(['b']);
  });

  it('filters by vibe, matching any place carrying the tag', () => {
    const pool = [
      place({ id: 'a', tags: ['cozy'] }),
      place({ id: 'b', tags: ['cozy', 'loud'] }),
      place({ id: 'c', tags: ['loud'] }),
    ];

    expect(applyAnswer(pool, 'vibe', 'cozy').map((p) => p.id)).toEqual(['a', 'b']);
  });
});

describe('nextQuestion', () => {
  it('asks cuisine first when the pool splits on it', () => {
    const pool = [
      place({ id: 'a', category: 'sushi', priceBand: '$', tags: ['cozy'] }),
      place({ id: 'b', category: 'ramen', priceBand: '$$', tags: ['loud'] }),
      place({ id: 'c', category: 'sushi', priceBand: '$$', tags: ['cozy'] }),
      place({ id: 'd', category: 'ramen', priceBand: '$', tags: ['loud'] }),
    ];

    expect(nextQuestion(pool, [])).toEqual({ axis: 'cuisine', options: ['ramen', 'sushi'] });
  });

  it('moves to price once cuisine has been asked', () => {
    const pool = [
      place({ id: 'a', category: 'sushi', priceBand: '$', tags: ['cozy'] }),
      place({ id: 'b', category: 'sushi', priceBand: '$$', tags: ['loud'] }),
      place({ id: 'c', category: 'sushi', priceBand: '$$', tags: ['cozy'] }),
      place({ id: 'd', category: 'sushi', priceBand: '$', tags: ['loud'] }),
    ];

    expect(nextQuestion(pool, ['cuisine'])).toEqual({ axis: 'price', options: ['$', '$$'] });
  });

  it('moves to vibe once cuisine and price have been asked', () => {
    const pool = [
      place({ id: 'a', category: 'sushi', priceBand: '$', tags: ['cozy'] }),
      place({ id: 'b', category: 'sushi', priceBand: '$', tags: ['loud'] }),
      place({ id: 'c', category: 'sushi', priceBand: '$', tags: ['cozy'] }),
      place({ id: 'd', category: 'sushi', priceBand: '$', tags: ['loud'] }),
    ];

    expect(nextQuestion(pool, ['cuisine', 'price'])).toEqual({ axis: 'vibe', options: ['cozy', 'loud'] });
  });

  it('auto-skips an axis with only one distinct value', () => {
    // Everyone shares the same cuisine, so cuisine can't split the pool --
    // skip straight to price.
    const pool = [
      place({ id: 'a', category: 'sushi', priceBand: '$', tags: ['cozy'] }),
      place({ id: 'b', category: 'sushi', priceBand: '$$', tags: ['loud'] }),
      place({ id: 'c', category: 'sushi', priceBand: '$', tags: ['cozy'] }),
      place({ id: 'd', category: 'sushi', priceBand: '$$', tags: ['loud'] }),
    ];

    expect(nextQuestion(pool, [])).toEqual({ axis: 'price', options: ['$', '$$'] });
  });

  it('returns null once the pool is at or below STOP_AT', () => {
    const pool = [
      place({ id: 'a', category: 'sushi' }),
      place({ id: 'b', category: 'ramen' }),
      place({ id: 'c', category: 'yakitori' }),
    ];
    expect(pool.length).toBe(STOP_AT);

    expect(nextQuestion(pool, [])).toBeNull();
  });

  it('returns null when every splittable axis has already been asked', () => {
    const pool = [
      place({ id: 'a', category: 'sushi', priceBand: '$', tags: ['cozy'] }),
      place({ id: 'b', category: 'ramen', priceBand: '$$', tags: ['loud'] }),
      place({ id: 'c', category: 'sushi', priceBand: '$$', tags: ['cozy'] }),
      place({ id: 'd', category: 'ramen', priceBand: '$', tags: ['loud'] }),
    ];

    expect(nextQuestion(pool, ['cuisine', 'price', 'vibe'])).toBeNull();
  });
});
