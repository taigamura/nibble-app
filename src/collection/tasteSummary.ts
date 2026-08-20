import { humanizeTag } from '../format';
import type { PriceBand, TasteGraph } from '../taste-engine';
import { getBeenCategoryStats, getBeenEntries, getWantPlaces, type CategoryStat } from './selectors';

/**
 * A one-glance portrait of the user's taste, derived entirely from data the
 * graph already holds: the strongest positive signals in the preference vector
 * (headline), the places they've actually been (category chips), and the price
 * band they gravitate to. Pure — same seam as `whySurfaced`, so it's unit
 * testable without any store or I/O.
 *
 * Returns `null` below a cold-start threshold: with only a swipe or two the
 * vector is noise, and a confidently-worded "your taste" card would be wrong.
 * The Collection screen simply renders nothing in that case.
 */
export interface TasteSummary {
  /** Natural-language lead, e.g. "Into ramen, late-night, and counter seats." */
  headline: string;
  /** Top Been categories with counts (may be empty if nothing is Been yet). */
  categoryChips: CategoryStat[];
  /** Distinct Want + Been places the summary is built from. */
  placeCount: number;
  /** Human price lean when one clearly dominates, e.g. "cheap eats". */
  priceLean?: string;
}

/** Minimum distinct Want/Been places before the summary is trustworthy. */
export const MIN_PLACES_FOR_SUMMARY = 5;

/** How many top categories to surface as chips. */
const MAX_CATEGORY_CHIPS = 4;

/** How many top vector signals to weave into the headline. */
const MAX_HEADLINE_SIGNALS = 3;

/**
 * Structural tags carry no vibe on their own, so they're excluded from the
 * headline: the price bands (surfaced separately as `priceLean`), the
 * noise-level buckets, and the chain/indie split. The `good-for:` /
 * `avoid:` prefixed tags are handled separately below.
 */
const STRUCTURAL_TAGS = new Set(['$', '$$', '$$$', '$$$$', 'chain', 'indie']);

const PRICE_LEAN_LABEL: Record<PriceBand, string> = {
  $: 'cheap eats',
  $$: 'mid-range',
  $$$: 'a splurge',
  $$$$: 'a splurge',
};

/**
 * Turns a raw taste tag into a headline-ready phrase, or `null` to drop it.
 * `good-for:solo` -> `solo`; `avoid:*` (a negative signal) is dropped; the
 * structural tags above are dropped; everything else is humanized.
 */
function headlinePhrase(tag: string): string | null {
  if (tag.startsWith('avoid:')) return null;
  if (STRUCTURAL_TAGS.has(tag)) return null;
  const base = tag.startsWith('good-for:') ? tag.slice('good-for:'.length) : tag;
  const phrase = humanizeTag(base).trim();
  return phrase.length > 0 ? phrase : null;
}

/** Joins phrases as a natural list: "a", "a and b", "a, b, and c". */
function joinPhrases(phrases: string[]): string {
  if (phrases.length <= 1) return phrases.join('');
  if (phrases.length === 2) return `${phrases[0]} and ${phrases[1]}`;
  return `${phrases.slice(0, -1).join(', ')}, and ${phrases[phrases.length - 1]}`;
}

/** The price band the user's actioned places most often fall in, if any. */
function dominantPriceLean(graph: TasteGraph): string | undefined {
  const bands = [...getWantPlaces(graph), ...getBeenEntries(graph).map((e) => e.place)].map(
    (place) => place.priceBand,
  );
  if (bands.length === 0) return undefined;

  const counts = new Map<PriceBand, number>();
  for (const band of bands) counts.set(band, (counts.get(band) ?? 0) + 1);

  let top: PriceBand | undefined;
  let topCount = 0;
  for (const [band, count] of counts) {
    if (count > topCount) {
      top = band;
      topCount = count;
    }
  }
  // Only claim a lean when it's a real majority, not a 3-way tie.
  return top && topCount / bands.length >= 0.5 ? PRICE_LEAN_LABEL[top] : undefined;
}

export function summarizeTaste(graph: TasteGraph): TasteSummary | null {
  const wantCount = getWantPlaces(graph).length;
  const beenCount = getBeenEntries(graph).length;
  const placeCount = wantCount + beenCount;
  if (placeCount < MIN_PLACES_FOR_SUMMARY) return null;

  const signals = Object.entries(graph.vector)
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => headlinePhrase(tag))
    .filter((phrase): phrase is string => phrase !== null);

  // De-duplicate phrases that humanize to the same words (e.g. a category and a
  // tag that collapse identically) while preserving weight order.
  const topSignals = [...new Set(signals)].slice(0, MAX_HEADLINE_SIGNALS);
  if (topSignals.length === 0) return null;

  return {
    headline: `Into ${joinPhrases(topSignals)}.`,
    categoryChips: getBeenCategoryStats(graph).slice(0, MAX_CATEGORY_CHIPS),
    placeCount,
    priceLean: dominantPriceLean(graph),
  };
}
