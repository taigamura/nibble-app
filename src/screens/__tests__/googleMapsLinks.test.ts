import { buildDirectionsUrl, buildWriteReviewUrl } from '../googleMapsLinks';
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

describe('buildDirectionsUrl', () => {
  it('deep-links to Maps navigation using the stored place id', () => {
    const url = buildDirectionsUrl(place);
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
