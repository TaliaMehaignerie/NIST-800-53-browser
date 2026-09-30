/**
 * The one cross-tab refresh hook (story 12). Fires `callback` when another
 * tab changes the working baseline, an ODP decision blob, or (opt-in) the
 * control-status blob, coalescing the
 * burst a batch fan-out produces (one storage event per `setItem`) into a
 * single refresh. Passive and last-write-wins — no locking (AD-10).
 */
import { ACTIVE_BASELINE_KEY } from './activeBaseline';
import { ODP_STORAGE_PREFIX } from './odpStore';
import { STATUS_STORAGE_KEY } from './statusStore';

/** Fired in the SAME tab after any workbench write that has no event of its own (e.g. a status save), so budget UI is not stale. */
export const WORKBENCH_DATA_EVENT = 'workbenchdatachanged';

interface Options {
  /** Also react to working-baseline changes. Pages whose baseline comes from their own route pass `false`. */
  baseline?: boolean;
  /** React to ODP decision blobs (default). */
  decisions?: boolean;
  /** Also react to the control-status blob. Off by default so ODP surfaces don't refresh on unrelated status edits. */
  status?: boolean;
  /** Restrict decision events to one baseline's blob. */
  onlyDecisionsFor?: string;
}

export function onOdpStorageChange(
  callback: () => void,
  { baseline = true, decisions = true, status = false, onlyDecisionsFor }: Options = {},
): void {
  let timer: number | undefined;
  window.addEventListener('storage', (e) => {
    const key = e.key;
    const relevant =
      key === null ||
      (status && key === STATUS_STORAGE_KEY) ||
      (baseline && key === ACTIVE_BASELINE_KEY) ||
      (decisions &&
        (onlyDecisionsFor !== undefined
          ? key === `${ODP_STORAGE_PREFIX}${onlyDecisionsFor}`
          : key.startsWith(ODP_STORAGE_PREFIX)));
    if (!relevant) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(callback, 50);
  });
}
