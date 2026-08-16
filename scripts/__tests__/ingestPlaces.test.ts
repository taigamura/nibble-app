import { buildSeedGrid, isFoodPrimaryType, mapGoogleResultToRow, SEED_POINTS } from '../ingestPlaces';
import { haversineMeters } from '../../src/providers/curatedPlace';

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
        photos: [{ name: 'places/g123/photos/abc' }, { name: 'places/g123/photos/def' }],
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
      photo_references: ['places/g123/photos/abc', 'places/g123/photos/def'],
      refreshed_at: now.toISOString(),
    });
  });

  it('caps the gallery and tolerates a photoless result', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ name: `places/g/photos/${i}` }));
    const row = mapGoogleResultToRow(
      {
        id: 'g999',
        displayName: { text: 'Photogenic' },
        location: { latitude: 35.6595, longitude: 139.7005 },
        photos: many,
      },
      new Date('2026-08-15T00:00:00.000Z'),
    );
    expect(row?.photo_references).toHaveLength(5);
    expect(row?.photo_reference).toBe('places/g/photos/0');

    const noPhotos = mapGoogleResultToRow({
      id: 'g000',
      displayName: { text: 'No Photos' },
      location: { latitude: 35.6595, longitude: 139.7005 },
    });
    expect(noPhotos?.photo_references).toEqual([]);
    expect(noPhotos?.photo_reference).toBeNull();
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

describe('buildSeedGrid', () => {
  const bounds = { minLat: 0, maxLat: 1, minLng: 0, maxLng: 1 };

  it('tiles a bounding box inclusive of both edges', () => {
    const grid = buildSeedGrid(bounds, 0.5, 0.5);
    // 0, 0.5, 1 in each axis -> a 3x3 grid.
    expect(grid).toHaveLength(9);
    expect(grid).toContainEqual({ lat: 0, lng: 0 });
    expect(grid).toContainEqual({ lat: 1, lng: 1 });
  });

  it('keeps the far edge despite floating-point step accumulation', () => {
    const grid = buildSeedGrid({ minLat: 0, maxLat: 0.3, minLng: 0, maxLng: 0 }, 0.1, 1);
    // 0, 0.1, 0.2, 0.3 -- the epsilon guard prevents 0.3 from being dropped.
    expect(grid.map((p) => p.lat)).toEqual([0, 0.1, 0.2, 0.3]);
  });
});

describe('SEED_POINTS coverage', () => {
  // The real Kinshicho spots that motivated the denser grid + distance ranking.
  const examples = [
    { name: 'Jitan', lat: 35.6983696, lng: 139.810093 },
    { name: 'Dessert lab', lat: 35.6980012, lng: 139.8118383 },
  ];

  it.each(examples)('has a seed circle (800m radius) covering $name', ({ lat, lng }) => {
    const nearest = Math.min(
      ...SEED_POINTS.map((seed) => haversineMeters(seed, { lat, lng })),
    );
    expect(nearest).toBeLessThan(800);
  });
});
