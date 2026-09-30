/**
 * The dashboard's baseline is a view scope, independent of the working baseline
 * (AD-13): an explicit `?baseline=` wins, otherwise it follows the working
 * baseline. One definition shared by the dashboard and the sections scoped to
 * it, so they can never disagree about which baseline is on screen.
 */
import { getActiveBaseline, isBaseline } from './activeBaseline';
import { setUrlState } from './urlState';

/** Fired after the dashboard's own filter changes the URL (which fires no event by itself). */
export const DASHBOARD_BASELINE_EVENT = 'dashboardbaselinechange';

export function explicitDashboardBaseline(): string | null {
  const value = new URLSearchParams(window.location.search).get('baseline');
  return isBaseline(value) ? value : null;
}

/**
 * The one way to change the dashboard's baseline: writes `?baseline=` (or clears
 * it to follow the working baseline again) and announces it, since
 * `replaceState` fires no event of its own and the sections scoped to the
 * dashboard would otherwise keep showing the old baseline.
 */
export function setDashboardBaseline(baseline: string | null): void {
  setUrlState({ search: { baseline } });
  window.dispatchEvent(new CustomEvent(DASHBOARD_BASELINE_EVENT));
}

export function dashboardBaseline(): string {
  return explicitDashboardBaseline() ?? getActiveBaseline();
}
