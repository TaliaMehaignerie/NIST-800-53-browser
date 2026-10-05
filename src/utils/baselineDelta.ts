/**
 * What moving your system from one baseline to another would change, answered
 * from data already embedded (no fetch): the items added and dropped (AD-15
 * scope, so program-wide PM items are never "added"), and how many of the
 * added items already have a status. Shown on Your data, beside the baseline
 * setting, so the cost of a change is visible before making it.
 */
import { isCounted, type ComplianceItem } from './complianceCount';
import type { StatusRecord } from './statusStore';

export interface BaselineDelta {
  added: ComplianceItem[];
  dropped: ComplianceItem[];
  /** Added items with no status record at all. */
  unstatused: number;
  /** Added items by status, a missing record counted as incomplete (AD-15). */
  byStatus: { compliant: number; inProgress: number; incomplete: number; notApplicable: number };
  /** Added items per family, with how many have no status yet. */
  byFamily: Map<string, { added: number; unstatused: number }>;
}

export function baselineDelta(
  items: ComplianceItem[],
  from: string,
  to: string,
  statuses: Record<string, StatusRecord>,
): BaselineDelta {
  const statusOf = (slug: string) =>
    Object.prototype.hasOwnProperty.call(statuses, slug) ? statuses[slug].status : undefined;
  const added = items.filter((i) => isCounted(i, to) && !isCounted(i, from));
  const dropped = items.filter((i) => isCounted(i, from) && !isCounted(i, to));
  const byStatus = { compliant: 0, inProgress: 0, incomplete: 0, notApplicable: 0 };
  const byFamily = new Map<string, { added: number; unstatused: number }>();
  let unstatused = 0;
  for (const i of added) {
    const s = statusOf(i.slug);
    if (s === undefined) unstatused += 1;
    if (s === 'compliant') byStatus.compliant += 1;
    else if (s === 'in-progress') byStatus.inProgress += 1;
    else if (s === 'not-applicable') byStatus.notApplicable += 1;
    else byStatus.incomplete += 1;
    const row = byFamily.get(i.familyCode) ?? { added: 0, unstatused: 0 };
    row.added += 1;
    if (s === undefined) row.unstatused += 1;
    byFamily.set(i.familyCode, row);
  }
  return { added, dropped, unstatused, byStatus, byFamily };
}
