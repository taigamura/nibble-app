import AsyncStorage from '@react-native-async-storage/async-storage';

import { emptyTasteGraph, updateTaste } from '../../taste-engine';
import type { Place } from '../../taste-engine';
import { LocalStore } from '../localStore';

const place: Place = {
  id: 'a',
  name: 'A',
  category: 'cafe',
  tags: [],
  priceBand: '$',
  rating: 4,
  distanceMeters: 50,
  photoUrl: 'https://example.com/photo.jpg',
};

describe('LocalStore', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('returns an empty graph when nothing has been saved yet', async () => {
    const store = new LocalStore();
    await expect(store.getGraph()).resolves.toEqual(emptyTasteGraph());
  });

  it('round-trips a saved graph through AsyncStorage', async () => {
    const store = new LocalStore();
    const graph = updateTaste(emptyTasteGraph(), { place, action: 'want', timestamp: 1 });

    await store.saveGraph(graph);

    await expect(store.getGraph()).resolves.toEqual(graph);
  });

  it('persists across separate store instances (survives app restart)', async () => {
    const graph = updateTaste(emptyTasteGraph(), { place, action: 'been', timestamp: 1, rating: 5 });
    await new LocalStore().saveGraph(graph);

    await expect(new LocalStore().getGraph()).resolves.toEqual(graph);
  });

  it('clear() removes the saved graph', async () => {
    const store = new LocalStore();
    const graph = updateTaste(emptyTasteGraph(), { place, action: 'want', timestamp: 1 });
    await store.saveGraph(graph);

    await store.clear();

    await expect(store.getGraph()).resolves.toEqual(emptyTasteGraph());
  });

  it('keeps separate storage keys independent', async () => {
    const a = new LocalStore('key-a');
    const b = new LocalStore('key-b');
    const graph = updateTaste(emptyTasteGraph(), { place, action: 'want', timestamp: 1 });

    await a.saveGraph(graph);

    await expect(b.getGraph()).resolves.toEqual(emptyTasteGraph());
  });
});
