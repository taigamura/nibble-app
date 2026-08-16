import type { Place } from '../taste-engine';

/**
 * Pure state-transition core for the "Where to tonight?" drill-down.
 *
 * The view drives this by tracking `(remaining, askedAxes)` across taps: each
 * answer narrows `remaining` via `applyAnswer` and appends its axis to
 * `askedAxes`, then `nextQuestion` decides what to ask next (or whether to
 * stop). No React, no I/O, no `Math.random` -- randomization (the 🎲
 * shortcut) lives in the screen and uses the taste-engine's seeded shuffle,
 * not this module.
 */

export type DrillAxis = 'cuisine' | 'price' | 'vibe';

/** Axis order the drill-down walks -- narrowest signal (cuisine) first. */
const LADDER: DrillAxis[] = ['cuisine', 'price', 'vibe'];

/** Stop asking and show the result once the remaining pool is this small. */
export const STOP_AT = 3;

/** A place's value(s) along a given axis. Vibe is multi-valued (tags). */
function axisValues(place: Place, axis: DrillAxis): string[] {
  switch (axis) {
    case 'cuisine':
      return [place.category];
    case 'price':
      return [place.priceBand];
    case 'vibe':
      return place.tags;
  }
}

/** Sorted, deduped values present in `pool` for `axis` (tags flattened for vibe). */
export function distinctValues(pool: readonly Place[], axis: DrillAxis): string[] {
  const values = new Set<string>();
  for (const place of pool) {
    for (const value of axisValues(place, axis)) {
      values.add(value);
    }
  }
  return [...values].sort();
}

/** Narrows `pool` to places whose `axis` value(s) include `value`. */
export function applyAnswer(pool: readonly Place[], axis: DrillAxis, value: string): Place[] {
  return pool.filter((place) => axisValues(place, axis).includes(value));
}

export interface DrillQuestion {
  axis: DrillAxis;
  /** Distinct values worth offering as chips; the view adds its own "Any" chip. */
  options: string[];
}

/**
 * Picks the next axis to ask about, or `null` when it's time to show the
 * result. Stops as soon as the pool is small enough to just look at
 * (`STOP_AT`), and otherwise walks the ladder in order, skipping any axis
 * that's already been asked or that can't split the remaining pool (every
 * place shares the same value, so a question there is pointless).
 */
export function nextQuestion(pool: readonly Place[], askedAxes: readonly DrillAxis[]): DrillQuestion | null {
  if (pool.length <= STOP_AT) return null;

  for (const axis of LADDER) {
    if (askedAxes.includes(axis)) continue;
    const options = distinctValues(pool, axis);
    if (options.length >= 2) {
      return { axis, options };
    }
  }

  return null;
}
