/**
 * Story 22: the bundled sample data, built from the Content Collection at
 * build time (AD-8) so every key is a real `controlSlug:paramId` and the sample
 * can never drift from the catalog. Deterministic: the same catalog gives the
 * same bytes, because nothing here reads the clock or a random source.
 *
 * The result is an ordinary backup envelope. It is loaded through the restore
 * path (`sampleData.ts`), never a second write path.
 *
 * What it shows, for an invented "Example System" at the Moderate baseline:
 *  - AC and AU fully reviewed; IA, SC, CM and CP part-way; the rest untouched.
 *  - The dash-one policy controls in six families share one answer per
 *    parameter (the batch case); the other 12 are left to the batch view.
 *  - A few overrides, each with a rationale. Statuses on about a fifth of the
 *    items, some with evidence.
 *  - Physical controls (PE) not applicable, inherited from an example provider.
 *  - Items that are in progress with unreviewed parameters, so "what's
 *    blocking me" has something to show.
 * Everything that reads like a person or an organization is a role or an
 * obviously made-up name, and links use only the reserved example.com domain.
 */
import { getCollection } from 'astro:content';
import { BACKUP_APP, ENVELOPE_VERSION, type BackupEnvelope } from './backup';
import { isDashOneControl } from './odpCluster';
import { ODP_SCHEMA_VERSION, type Decision } from './odpStore';
import {
  STATUS_SCHEMA_VERSION,
  inheritedJustification,
  type EvidenceRef,
  type ItemStatus,
  type StatusRecord,
} from './statusStore';

const EXPORTED_AT = '2026-10-14T15:00:00.000Z';
const COLLECTED_AT = '2026-09-30T12:00:00.000Z';
const PROVIDER = 'Example Cloud Provider';

/** Families reviewed completely. */
const FULL_FAMILIES = ['AC', 'AU'];
/** Families reviewed part-way: how many of their items (catalog order) are done. */
const PARTIAL_FAMILIES: Record<string, number> = { IA: 14, SC: 6, CM: 4, CP: 3 };
/** In a part-way family, this many of the items after the done ones are in progress with parameters still to set. */
const BLOCKED_PER_FAMILY = 2;

const OWNERS: Record<string, string> = {
  AC: 'ISSO',
  AU: 'Security operations lead',
  IA: 'Identity team lead',
  SC: 'Cloud operations lead',
  CM: 'Cloud operations lead',
  CP: 'Resilience lead',
};

interface Param {
  id: string;
  label: string | null;
  select: { howMany: string | null; choice: string[] } | null;
}

function bare(label: string | null): string {
  return (label ?? '').toLowerCase().replace(/^organization-defined\s+/, '').trim();
}

/** A plausible answer for a parameter, depending only on its label and options (so dash-one members always agree). */
function valueFor(param: Param): string | string[] {
  if (param.select) {
    const first = param.select.choice[0] ?? '';
    return param.select.howMany === 'one-or-more' ? [first] : first;
  }
  const label = bare(param.label);
  if (label === 'frequency' || label === 'frequencies') return 'at least annually';
  if (label === 'time period') return '30 days';
  if (label === 'number') return '3';
  if (label === 'official') return 'the Authorizing Official';
  if (label === 'events') return 'the events listed in the Example System audit policy';
  if (/personnel|roles/.test(label)) return 'the system owner and the ISSO';
  return 'as defined in the Example System security plan';
}

/** A different answer, for a parameter the sample overrides. */
function overrideFor(param: Param): string | string[] {
  if (param.select) {
    const last = param.select.choice[param.select.choice.length - 1] ?? '';
    return param.select.howMany === 'one-or-more' ? [last] : last;
  }
  const label = bare(param.label);
  if (label === 'frequency' || label === 'frequencies') return 'at least quarterly';
  if (label === 'time period') return '7 days';
  if (label === 'number') return '5';
  if (/personnel|roles/.test(label)) return 'the ISSO and the security operations lead';
  return `${valueFor(param) as string}, reviewed by the ISSO`;
}

const OVERRIDE_EVERY = 9;
const OVERRIDE_RATIONALE = 'Sample: the Example System policy sets a stricter value than the common default.';

export async function buildSampleEnvelope(): Promise<BackupEnvelope> {
  const entries = (await getCollection('controls'))
    .filter((e) => !e.data.withdrawn && (e.data.baselines as string[]).includes('moderate'))
    .sort((a, b) => (a.data.sortId < b.data.sortId ? -1 : a.data.sortId > b.data.sortId ? 1 : 0));

  const byFamily = new Map<string, typeof entries>();
  for (const e of entries) {
    const list = byFamily.get(e.data.familyCode) ?? [];
    list.push(e);
    byFamily.set(e.data.familyCode, list);
  }

  const decisions: Record<string, Decision> = {};
  const items: Record<string, StatusRecord> = {};
  let paramCounter = 0;

  const decide = (entry: (typeof entries)[number]) => {
    const dashOne = isDashOneControl(entry.data.id);
    for (const param of entry.data.params as Param[]) {
      paramCounter += 1;
      // Dash-one members must agree, so they are never overridden.
      const override = !dashOne && paramCounter % OVERRIDE_EVERY === 0;
      decisions[`${entry.data.slug}:${param.id}`] = override
        ? { value: overrideFor(param), status: 'overridden', rationale: OVERRIDE_RATIONALE }
        : { value: valueFor(param), status: 'confirmed', rationale: '' };
    }
  };

  const status = (
    slug: string,
    value: ItemStatus,
    owner: string,
    extra: Partial<StatusRecord> = {},
  ): void => {
    items[slug] = { status: value, justification: '', owner, evidence: [], updatedAt: EXPORTED_AT, ...extra };
  };

  const evidenceFor = (slug: string, label: string): EvidenceRef[] => [
    {
      note: `Sample: ${label} for the Example System.`,
      url: `https://example.com/example-system/evidence/${slug}`,
      collectedAt: COLLECTED_AT,
    },
  ];

  for (const [family, list] of byFamily) {
    const owner = OWNERS[family] ?? 'ISSO';

    if (family === 'PE') {
      for (const e of list) {
        status(e.data.slug, 'not-applicable', 'Cloud provider (inherited)', {
          inheritedFrom: PROVIDER,
          justification: inheritedJustification(
            PROVIDER,
            'Sample: physical and environmental protection is provided by the data centers of the example provider.',
          ),
        });
      }
      continue;
    }

    const done = FULL_FAMILIES.includes(family) ? list.length : PARTIAL_FAMILIES[family] ?? 0;
    list.slice(0, done).forEach((e, i) => {
      decide(e);
      const slug = e.data.slug;
      if (family === 'AC') {
        if (i % 5 <= 2) status(slug, 'compliant', owner, i % 2 === 0 ? { evidence: evidenceFor(slug, 'Access review export') } : {});
        else if (i % 5 === 3) status(slug, 'in-progress', owner);
      } else if (family === 'AU') {
        if (i % 3 === 0) status(slug, 'compliant', owner, { evidence: evidenceFor(slug, 'Audit log configuration') });
        else if (i % 3 === 1) status(slug, 'in-progress', owner);
      } else if (i % 2 === 0) {
        status(slug, 'compliant', owner);
      }
    });

    // Items that would be compliant but for parameters nobody has set yet.
    if (done > 0 && done < list.length) {
      list
        .slice(done)
        .filter((e) => e.data.params.length > 0)
        .slice(0, BLOCKED_PER_FAMILY)
        .forEach((e) => status(e.data.slug, 'in-progress', owner));
    }
  }

  return {
    app: BACKUP_APP,
    envelopeVersion: ENVELOPE_VERSION,
    exportedAt: EXPORTED_AT,
    odpDecisions: { moderate: { schemaVersion: ODP_SCHEMA_VERSION, decisions } },
    controlStatus: { schemaVersion: STATUS_SCHEMA_VERSION, items },
    activeBaseline: 'moderate',
    sample: true,
  };
}
