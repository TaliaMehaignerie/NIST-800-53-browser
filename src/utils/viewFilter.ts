/**
 * The catalog's "what am I looking at" filter (`?baseline=`), separate from
 * your system's baseline (AD-13) but defaulting to it: once you have chosen a
 * baseline, pages open showing it, and `?baseline=all` shows everything.
 * Before a choice, no parameter means everything, as it always has.
 * One definition shared by the filter control and search.
 */
import { getActiveBaseline, hasChosenBaseline, isBaseline } from './activeBaseline';

export const SHOW_ALL = 'all';

/** The view's default: your system's baseline once chosen, otherwise everything (`null`). */
export function defaultViewBaseline(): string | null {
  return hasChosenBaseline() ? getActiveBaseline() : null;
}

/** The baseline the page is filtered to right now, or `null` for everything. */
export function viewBaseline(): string | null {
  const value = new URLSearchParams(window.location.search).get('baseline');
  if (value === SHOW_ALL) return null;
  if (isBaseline(value)) return value;
  return defaultViewBaseline();
}

/** The `?baseline=` value that expresses `baseline` — `null` (no parameter) when it is the default. */
export function viewParam(baseline: string | null): string | null {
  if (baseline === defaultViewBaseline()) return null;
  return baseline ?? SHOW_ALL;
}
