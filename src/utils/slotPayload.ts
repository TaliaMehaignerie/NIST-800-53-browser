/**
 * Reads the per-page control payload the control page embeds at build time
 * (story 10: each control's own parameter labels, choices, guidelines,
 * baselines and family code). One reader for every client surface that needs
 * it — never a dataset fetch, never a second delivery path.
 */
import type { SlotPayload } from './odpSlotPopover';

export function readSlotPayload(): SlotPayload {
  const empty: SlotPayload = { controls: {}, cluster: { lists: [], byParam: {} } };
  try {
    const parsed = JSON.parse(document.getElementById('odp-slot-data')?.textContent ?? '{}') as Partial<SlotPayload>;
    return { controls: parsed.controls ?? empty.controls, cluster: parsed.cluster ?? empty.cluster };
  } catch (err) {
    console.error('slotPayload: could not parse embedded page data', err);
    return empty;
  }
}
