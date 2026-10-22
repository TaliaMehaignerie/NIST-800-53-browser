/**
 * Story 22: whether the workbench currently holds the bundled sample data.
 *
 * The flag is one small key, separate from the data blobs, so sample data is
 * never mistaken for the visitor's own work. Its value is a fingerprint of the
 * decision and status blobs as they were when the sample was loaded (or
 * restored); a different fingerprint later means the visitor has edited the
 * sample, which the clear confirmation says out loud. Blobs are read only
 * through their own modules (AD-10, AD-14).
 */
import { BASELINES } from './activeBaseline';
import { readRawBlob as readOdpRaw } from './odpStore';
import { readRawBlob as readStatusRaw } from './statusStore';

export const SAMPLE_FLAG_KEY = 'sample-data';

/** FNV-1a over every stored blob. Not a security measure: it only notices that something changed. */
export function dataFingerprint(): string {
  let hash = 0x811c9dc5;
  const feed = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  };
  for (const baseline of BASELINES) feed(`${baseline}\n${readOdpRaw(baseline) ?? ''}\n`);
  feed(`status\n${readStatusRaw() ?? ''}`);
  return hash.toString(16);
}

function readFlag(): { fingerprint: string } | null {
  try {
    const raw = localStorage.getItem(SAMPLE_FLAG_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as { fingerprint?: unknown } | null;
    return parsed && typeof parsed.fingerprint === 'string' ? { fingerprint: parsed.fingerprint } : null;
  } catch {
    return null;
  }
}

/** True while sample data is loaded. A missing or unreadable flag reads as "not sample data". */
export function isSampleData(): boolean {
  return readFlag() !== null;
}

/** True when the sample has been changed since it was loaded or restored. */
export function sampleDataEdited(): boolean {
  const flag = readFlag();
  return flag !== null && flag.fingerprint !== dataFingerprint();
}

/** Marks the data currently stored as sample data. Returns `false` if the flag could not be written. */
export function markSampleData(): boolean {
  try {
    localStorage.setItem(SAMPLE_FLAG_KEY, JSON.stringify({ fingerprint: dataFingerprint() }));
    return true;
  } catch (err) {
    console.error('sampleFlag: failed to write the sample flag', err);
    return false;
  }
}

export function clearSampleFlag(): void {
  try {
    localStorage.removeItem(SAMPLE_FLAG_KEY);
  } catch (err) {
    console.error('sampleFlag: failed to clear the sample flag', err);
  }
}
