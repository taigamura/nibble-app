import { runEnrichment } from '../enrichPlaces';

describe('runEnrichment', () => {
  function fetchSequence(...responses: unknown[]): jest.Mock {
    const mock = jest.fn();
    for (const body of responses) {
      mock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body });
    }
    return mock;
  }

  const validTags = {
    vibe: ['minimal', 'quiet'],
    chain_or_indie: 'indie',
    specialty: 'pour-over coffee',
    good_for: ['solo'],
    not_for: ['groups'],
    price_band: 'mid',
    noise: 'quiet',
  };

  it('only tags places selected via the untagged filter, and persists the flattened tags', async () => {
    const fetchImpl = fetchSequence(
      // 1. fetchUntaggedPlaces
      [{ place_id: 'p1', name: 'Fuunji', category: 'ramen' }],
      // 2. LlmEnrichmentProvider: Google Place Details
      { reviews: [{ text: { text: 'Great ramen' } }] },
      // 3. LlmEnrichmentProvider: Anthropic
      { content: [{ type: 'text', text: JSON.stringify(validTags) }] },
      // 4. persistTags PATCH
      {},
    );

    const result = await runEnrichment({
      anthropicApiKey: 'a-key',
      googlePlacesApiKey: 'g-key',
      supabaseUrl: 'https://project.supabase.co',
      supabaseServiceRoleKey: 'service-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ tagged: 1 });
    expect(fetchImpl).toHaveBeenCalledTimes(4);

    const [selectUrl] = fetchImpl.mock.calls[0];
    expect(String(selectUrl)).toContain('tags=eq.%5B%5D');

    const [patchUrl, patchInit] = fetchImpl.mock.calls[3];
    expect(String(patchUrl)).toContain('place_id=eq.p1');
    expect((patchInit as RequestInit).method).toBe('PATCH');
    const body = JSON.parse((patchInit as RequestInit).body as string);
    expect(body.tags).toEqual([
      'minimal',
      'quiet',
      'indie',
      'pour-over coffee',
      'good-for:solo',
      'avoid:groups',
      'mid',
      'quiet',
    ]);
  });

  it('does nothing when there are no untagged places', async () => {
    const fetchImpl = fetchSequence([]);

    const result = await runEnrichment({
      anthropicApiKey: 'a-key',
      googlePlacesApiKey: 'g-key',
      supabaseUrl: 'https://project.supabase.co',
      supabaseServiceRoleKey: 'service-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ tagged: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
