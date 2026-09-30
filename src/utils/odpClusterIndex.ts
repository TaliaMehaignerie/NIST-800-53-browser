/**
 * Build-time display index for the control-page popover's batch scope
 * (story 11). Membership comes from `groupDashOneClusters` (AD-11), run per
 * baseline over the same Content Collection the dataset reads (AD-8), so it
 * always equals what the workspace's batch view would group.
 *
 * This is NOT a stored cluster reference: nothing written to a decision blob
 * refers to it. Fan-out still writes N independent decisions, and the live
 * match count is recomputed client-side from odpStore at read time.
 *
 * Server-side only (imports `astro:content`).
 */
import { getCollection } from 'astro:content';
import { groupDashOneClusters, type ClusterMember, type OdpDatasetEntry } from './odpCluster';
import { BASELINES, type Baseline } from './activeBaseline';

type Membership = Map<string, Partial<Record<Baseline, ClusterMember[]>>>;

let cached: Promise<Membership> | null = null;

async function build(): Promise<Membership> {
  const entries: OdpDatasetEntry[] = (await getCollection('controls'))
    .filter((c) => !c.data.withdrawn)
    .flatMap((c) =>
      c.data.params.map((p) => ({
        controlSlug: c.data.slug,
        controlId: c.data.id,
        controlTitle: c.data.title,
        familyCode: c.data.familyCode,
        paramId: p.id,
        label: p.label,
        guidelines: p.guidelines,
        select: p.select,
        statementProse: null,
        baselines: c.data.baselines,
      })),
    );

  const membership: Membership = new Map();
  for (const baseline of BASELINES) {
    const inBaseline = entries.filter((e) => e.baselines.includes(baseline));
    for (const cluster of groupDashOneClusters(inBaseline)) {
      for (const member of cluster.members) {
        const key = `${member.controlSlug}:${member.paramId}`;
        const byBaseline = membership.get(key) ?? {};
        byBaseline[baseline] = cluster.members;
        membership.set(key, byBaseline);
      }
    }
  }
  return membership;
}

/** Compact payload: member lists are deduped into `lists`; each param maps baseline -> list index. */
export async function clusterPayloadFor(
  controlSlug: string,
  paramIds: string[],
): Promise<{ lists: [string, string][][]; byParam: Record<string, Partial<Record<Baseline, number>>> }> {
  cached ??= build();
  const membership = await cached;

  const lists: [string, string][][] = [];
  const listIndex = new Map<string, number>();
  const byParam: Record<string, Partial<Record<Baseline, number>>> = {};

  for (const paramId of paramIds) {
    const byBaseline = membership.get(`${controlSlug}:${paramId}`);
    if (!byBaseline) continue;
    const refs: Partial<Record<Baseline, number>> = {};
    for (const baseline of BASELINES) {
      const members = byBaseline[baseline];
      if (!members) continue;
      const list = members.map((m): [string, string] => [m.controlSlug, m.paramId]);
      const id = JSON.stringify(list);
      let idx = listIndex.get(id);
      if (idx === undefined) {
        idx = lists.length;
        lists.push(list);
        listIndex.set(id, idx);
      }
      refs[baseline] = idx;
    }
    byParam[paramId] = refs;
  }
  return { lists, byParam };
}
