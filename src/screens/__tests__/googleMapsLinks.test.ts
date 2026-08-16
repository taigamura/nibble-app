import { Platform } from 'react-native';

import { buildMapUrl, buildWriteReviewUrl } from '../googleMapsLinks';
import type { Place } from '../../taste-engine';

const place: Place = {
  id: 'ChIJ_place_123',
  name: "Tsuta Ramen & Sons",
  category: 'ramen',
  tags: [],
  priceBand: '$$',
  rating: 4.5,
  distanceMeters: 300,
  photoUrl: 'https://example.com/photo.jpg',
};

const placeWithGeo: Place = { ...place, lat: 35.7, lng: 139.8 };

describe('buildMapUrl', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
  });

  it('deep-links to Apple Maps on iOS', () => {
    Platform.OS = 'ios';
    const url = buildMapUrl(place);
    expect(url).toBe('http://maps.apple.com/?q=Tsuta%20Ramen%20%26%20Sons');
  });

  it('includes coordinates for Apple Maps when available', () => {
    Platform.OS = 'ios';
    const url = buildMapUrl(placeWithGeo);
    expect(url).toBe('http://maps.apple.com/?q=Tsuta%20Ramen%20%26%20Sons&ll=35.7,139.8');
  });

  it('deep-links to Google Maps navigation on Android', () => {
    Platform.OS = 'android';
    const url = buildMapUrl(place);
    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Tsuta%20Ramen%20%26%20Sons&destination_place_id=ChIJ_place_123'
    );
  });

  it('deep-links to Google Maps navigation on web', () => {
    Platform.OS = 'web';
    const url = buildMapUrl(place);
    expect(url).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Tsuta%20Ramen%20%26%20Sons&destination_place_id=ChIJ_place_123'
    );
  });
});

describe('buildWriteReviewUrl', () => {
  it('deep-links to the Maps write-a-review screen using the stored place id', () => {
    const url = buildWriteReviewUrl(place);
    expect(url).toBe('https://search.google.com/local/writereview?placeid=ChIJ_place_123');
  });
});
