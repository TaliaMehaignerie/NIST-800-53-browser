// AD-8: build-time ODP dataset endpoint. Reads `getCollection('controls')` —
// the same committed Content Collection every other page reads — and never
// touches raw OSCAL or `scripts/ingest.mjs` (AD-2). Runs inside the same
// `astro build` step as every other route (AD-6); this project's
// `output: 'static'` makes this endpoint prerendered by default.
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

interface OdpDatasetEntry {
  controlSlug: string;
  controlId: string;
  familyCode: string;
  paramId: string;
  label: string | null;
  guidelines: string[];
  select: { howMany: string | null; choice: string[] } | null;
  baselines: ('low' | 'moderate' | 'high' | 'privacy')[];
}

export const GET: APIRoute = async () => {
  const allEntries = await getCollection('controls');

  // Non-withdrawn only (spec Tasks & Acceptance); one flat entry per param
  // instance, across both Controls and Enhancements (AD-2: siblings in the
  // same collection, both carry `params`).
  const dataset: OdpDatasetEntry[] = allEntries
    .filter((entry) => !entry.data.withdrawn)
    .flatMap((entry) =>
      entry.data.params.map((param) => ({
        controlSlug: entry.data.slug,
        controlId: entry.data.id,
        familyCode: entry.data.familyCode,
        paramId: param.id,
        label: param.label,
        guidelines: param.guidelines,
        select: param.select,
        baselines: entry.data.baselines,
      })),
    );

  return new Response(JSON.stringify(dataset), {
    headers: { 'Content-Type': 'application/json' },
  });
};
