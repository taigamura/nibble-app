import { formatCategory } from '../format';

describe('formatCategory', () => {
  it('title-cases a single-word slug', () => {
    expect(formatCategory('ramen')).toBe('Ramen');
  });

  it('splits kebab-case into words', () => {
    expect(formatCategory('cocktail-bar')).toBe('Cocktail Bar');
  });

  it('splits snake_case and drops a trailing generic "restaurant"', () => {
    expect(formatCategory('japanese_izakaya_restaurant')).toBe('Japanese Izakaya');
    expect(formatCategory('chinese_restaurant')).toBe('Chinese');
  });

  it('keeps a bare "restaurant" rather than emptying it', () => {
    expect(formatCategory('restaurant')).toBe('Restaurant');
  });

  it('normalizes mixed casing and extra separators', () => {
    expect(formatCategory('SHABU__shabu')).toBe('Shabu Shabu');
  });

  it('returns an empty string for an empty slug', () => {
    expect(formatCategory('')).toBe('');
  });
});
