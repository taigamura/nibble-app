import { emptyTasteGraph } from '../../taste-engine';
import type { Place } from '../../taste-engine';
import { seedBeenSignals } from '../seedBeenSignals';

function place(overrides: Partial<Place> = {}): Place {
  return {
    id: 'p1',
    name: 'Fuunji',
    category: 'ramen',
    tags: ['tsukemen', 'late-night'],
    priceBand: '$',
    rating: 4.5,
    distanceMeters: 450,
    photoUrl: 'https://example.com/photo.jpg',
    ...overrides,
  };
}

describe('seedBeenSignals', () => {
  it('folds each tapped place into the graph as a been signal', () => {
    const ramen = place({ id: 'p1', category: 'ramen', tags: ['tsukemen'] });
    const bar = place({ id: 'p2', category: 'cocktail-bar', tags: ['speakeasy'] });

    const graph = seedBeenSignals(emptyTasteGraph(), [ramen, bar], 1000);

    expect(graph.actionedPlaceIds).toEqual(['p1', 'p2']);
    expect(graph.vector.ramen).toBe(2);
    expect(graph.vector.tsukemen).toBe(2);
    expect(graph.vector['cocktail-bar']).toBe(2);
    expect(graph.vector.speakeasy).toBe(2);
    expect(graph.history).toHaveLength(2);
    expect(graph.history.every((event) => event.action === 'been')).toBe(true);
  });

  it('returns the graph unchanged when no places are selected (skip)', () => {
    const graph = emptyTasteGraph();
    expect(seedBeenSignals(graph, [])).toBe(graph);
  });

  it('is a no-op composed onto an existing graph rather than a reset', () => {
    const ramen = place({ id: 'p1' });
    const seeded = seedBeenSignals(emptyTasteGraph(), [ramen], 1000);

    const bar = place({ id: 'p2', category: 'cocktail-bar', tags: [] });
    const seededAgain = seedBeenSignals(seeded, [bar], 2000);

    expect(seededAgain.actionedPlaceIds).toEqual(['p1', 'p2']);
    expect(seededAgain.vector.ramen).toBe(2);
    expect(seededAgain.vector['cocktail-bar']).toBe(2);
  });
});
