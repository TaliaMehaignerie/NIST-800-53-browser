/**
 * What "reviewing" means, in one place. An item (control or enhancement) in
 * your baseline still needs review while it has a parameter not yet confirmed
 * or overridden, or no status recorded. Everything else is reviewed — an item
 * marked "in progress" has been looked at; the dashboard tracks how far along
 * it is. Scope is the AD-15 rule (`isCounted`): your baseline plus the
 * program-wide PM items.
 */
import { controlUrl } from './url';
import { isCounted, type ComplianceItem } from './complianceCount';
import type { Decision } from './odpStore';
import type { StatusRecord } from './statusStore';
import type { ItemTuple } from './itemPayload';

export interface ReviewItem extends ComplianceItem {
  label: string;
  title: string;
  parentSlug: string;
  paramIds: string[];
}

export interface ItemProgress {
  item: ReviewItem;
  unreviewedParams: number;
  hasStatus: boolean;
  needsReview: boolean;
}

export function decodeItems(tuples: ItemTuple[]): ReviewItem[] {
  return tuples.map(([slug, label, title, familyCode, baselines, parentSlug, paramIds]) => ({
    slug,
    label,
    title,
    familyCode,
    baselines: baselines ? baselines.split(' ') : [],
    withdrawn: false,
    parentSlug,
    paramIds: paramIds ? paramIds.split(' ') : [],
  }));
}

/** Reads the embedded item list from `<script type="application/json" id=…>`; `null` if absent or unreadable. */
export function readItems(elementId: string): ReviewItem[] | null {
  const el = document.getElementById(elementId);
  if (!el) return null;
  try {
    return decodeItems(JSON.parse(el.textContent ?? '[]') as ItemTuple[]);
  } catch (err) {
    console.error('reviewItems: could not parse embedded item list', err);
    return null;
  }
}

/**
 * Parameters can be decided only for an item that is IN your baseline. The
 * program-wide PM items are counted for status (AD-15) but belong to no
 * baseline, so their parameters are invisible to the workspace and the export
 * and recording a decision there is out of scope (AD-13).
 */
export function decidableParams(item: ReviewItem, baseline: string): string[] {
  return item.baselines.includes(baseline) ? item.paramIds : [];
}

export function progressFor(
  item: ReviewItem,
  baseline: string,
  decisions: Record<string, Decision>,
  statuses: Record<string, StatusRecord>,
): ItemProgress {
  const unreviewedParams = decidableParams(item, baseline).filter((id) => {
    const d = decisions[`${item.slug}:${id}`];
    return !d || d.status === 'unreviewed-default';
  }).length;
  const status = Object.prototype.hasOwnProperty.call(statuses, item.slug) ? statuses[item.slug].status : undefined;
  const hasStatus = status !== undefined && status !== 'incomplete';
  return { item, unreviewedParams, hasStatus, needsReview: unreviewedParams > 0 || !hasStatus };
}

/** Items in your baseline, in catalog order, with their review progress. */
export function reviewProgress(
  items: ReviewItem[],
  baseline: string,
  decisions: Record<string, Decision>,
  statuses: Record<string, StatusRecord>,
): ItemProgress[] {
  return items.filter((i) => isCounted(i, baseline)).map((i) => progressFor(i, baseline, decisions, statuses));
}

/** Where an item is reviewed: its own control page, or its parent's page at the enhancement. */
export function itemUrl(item: ReviewItem, reviewing = false): string {
  const page = item.parentSlug ? controlUrl(item.parentSlug) : controlUrl(item.slug);
  return `${page}${reviewing ? '?review=1' : ''}${item.parentSlug ? `#${item.slug}` : ''}`;
}

/** The next item needing review after `afterSlug` (catalog order), wrapping to the start; `undefined` when none is left. */
export function nextToReview(progress: ItemProgress[], afterSlug?: string | null): ItemProgress | undefined {
  const pending = progress.filter((p) => p.needsReview);
  if (pending.length === 0) return undefined;
  if (!afterSlug) return pending[0];
  const at = progress.findIndex((p) => p.item.slug === afterSlug);
  if (at < 0) return pending[0];
  return progress.slice(at + 1).find((p) => p.needsReview) ?? pending.find((p) => p.item.slug !== afterSlug) ?? undefined;
}
