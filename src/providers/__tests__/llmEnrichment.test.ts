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
  function fakeFetch(googleBody: unknown, anthropicText: string): jest.Mock {
    return jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => googleBody })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ content: [{ type: 'text', text: anthropicText }] }),
      });
  }

  it('fetches reviews, calls the LLM, and returns flattened tags', async () => {
    const fetchImpl = fakeFetch(
      { reviews: [{ text: { text: 'Amazing espresso' } }, { text: { text: 'Tiny counter seating' } }] },
      JSON.stringify(tags()),
    );

    const provider = new LlmEnrichmentProvider({
      anthropicApiKey: 'anthropic-key',
      googlePlacesApiKey: 'google-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await provider.enrich({ id: 'place-1', name: 'Fuunji', category: 'ramen' });

    expect(result).toEqual(flattenEnrichmentTags(tags()));
    expect(fetchImpl).toHaveBeenCalledTimes(2);

    const [googleUrl, googleInit] = fetchImpl.mock.calls[0];
    expect(String(googleUrl)).toContain('places/place-1');
    expect((googleInit as RequestInit).headers).toMatchObject({ 'X-Goog-Api-Key': 'google-key' });

    const [anthropicUrl, anthropicInit] = fetchImpl.mock.calls[1];
    expect(String(anthropicUrl)).toBe('https://api.anthropic.com/v1/messages');
    expect((anthropicInit as RequestInit).headers).toMatchObject({ 'x-api-key': 'anthropic-key' });
    const body = JSON.parse((anthropicInit as RequestInit).body as string);
    expect(body.messages[0].content).toContain('Amazing espresso');
  });

  it('handles places with no reviews', async () => {
    const fetchImpl = fakeFetch({}, JSON.stringify(tags()));

    const provider = new LlmEnrichmentProvider({
      anthropicApiKey: 'anthropic-key',
      googlePlacesApiKey: 'google-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const result = await provider.enrich({ id: 'place-2', name: 'New Spot', category: 'cafe' });
    expect(result).toEqual(flattenEnrichmentTags(tags()));
  });

  it('throws when the Google Place Details lookup fails', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    const provider = new LlmEnrichmentProvider({
      anthropicApiKey: 'anthropic-key',
      googlePlacesApiKey: 'google-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(provider.enrich({ id: 'missing', name: 'Ghost', category: 'cafe' })).rejects.toThrow('status 404');
  });

  it('throws when the Anthropic call fails', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ reviews: [] }) })
      .mockResolvedValueOnce({ ok: false, status: 500 });

    const provider = new LlmEnrichmentProvider({
      anthropicApiKey: 'anthropic-key',
      googlePlacesApiKey: 'google-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(provider.enrich({ id: 'place-3', name: 'Cafe', category: 'cafe' })).rejects.toThrow('status 500');
  });
});
