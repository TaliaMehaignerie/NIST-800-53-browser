/**
 * The one cross-tab refresh hook (story 12). Fires `callback` when another
 * tab changes the working baseline or any ODP decision blob, coalescing the
 * burst a batch fan-out produces (one storage event per `setItem`) into a
 * single refresh. Passive and last-write-wins — no locking (AD-10).
 */
import { ACTIVE_BASELINE_KEY } from './activeBaseline';
import { ODP_STORAGE_PREFIX } from './odpStore';

interface Options {
  /** Also react to working-baseline changes. Pages whose baseline comes from their own route pass `false`. */
  baseline?: boolean;
  /** Restrict decision events to one baseline's blob. */
  onlyDecisionsFor?: string;
}

export function onOdpStorageChange(callback: () => void, { baseline = true, onlyDecisionsFor }: Options = {}): void {
  let timer: number | undefined;
  window.addEventListener('storage', (e) => {
    const key = e.key;
    const relevant =
      key === null ||
      (baseline && key === ACTIVE_BASELINE_KEY) ||
      (onlyDecisionsFor !== undefined
        ? key === `${ODP_STORAGE_PREFIX}${onlyDecisionsFor}`
        : key.startsWith(ODP_STORAGE_PREFIX));
    if (!relevant) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(callback, 50);
  });
}
