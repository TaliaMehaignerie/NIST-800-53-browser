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

/**
 * What callers pass in. There is deliberately no date: the store carries an
 * existing reference's `collectedAt` forward when its note and URL are
 * unchanged, and stamps `now` otherwise, so a caller can neither backdate
 * evidence nor accidentally re-stamp it.
 */
export interface EvidenceInput {
  note: string;
  url: string;
}

/** Caps that protect the ~5MB localStorage quota shared with the ODP blobs. */
export const MAX_EVIDENCE_REFS = 20;
export const MAX_EVIDENCE_NOTE_LENGTH = 2000;

export const JUSTIFICATION_REQUIRED_MESSAGE = 'A justification is required to mark this not applicable.';
export const EVIDENCE_NOTE_REQUIRED_MESSAGE = 'Each evidence reference needs a note.';
export const EVIDENCE_URL_MESSAGE = 'Evidence URLs must start with http:// or https://.';
export const INHERITED_PROVIDER_MESSAGE = 'Name the provider this is inherited from.';
export const EVIDENCE_LIMIT_MESSAGE = `An item can carry at most ${MAX_EVIDENCE_REFS} evidence references of ${MAX_EVIDENCE_NOTE_LENGTH} characters each.`;

export interface StatusRecord {
  status: ItemStatus;
  /** Required (non-empty) iff `status === 'not-applicable'`. */
  justification: string;
  /** Free text, may be empty. */
  owner: string;
  /**
   * The provider a `not-applicable` status is inherited from (story 19): the
   * most common real N/A reason and the one an assessor asks about, kept as a
   * structured field rather than buried in free text. Set only for N/A.
   */
  inheritedFrom?: string;
  /** Proof of completion; empty when none. */
  evidence: EvidenceRef[];
  /** ISO timestamp, set on every write. */
  updatedAt: string;
}

export interface StatusBlob {
  schemaVersion: number;
  items: Record<string, StatusRecord>;
}

export const STATUS_STORAGE_KEY = 'control-status';
const SCHEMA_VERSION = 1;

/** The blob schema version this build reads and writes (travels inside a backup envelope). */
export const STATUS_SCHEMA_VERSION = SCHEMA_VERSION;

export function isItemStatus(value: unknown): value is ItemStatus {
  return typeof value === 'string' && (ITEM_STATUSES as readonly string[]).includes(value);
}

/**
 * True only for a URL that literally starts with `http://` or `https://`,
 * parses, and carries no credentials — the only kind ever rendered as a link.
 * (`new URL('http:example.com')` and backslash forms parse as http(s), so the
 * prefix is checked on the string itself, matching what the message promises.)
 */
export function isSafeEvidenceUrl(url: string): boolean {
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    return (
      (parsed.protocol === 'http:' || parsed.protocol === 'https:') && parsed.username === '' && parsed.password === ''
    );
  } catch {
    return false;
  }
}

/** A row with neither note nor URL is an empty form row, not a reference. */
function isBlankRef(ref: EvidenceInput): boolean {
  return ref.note.trim().length === 0 && ref.url.trim().length === 0;
}

/**
 * The one place a status write is judged. Returns the reason a write would be
 * refused, or `null`. `setStatus` refuses on exactly this, and the UI shows
 * exactly this, so the message can never drift from the rule.
 */
export function statusProblem(record: {
  status: ItemStatus;
  justification: string;
  inheritedFrom?: string;
  evidence?: EvidenceInput[];
}): string | null {
  if (record.status === 'not-applicable' && record.inheritedFrom !== undefined && record.inheritedFrom.trim().length === 0) {
    return INHERITED_PROVIDER_MESSAGE;
  }
  if (record.status === 'not-applicable' && record.justification.trim().length === 0) {
    return JUSTIFICATION_REQUIRED_MESSAGE;
  }
  const refs = (record.evidence ?? []).filter((r) => !isBlankRef(r));
  if (refs.length > MAX_EVIDENCE_REFS) return EVIDENCE_LIMIT_MESSAGE;
  for (const ref of refs) {
    if (ref.note.trim().length === 0) return EVIDENCE_NOTE_REQUIRED_MESSAGE;
    if (ref.note.length > MAX_EVIDENCE_NOTE_LENGTH) return EVIDENCE_LIMIT_MESSAGE;
    if (ref.url.trim().length > 0 && !isSafeEvidenceUrl(ref.url.trim())) return EVIDENCE_URL_MESSAGE;
  }
  return null;
}

export function isEvidenceRef(value: unknown): value is EvidenceRef {
  if (!value || typeof value !== 'object') return false;
  const e = value as Record<string, unknown>;
  return typeof e.note === 'string' && typeof e.url === 'string' && typeof e.collectedAt === 'string';
}

// A malformed or empty-note evidence entry is dropped on read, never allowed to
// void the whole blob (every item's status) or to wedge later saves.
function readableEvidence(value: unknown): EvidenceRef[] {
  if (!Array.isArray(value)) return [];
  const kept = value.filter((e): e is EvidenceRef => isEvidenceRef(e) && e.note.trim().length > 0);
  if (kept.length !== value.length) console.error('statusStore: dropped malformed evidence entries from stored blob');
  return kept;
}

function isStatusRecord(value: unknown): value is StatusRecord {
  if (!value || typeof value !== 'object') return false;
  const r = value as Record<string, unknown>;
  if (!isItemStatus(r.status)) return false;
  if (typeof r.justification !== 'string' || typeof r.owner !== 'string' || typeof r.updatedAt !== 'string') return false;
  if (r.inheritedFrom !== undefined && typeof r.inheritedFrom !== 'string') return false;
  // Mirror the write-path invariant so a hand-edited blob fails like any corrupt one.
  return r.status !== 'not-applicable' || r.justification.trim().length > 0;
}

export function isStatusBlob(value: unknown): value is StatusBlob {
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
    for (const record of Object.values(parsed.items)) record.evidence = readableEvidence(record.evidence);
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

/**
 * Backup/restore access (story 18): the stored text of the status blob, or
 * `null` when none. Kept here so this module stays the only localStorage path.
 */
export function readRawBlob(): string | null {
  try {
    return localStorage.getItem(STATUS_STORAGE_KEY);
  } catch (err) {
    console.error('statusStore: localStorage unavailable', err);
    return null;
  }
}

/** Replaces the stored blob with `raw`, or removes it for `null`. Returns `false` on failure. */
export function writeRawBlob(raw: string | null): boolean {
  try {
    if (raw === null) localStorage.removeItem(STATUS_STORAGE_KEY);
    else localStorage.setItem(STATUS_STORAGE_KEY, raw);
    return true;
  } catch (err) {
    console.error('statusStore: failed to write to localStorage', err);
    return false;
  }
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

/** The justification stored for an inherited N/A: the user's details, else a default naming the provider. */
export function inheritedJustification(provider: string, details: string): string {
  return details.trim().length > 0 ? details : `Inherited from ${provider.trim()}`;
}

export interface StatusInput {
  status: ItemStatus;
  justification: string;
  owner: string;
  /** Provider for an inherited not-applicable status; ignored for any other status. */
  inheritedFrom?: string;
  evidence?: EvidenceInput[];
}

// Builds the stored record for one write. Omitted evidence preserves what is
// stored, so a caller that only changes status (e.g. a bulk write) can never
// wipe references. Given evidence: blank rows are dropped, and a reference
// whose note and URL match an unused stored one keeps that one's
// `collectedAt`; anything else is stamped `now`.
function buildRecord(existing: StatusRecord | undefined, input: StatusInput, now: string): StatusRecord {
  const stored = existing?.evidence ?? [];
  const unused = [...stored];
  const evidence: EvidenceRef[] = input.evidence
    ? input.evidence
        .filter((e) => !isBlankRef(e))
        .map((e) => {
          const note = e.note.trim();
          const url = e.url.trim();
          const at = unused.findIndex((s) => s.note === note && s.url === url);
          const collectedAt = at >= 0 ? unused.splice(at, 1)[0].collectedAt : now;
          return { note, url, collectedAt };
        })
    : stored;
  const provider = input.status === 'not-applicable' ? input.inheritedFrom?.trim() : undefined;
  return {
    status: input.status,
    justification: input.justification,
    owner: input.owner,
    ...(provider ? { inheritedFrom: provider } : {}),
    evidence,
    updatedAt: now,
  };
}

function writeBlob(next: StatusBlob): boolean {
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

/**
 * Writes one item's status and stamps `updatedAt`. Rejects (returns `false`,
 * nothing written) when `status` is unknown, or when `not-applicable` is
 * requested without a non-empty justification — the same boundary and idiom
 * as `overridden` requiring a rationale in `odpStore`. Also returns `false`
 * when the underlying write fails (quota, private mode).
 */
export function setStatus(slug: string, record: StatusInput): boolean {
  if (!isItemStatus(record.status)) return false;
  if (statusProblem(record) !== null) return false;

  const current = readBlob();
  const now = new Date().toISOString();
  return writeBlob({
    ...current,
    items: { ...current.items, [slug]: buildRecord(getOwn(current.items, slug), record, now) },
  });
}

/**
 * Writes many items in ONE atomic pass (story 19, bulk not-applicable): every
 * entry is validated first and then written to the blob together, so either
 * all of them land or none do. The records are fully independent — nothing
 * marks them as bulk-derived, and each stays individually editable (the same
 * discipline as AD-11's batch decisions).
 */
export function setStatuses(entries: { slug: string; record: StatusInput }[]): boolean {
  if (entries.length === 0) return true;
  for (const { record } of entries) {
    if (!isItemStatus(record.status) || statusProblem(record) !== null) return false;
  }
  const current = readBlob();
  const now = new Date().toISOString();
  const items = { ...current.items };
  for (const { slug, record } of entries) items[slug] = buildRecord(getOwn(current.items, slug), record, now);
  return writeBlob({ ...current, items });
}
