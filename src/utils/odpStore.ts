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

interface OdpBlob {
  schemaVersion: number;
  decisions: Record<string, Decision>;
}

const SCHEMA_VERSION = 1;

export const ODP_STORAGE_PREFIX = 'odp-decisions:';

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

function isOdpBlob(value: unknown): value is OdpBlob {
  if (!value || typeof value !== 'object') return false;
  const b = value as Record<string, unknown>;
  if (typeof b.schemaVersion !== 'number') return false;
  if (!b.decisions || typeof b.decisions !== 'object') return false;
  return Object.values(b.decisions as Record<string, unknown>).every(isDecision);
}

function emptyBlob(): OdpBlob {
  return { schemaVersion: SCHEMA_VERSION, decisions: {} };
}

/**
 * Reads the raw blob for a baseline, corrupt/missing-safe. Never throws.
 */
function readBlob(baseline: string): OdpBlob {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(baseline));
  } catch (err) {
    // localStorage can throw (e.g. disabled/private mode) — treat as empty.
    console.error('odpStore: localStorage unavailable, treating as empty state', err);
    return emptyBlob();
  }
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

/** Returns `true` on a successful write, `false` on a caught failure (e.g. quota exceeded, private mode). */
function writeBlob(baseline: string, blob: OdpBlob): boolean {
  try {
    localStorage.setItem(storageKey(baseline), JSON.stringify(blob));
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

  const blob = readBlob(baseline);
  blob.decisions[key] = decision;
  return writeBlob(baseline, blob);
}
