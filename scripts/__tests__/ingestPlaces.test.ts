import { isFoodPrimaryType, mapGoogleResultToRow } from '../ingestPlaces';

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

  it('rejects results whose primary type is not a food-and-drink type', () => {
    const nonFood = mapGoogleResultToRow({
      id: 'hotel1',
      displayName: { text: 'Grand Hotel (has a restaurant inside)' },
      primaryType: 'lodging',
      location: { latitude: 35.6956, longitude: 139.8124 },
    });
    expect(nonFood).toBeNull();

    const conbini = mapGoogleResultToRow({
      id: 'conbini1',
      displayName: { text: '7-Eleven' },
      primaryType: 'convenience_store',
      location: { latitude: 35.6956, longitude: 139.8124 },
    });
    expect(conbini).toBeNull();
  });

  it('keeps food-and-drink primary types (subtypes and the curated set)', () => {
    expect(isFoodPrimaryType('japanese_restaurant')).toBe(true);
    expect(isFoodPrimaryType('ramen_restaurant')).toBe(true);
    expect(isFoodPrimaryType('cafe')).toBe(true);
    expect(isFoodPrimaryType('coffee_shop')).toBe(true);
    expect(isFoodPrimaryType('bakery')).toBe(true);
    expect(isFoodPrimaryType(undefined)).toBe(true);
    expect(isFoodPrimaryType('lodging')).toBe(false);
    expect(isFoodPrimaryType('supermarket')).toBe(false);
    expect(isFoodPrimaryType('gas_station')).toBe(false);
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
