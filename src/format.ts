/**
 * Presentation helpers for turning raw data values into human-readable labels.
 *
 * Category slugs arrive in two shapes: clean fixture values like `ramen` or
 * `cocktail-bar`, and raw Google Places types like `japanese_izakaya_restaurant`.
 * The UI should never show the raw snake/kebab slug to a user, so every place
 * label routes its category through `formatCategory`.
 */

/**
 * Humanizes a category slug into a Title Case label.
 *
 * - `japanese_izakaya_restaurant` -> `Japanese Izakaya`
 * - `chinese_restaurant` -> `Chinese`
 * - `cocktail-bar` -> `Cocktail Bar`
 * - `ramen` -> `Ramen`
 *
 * The trailing generic `restaurant` token is dropped only when other words
 * remain, so a bare `restaurant` still renders as `Restaurant` rather than an
 * empty string.
 */
export function formatCategory(category: string): string {
  const words = category
    .trim()
    .split(/[_\-\s]+/)
    .filter(Boolean);
  if (words.length === 0) return '';

  // Drop the generic "restaurant" suffix when it's not the only word, so
  // "Japanese Izakaya Restaurant" reads as "Japanese Izakaya".
  const trimmed =
    words.length > 1 && words[words.length - 1].toLowerCase() === 'restaurant'
      ? words.slice(0, -1)
      : words;

  return trimmed
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
