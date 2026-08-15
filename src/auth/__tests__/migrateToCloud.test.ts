import { InMemoryStore } from '../../providers/inMemory';
import { updateTaste } from '../../taste-engine';
import type { Place, TasteGraph } from '../../taste-engine';
import { migrateLocalDataToCloud } from '../migrateToCloud';

function place(id: string): Place {
  return {
    id,
    name: id,
    category: 'cafe',
    tags: [],
    priceBand: '$',
    rating: 4,
    distanceMeters: 50,
    photoUrl: 'https://example.com/photo.jpg',
  };
}

function graphFrom(...ids: string[]): TasteGraph {
  return ids.reduce(
    (graph, id, index) => updateTaste(graph, { place: place(id), action: 'want', timestamp: index }),
    { vector: {}, actionedPlaceIds: [], history: [], ratings: {} } as TasteGraph
  );
}

describe('migrateLocalDataToCloud', () => {
  it('merges the local graph into the cloud store and persists it there', async () => {
    const local = new InMemoryStore(graphFrom('a'));
    const cloud = new InMemoryStore(graphFrom('b'));

    const merged = await migrateLocalDataToCloud(local, cloud);

    expect(merged.actionedPlaceIds.sort()).toEqual(['a', 'b']);
    await expect(cloud.getGraph()).resolves.toEqual(merged);
  });

  it('never writes back to the local store', async () => {
    const localGraph = graphFrom('a');
    const local = new InMemoryStore(localGraph);
    const cloud = new InMemoryStore();

    await migrateLocalDataToCloud(local, cloud);

    await expect(local.getGraph()).resolves.toEqual(localGraph);
  });
});
