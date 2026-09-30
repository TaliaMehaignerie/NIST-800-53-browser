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
  readValue,
  saveDecision,
  validateOverrideRationale,
  validateValue,
  SAVE_FAILED_MESSAGE,
  type ValueFieldSelect,
} from './odpEdit';
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

export interface OpenPopoverArgs {
  slot: HTMLElement;
  control: SlotControl;
  controlSlug: string;
  paramId: string;
  baseline: string;
  onSaved: () => void;
}

let current: { el: HTMLElement; slot: HTMLElement; cleanup: () => void } | null = null;

export function closeSlotPopover(): void {
  if (!current) return;
  const { el, slot, cleanup } = current;
  current = null;
  cleanup();
  el.remove();
  slot.setAttribute('aria-expanded', 'false');
  slot.focus();
}

export function openSlotPopover(args: OpenPopoverArgs): void {
  const { slot, control, controlSlug, paramId, baseline, onSaved } = args;
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
    if (!el.contains(target) && !slot.contains(target)) closeSlotPopover();
  }

  document.addEventListener('keydown', onKeydown);
  document.addEventListener('mousedown', onPointerDown);

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
    },
  };
  (focusables()[0] ?? el).focus();
}
