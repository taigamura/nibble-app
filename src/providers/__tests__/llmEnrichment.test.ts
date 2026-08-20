import {
  buildEnrichmentPrompt,
  flattenEnrichmentTags,
  LlmEnrichmentProvider,
  parseEnrichmentResponse,
  type EnrichmentTags,
} from '../llmEnrichment';

function tags(overrides: Partial<EnrichmentTags> = {}): EnrichmentTags {
  return {
    vibe: ['minimal', 'intense', 'counter-seating'],
    chain_or_indie: 'indie',
    specialty: 'third-wave espresso',
    good_for: ['solo', 'quick'],
    not_for: ['groups', 'laptop-work'],
    price_band: 'mid',
    noise: 'quiet',
    ...overrides,
  };
}

describe('flattenEnrichmentTags', () => {
  it('flattens the structured record into the flat tag vocabulary', () => {
    expect(flattenEnrichmentTags(tags())).toEqual([
      'minimal',
      'intense',
      'counter-seating',
      'indie',
      'third-wave espresso',
      'good-for:solo',
      'good-for:quick',
      'avoid:groups',
      'avoid:laptop-work',
      'mid',
      'quiet',
    ]);
  });

  it('drops empty values', () => {
    expect(flattenEnrichmentTags(tags({ specialty: '', good_for: [], not_for: [] }))).toEqual([
      'minimal',
      'intense',
      'counter-seating',
      'indie',
      'mid',
      'quiet',
    ]);
  });
});

describe('parseEnrichmentResponse', () => {
  it('parses raw JSON', () => {
    expect(parseEnrichmentResponse(JSON.stringify(tags()))).toEqual(tags());
  });

  it('parses JSON wrapped in a markdown code fence', () => {
    const fenced = '```json\n' + JSON.stringify(tags()) + '\n```';
    expect(parseEnrichmentResponse(fenced)).toEqual(tags());
  });

  it('throws when a required key is missing', () => {
    const { vibe: _vibe, ...rest } = tags();
    expect(() => parseEnrichmentResponse(JSON.stringify(rest))).toThrow('vibe');
  });

  it('coerces a scalar string into a single-element array for array fields', () => {
    const raw = JSON.stringify({ ...tags(), good_for: 'solo' });
    expect(parseEnrichmentResponse(raw)).toEqual(tags({ good_for: ['solo'] }));
  });

  it('coerces null/non-array array fields into empty arrays', () => {
    const raw = JSON.stringify({ ...tags(), not_for: null });
    expect(parseEnrichmentResponse(raw)).toEqual(tags({ not_for: [] }));
  });
});

describe('buildEnrichmentPrompt', () => {
  it('includes the place name and numbered reviews', () => {
    const prompt = buildEnrichmentPrompt({ name: 'Fuunji', category: 'ramen' }, ['Great tsukemen', 'Long lines']);
    expect(prompt).toContain('Fuunji');
    expect(prompt).toContain('1. Great tsukemen');
    expect(prompt).toContain('2. Long lines');
  });

  it('notes when there are no reviews', () => {
    const prompt = buildEnrichmentPrompt({ name: 'New Spot', category: 'cafe' }, []);
    expect(prompt).toContain('no reviews available');
  });
});

describe('LlmEnrichmentProvider', () => {
  // Only Google Place Details is fetched over HTTP; the LLM step is the
  // injected `completePrompt` (the local `claude` CLI in production).
  function googleFetch(googleBody: unknown): jest.Mock {
    return jest.fn().mockResolvedValueOnce({ ok: true, status: 200, json: async () => googleBody });
  }

  it('fetches reviews, calls the completion backend, and returns flattened tags', async () => {
    const fetchImpl = googleFetch({
      reviews: [{ text: { text: 'Amazing espresso' } }, { text: { text: 'Tiny counter seating' } }],
    });
    const completePrompt = jest.fn(async (_prompt: string) => JSON.stringify(tags()));

    const provider = new LlmEnrichmentProvider({
      googlePlacesApiKey: 'google-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      completePrompt,
    });

    const result = await provider.enrich({ id: 'place-1', name: 'Fuunji', category: 'ramen' });

    expect(result).toEqual(flattenEnrichmentTags(tags()));
    // Exactly one HTTP call, and it's Google — never an Anthropic endpoint.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [googleUrl, googleInit] = fetchImpl.mock.calls[0];
    expect(String(googleUrl)).toContain('places/place-1');
    expect((googleInit as RequestInit).headers).toMatchObject({ 'X-Goog-Api-Key': 'google-key' });

    // The prompt handed to the completion backend carries the reviews.
    expect(completePrompt).toHaveBeenCalledTimes(1);
    expect(completePrompt.mock.calls[0][0]).toContain('Amazing espresso');
  });

  it('handles places with no reviews', async () => {
    const fetchImpl = googleFetch({});
    const provider = new LlmEnrichmentProvider({
      googlePlacesApiKey: 'google-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      completePrompt: async () => JSON.stringify(tags()),
    });

    const result = await provider.enrich({ id: 'place-2', name: 'New Spot', category: 'cafe' });
    expect(result).toEqual(flattenEnrichmentTags(tags()));
  });

  it('throws when the Google Place Details lookup fails', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    const provider = new LlmEnrichmentProvider({
      googlePlacesApiKey: 'google-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      completePrompt: async () => JSON.stringify(tags()),
    });

    await expect(provider.enrich({ id: 'missing', name: 'Ghost', category: 'cafe' })).rejects.toThrow('status 404');
  });

  it('propagates a completion-backend failure', async () => {
    const fetchImpl = googleFetch({ reviews: [] });
    const provider = new LlmEnrichmentProvider({
      googlePlacesApiKey: 'google-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
      completePrompt: async () => {
        throw new Error('claude CLI exited 1');
      },
    });

    await expect(provider.enrich({ id: 'place-3', name: 'Cafe', category: 'cafe' })).rejects.toThrow('claude CLI');
  });
});
