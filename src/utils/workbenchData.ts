/**
 * Whether the visitor has created any workbench data at all: a control status
 * in `statusStore`, or a parameter decision in any baseline's `odpStore` blob
 * (story 17). Reads both stores through their own modules — no localStorage
 * access here (AD-10, AD-14). A missing or corrupt blob is empty state, so a
 * first-time visitor, or one with only corrupt data, reads as "no data".
 */
import { BASELINES } from './activeBaseline';
import { getDecisions } from './odpStore';
import { getStatuses } from './statusStore';

export function hasWorkbenchData(): boolean {
  if (Object.keys(getStatuses()).length > 0) return true;
  return BASELINES.some((baseline) => Object.keys(getDecisions(baseline)).length > 0);
}
