/**
 * Whether the visitor has created any workbench data at all: a control status
 * in `statusStore`, or a parameter decision in any baseline's `odpStore` blob
 * (story 17). Reads both stores through their own modules — no localStorage
 * access here (AD-10, AD-14). A missing or corrupt blob is empty state, so a
 * first-time visitor, or one with only corrupt data, reads as "no data".
 */
import { BASELINES, clearActiveBaseline, hasChosenBaseline } from './activeBaseline';
import { getDecisions, writeRawBlob as writeOdpRaw } from './odpStore';
import { clearSampleFlag, isSampleData } from './sampleFlag';
import { getStatuses, writeRawBlob as writeStatusRaw } from './statusStore';

export function hasWorkbenchData(): boolean {
  if (Object.keys(getStatuses()).length > 0) return true;
  return BASELINES.some((baseline) => Object.keys(getDecisions(baseline)).length > 0);
}

/** Whether Reset has anything to remove: data, a chosen baseline, or the sample flag. */
export function hasAnythingToReset(): boolean {
  return hasWorkbenchData() || hasChosenBaseline() || isSampleData();
}

export type ClearResult = { ok: true } | { ok: false; message: string };

/**
 * The one way to empty the workbench (stories 22 and 24): every baseline's
 * decisions, the control statuses, the chosen baseline and the sample flag,
 * each through its owning module (AD-10, AD-13, AD-14). Never
 * `localStorage.clear()`, which would also remove keys the workbench does not
 * own. Removes unreadable blobs too, since a raw removal needs no parsing.
 */
export function clearWorkbench(): ClearResult {
  const failed: string[] = [];
  for (const baseline of BASELINES) {
    if (!writeOdpRaw(baseline, null)) failed.push(`${baseline} decisions`);
  }
  if (!writeStatusRaw(null)) failed.push('control status');
  clearActiveBaseline();
  clearSampleFlag();
  return failed.length === 0
    ? { ok: true }
    : { ok: false, message: `Could not remove: ${failed.join(', ')}. Reload the page and try again.` };
}
