/**
 * AD-13: the one app-global working baseline ("whose decisions am I making").
 * Distinct from the per-page BaselineFilter ("what do I want to see"), which
 * keeps its `All`. Pages resolve a baseline through this module only.
 */
export const BASELINES = ['low', 'moderate', 'high', 'privacy'] as const;
export type Baseline = (typeof BASELINES)[number];

const STORAGE_KEY = 'active-baseline';
const DEFAULT_BASELINE: Baseline = 'moderate';
export const ACTIVE_BASELINE_EVENT = 'activebaselinechange';

export function isBaseline(value: unknown): value is Baseline {
  return typeof value === 'string' && (BASELINES as readonly string[]).includes(value);
}

export function getActiveBaseline(): Baseline {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isBaseline(raw) ? raw : DEFAULT_BASELINE;
  } catch {
    return DEFAULT_BASELINE;
  }
}

export function setActiveBaseline(baseline: Baseline): void {
  try {
    localStorage.setItem(STORAGE_KEY, baseline);
  } catch (err) {
    console.error('activeBaseline: failed to persist working baseline', err);
  }
  window.dispatchEvent(new CustomEvent(ACTIVE_BASELINE_EVENT, { detail: { baseline } }));
}
