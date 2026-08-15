import { mapGoogleResultToRow } from '../ingestPlaces';

describe('mapGoogleResultToRow', () => {
  it('maps a Google Places (New) result into a curated place row', () => {
    const now = new Date('2026-08-15T00:00:00.000Z');
    const row = mapGoogleResultToRow(
      {
        id: 'g123',
        displayName: { text: 'Fuunji' },
        primaryType: 'ramen_restaurant',
        priceLevel: 'PRICE_LEVEL_INEXPENSIVE',
        rating: 4.5,
        location: { latitude: 35.6595, longitude: 139.7005 },
        photos: [{ name: 'places/g123/photos/abc' }],
      },
      now,
    );

    expect(row).toEqual({
      place_id: 'g123',
      name: 'Fuunji',
      category: 'ramen_restaurant',
      tags: [],
      price_band: '$',
      rating: 4.5,
      lat: 35.6595,
      lng: 139.7005,
      photo_reference: 'places/g123/photos/abc',
      refreshed_at: now.toISOString(),
    });
  });

  it('returns null when the result has no name or location', () => {
    expect(mapGoogleResultToRow({ id: 'g1' })).toBeNull();
  });

  it('carries forward existing tags so a re-ingest refresh does not wipe enrichment', () => {
    const row = mapGoogleResultToRow(
      {
        id: 'g123',
        displayName: { text: 'Fuunji' },
        location: { latitude: 35.6595, longitude: 139.7005 },
      },
      new Date('2026-08-15T00:00:00.000Z'),
      ['tsukemen', 'good-for:solo'],
    );

    expect(row?.tags).toEqual(['tsukemen', 'good-for:solo']);
  });

  it('defaults missing rating, price level, and photos to safe values', () => {
    const row = mapGoogleResultToRow({
      id: 'g2',
      displayName: { text: 'No Frills Cafe' },
      location: { latitude: 35.6, longitude: 139.7 },
    });

    expect(row).toMatchObject({
      rating: 0,
      price_band: '$$',
      photo_reference: null,
      category: 'restaurant',
    });
  });
});
