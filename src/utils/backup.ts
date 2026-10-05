/**
 * Story 18: backup, restore and the storage budget.
 *
 * OSCAL export is a product, not a backup: it is lossy about owner, status and
 * evidence notes and cannot be re-imported. Hand-written evidence and N/A
 * justifications exist only in this browser profile, so this module moves
 * BOTH blobs (ODP decisions per baseline, control status) in one versioned
 * envelope. The envelope has its own version, and each blob's `schemaVersion`
 * travels inside it.
 *
 * All storage access stays in `odpStore.ts` / `statusStore.ts` (AD-10, AD-14):
 * this module only uses their raw read/write functions. Restore validates the
 * WHOLE file before writing anything, and a failed write rolls every key back
 * to what it was — a file from another schema version, or one that cannot be
 * fully applied, never changes your data.
 */
import { BASELINES, activeBaselineStorageChars, baselineLabel, type Baseline } from './activeBaseline';
import {
  ODP_SCHEMA_VERSION,
  isOdpBlob,
  odpStorageKey,
  readRawBlob as readOdpRaw,
  writeRawBlob as writeOdpRaw,
  type OdpBlob,
} from './odpStore';
import { originUsageChars } from './originStorage';
import {
  STATUS_SCHEMA_VERSION,
  STATUS_STORAGE_KEY,
  isEvidenceRef,
  isStatusBlob,
  readRawBlob as readStatusRaw,
  writeRawBlob as writeStatusRaw,
  type StatusBlob,
} from './statusStore';

export const BACKUP_APP = 'nist-800-53-browser-workbench';
export const ENVELOPE_VERSION = 1;
/**
 * Generous ceiling (twice the ~5M-character storage budget): a backup of a
 * nearly full store plus the envelope wrapper must still restore — that is the
 * exact case "Download a backup now" sends people to.
 */
export const MAX_BACKUP_CHARS = 10 * 1024 * 1024;

export interface BackupEnvelope {
  app: typeof BACKUP_APP;
  envelopeVersion: number;
  exportedAt: string;
  odpDecisions: Partial<Record<Baseline, OdpBlob>>;
  controlStatus: StatusBlob | null;
  /**
   * Raw text of stored blobs that could not be read. Kept so a safety download
   * never silently loses them; a restore ignores this field.
   */
  unreadable?: Record<string, string>;
}

export interface BackupSummary {
  /** Stored items that are unreadable and so are in no restorable backup. */
  unreadable: string[];
  decisionsByBaseline: Partial<Record<Baseline, number>>;
  totalDecisions: number;
  statusRecords: number;
  evidenceRefs: number;
}

export type ParseResult = { ok: true; envelope: BackupEnvelope } | { ok: false; message: string };

function parseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The current data as an envelope. `skipped` names any stored blob that was unreadable and so left out. */
export function buildEnvelope(now: Date = new Date()): { envelope: BackupEnvelope; skipped: string[] } {
  const skipped: string[] = [];
  const unreadable: Record<string, string> = {};
  const odpDecisions: BackupEnvelope['odpDecisions'] = {};
  for (const baseline of BASELINES) {
    const raw = readOdpRaw(baseline);
    if (raw === null) continue;
    const parsed = parseJson(raw);
    if (isOdpBlob(parsed)) odpDecisions[baseline] = parsed;
    else {
      skipped.push(`${baselineLabel(baseline)} decisions`);
      unreadable[odpStorageKey(baseline)] = raw;
    }
  }

  let controlStatus: StatusBlob | null = null;
  const statusRaw = readStatusRaw();
  if (statusRaw !== null) {
    const parsed = parseJson(statusRaw);
    if (isStatusBlob(parsed)) controlStatus = parsed;
    else {
      skipped.push('control status');
      unreadable[STATUS_STORAGE_KEY] = statusRaw;
    }
  }

  return {
    envelope: {
      app: BACKUP_APP,
      envelopeVersion: ENVELOPE_VERSION,
      exportedAt: now.toISOString(),
      odpDecisions,
      controlStatus,
      ...(skipped.length > 0 ? { unreadable } : {}),
    },
    skipped,
  };
}

export function backupFileName(now: Date = new Date()): string {
  return `nist-800-53-workbench-backup-${now.toISOString().slice(0, 10)}.json`;
}

export function serializeEnvelope(envelope: BackupEnvelope): string {
  return JSON.stringify(envelope);
}

function refuse(message: string): ParseResult {
  return { ok: false, message: `${message} Nothing was changed.` };
}

/** Validates a whole backup file. Anything short of fully valid and on the current schema versions is refused. */
export function parseEnvelope(text: string): ParseResult {
  if (text.length > MAX_BACKUP_CHARS) return refuse('That file is too large to be a workbench backup.');

  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return refuse('That file is not valid JSON, so it cannot be a workbench backup.');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return refuse('That file is not a workbench backup.');

  const file = value as Record<string, unknown>;
  if (file.app !== BACKUP_APP) return refuse('That file is not a backup from this app.');
  if (file.envelopeVersion !== ENVELOPE_VERSION) {
    return refuse(
      `This backup uses file version ${String(file.envelopeVersion)}, but this app reads version ${ENVELOPE_VERSION}.`,
    );
  }
  if (typeof file.exportedAt !== 'string') return refuse('That backup has no export date, so it looks damaged.');

  const decisions = file.odpDecisions;
  if (!decisions || typeof decisions !== 'object' || Array.isArray(decisions)) {
    return refuse('That backup has no decisions section, so it looks damaged.');
  }
  const odpDecisions: BackupEnvelope['odpDecisions'] = {};
  for (const [key, blob] of Object.entries(decisions as Record<string, unknown>)) {
    if (!(BASELINES as readonly string[]).includes(key)) return refuse(`That backup contains an unknown baseline "${key}".`);
    if (!isOdpBlob(blob)) return refuse(`The ${baselineLabel(key)} decisions in that backup are damaged.`);
    if (blob.schemaVersion !== ODP_SCHEMA_VERSION) {
      return refuse(
        `The ${baselineLabel(key)} decisions in that backup use schema version ${blob.schemaVersion}, ` +
          `but this app reads version ${ODP_SCHEMA_VERSION}.`,
      );
    }
    odpDecisions[key as Baseline] = blob;
  }

  let controlStatus: StatusBlob | null = null;
  if (file.controlStatus !== null && file.controlStatus !== undefined) {
    if (!isStatusBlob(file.controlStatus)) return refuse('The control status in that backup is damaged.');
    if (file.controlStatus.schemaVersion !== STATUS_SCHEMA_VERSION) {
      return refuse(
        `The control status in that backup uses schema version ${file.controlStatus.schemaVersion}, ` +
          `but this app reads version ${STATUS_SCHEMA_VERSION}.`,
      );
    }
    for (const record of Object.values(file.controlStatus.items)) {
      const evidence = (record as { evidence?: unknown }).evidence;
      if (evidence !== undefined && !(Array.isArray(evidence) && evidence.every(isEvidenceRef))) {
        return refuse('The evidence in that backup is damaged.');
      }
    }
    controlStatus = file.controlStatus;
  }

  return {
    ok: true,
    envelope: { app: BACKUP_APP, envelopeVersion: ENVELOPE_VERSION, exportedAt: file.exportedAt, odpDecisions, controlStatus },
  };
}

export function summarize(envelope: BackupEnvelope): BackupSummary {
  const decisionsByBaseline: BackupSummary['decisionsByBaseline'] = {};
  let totalDecisions = 0;
  for (const baseline of BASELINES) {
    const blob = envelope.odpDecisions[baseline];
    if (!blob) continue;
    const n = Object.keys(blob.decisions).length;
    decisionsByBaseline[baseline] = n;
    totalDecisions += n;
  }
  const records = Object.values(envelope.controlStatus?.items ?? {});
  return {
    decisionsByBaseline,
    totalDecisions,
    statusRecords: records.length,
    evidenceRefs: records.reduce((sum, r) => sum + (Array.isArray(r.evidence) ? r.evidence.length : 0), 0),
    unreadable: [],
  };
}

export function currentSummary(): BackupSummary {
  const { envelope, skipped } = buildEnvelope();
  return { ...summarize(envelope), unreadable: skipped };
}

/** Replaces all stored data with the envelope's. All-or-nothing: a failed write restores every key. */
export function applyEnvelope(envelope: BackupEnvelope): { ok: boolean; message: string } {
  const previousOdp = BASELINES.map((b) => [b, readOdpRaw(b)] as const);
  const previousStatus = readStatusRaw();

  const writes: boolean[] = BASELINES.map((baseline) => {
    const blob = envelope.odpDecisions[baseline];
    return writeOdpRaw(baseline, blob ? JSON.stringify(blob) : null);
  });
  writes.push(writeStatusRaw(envelope.controlStatus ? JSON.stringify(envelope.controlStatus) : null));

  if (writes.every(Boolean)) return { ok: true, message: 'Restored. Your data now matches the backup file.' };

  // Put every key back, and check that each put-back worked: freed space can be
  // taken by another tab or site before the rollback lands.
  const notRestored: string[] = [];
  // Only keys that actually differ need putting back: a write that failed
  // changed nothing, so there is nothing to undo (and nothing to fail again).
  for (const [baseline, raw] of previousOdp) {
    if (readOdpRaw(baseline) !== raw && !writeOdpRaw(baseline, raw)) notRestored.push(`${baselineLabel(baseline)} decisions`);
  }
  if (readStatusRaw() !== previousStatus && !writeStatusRaw(previousStatus)) notRestored.push('control status');

  return notRestored.length === 0
    ? {
        ok: false,
        message: 'Could not write the backup to browser storage (it may be full). Your previous data was put back unchanged.',
      }
    : {
        ok: false,
        message:
          `Could not write the backup to browser storage, and could not put back: ${notRestored.join(', ')}. ` +
          'Restore the backup file you downloaded before this, once there is space.',
      };
}

// ---- storage budget ------------------------------------------------------

/**
 * Browsers do not expose localStorage's limit. ~5M characters is the common
 * floor across engines, so it is used as the conservative budget and shown as
 * approximate. The quota is shared by the whole ORIGIN, and this site is served
 * from a `github.io` origin that other projects also write to, so usage is the
 * origin's total (measured in `originStorage.ts`), with this app's own blobs
 * broken out and the remainder reported as other data on the origin.
 */
export const STORAGE_QUOTA_CHARS = 5 * 1024 * 1024;
export const BUDGET_WARN_RATIO = 0.8;
export const BUDGET_CRITICAL_RATIO = 0.95;

export interface StoragePart {
  label: string;
  chars: number;
}

export interface StorageUsage {
  usedChars: number;
  quotaChars: number;
  ratio: number;
  parts: StoragePart[];
  level: 'ok' | 'warn' | 'critical';
}

export function storageUsage(): StorageUsage {
  const parts: StoragePart[] = [];
  for (const baseline of BASELINES) {
    const raw = readOdpRaw(baseline);
    if (raw !== null) parts.push({ label: `${baselineLabel(baseline)} decisions`, chars: odpStorageKey(baseline).length + raw.length });
  }
  const status = readStatusRaw();
  if (status !== null) parts.push({ label: 'Control status and evidence', chars: STATUS_STORAGE_KEY.length + status.length });

  const setting = activeBaselineStorageChars();
  if (setting > 0) parts.push({ label: 'Settings', chars: setting });
  const ours = parts.reduce((sum, p) => sum + p.chars, 0);
  const usedChars = Math.max(originUsageChars(), ours);
  if (usedChars > ours) parts.push({ label: 'Other data on this site\'s origin (other projects)', chars: usedChars - ours });
  const ratio = usedChars / STORAGE_QUOTA_CHARS;
  return {
    usedChars,
    quotaChars: STORAGE_QUOTA_CHARS,
    ratio,
    parts,
    level: ratio >= BUDGET_CRITICAL_RATIO ? 'critical' : ratio >= BUDGET_WARN_RATIO ? 'warn' : 'ok',
  };
}

export function formatSize(chars: number): string {
  if (chars >= 1024 * 1024) return `${(chars / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(0.1, chars / 1024).toFixed(1)} KB`;
}
