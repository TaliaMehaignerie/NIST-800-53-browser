/**
 * Story 10: anchored popover that edits one parameter from a control page.
 * All mutation goes through `odpEdit.ts` (AD-9) — this module never calls
 * `setDecision` and never reimplements validation, so its refusal messages
 * are the workspace's own. User-entered text is written with textContent.
 */
import { getDecision, type Decision, type DecisionStatus } from './odpStore';
import {
  buildValueField,
  decisionKey,
  fanOutDecision,
  readValue,
  saveDecision,
  validateOverrideRationale,
  validateValue,
  FAN_OUT_FAILED_MESSAGE,
  SAVE_FAILED_MESSAGE,
  type ValueFieldSelect,
} from './odpEdit';
import { valuesMatch } from './odpCluster';
import { ACTIVE_BASELINE_EVENT } from './activeBaseline';
import { workspaceUrl } from './url';

export interface SlotParam {
  label: string | null;
  select: ValueFieldSelect;
  guidelines: string[];
}

export interface SlotControl {
  familyCode: string;
  controlId: string;
  title: string;
  params: Record<string, SlotParam>;
}

/** Build-time membership index (story 11): deduped member lists plus param -> baseline -> list index. */
export interface ClusterPayload {
  lists: [string, string][][];
  byParam: Record<string, Record<string, number>>;
}

export interface SlotPayload {
  controls: Record<string, SlotControl>;
  cluster: ClusterPayload;
}

export interface OpenPopoverArgs {
  slot: HTMLElement;
  control: SlotControl;
  controlSlug: string;
  paramId: string;
  baseline: string;
  cluster: ClusterPayload;
  onSaved: () => void;
}

let current: { el: HTMLElement; slot: HTMLElement; cleanup: () => void } | null = null;

export function isSlotPopoverOpenFor(slot: HTMLElement): boolean {
  return current?.slot === slot;
}

// Focus goes back to the slot except on outside-click dismissal, where the
// user has deliberately moved elsewhere and a focus() would scroll them back.
export function closeSlotPopover(restoreFocus = true): void {
  if (!current) return;
  const { el, slot, cleanup } = current;
  current = null;
  cleanup();
  el.remove();
  slot.setAttribute('aria-expanded', 'false');
  if (restoreFocus) slot.focus({ preventScroll: true });
}

export function openSlotPopover(args: OpenPopoverArgs): void {
  const { slot, control, controlSlug, paramId, baseline, cluster, onSaved } = args;
  const param = control.params[paramId];
  if (!param) return;
  if (current) closeSlotPopover();

  const key = decisionKey({ controlSlug, paramId });
  const existing = getDecision(baseline, key);
  const baselineName = `${baseline[0].toUpperCase()}${baseline.slice(1)}`;
  const uid = `odp-pop-${controlSlug}-${paramId}`.replace(/[^a-zA-Z0-9_-]/g, '-');

  const el = document.createElement('div');
  el.className = 'odp-popover';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', `${uid}-title`);

  const title = document.createElement('h3');
  title.id = `${uid}-title`;
  title.className = 'odp-popover__title';
  title.textContent = `${control.controlId.toUpperCase()} — ${control.title}`;
  el.appendChild(title);

  const meta = document.createElement('p');
  meta.className = 'odp-popover__meta';
  meta.textContent = `${param.label ?? paramId} · ${baselineName} baseline`;
  el.appendChild(meta);

  if (param.guidelines.length > 0) {
    const list = document.createElement('ul');
    list.className = 'odp-popover__guidelines';
    for (const g of param.guidelines) {
      const li = document.createElement('li');
      li.textContent = g;
      list.appendChild(li);
    }
    el.appendChild(list);
  }

  const form = document.createElement('div');
  form.className = 'odp-popover__form';
  form.appendChild(buildValueField(`${uid}-value`, param.select, existing?.value));

  const rationaleField = document.createElement('div');
  rationaleField.className = 'odp-row__field';
  const rationaleLabel = document.createElement('label');
  rationaleLabel.setAttribute('for', `${uid}-rationale`);
  rationaleLabel.textContent = 'Rationale (required to override)';
  const rationaleInput = document.createElement('textarea');
  rationaleInput.id = `${uid}-rationale`;
  rationaleInput.rows = 2;
  rationaleInput.value = existing?.rationale ?? '';
  rationaleField.append(rationaleLabel, rationaleInput);
  form.appendChild(rationaleField);

  // Batch scope: offered only when this param belongs to a dash-one cluster
  // in the working baseline. The match count is recomputed from odpStore on
  // every change (AD-11) — nothing about the cluster is ever stored.
  const listIdx = cluster.byParam[paramId]?.[baseline];
  const listed = (listIdx !== undefined ? cluster.lists[listIdx] : []).map(([slug, pid]) => ({
    controlSlug: slug,
    paramId: pid,
  }));
  // The index is keyed by paramId for this page's own control; only trust it
  // when this slot's own decision key is actually one of the members.
  const members = listed.some((m) => m.controlSlug === controlSlug && m.paramId === paramId) ? listed : [];
  let scopeAll: HTMLInputElement | null = null;
  let countLine: HTMLElement | null = null;

  if (members.length >= 2) {
    const scope = document.createElement('fieldset');
    scope.className = 'odp-popover__scope';
    const legend = document.createElement('legend');
    legend.textContent = 'Apply to';
    scope.appendChild(legend);

    const mkRadio = (value: string, text: string, checked: boolean): HTMLInputElement => {
      const label = document.createElement('label');
      label.className = 'odp-popover__scope-option';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = `${uid}-scope`;
      input.value = value;
      input.checked = checked;
      label.append(input, document.createTextNode(` ${text}`));
      scope.appendChild(label);
      return input;
    };
    const scopeOne = mkRadio('one', 'Just this control', true);
    scopeAll = mkRadio('all', `All ${members.length} dash-one controls in ${baselineName}`, false);

    countLine = document.createElement('p');
    countLine.className = 'odp-popover__count';
    countLine.setAttribute('role', 'status');
    countLine.hidden = true;
    scope.appendChild(countLine);
    form.appendChild(scope);

    const updateCount = (): void => {
      if (!scopeAll || !countLine) return;
      countLine.hidden = !scopeAll.checked;
      if (!scopeAll.checked) return;
      const value = readValue(param.select, form);
      if (validateValue(value)) {
        countLine.textContent = `Enter a value to see how many of the ${members.length} controls match it.`;
        return;
      }
      let matching = 0;
      let overwritten = 0;
      for (const m of members) {
        const d = getDecision(baseline, decisionKey(m));
        if (!d) continue;
        if (valuesMatch(d.value, value)) matching += 1;
        else overwritten += 1;
      }
      countLine.textContent =
        `${matching} of ${members.length} controls already have this value. ` +
        `Applying writes it to all ${members.length}` +
        (overwritten > 0 ? `, replacing ${overwritten} different decided value${overwritten === 1 ? '' : 's'}.` : '.');
    };
    scopeOne.addEventListener('change', updateCount);
    scopeAll.addEventListener('change', updateCount);
    form.addEventListener('input', updateCount);
    form.addEventListener('change', updateCount);
  }
  el.appendChild(form);

  const error = document.createElement('p');
  error.className = 'odp-popover__error';
  error.setAttribute('role', 'alert');
  error.hidden = true;
  el.appendChild(error);

  const actions = document.createElement('div');
  actions.className = 'odp-popover__actions';
  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.textContent = 'Confirm';
  const overrideBtn = document.createElement('button');
  overrideBtn.type = 'button';
  overrideBtn.textContent = 'Override';
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = 'Close';
  actions.append(confirmBtn, overrideBtn, closeBtn);
  el.appendChild(actions);

  const link = document.createElement('a');
  link.className = 'odp-popover__link';
  const href = new URL(workspaceUrl(baseline), window.location.origin);
  href.searchParams.set('view', 'individual');
  href.searchParams.set('family', control.familyCode);
  link.href = href.toString();
  link.textContent = `Open in ${control.familyCode} workspace`;
  el.appendChild(link);

  function save(status: DecisionStatus): void {
    error.hidden = true;
    error.textContent = '';
    const value = readValue(param.select, form);
    const rationale = rationaleInput.value;
    const invalid = validateValue(value) ?? validateOverrideRationale(status, rationale);
    if (invalid) {
      error.textContent = invalid;
      error.hidden = false;
      return;
    }
    const decision: Decision = { value, status, rationale };

    // One independent write per member (AD-11), through odpEdit's fan-out.
    if (scopeAll?.checked) {
      const results = fanOutDecision(baseline, members, decision);
      onSaved();
      if (!results.every((r) => r.ok)) {
        error.textContent = FAN_OUT_FAILED_MESSAGE;
        error.hidden = false;
        scopeAll.dispatchEvent(new Event('change'));
        return;
      }
      closeSlotPopover();
      return;
    }

    if (!saveDecision(baseline, key, decision)) {
      error.textContent = SAVE_FAILED_MESSAGE;
      error.hidden = false;
      return;
    }
    onSaved();
    closeSlotPopover();
  }

  confirmBtn.addEventListener('click', () => save('confirmed'));
  overrideBtn.addEventListener('click', () => save('overridden'));
  closeBtn.addEventListener('click', () => closeSlotPopover());

  function focusables(): HTMLElement[] {
    return Array.from(el.querySelectorAll<HTMLElement>('input, select, textarea, button, a[href]')).filter(
      (n) => !n.hasAttribute('disabled'),
    );
  }

  function onKeydown(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeSlotPopover();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = focusables();
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || !el.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !el.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  function onPointerDown(e: MouseEvent): void {
    const target = e.target as Node;
    if (!el.contains(target) && !slot.contains(target)) closeSlotPopover(false);
  }

  // The popover saves to the baseline it opened for; if the working baseline
  // changes underneath it, close rather than write to a stale one.
  function onBaselineChange(): void {
    closeSlotPopover();
  }

  document.addEventListener('keydown', onKeydown);
  document.addEventListener('mousedown', onPointerDown);
  window.addEventListener(ACTIVE_BASELINE_EVENT, onBaselineChange);

  document.body.appendChild(el);
  const rect = slot.getBoundingClientRect();
  const width = Math.min(360, window.innerWidth - 16);
  el.style.width = `${width}px`;
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
  el.style.left = `${left + window.scrollX}px`;
  el.style.top = `${rect.bottom + window.scrollY + 6}px`;

  slot.setAttribute('aria-expanded', 'true');
  current = {
    el,
    slot,
    cleanup: () => {
      document.removeEventListener('keydown', onKeydown);
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener(ACTIVE_BASELINE_EVENT, onBaselineChange);
    },
  };
  (focusables()[0] ?? el).focus();
}
