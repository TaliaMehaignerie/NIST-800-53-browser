/**
 * AD-13: the one app-global working baseline: your system's baseline, the one
 * whose decisions you are making. Asked once, on the Review page, and then kept
 * out of the way — it changes only from the Your data page. Pages resolve a
 * baseline through this module only.
 */
export const BASELINES = ['low', 'moderate', 'high', 'privacy'] as const;
export type Baseline = (typeof BASELINES)[number];

export const ACTIVE_BASELINE_KEY = 'active-baseline';
const DEFAULT_BASELINE: Baseline = 'moderate';
export const ACTIVE_BASELINE_EVENT = 'activebaselinechange';

/** Display name for a baseline, e.g. `moderate` -> `Moderate`. */
export function baselineLabel(baseline: string): string {
  return `${baseline[0].toUpperCase()}${baseline.slice(1)}`;
}

export function isBaseline(value: unknown): value is Baseline {
  return typeof value === 'string' && (BASELINES as readonly string[]).includes(value);
}

// Used only when localStorage is unavailable, so a pick still holds for this page.
let memoryBaseline: Baseline | null = null;

export function getActiveBaseline(): Baseline {
  try {
    const raw = localStorage.getItem(ACTIVE_BASELINE_KEY);
    if (isBaseline(raw)) return raw;
  } catch {
    // fall through to the in-memory value
  }
  return memoryBaseline ?? DEFAULT_BASELINE;
}

/**
 * Whether the user has told us their system's baseline. Until they have, the
 * workbench asks once (on the Review page) and the rest of the app shows the
 * catalog only — it never silently works against the default.
 */
export function hasChosenBaseline(): boolean {
  try {
    if (isBaseline(localStorage.getItem(ACTIVE_BASELINE_KEY))) return true;
  } catch {
    // fall through to the in-memory value
  }
  return memoryBaseline !== null;
}

/** Characters this setting occupies in storage (for the storage budget's breakdown). */
export function activeBaselineStorageChars(): number {
  try {
    const raw = localStorage.getItem(ACTIVE_BASELINE_KEY);
    return raw === null ? 0 : ACTIVE_BASELINE_KEY.length + raw.length;
  } catch {
    return 0;
  }
}

export function setActiveBaseline(baseline: Baseline): void {
  memoryBaseline = baseline;
  try {
    localStorage.setItem(ACTIVE_BASELINE_KEY, baseline);
  } catch (err) {
    console.error('activeBaseline: failed to persist working baseline', err);
  }
  window.dispatchEvent(new CustomEvent(ACTIVE_BASELINE_EVENT, { detail: { baseline } }));
}
