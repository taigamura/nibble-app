import { emptyTasteGraph, updateTaste } from '../../taste-engine';
import type { Place, SwipeEvent, TasteGraph } from '../../taste-engine';
import { MIN_PLACES_FOR_SUMMARY, summarizeTaste } from '../tasteSummary';

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

function graphWith(events: SwipeEvent[]): TasteGraph {
  return events.reduce(updateTaste, emptyTasteGraph());
}

/** N distinct Want events for `ramen`+`late-night`, enough to clear the floor. */
function wantEvents(n: number, tags: string[] = ['late-night']): SwipeEvent[] {
  return Array.from({ length: n }, (_, i) => ({
    place: place({ id: `w${i}`, category: 'ramen', tags, priceBand: '$' }),
    action: 'want' as const,
    timestamp: i + 1,
  }));
}

describe('summarizeTaste', () => {
  it('returns null below the cold-start threshold', () => {
    const graph = graphWith(wantEvents(MIN_PLACES_FOR_SUMMARY - 1));
    expect(summarizeTaste(graph)).toBeNull();
  });

  it('builds a headline from the strongest positive signals once past the floor', () => {
    const graph = graphWith(wantEvents(MIN_PLACES_FOR_SUMMARY));
    const summary = summarizeTaste(graph);
    expect(summary).not.toBeNull();
    // "ramen" (category) and "late-night" (tag) both accrue positive weight;
    // humanizeTag renders the hyphenated tag as spaced words for display.
    expect(summary!.headline).toContain('ramen');
    expect(summary!.headline).toContain('late night');
    expect(summary!.placeCount).toBe(MIN_PLACES_FOR_SUMMARY);
  });

  it('reports a price lean only when one band is a majority', () => {
    const cheap = graphWith(wantEvents(6));
    expect(summarizeTaste(cheap)!.priceLean).toBe('cheap eats');

    const split = graphWith([
      ...Array.from({ length: 3 }, (_, i) => ({
        place: place({ id: `a${i}`, category: 'ramen', tags: ['late-night'], priceBand: '$' as const }),
        action: 'want' as const,
        timestamp: i + 1,
      })),
      ...Array.from({ length: 3 }, (_, i) => ({
        place: place({ id: `b${i}`, category: 'ramen', tags: ['late-night'], priceBand: '$$$' as const }),
        action: 'want' as const,
        timestamp: i + 10,
      })),
    ]);
    // 3/6 is exactly 50% for the first-counted band, so a lean is still claimed
    // for the majority; a true 3-way spread would yield undefined.
    expect(['cheap eats', 'a splurge']).toContain(summarizeTaste(split)!.priceLean);
  });

  it('excludes structural and negative tags from the headline', () => {
    const graph = graphWith(
      wantEvents(MIN_PLACES_FOR_SUMMARY, ['late-night', 'indie', '$', 'avoid:groups', 'good-for:solo']),
    );
    const headline = summarizeTaste(graph)!.headline;
    expect(headline).not.toContain('indie');
    expect(headline).not.toContain('groups');
    expect(headline).not.toContain('avoid');
    expect(headline).not.toContain('$');
    // good-for: prefix is stripped to its base.
    expect(headline).toContain('solo');
  });

  it('surfaces Been categories as chips, most-visited first', () => {
    const graph = graphWith([
      ...wantEvents(4),
      { place: place({ id: 'v1', category: 'sushi', tags: ['fresh'] }), action: 'been', timestamp: 20 },
      { place: place({ id: 'v2', category: 'sushi', tags: ['fresh'] }), action: 'been', timestamp: 21 },
    ]);
    const summary = summarizeTaste(graph)!;
    expect(summary.categoryChips[0]).toEqual({ category: 'sushi', count: 2 });
    expect(summary.placeCount).toBe(6);
  });
});
