/**
 * The dashboard shows your system's baseline (AD-13), always: the baseline is
 * chosen once on Review and changed only on Your data, so there is no
 * per-page switcher. Kept as a module so the dashboard and the sections
 * scoped to it read one definition.
 */
import { getActiveBaseline } from './activeBaseline';

/** Kept for listeners; fired if the dashboard's baseline ever changes in-page. */
export const DASHBOARD_BASELINE_EVENT = 'dashboardbaselinechange';

export function dashboardBaseline(): string {
  return getActiveBaseline();
}
