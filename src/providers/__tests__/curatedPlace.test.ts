import { buildPhotoUrl, haversineMeters, needsRefresh, toPlace } from '../curatedPlace';
import type { CuratedPlaceRow } from '../curatedPlace';

function row(overrides: Partial<CuratedPlaceRow> = {}): CuratedPlaceRow {
  return {
    place_id: 'g123',
    name: 'Fuunji',
    category: 'ramen',
    tags: ['tsukemen'],
    price_band: '$',
    rating: 4.5,
    lat: 35.6595,
    lng: 139.7005,
    photo_reference: 'places/g123/photos/abc',
    refreshed_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('haversineMeters', () => {
  it('is zero for identical points', () => {
    expect(haversineMeters({ lat: 35.66, lng: 139.7 }, { lat: 35.66, lng: 139.7 })).toBe(0);
  });

  it('returns a plausible distance for two nearby Tokyo points', () => {
    // Shibuya to Ebisu, roughly ~1.7km apart.
    const meters = haversineMeters({ lat: 35.6595, lng: 139.7005 }, { lat: 35.6465, lng: 139.6989 });
    expect(meters).toBeGreaterThan(1300);
    expect(meters).toBeLessThan(2000);
  });
});

describe('buildPhotoUrl', () => {
  it('constructs a direct Google Places photo media URL', () => {
    const url = buildPhotoUrl('places/g123/photos/abc', 'test-key');
    expect(url).toBe('https://places.googleapis.com/v1/places/g123/photos/abc/media?maxWidthPx=800&key=test-key');
  });
});

describe('toPlace', () => {
  it('maps a curated row into a taste-engine Place with distance and a real photo URL', () => {
    const place = toPlace(row(), { lat: 35.6595, lng: 139.7005 }, 'test-key');

    expect(place).toMatchObject({
      id: 'g123',
      name: 'Fuunji',
      category: 'ramen',
      tags: ['tsukemen'],
      priceBand: '$',
      rating: 4.5,
      distanceMeters: 0,
    });
    expect(place.photoUrl).toContain('places.googleapis.com');
  });

  it('falls back to a placeholder photo when no photo reference is stored', () => {
    const place = toPlace(row({ photo_reference: null }), { lat: 35.6595, lng: 139.7005 }, 'test-key');
    expect(place.photoUrl).not.toContain('places.googleapis.com');
  });

  it('builds a deduped, capped gallery from photo_references (hero first)', () => {
    const place = toPlace(
      row({
        photo_reference: 'places/g123/photos/a',
        photo_references: [
          'places/g123/photos/a',
          'places/g123/photos/a', // duplicate hero -> collapsed
          'places/g123/photos/b',
          'places/g123/photos/c',
          'places/g123/photos/d',
          'places/g123/photos/e',
          'places/g123/photos/f', // 6th distinct -> dropped by the cap of 5
        ],
      }),
      { lat: 35.6595, lng: 139.7005 },
      'test-key',
    );
    expect(place.photoUrls).toHaveLength(5);
    expect(place.photoUrls?.[0]).toBe(place.photoUrl);
    expect(place.photoUrls?.every((url) => url.includes('places.googleapis.com'))).toBe(true);
  });

  it('falls back to the legacy single reference for rows without a gallery column', () => {
    const place = toPlace(row({ photo_references: undefined }), { lat: 35.6595, lng: 139.7005 }, 'test-key');
    expect(place.photoUrls).toEqual([place.photoUrl]);
  });
});

describe('needsRefresh', () => {
  it('is false for a row refreshed today', () => {
    expect(needsRefresh({ refreshed_at: new Date().toISOString() })).toBe(false);
  });

  it('is true for a row refreshed 31 days ago', () => {
    const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    expect(needsRefresh({ refreshed_at: thirtyOneDaysAgo })).toBe(true);
  });
});
