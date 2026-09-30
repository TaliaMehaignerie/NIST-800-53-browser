/**
 * The one shared localStorage read/write path for ODP decisions (AD-10).
 * No other module in this feature may call `localStorage` directly.
 *
 * Blob shape, one per baseline, key `odp-decisions:<baseline>`:
 *   { schemaVersion: number, decisions: { "<controlSlug>:<paramId>": Decision } }
 *
 * A missing or unparseable blob is always treated as empty state — never
 * thrown as an uncaught error, never used to fabricate a value (AD-10,
 * spec I/O matrix "Corrupt blob").
 */

export type DecisionStatus = 'unreviewed-default' | 'confirmed' | 'overridden';

export interface Decision {
  value: string | string[];
  status: DecisionStatus;
  rationale: string;
}

export interface OdpBlob {
  schemaVersion: number;
  decisions: Record<string, Decision>;
}

const SCHEMA_VERSION = 1;

/** The blob schema version this build reads and writes (travels inside a backup envelope). */
export const ODP_SCHEMA_VERSION = SCHEMA_VERSION;

export const ODP_STORAGE_PREFIX = 'odp-decisions:';

export function odpStorageKey(baseline: string): string {
  return storageKey(baseline);
}

function storageKey(baseline: string): string {
  return `${ODP_STORAGE_PREFIX}${baseline}`;
}

function isDecision(value: unknown): value is Decision {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  const valueOk =
    typeof d.value === 'string' || (Array.isArray(d.value) && d.value.every((v) => typeof v === 'string'));
  const statusOk = d.status === 'unreviewed-default' || d.status === 'confirmed' || d.status === 'overridden';
  const rationaleOk = typeof d.rationale === 'string';
  // Mirror the write-path invariant (setDecision): `overridden` requires a
  // non-empty rationale. Keeps read and write paths consistent — a
  // hand-edited or bug-written blob with `overridden` + empty rationale
  // fails validation here and falls back to empty state, same as any other
  // corrupt blob.
  const overrideRationaleOk = d.status !== 'overridden' || (rationaleOk && (d.rationale as string).trim().length > 0);
  return valueOk && statusOk && rationaleOk && overrideRationaleOk;
}

export function isOdpBlob(value: unknown): value is OdpBlob {
  if (!value || typeof value !== 'object') return false;
  const b = value as Record<string, unknown>;
  if (typeof b.schemaVersion !== 'number') return false;
  if (!b.decisions || typeof b.decisions !== 'object' || Array.isArray(b.decisions)) return false;
  return Object.values(b.decisions as Record<string, unknown>).every(isDecision);
}

function emptyBlob(): OdpBlob {
  return { schemaVersion: SCHEMA_VERSION, decisions: {} };
}

// Read-through cache keyed on the raw stored string: `localStorage.getItem`
// is cheap, `JSON.parse` plus validation of the whole blob is not (the
// dashboard used to do 643 full parses per refresh). Comparing the raw string
// keeps this correct across tabs with no invalidation hook, and a write
// replaces the entry. Cached blobs are shared - callers must treat them as
// read-only, and `setDecision` builds a new object rather than mutating.
const cache = new Map<string, { raw: string | null; blob: OdpBlob }>();

/**
 * Reads the blob for a baseline, corrupt/missing-safe. Never throws.
 */
function readBlob(baseline: string): OdpBlob {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(baseline));
  } catch (err) {
    // localStorage can throw (e.g. disabled/private mode) - treat as empty.
    console.error('odpStore: localStorage unavailable, treating as empty state', err);
    return emptyBlob();
  }

  const hit = cache.get(baseline);
  if (hit && hit.raw === raw) return hit.blob;

  const blob = parseBlob(raw);
  cache.set(baseline, { raw, blob });
  return blob;
}

function parseBlob(raw: string | null): OdpBlob {
  if (raw === null) return emptyBlob();
  try {
    const parsed = JSON.parse(raw);
    if (!isOdpBlob(parsed)) {
      console.error('odpStore: stored blob has unexpected shape, treating as empty state', parsed);
      return emptyBlob();
    }
    return parsed;
  } catch (err) {
    console.error('odpStore: stored blob is not valid JSON, treating as empty state', err);
    return emptyBlob();
  }
}

/**
 * Backup/restore access (story 18): the stored text of one baseline's blob, or
 * `null` when none. Kept here so this module stays the only localStorage path.
 */
export function readRawBlob(baseline: string): string | null {
  try {
    return localStorage.getItem(storageKey(baseline));
  } catch (err) {
    console.error('odpStore: localStorage unavailable', err);
    return null;
  }
}

/** Replaces one baseline's stored blob with `raw`, or removes it for `null`. Returns `false` on failure. */
export function writeRawBlob(baseline: string, raw: string | null): boolean {
  try {
    if (raw === null) localStorage.removeItem(storageKey(baseline));
    else localStorage.setItem(storageKey(baseline), raw);
    return true;
  } catch (err) {
    console.error('odpStore: failed to write to localStorage', err);
    return false;
  }
}

/** Returns `true` on a successful write, `false` on a caught failure (e.g. quota exceeded, private mode). */
function writeBlob(baseline: string, blob: OdpBlob): boolean {
  try {
    const raw = JSON.stringify(blob);
    localStorage.setItem(storageKey(baseline), raw);
    cache.set(baseline, { raw, blob });
    return true;
  } catch (err) {
    console.error('odpStore: failed to write to localStorage', err);
    return false;
  }
}

/** All decisions currently stored for a baseline, keyed by `controlSlug:paramId`. */
export function getDecisions(baseline: string): Record<string, Decision> {
  return readBlob(baseline).decisions;
}

/**
 * One decision, or `undefined` when unset — callers should treat that as
 * `status: 'unreviewed-default'` with no value (AD-10).
 */
export function getDecision(baseline: string, key: string): Decision | undefined {
  return readBlob(baseline).decisions[key];
}

/**
 * Writes one decision. Rejects (returns `false`, no partial write) when
 * `status: 'overridden'` is requested without a non-empty `rationale` —
 * spec I/O matrix "Override without rationale" — or when the underlying
 * `localStorage.setItem` call itself fails (quota exceeded, private mode,
 * etc.), so a caller never treats an unpersisted decision as saved.
 */
export function setDecision(baseline: string, key: string, decision: Decision): boolean {
  if (decision.status === 'overridden' && decision.rationale.trim().length === 0) {
    return false;
  }

  const current = readBlob(baseline);
  return writeBlob(baseline, { ...current, decisions: { ...current.decisions, [key]: decision } });
}
