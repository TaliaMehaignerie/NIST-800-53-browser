/**
 * AD-15: the only place completion is counted. One rule set, so no surface
 * can derive its own denominator (every variation of which inflates the
 * figure):
 *
 *  - withdrawn items are never counted;
 *  - enhancements are first-class items, counted like controls;
 *  - `not-applicable` is EXCLUDED from the denominator entirely — it is shown
 *    as its own segment but never counts as complete or as outstanding;
 *  - baseline-less PM-family items (the program-wide ones) are included under
 *    EVERY baseline and reported as their own line, rather than silently
 *    dropped the way a plain `baselines.includes(...)` filter drops them;
 *  - a missing status record reads as `incomplete` (AD-14), nothing fabricated.
 *
 * Every displayed percentage carries its raw fraction (`64% (176/275)`): a
 * percentage over an invisible denominator is unauditable. Pure — no DOM, no
 * storage — so the same function serves the dashboard and any later surface.
 */
import type { ItemStatus, StatusRecord } from './statusStore';

export interface ComplianceItem {
  slug: string;
  familyCode: string;
  baselines: string[];
  withdrawn: boolean;
}

export interface ComplianceCounts {
  compliant: number;
  inProgress: number;
  incomplete: number;
  notApplicable: number;
  /** compliant + inProgress + incomplete — `not-applicable` is never in it. */
  denominator: number;
  /** Every counted item, including not-applicable ones. */
  total: number;
}

export interface ComplianceResult {
  overall: ComplianceCounts;
  byFamily: Map<string, ComplianceCounts>;
  /** The program-wide (baseline-less PM) items, already included in `overall`. */
  programWide: ComplianceCounts;
}

export function emptyComplianceCounts(): ComplianceCounts {
  return { compliant: 0, inProgress: 0, incomplete: 0, notApplicable: 0, denominator: 0, total: 0 };
}

/** The family whose baseline-less items are program-wide (AD-15). */
export const PROGRAM_WIDE_FAMILY = 'PM';

/** A baseline-less PM-family item: part of the program, in no baseline, shown under every baseline. */
export function isProgramWide(item: ComplianceItem): boolean {
  return !item.withdrawn && item.baselines.length === 0 && item.familyCode.toUpperCase() === PROGRAM_WIDE_FAMILY;
}

/** Whether an item is counted under `baseline`. Withdrawn items never are. */
export function isCounted(item: ComplianceItem, baseline: string): boolean {
  if (item.withdrawn) return false;
  return item.baselines.includes(baseline) || isProgramWide(item);
}

function add(counts: ComplianceCounts, status: ItemStatus): void {
  counts.total += 1;
  if (status === 'compliant') counts.compliant += 1;
  else if (status === 'in-progress') counts.inProgress += 1;
  else if (status === 'not-applicable') counts.notApplicable += 1;
  else counts.incomplete += 1;
  if (status !== 'not-applicable') counts.denominator += 1;
}

export function countCompliance(
  items: ComplianceItem[],
  baseline: string,
  statuses: Record<string, StatusRecord>,
): ComplianceResult {
  const overall = emptyComplianceCounts();
  const programWide = emptyComplianceCounts();
  const byFamily = new Map<string, ComplianceCounts>();

  for (const item of items) {
    if (!isCounted(item, baseline)) continue;
    const status: ItemStatus = Object.prototype.hasOwnProperty.call(statuses, item.slug)
      ? statuses[item.slug].status
      : 'incomplete';

    add(overall, status);
    if (isProgramWide(item)) add(programWide, status);

    let family = byFamily.get(item.familyCode);
    if (!family) {
      family = emptyComplianceCounts();
      byFamily.set(item.familyCode, family);
    }
    add(family, status);
  }

  return { overall, byFamily, programWide };
}

/**
 * Whole-number percent of the denominator that is compliant, or `null` when
 * the denominator is empty. Floored, never rounded: rounding would show
 * 199/200 as 100%, and a figure that reads audit-complete while items are
 * outstanding is exactly the flattery this module exists to prevent. 100%
 * therefore appears only when every counted item really is compliant.
 */
export function compliancePercent(counts: ComplianceCounts): number | null {
  return counts.denominator === 0 ? null : Math.floor((counts.compliant / counts.denominator) * 100);
}

/** `64% (176/275)` — always the fraction beside the percentage; `— (0/0)` when nothing is countable. */
export function percentLabel(counts: ComplianceCounts): string {
  const pct = compliancePercent(counts);
  return `${pct === null ? '—' : `${pct}%`} (${counts.compliant}/${counts.denominator})`;
}
