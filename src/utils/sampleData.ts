/**
 * Story 22: load and clear the bundled sample data.
 *
 * The sample is an ordinary backup envelope, so loading it is the existing
 * restore path: `parseEnvelope` validates the whole thing and `applyEnvelope`
 * writes it all-or-nothing (story 18). There is no second write path. It is
 * loaded only into an empty workbench, checked again after the fetch resolves,
 * so it can never mix with a visitor's own work.
 */
import { applyEnvelope, parseEnvelope } from './backup';
import { hasChosenBaseline } from './activeBaseline';
import { sampleDataUrl } from './url';
import { hasWorkbenchData } from './workbenchData';

export type SampleResult = { ok: true } | { ok: false; message: string };

export const ALREADY_HAVE_DATA_MESSAGE = 'You already have data in this browser, so sample data was not loaded.';

/** Whether sample data may be loaded: nothing stored and no baseline chosen. */
export function canLoadSampleData(): boolean {
  return !hasWorkbenchData() && !hasChosenBaseline();
}

export async function loadSampleData(): Promise<SampleResult> {
  if (!canLoadSampleData()) return { ok: false, message: ALREADY_HAVE_DATA_MESSAGE };

  let text: string;
  try {
    const response = await fetch(sampleDataUrl());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    text = await response.text();
  } catch (err) {
    console.error('sampleData: could not fetch the sample', err);
    return { ok: false, message: 'Could not load the sample data. Check your connection and try again.' };
  }

  const parsed = parseEnvelope(text);
  if (!parsed.ok) return { ok: false, message: parsed.message };

  // Data may have appeared in another tab while the file was loading.
  if (!canLoadSampleData()) return { ok: false, message: ALREADY_HAVE_DATA_MESSAGE };

  const applied = applyEnvelope(parsed.envelope);
  return applied.ok ? { ok: true } : { ok: false, message: applied.message };
}
