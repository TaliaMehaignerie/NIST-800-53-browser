// Build-time endpoint: NIST's Discussion text, verbatim (AD-5), for every
// non-withdrawn control and enhancement that has parameters, keyed by slug.
// Served separately from `odp-dataset.json` so it is stored once per item
// rather than repeated for each of its parameters, and so the workspace only
// fetches it when someone first opens a discussion. Reads the same Content
// Collection as every other page (AD-8).
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async () => {
  const discussions: Record<string, string> = {};
  for (const entry of await getCollection('controls')) {
    if (entry.data.withdrawn || entry.data.params.length === 0 || !entry.data.guidance) continue;
    discussions[entry.data.slug] = entry.data.guidance;
  }
  return new Response(JSON.stringify(discussions), {
    headers: { 'Content-Type': 'application/json' },
  });
};
