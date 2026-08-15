import { emptyTasteGraph, updateTaste } from '../../taste-engine';
import type { Place } from '../../taste-engine';
import { SupabaseStore } from '../supabaseStore';

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

const session = { userId: 'user-1', accessToken: 'token-1' };

describe('SupabaseStore', () => {
  it('fetches the graph scoped to the signed-in user', async () => {
    const graph = updateTaste(emptyTasteGraph(), { place, action: 'want', timestamp: 1 });
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => [{ graph }] });
    const store = new SupabaseStore({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      getSession: async () => session,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(store.getGraph()).resolves.toEqual(graph);

    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain('user_id=eq.user-1');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer token-1' });
  });

  it('returns an empty graph when the user has no row yet', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => [] });
    const store = new SupabaseStore({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      getSession: async () => session,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(store.getGraph()).resolves.toEqual(emptyTasteGraph());
  });

  it('upserts the graph on save', async () => {
    const graph = updateTaste(emptyTasteGraph(), { place, action: 'been', timestamp: 1, rating: 5 });
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const store = new SupabaseStore({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      getSession: async () => session,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await store.saveGraph(graph);

    const [, init] = fetchImpl.mock.calls[0];
    expect((init as RequestInit).method).toBe('POST');
    expect((init as RequestInit).headers).toMatchObject({ Prefer: 'resolution=merge-duplicates' });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ user_id: 'user-1', graph });
  });

  it('throws when the fetch fails', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const store = new SupabaseStore({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      getSession: async () => session,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(store.getGraph()).rejects.toThrow('status 500');
  });
});
