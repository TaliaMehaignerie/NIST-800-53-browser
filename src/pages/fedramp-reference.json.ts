// Build-time endpoint: what FedRAMP assigned each parameter before Notice 0013
// (story 23), verbatim (AD-5), keyed controlSlug -> paramId. Reference only.
// Served separately from `odp-dataset.json` so that file does not grow, and so
// the workspace fetches this only for a baseline FedRAMP covered. Reads the same
// Content Collection as every other page (AD-8).
import type { APIRoute } from 'astro';
import { getCollection, getEntry } from 'astro:content';
import { fedrampSourceText } from '../utils/fedrampSource';

export const GET: APIRoute = async () => {
  const provenance = await getEntry('meta', 'provenance');
  const values: Record<string, Record<string, Record<string, string>>> = {};
  for (const entry of await getCollection('controls')) {
    if (entry.data.withdrawn) continue;
    for (const param of entry.data.params) {
      if (!param.fedramp) continue;
      (values[entry.data.slug] ??= {})[param.id] = param.fedramp as Record<string, string>;
    }
  }
  return new Response(
    JSON.stringify({ sourceText: fedrampSourceText(provenance?.data.fedramp), values }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
