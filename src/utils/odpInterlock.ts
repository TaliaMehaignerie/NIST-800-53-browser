/**
 * Story 15: the ODP interlock. An item cannot be marked compliant while any
 * of its own organization-defined parameters is still unreviewed-default — a
 * control "compliant" with parameters nobody specified is the unexamined
 * ceiling the workbench exists to prevent, one layer up.
 *
 * Status is per-system (AD-14) but the parameters gating it are per-baseline
 * (AD-10), so the verdict can legitimately differ between Moderate and High
 * for the same item; the message therefore always names the baseline.
 *
 * An item is gated only when it is in the working baseline: its parameters
 * are otherwise invisible to the workspace (AD-13), so blocking on them would
 * be a block that can never be cleared. An item with no parameters is never
 * blocked. Counting is the shared `odpCounts` tally via `odpReadiness`.
 */
import type { Decision } from './odpStore';
import { readinessFor, type ReadinessItem } from './odpReadiness';
import { baselineLabel } from './activeBaseline';

export interface Gate {
  blocked: boolean;
  unreviewed: number;
  total: number;
  baseline: string;
}

export function interlockFor(
  item: ReadinessItem | undefined,
  baseline: string,
  decisions: Record<string, Decision>,
): Gate {
  const none: Gate = { blocked: false, unreviewed: 0, total: 0, baseline };
  if (!item || item.paramIds.length === 0 || !item.baselines.includes(baseline)) return none;
  const counts = readinessFor([item], baseline, decisions);
  return { blocked: counts.unreviewed > 0, unreviewed: counts.unreviewed, total: counts.total, baseline };
}

function parameterCount(gate: Gate): string {
  return `${gate.unreviewed} of ${gate.total} parameter${gate.total === 1 ? '' : 's'}`;
}

export const PAYLOAD_UNAVAILABLE_MESSAGE =
  "Cannot mark compliant: this page's parameters could not be read, so they cannot be checked. Reload the page.";

export function blockMessage(gate: Gate): string {
  return `Cannot mark compliant: ${parameterCount(gate)} still unreviewed in the ${baselineLabel(gate.baseline)} baseline.`;
}

/** For an item that is already compliant when the working baseline's parameters are not all reviewed. */
export function staleCompliantMessage(gate: Gate): string {
  return `Marked compliant, but ${parameterCount(gate)} still unreviewed in the ${baselineLabel(gate.baseline)} baseline.`;
}
