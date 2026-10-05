/**
 * Per-baseline parameter totals, counted once at build time from the Content
 * Collection (AD-8) with the same non-withdrawn filter as `odp-dataset.json`.
 * Shared by the `odp-meta.json` endpoint and the Review page's baseline options,
 * which embed the numbers in their markup instead of fetching a build-time constant.
 * Server-side only (imports `astro:content`).
 */
import { getCollection } from 'astro:content';

export type ParamCounts = Record<'low' | 'moderate' | 'high' | 'privacy', number>;

let cached: Promise<ParamCounts> | null = null;

export function getParamCounts(): Promise<ParamCounts> {
  cached ??= (async () => {
    const counts: ParamCounts = { low: 0, moderate: 0, high: 0, privacy: 0 };
    for (const entry of await getCollection('controls')) {
      if (entry.data.withdrawn) continue;
      for (const baseline of entry.data.baselines) counts[baseline] += entry.data.params.length;
    }
    return counts;
  })();
  return cached;
}
