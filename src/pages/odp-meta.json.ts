// AD-12: build-time endpoint that surfaces the ingested corpus's own
// `oscal-version` (from the `meta` Content Collection singleton) so
// `oscalExport.ts` never hardcodes or re-derives that value independently.
// Also carries per-baseline parameter totals (AD-13's readiness chip), counted
// with the same non-withdrawn filter as `odp-dataset.json.ts`.
// Runs inside the same `astro build` step as every other route (AD-6); this
// project's `output: 'static'` makes this endpoint prerendered by default.
import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';

interface OdpMeta {
  oscalVersion: string;
  paramCounts: Record<'low' | 'moderate' | 'high' | 'privacy', number>;
}

export const GET: APIRoute = async () => {
  const provenance = await getEntry('meta', 'provenance');
  const oscalVersion = provenance?.data.oscalVersion ?? '';

  const paramCounts: OdpMeta['paramCounts'] = { low: 0, moderate: 0, high: 0, privacy: 0 };
  for (const entry of await getCollection('controls')) {
    if (entry.data.withdrawn) continue;
    for (const baseline of entry.data.baselines) {
      paramCounts[baseline] += entry.data.params.length;
    }
  }

  const meta: OdpMeta = { oscalVersion, paramCounts };

  return new Response(JSON.stringify(meta), {
    headers: { 'Content-Type': 'application/json' },
  });
};
