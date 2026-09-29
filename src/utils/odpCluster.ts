/**
 * AD-11's sole clustering implementation. Dash-one batching is a read-time
 * display grouping only — never a stored cluster reference. Cluster
 * membership is recomputed at render time from `paramId`/`familyCode`;
 * nothing marks a decision as batch-derived once it's written (via
 * `odpStore.setDecision`, one independent call per member).
 *
 * Imported by the batch-entry UI (`OdpWorkspace.astro`, this story) and, in
 * story 3, the readiness dashboard — never reimplemented elsewhere.
 */

/** Matches the shape `odp-dataset.json.ts` (AD-8) already emits per parameter instance. */
export interface OdpDatasetEntry {
  controlSlug: string;
  controlId: string;
  controlTitle: string;
  familyCode: string;
  paramId: string;
  label: string | null;
  guidelines: string[];
  select: { howMany: string | null; choice: string[] } | null;
  statementProse: string | null;
  baselines: ('low' | 'moderate' | 'high' | 'privacy')[];
}

/** One dash-one control member of a cluster — just enough to build a decision key. */
export interface ClusterMember {
  controlSlug: string;
  controlId: string;
  paramId: string;
}

export interface Cluster {
  /** The stripped, shared param key (`prm_1`, `odp.01`, ...). Not globally unique across families by itself. */
  clusterKey: string;
  label: string | null;
  guidelines: string[];
  select: { howMany: string | null; choice: string[] } | null;
  /** Only members whose `select` shape is deep-equal across the whole cluster — a divergent member is dropped here. */
  members: ClusterMember[];
  /**
   * The control title shared by every member, or `null` when it diverges.
   * Real-data verified: all 18 dash-one controls share `"Policy and
   * Procedures"`, so this is non-null for every current cluster — but
   * computed fresh, never assumed (spec Boundaries).
   */
  sharedTitle: string | null;
  /**
   * The statement sentence shared verbatim by every member, or `null` when
   * it diverges. Real-data verified: `prm_1` shares one identical sentence
   * across all 18 members, but `odp.03` has 18 distinct sentences (each
   * names its own family's policy) — never presented as if shared.
   */
  sharedProse: string | null;
  /**
   * The first member, for attributing a non-shared sentence to a specific
   * control when `sharedProse` is `null` — never presented as if it applied
   * to every member (spec Boundaries).
   */
  representative: { controlId: string; statementProse: string | null };
}

/**
 * A dash-one control is `kind === 'control'` with `id` matching `^[a-z]{2}-1$`
 * — detected structurally, never a hardcoded list. An Enhancement's id always
 * carries a `.` suffix (`ac-2.1`), so it can never match this pattern; the
 * regex alone is sufficient to exclude Enhancements without a separate
 * `kind` check.
 */
export function isDashOneControl(id: string): boolean {
  return /^[a-z]{2}-1$/.test(id);
}

/**
 * Strips the `^<familyCode>-1_` / `^<familyCode>-01_` prefix from a paramId
 * (familyCode lowercased first) to get the shared cluster key —
 * `ac-1_prm_1` / `ac-01_prm_1` both become `prm_1`.
 */
export function clusterKey(paramId: string, familyCode: string): string {
  const fc = familyCode.toLowerCase();
  return paramId.replace(new RegExp(`^${fc}-0?1_`), '');
}

function arraysMatchAsSets(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  const setB = new Set(b);
  if (setA.size !== setB.size) return false;
  for (const v of setA) {
    if (!setB.has(v)) return false;
  }
  return true;
}

/**
 * Order-independent set equality when either value is an array (the
 * `one-or-more` case) — a naive `===` would falsely flag an untouched,
 * identically-selected member as diverged. Plain string equality otherwise.
 */
export function valuesMatch(a: string | string[], b: string | string[]): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return arraysMatchAsSets(a, b);
  if (Array.isArray(a) || Array.isArray(b)) return false;
  return a === b;
}

function selectDeepEqual(
  a: { howMany: string | null; choice: string[] } | null,
  b: { howMany: string | null; choice: string[] } | null,
): boolean {
  if (a === null || b === null) return a === b;
  if (a.howMany !== b.howMany) return false;
  if (a.choice.length !== b.choice.length) return false;
  return a.choice.every((choice, i) => choice === b.choice[i]);
}

/**
 * Groups dash-one baseline entries by their shared `clusterKey`, keeping
 * only the members whose `select` is byte-identical to the first member's.
 * A member whose `select` diverges (e.g. real data: `sc-1`'s `odp.03`
 * spells one choice differently than the other 17 dash-one controls) is
 * dropped from `members` entirely — the caller's existing per-control
 * individual-row loop still covers it, unchanged.
 *
 * A group left with fewer than 2 matching members after that filter isn't a
 * cluster at all (nothing to batch) and is omitted — mirroring AD-11's
 * treatment of the structural outlier `pm-1`, whose family has no other
 * dash-one control to cluster with.
 */
export function groupDashOneClusters(entries: OdpDatasetEntry[]): Cluster[] {
  const dashOneEntries = entries.filter((entry) => isDashOneControl(entry.controlId));

  const byKey = new Map<string, OdpDatasetEntry[]>();
  for (const entry of dashOneEntries) {
    const key = clusterKey(entry.paramId, entry.familyCode);
    const list = byKey.get(key);
    if (list) {
      list.push(entry);
    } else {
      byKey.set(key, [entry]);
    }
  }

  const clusters: Cluster[] = [];
  for (const [key, members] of byKey) {
    const [first, ...rest] = members;
    const matching = [first, ...rest.filter((m) => selectDeepEqual(m.select, first.select))];
    if (matching.length < 2) continue;

    const allSameTitle = matching.every((m) => m.controlTitle === first.controlTitle);
    const allSameProse = matching.every((m) => m.statementProse === first.statementProse);

    // For the divergent-sentence fallback, prefer a member that actually
    // has a sentence — `first` (insertion order) can itself lack one (real
    // data: the `odp.01`/`odp.02` clusters' first member, `ac-1`, has no
    // statement reference, even though `pm-1` in the same cluster does).
    // Falling back to `first` only when no member has a sentence keeps the
    // spec's "never present a non-shared sentence as if it applied to all"
    // rule from silently degrading into "show nothing" when the answer was
    // there all along, just not on the first member.
    const proseHolder = matching.find((m) => m.statementProse) ?? first;

    clusters.push({
      clusterKey: key,
      label: first.label,
      guidelines: first.guidelines,
      select: first.select,
      members: matching.map((m) => ({ controlSlug: m.controlSlug, controlId: m.controlId, paramId: m.paramId })),
      sharedTitle: allSameTitle ? first.controlTitle : null,
      sharedProse: allSameProse ? first.statementProse : null,
      representative: { controlId: proseHolder.controlId, statementProse: proseHolder.statementProse },
    });
  }

  return clusters;
}

export interface ClusterMatch {
  matchCount: number;
  total: number;
  majorityValue: string | string[] | undefined;
}

/**
 * Fresh-every-call majority-vote match count: groups the members' current
 * stored values (via `valuesMatch`, order-independent for arrays) and
 * reports the size of the largest group. Never cached or stored — computed
 * at render time only, consistent with AD-11.
 */
export function computeClusterMatch(currentValues: (string | string[] | undefined)[]): ClusterMatch {
  const groups: { value: string | string[]; count: number }[] = [];
  for (const value of currentValues) {
    if (value === undefined) continue;
    const group = groups.find((g) => valuesMatch(g.value, value));
    if (group) {
      group.count += 1;
    } else {
      groups.push({ value, count: 1 });
    }
  }

  if (groups.length === 0) {
    return { matchCount: 0, total: currentValues.length, majorityValue: undefined };
  }

  groups.sort((a, b) => b.count - a.count);
  return { matchCount: groups[0].count, total: currentValues.length, majorityValue: groups[0].value };
}
