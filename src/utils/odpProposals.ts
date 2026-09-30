/**
 * Story 20: cross-baseline decision PROPOSALS.
 *
 * Low is a strict subset of Moderate is a strict subset of High, so a user who
 * finishes Moderate's 643 parameters and moves to High meets 767, of which 643
 * are the identical `controlSlug:paramId` sitting in a different blob, all
 * reading unreviewed. A proposal offers that earlier answer — with its
 * provenance — but it costs an act of review: it is NEVER auto-copied.
 *
 *  - A proposal is a read across blobs, not a shape change: storage stays per
 *    baseline (AD-10), nothing is stored for it, there is no migration.
 *  - Copying on a baseline switch would fabricate review status, the one thing
 *    `odpStore` is built never to do, and would be substantively wrong: High
 *    legitimately demands stricter values for real parameters (scan frequency,
 *    log retention). A proposal therefore leaves the decision
 *    `unreviewed-default` and it still counts as unreviewed in the readiness
 *    gate until the user confirms it.
 *  - When several baselines hold a decision for the same parameter, the
 *    proposal comes from the NEAREST one and names it; sources are never merged
 *    into one unattributed suggestion.
 *  - Privacy barely participates (53 of its 96 items are privacy-only), so it
 *    is not a four-way comparison: as a target it is offered the strictest
 *    available earlier answer first, and as a source it is only a last resort.
 */
import { BASELINES, baselineLabel } from './activeBaseline';
import { getDecisions, type Decision } from './odpStore';

export interface Proposal {
  value: string | string[];
  /** Carried from the source so an adopted override keeps its reasoning. */
  rationale: string;
  /** The source decision's own status — `confirmed` or `overridden`. */
  status: 'confirmed' | 'overridden';
  /** The baseline the proposal comes from. */
  from: string;
}

const NESTED = ['low', 'moderate', 'high'] as const;

/**
 * Source baselines for `target`, nearest first. Nested baselines are ordered
 * by distance in strictness, ties going to the stricter one (Moderate is
 * offered High's answer before Low's). Privacy is last, except as a target.
 */
export function sourceOrder(target: string): string[] {
  if (!(BASELINES as readonly string[]).includes(target)) return [];
  if (target === 'privacy') return ['high', 'moderate', 'low'];
  const rank = NESTED.indexOf(target as (typeof NESTED)[number]);
  const nested = NESTED.filter((b) => b !== target).sort(
    (a, b) =>
      Math.abs(NESTED.indexOf(a) - rank) - Math.abs(NESTED.indexOf(b) - rank) || NESTED.indexOf(b) - NESTED.indexOf(a),
  );
  return [...nested, 'privacy'];
}

function isDecided(decision: Decision | undefined): decision is Decision & { status: 'confirmed' | 'overridden' } {
  return decision !== undefined && decision.status !== 'unreviewed-default';
}

/**
 * Proposals for the keys that have NO stored decision in `target`. A stored
 * decision of any status is the user's own (a draft included) and is never
 * second-guessed by a proposal, so the prefill and the note can never disagree.
 */
export function proposalsFor(keys: string[], target: string): Map<string, Proposal> {
  const own = getDecisions(target);
  const sources = sourceOrder(target)
    .filter((b) => (BASELINES as readonly string[]).includes(b))
    .map((from) => ({ from, decisions: getDecisions(from) }));

  const proposals = new Map<string, Proposal>();
  for (const key of keys) {
    if (own[key] !== undefined) continue;
    for (const { from, decisions } of sources) {
      const decision = decisions[key];
      if (!isDecided(decision)) continue;
      proposals.set(key, { value: decision.value, rationale: decision.rationale, status: decision.status, from });
      break;
    }
  }
  return proposals;
}

export function proposalValueText(proposal: Proposal): string {
  return Array.isArray(proposal.value) ? proposal.value.join('; ') : proposal.value;
}

/** "Moderate (confirmed)" — the provenance shown beside a proposed value. */
export function proposalSourceText(proposal: Proposal): string {
  return `${baselineLabel(proposal.from)} (${proposal.status})`;
}
