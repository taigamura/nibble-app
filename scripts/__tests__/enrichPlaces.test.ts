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

    expect(result).toEqual({ tagged: 1, failed: 0 });
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

  it('skips a place whose upstream call fails, tags the rest, and reports the failure', async () => {
    const fetchImpl = jest.fn();
    // 1. fetchUntaggedPlaces -> two places
    fetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => [
        { place_id: 'p1', name: 'Rate Limited', category: 'ramen' },
        { place_id: 'p2', name: 'Fuunji', category: 'ramen' },
      ],
    });
    // 2. p1: Google Place Details -> 429, aborts this place only
    fetchImpl.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) });
    // 3. p2: Google Place Details -> ok
    fetchImpl.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ reviews: [] }) });
    // 4. p2: Anthropic -> ok
    fetchImpl.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ content: [{ type: 'text', text: JSON.stringify(validTags) }] }),
    });
    // 5. p2: persistTags PATCH -> ok
    fetchImpl.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) });

    const result = await runEnrichment({
      anthropicApiKey: 'a-key',
      googlePlacesApiKey: 'g-key',
      supabaseUrl: 'https://project.supabase.co',
      supabaseServiceRoleKey: 'service-key',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(result).toEqual({ tagged: 1, failed: 1 });
    // p1 never reaches persistTags; only p2's PATCH fires.
    const patchCalls = fetchImpl.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === 'PATCH',
    );
    expect(patchCalls).toHaveLength(1);
    expect(String(patchCalls[0][0])).toContain('place_id=eq.p2');
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

    expect(result).toEqual({ tagged: 0, failed: 0 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
