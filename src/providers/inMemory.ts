import { FIXTURE_PLACES } from '../fixtures/places';
import { emptyTasteGraph } from '../taste-engine';
import type { Place, TasteGraph } from '../taste-engine';
import type { EnrichmentProvider, PlacesProvider, Store } from './types';

export class FixturePlacesProvider implements PlacesProvider {
  constructor(private readonly places: Place[] = FIXTURE_PLACES) {}

  async getCandidates(): Promise<Place[]> {
    return this.places;
  }
}

/** Passes through the tags already on the fixture data — no LLM call. */
export class NoopEnrichmentProvider implements EnrichmentProvider {
  async enrich(place: Place): Promise<string[]> {
    return place.tags;
  }
}

export class InMemoryStore implements Store {
  private graph: TasteGraph;

  constructor(initialGraph: TasteGraph = emptyTasteGraph()) {
    this.graph = initialGraph;
  }

  async getGraph(): Promise<TasteGraph> {
    return this.graph;
  }

  async saveGraph(graph: TasteGraph): Promise<void> {
    this.graph = graph;
  }
}
