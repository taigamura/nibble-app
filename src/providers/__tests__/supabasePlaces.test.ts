import { SupabasePlacesProvider } from '../supabasePlaces';
import type { CuratedPlaceRow } from '../curatedPlace';

function row(overrides: Partial<CuratedPlaceRow> = {}): CuratedPlaceRow {
  return {
    place_id: 'near',
    name: 'Near Place',
    category: 'ramen',
    tags: [],
    price_band: '$',
    rating: 4,
    lat: 35.6595,
    lng: 139.7005,
    photo_reference: null,
    refreshed_at: new Date().toISOString(),
    ...overrides,
  };
}

function fakeFetch(rows: CuratedPlaceRow[]): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => rows,
  });
}

describe('SupabasePlacesProvider', () => {
  it('queries the curated places table and maps rows to Place[], sorted by distance', async () => {
    const rows = [
      row({ place_id: 'far', lat: 35.68, lng: 139.72 }),
      row({ place_id: 'near', lat: 35.6596, lng: 139.7006 }),
    ];
    const fetchImpl = fakeFetch(rows);

    const provider = new SupabasePlacesProvider({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      googlePlacesApiKey: 'google-key',
      getUserLocation: async () => ({ lat: 35.6595, lng: 139.7005 }),
      radiusMeters: 5000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const places = await provider.getCandidates();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toContain(`${'https://project.supabase.co'}/rest/v1/places`);
    expect((init as RequestInit).headers).toMatchObject({ apikey: 'anon-key' });

    expect(places.map((p) => p.id)).toEqual(['near', 'far']);
  });

  it('filters out rows outside the requested radius', async () => {
    const rows = [
      row({ place_id: 'inside', lat: 35.6596, lng: 139.7006 }),
      row({ place_id: 'far-away', lat: 35.9, lng: 139.9 }),
    ];
    const fetchImpl = fakeFetch(rows);

    const provider = new SupabasePlacesProvider({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      googlePlacesApiKey: 'google-key',
      getUserLocation: async () => ({ lat: 35.6595, lng: 139.7005 }),
      radiusMeters: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const places = await provider.getCandidates();
    expect(places.map((p) => p.id)).toEqual(['inside']);
  });

  it('overrides the default center and radius with the given DeckContext (issue #10)', async () => {
    const rows = [
      row({ place_id: 'near-shimokita', lat: 35.6614, lng: 139.6684 }),
      row({ place_id: 'near-default', lat: 35.6596, lng: 139.7006 }),
    ];
    const fetchImpl = fakeFetch(rows);
    const getUserLocation = jest.fn().mockResolvedValue({ lat: 35.6595, lng: 139.7005 });

    const provider = new SupabasePlacesProvider({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      googlePlacesApiKey: 'google-key',
      getUserLocation,
      radiusMeters: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    const places = await provider.getCandidates({
      center: { lat: 35.6613, lng: 139.6683 },
      radiusMeters: 500,
    });

    // The overridden center is used instead of calling getUserLocation, and
    // only the place near that center survives the (overridden, wider) radius.
    expect(getUserLocation).not.toHaveBeenCalled();
    expect(places.map((p) => p.id)).toEqual(['near-shimokita']);
  });

  it('throws when the Supabase query fails', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 500 });
    const provider = new SupabasePlacesProvider({
      supabaseUrl: 'https://project.supabase.co',
      supabaseAnonKey: 'anon-key',
      googlePlacesApiKey: 'google-key',
      getUserLocation: async () => ({ lat: 35.6595, lng: 139.7005 }),
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    await expect(provider.getCandidates()).rejects.toThrow('status 500');
  });
});
