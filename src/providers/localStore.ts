import AsyncStorage from '@react-native-async-storage/async-storage';

import { emptyTasteGraph } from '../taste-engine';
import type { TasteGraph } from '../taste-engine';
import type { Store } from './types';

const DEFAULT_STORAGE_KEY = 'nibble.tasteGraph.v1';

/**
 * Persists the taste graph on-device via AsyncStorage. This is the default
 * `Store` for a brand-new anonymous user (issue #9): swipes, Want, and Been
 * all live in `TasteGraph.history`, so persisting the graph alone survives
 * app restarts with no account and no server round-trip.
 */
export class LocalStore implements Store {
  constructor(private readonly storageKey: string = DEFAULT_STORAGE_KEY) {}

  async getGraph(): Promise<TasteGraph> {
    const raw = await AsyncStorage.getItem(this.storageKey);
    if (!raw) return emptyTasteGraph();
    return JSON.parse(raw) as TasteGraph;
  }

  async saveGraph(graph: TasteGraph): Promise<void> {
    await AsyncStorage.setItem(this.storageKey, JSON.stringify(graph));
  }

  /** Called after a successful migration to cloud, so a later sign-out starts clean. */
  async clear(): Promise<void> {
    await AsyncStorage.removeItem(this.storageKey);
  }
}
