/**
 * The one status-counting implementation for ODP decisions (story 12). The
 * workspace dashboard, the per-control summary and the family readiness
 * column all tally through here — never a separate counter. A missing
 * decision counts as `unreviewed-default` (AD-10). Computed fresh on every
 * call, never cached or stored.
 */
import type { Decision, DecisionStatus } from './odpStore';

export interface StatusCounts {
  unreviewed: number;
  confirmed: number;
  overridden: number;
  total: number;
}

export function emptyStatusCounts(): StatusCounts {
  return { unreviewed: 0, confirmed: 0, overridden: 0, total: 0 };
}

export function statusField(status: DecisionStatus): 'unreviewed' | 'confirmed' | 'overridden' {
  return status === 'unreviewed-default' ? 'unreviewed' : status;
}

export function statusOf(decisions: Record<string, Decision>, key: string): DecisionStatus {
  return decisions[key]?.status ?? 'unreviewed-default';
}

export function tallyStatuses<T>(
  items: T[],
  keyOf: (item: T) => string,
  groupOf: (item: T) => string,
  decisions: Record<string, Decision>,
): { overall: StatusCounts; byGroup: Map<string, StatusCounts> } {
  const overall = emptyStatusCounts();
  const byGroup = new Map<string, StatusCounts>();

  for (const item of items) {
    const field = statusField(statusOf(decisions, keyOf(item)));
    overall.total += 1;
    overall[field] += 1;

    const group = groupOf(item);
    let counts = byGroup.get(group);
    if (!counts) {
      counts = emptyStatusCounts();
      byGroup.set(group, counts);
    }
    counts.total += 1;
    counts[field] += 1;
  }

  return { overall, byGroup };
}
