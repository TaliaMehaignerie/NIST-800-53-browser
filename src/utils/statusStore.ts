/**
 * The one shared localStorage read/write path for control implementation
 * status (AD-14). Deliberately ONE blob, key `control-status`, not one per
 * baseline like `odpStore` (AD-10): ODP values genuinely differ between
 * Moderate and High, implementation status does not — you pursue one
 * authorization, and AC-2 is either implemented in your system or it is not.
 * Baseline is a view filter over this single dataset. Do not "fix" the
 * asymmetry with odpStore.
 *
 * Blob shape: { schemaVersion: number, items: { "<itemSlug>": StatusRecord } }
 * Items are Controls AND Enhancements, keyed by slug. A missing or
 * unparseable blob is empty state — never a crash, never a fabricated status.
 * A missing record means `incomplete` to a reader, but nothing is stored for
 * it.
 */

export type ItemStatus = 'incomplete' | 'in-progress' | 'compliant' | 'not-applicable';

export const ITEM_STATUSES: readonly ItemStatus[] = ['incomplete', 'in-progress', 'compliant', 'not-applicable'];

export interface StatusRecord {
  status: ItemStatus;
  /** Required (non-empty) iff `status === 'not-applicable'`. */
  justification: string;
  /** Free text, may be empty. */
  owner: string;
  /** ISO timestamp, set on every write. */
  updatedAt: string;
}

interface StatusBlob {
  schemaVersion: number;
  items: Record<string, StatusRecord>;
}

export const STATUS_STORAGE_KEY = 'control-status';
const SCHEMA_VERSION = 1;

export function isItemStatus(value: unknown): value is ItemStatus {
  return typeof value === 'string' && (ITEM_STATUSES as readonly string[]).includes(value);
}

function isStatusRecord(value: unknown): value is StatusRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  if (!isItemStatus(r.status)) return false;
  if (typeof r.justification !== 'string' || typeof r.owner !== 'string' || typeof r.updatedAt !== 'string') return false;
  // Mirror the write-path invariant so a hand-edited blob fails like any corrupt one.
  return r.status !== 'not-applicable' || r.justification.trim().length > 0;
}

function isStatusBlob(value: unknown): value is StatusBlob {
  if (!value || typeof value !== 'object') return false;
  const b = value as Record<string, unknown>;
  if (typeof b.schemaVersion !== 'number') return false;
  if (!b.items || typeof b.items !== 'object' || Array.isArray(b.items)) return false;
  return Object.values(b.items as Record<string, unknown>).every(isStatusRecord);
}

function emptyBlob(): StatusBlob {
  return { schemaVersion: SCHEMA_VERSION, items: {} };
}

// Read-through cache keyed on the raw stored string (same scheme as
// odpStore): a write replaces the entry, and comparing the raw string keeps
// it correct across tabs. Cached blobs are shared and read-only.
let cache: { raw: string | null; blob: StatusBlob } | null = null;

function parseBlob(raw: string | null): StatusBlob {
  if (raw === null) return emptyBlob();
  try {
    const parsed = JSON.parse(raw);
    if (!isStatusBlob(parsed)) {
      console.error('statusStore: stored blob has unexpected shape, treating as empty state', parsed);
      return emptyBlob();
    }
    return parsed;
  } catch (err) {
    console.error('statusStore: stored blob is not valid JSON, treating as empty state', err);
    return emptyBlob();
  }
}

function readBlob(): StatusBlob {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STATUS_STORAGE_KEY);
  } catch (err) {
    console.error('statusStore: localStorage unavailable, treating as empty state', err);
    return emptyBlob();
  }
  if (cache && cache.raw === raw) return cache.blob;
  const blob = parseBlob(raw);
  cache = { raw, blob };
  return blob;
}

/** All stored records keyed by item slug. Read-only. */
export function getStatuses(): Record<string, StatusRecord> {
  return readBlob().items;
}

/** One item's record, or `undefined` when none was ever set (readers treat that as `incomplete`). */
export function getStatus(slug: string): StatusRecord | undefined {
  const items = readBlob().items;
  // Own-property check: a slug like `constructor` must not resolve to a prototype member.
  return Object.prototype.hasOwnProperty.call(items, slug) ? items[slug] : undefined;
}

/**
 * Writes one item's status and stamps `updatedAt`. Rejects (returns `false`,
 * nothing written) when `status` is unknown, or when `not-applicable` is
 * requested without a non-empty justification — the same boundary and idiom
 * as `overridden` requiring a rationale in `odpStore`. Also returns `false`
 * when the underlying write fails (quota, private mode).
 */
export function setStatus(slug: string, record: Omit<StatusRecord, 'updatedAt'>): boolean {
  if (!isItemStatus(record.status)) return false;
  if (record.status === 'not-applicable' && record.justification.trim().length === 0) return false;

  const current = readBlob();
  const next: StatusBlob = {
    ...current,
    items: { ...current.items, [slug]: { ...record, updatedAt: new Date().toISOString() } },
  };
  try {
    const raw = JSON.stringify(next);
    localStorage.setItem(STATUS_STORAGE_KEY, raw);
    cache = { raw, blob: next };
    return true;
  } catch (err) {
    console.error('statusStore: failed to write to localStorage', err);
    return false;
  }
}
