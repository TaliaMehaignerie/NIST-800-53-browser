/**
 * The compact per-item list that review and planning surfaces embed at build
 * time (no fetch): every non-withdrawn control and enhancement, in catalog
 * order. Built once here so the pages that embed it cannot drift apart.
 * Server-side only (imports `astro:content`); `reviewItems.ts` decodes it.
 *
 * Tuple: [slug, label, title, familyCode, space-joined baselines,
 *         parentSlug ('' for a control), space-joined paramIds]
 */
import { getCollection } from 'astro:content';

export type ItemTuple = [string, string, string, string, string, string, string];

let cached: Promise<ItemTuple[]> | null = null;

export function getItemTuples(): Promise<ItemTuple[]> {
  cached ??= (async () =>
    (await getCollection('controls'))
      .filter((e) => !e.data.withdrawn)
      .sort((a, b) => (a.data.sortId < b.data.sortId ? -1 : a.data.sortId > b.data.sortId ? 1 : 0))
      .map(
        (e): ItemTuple => [
          e.data.slug,
          e.data.label,
          e.data.title,
          e.data.familyCode,
          e.data.baselines.join(' '),
          e.data.parentSlug ?? '',
          e.data.params.map((p: { id: string }) => p.id).join(' '),
        ],
      ))();
  return cached;
}

/** The tuple list as JSON safe to embed in a `<script type="application/json">` (`<` escaped). */
export async function itemPayloadJson(): Promise<string> {
  return JSON.stringify(await getItemTuples()).replace(/</g, '\\u003c');
}
