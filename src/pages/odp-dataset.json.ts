// AD-8: build-time ODP dataset endpoint. Reads `getCollection('controls')` —
// the same committed Content Collection every other page reads — and never
// touches raw OSCAL or `scripts/ingest.mjs` (AD-2). Runs inside the same
// `astro build` step as every other route (AD-6); this project's
// `output: 'static'` makes this endpoint prerendered by default.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { resolveParams } from '../utils/resolveParams';

interface OdpDatasetEntry {
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

interface StatementNode {
  label: string | null;
  prose: string | null;
  children: StatementNode[];
}

/** Same placeholder pattern as `resolveParams.ts` — used only to test which param ids a node's prose references. */
const PLACEHOLDER_ID = /\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g;

/**
 * First statement node (depth-first, catalog order) whose prose references
 * `paramId`, prefixed with the node's own `label` when present (spec
 * Boundaries: "the first statement node whose prose references that
 * paramId"). Returns `null` when no node references it — real-data
 * verified: 399 of 1600 params are never referenced this way.
 */
function findStatementProse(nodes: StatementNode[], paramId: string): string | null {
  for (const node of nodes) {
    if (node.prose) {
      const ids = Array.from(node.prose.matchAll(PLACEHOLDER_ID), (m) => m[1]);
      if (ids.includes(paramId)) {
        return node.label ? `${node.label} ${node.prose}` : node.prose;
      }
    }
    const found = findStatementProse(node.children, paramId);
    if (found) return found;
  }
  return null;
}

export const GET: APIRoute = async () => {
  const allEntries = await getCollection('controls');

  // Non-withdrawn only (spec Tasks & Acceptance); one flat entry per param
  // instance, across both Controls and Enhancements (AD-2: siblings in the
  // same collection, both carry `params`).
  const dataset: OdpDatasetEntry[] = allEntries
    .filter((entry) => !entry.data.withdrawn)
    .flatMap((entry) =>
      entry.data.params.map((param) => {
        const rawProse = findStatementProse(entry.data.statement, param.id);
        return {
          controlSlug: entry.data.slug,
          controlId: entry.data.id,
          controlTitle: entry.data.title,
          familyCode: entry.data.familyCode,
          paramId: param.id,
          label: param.label,
          guidelines: param.guidelines,
          select: param.select,
          // Resolved at build time (spec Boundaries: one resolver, run
          // once) — the client receives display-ready text and never
          // resolves `{{ insert: param, … }}` placeholders itself.
          statementProse: rawProse ? resolveParams(rawProse, entry.data.params) : null,
          baselines: entry.data.baselines,
        };
      }),
    );

  return new Response(JSON.stringify(dataset), {
    headers: { 'Content-Type': 'application/json' },
  });
};
