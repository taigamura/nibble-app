import { FIXTURE_PLACES } from '../fixtures/places';
import { emptyTasteGraph } from '../taste-engine';
import type { Place, TasteGraph } from '../taste-engine';
import type { DeckContext, EnrichmentProvider, PlacesProvider, Store } from './types';

export class FixturePlacesProvider implements PlacesProvider {
  constructor(private readonly places: Place[] = FIXTURE_PLACES) {}

  // Fixture data has no real geo spread to filter on, so the area/radius
  // context (issue #10) is accepted for interface parity but has no effect
  // here -- it only changes behavior in the real (Supabase-backed) provider.
  async getCandidates(_context?: DeckContext): Promise<Place[]> {
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
