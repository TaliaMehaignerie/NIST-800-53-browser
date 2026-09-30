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
 *
 * Evidence (story 14) is structured references, never uploaded files: a note,
 * an optional URL, and a `collectedAt` the store stamps itself. Base64 files
 * would share localStorage's ~5MB quota with the ODP decision blobs, and a
 * full quota would silently stop parameter decisions saving on other pages.
 * `schemaVersion` stays 1: `evidence` is optional on read and normalized to
 * `[]`, so existing blobs keep working rather than reading as corrupt.
 */

export type ItemStatus = 'incomplete' | 'in-progress' | 'compliant' | 'not-applicable';

export const ITEM_STATUSES: readonly ItemStatus[] = ['incomplete', 'in-progress', 'compliant', 'not-applicable'];

export interface EvidenceRef {
  note: string;
  /** Empty string when none; otherwise an http(s) URL. */
  url: string;
  /** ISO timestamp, stamped by the store — never a user field. */
  collectedAt: string;
}

/** What callers pass in: `collectedAt` is kept when given (unchanged ref), stamped when absent. */
export interface EvidenceInput {
  note: string;
  url: string;
  collectedAt?: string;
}

export interface StatusRecord {
  status: ItemStatus;
  /** Required (non-empty) iff `status === 'not-applicable'`. */
  justification: string;
  /** Free text, may be empty. */
  owner: string;
  /** Proof of completion; empty when none. */
  evidence: EvidenceRef[];
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

/** True for an http(s) URL — the only kind ever rendered as a link. */
export function isSafeEvidenceUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/** First problem with a set of evidence inputs, or `null`. Shared by the store and the UI. */
export function validateEvidence(evidence: EvidenceInput[]): string | null {
  for (const ref of evidence) {
    if (ref.note.trim().length === 0) return 'Each evidence reference needs a note.';
    if (ref.url.trim().length > 0 && !isSafeEvidenceUrl(ref.url.trim())) {
      return 'Evidence URLs must start with http:// or https://.';
    }
  }
  return null;
}

function isEvidenceRef(value: unknown): value is EvidenceRef {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return typeof e.note === 'string' && typeof e.url === 'string' && typeof e.collectedAt === 'string';
}

function isStatusRecord(value: unknown): value is StatusRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  if (r.evidence !== undefined && !(Array.isArray(r.evidence) && r.evidence.every(isEvidenceRef))) return false;
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
    // Blobs written before evidence existed carry no `evidence` field.
    for (const record of Object.values(parsed.items)) record.evidence ??= [];
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
  return getOwn(readBlob().items, slug);
}

// Own-property check: a slug like `constructor` must not resolve to a prototype member.
function getOwn(items: Record<string, StatusRecord>, slug: string): StatusRecord | undefined {
  return Object.prototype.hasOwnProperty.call(items, slug) ? items[slug] : undefined;
}

/**
 * Writes one item's status and stamps `updatedAt`. Rejects (returns `false`,
 * nothing written) when `status` is unknown, or when `not-applicable` is
 * requested without a non-empty justification — the same boundary and idiom
 * as `overridden` requiring a rationale in `odpStore`. Also returns `false`
 * when the underlying write fails (quota, private mode).
 */
export function setStatus(
  slug: string,
  record: { status: ItemStatus; justification: string; owner: string; evidence?: EvidenceInput[] },
): boolean {
  if (!isItemStatus(record.status)) return false;
  if (record.status === 'not-applicable' && record.justification.trim().length === 0) return false;
  if (record.evidence && validateEvidence(record.evidence) !== null) return false;

  const current = readBlob();
  const now = new Date().toISOString();
  // Omitted evidence preserves what is stored, so a caller that only changes
  // status (e.g. a bulk write) can never wipe references.
  const evidence: EvidenceRef[] = record.evidence
    ? record.evidence.map((e) => ({ note: e.note.trim(), url: e.url.trim(), collectedAt: e.collectedAt ?? now }))
    : (getOwn(current.items, slug)?.evidence ?? []);
  const next: StatusBlob = {
    ...current,
    items: {
      ...current.items,
      [slug]: { status: record.status, justification: record.justification, owner: record.owner, evidence, updatedAt: now },
    },
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
