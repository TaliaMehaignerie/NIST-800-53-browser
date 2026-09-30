// AD-12: build-time endpoint that surfaces the ingested corpus's own
// `oscal-version` (from the `meta` Content Collection singleton) so
// `oscalExport.ts` never hardcodes or re-derives that value independently.
// Also carries per-baseline parameter totals (AD-13's readiness chip), counted
// with the same non-withdrawn filter as `odp-dataset.json.ts`.
// Runs inside the same `astro build` step as every other route (AD-6); this
// project's `output: 'static'` makes this endpoint prerendered by default.
import type { APIRoute } from 'astro';
import { getEntry } from 'astro:content';
import { getParamCounts, type ParamCounts } from '../utils/paramCounts';

interface OdpMeta {
  oscalVersion: string;
  paramCounts: ParamCounts;
}

export const GET: APIRoute = async () => {
  const provenance = await getEntry('meta', 'provenance');
  const oscalVersion = provenance?.data.oscalVersion ?? '';

  const meta: OdpMeta = { oscalVersion, paramCounts: await getParamCounts() };

  return new Response(JSON.stringify(meta), {
    headers: { 'Content-Type': 'application/json' },
  });
};
