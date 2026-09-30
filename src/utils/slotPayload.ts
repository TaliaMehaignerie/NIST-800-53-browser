/**
 * Reads the per-page control payload the control page embeds at build time
 * (story 10: each control's own parameter labels, choices, guidelines,
 * baselines and family code). One reader for every client surface that needs
 * it — never a dataset fetch, never a second delivery path.
 */
import type { SlotPayload } from './odpSlotPopover';

/**
 * Returns `null` when the payload is absent or unparseable, so a caller that
 * must not fail open (the ODP interlock) can tell "no parameters on this
 * page" apart from "could not read the page's parameters".
 */
export function readSlotPayload(): SlotPayload | null {
  const el = document.getElementById('odp-slot-data');
  if (!el) return null;
  try {
    const parsed = JSON.parse(el.textContent ?? '') as Partial<SlotPayload>;
    return {
      controls: parsed.controls ?? {},
      cluster: parsed.cluster ?? { lists: [], byParam: {} },
    };
  } catch (err) {
    console.error('slotPayload: could not parse embedded page data', err);
    return null;
  }
}
