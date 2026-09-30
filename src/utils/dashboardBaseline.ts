/**
 * The dashboard's baseline is a view scope, independent of the working baseline
 * (AD-13): an explicit `?baseline=` wins, otherwise it follows the working
 * baseline. One definition shared by the dashboard and the sections scoped to
 * it, so they can never disagree about which baseline is on screen.
 */
import { getActiveBaseline, isBaseline } from './activeBaseline';

/** Fired after the dashboard's own filter changes the URL (which fires no event by itself). */
export const DASHBOARD_BASELINE_EVENT = 'dashboardbaselinechange';

export function explicitDashboardBaseline(): string | null {
  const value = new URLSearchParams(window.location.search).get('baseline');
  return isBaseline(value) ? value : null;
}

export function dashboardBaseline(): string {
  return explicitDashboardBaseline() ?? getActiveBaseline();
}
