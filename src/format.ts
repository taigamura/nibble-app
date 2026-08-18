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
/**
 * Splits a category/tag slug into its words and drops the trailing generic
 * `restaurant` token (unless it's the only word), shared by the display
 * helpers below so they humanize slugs identically.
 */
function slugWords(slug: string): string[] {
  const words = slug
    .trim()
    .split(/[_\-\s]+/)
    .filter(Boolean);

  // Drop the generic "restaurant" suffix when it's not the only word, so
  // "japanese izakaya restaurant" reads as "japanese izakaya".
  return words.length > 1 && words[words.length - 1].toLowerCase() === 'restaurant'
    ? words.slice(0, -1)
    : words;
}

export function formatCategory(category: string): string {
  return slugWords(category)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Humanizes a category/tag slug into a lowercase phrase, for inline use inside
 * a sentence (e.g. the "Because you like ..." reason pill), where Title Case
 * would read as shouting. `japanese_restaurant` -> `japanese`,
 * `cocktail-bar` -> `cocktail bar`, `minimal` -> `minimal`.
 */
export function humanizeTag(tag: string): string {
  return slugWords(tag)
    .map((word) => word.toLowerCase())
    .join(' ');
}
