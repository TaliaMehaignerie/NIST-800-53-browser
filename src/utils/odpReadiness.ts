/**
 * Readiness over a control and its enhancements (story 12), for the
 * control-page summary and the family readiness column. Only items that are
 * in the working baseline count — a decision elsewhere would be invisible to
 * the workspace (AD-13). Tallying itself is `odpCounts.ts`, not reimplemented.
 */
import type { Decision } from './odpStore';
import { tallyStatuses, type StatusCounts } from './odpCounts';

export interface ReadinessItem {
  slug: string;
  baselines: string[];
  paramIds: string[];
}

export function readinessFor(
  items: ReadinessItem[],
  baseline: string,
  decisions: Record<string, Decision>,
): StatusCounts {
  const keys = items
    .filter((item) => item.baselines.includes(baseline))
    .flatMap((item) => item.paramIds.map((paramId) => `${item.slug}:${paramId}`));
  return tallyStatuses(keys, (k) => k, () => 'all', decisions).overall;
}

export function reviewedCount(counts: StatusCounts): number {
  return counts.confirmed + counts.overridden;
}
