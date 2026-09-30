/**
 * AD-9: sole owner of decision mutation semantics — value-field construction,
 * value read/write, override-rationale validation, and dash-one fan-out. The
 * only module that calls `setDecision`; state itself stays in `odpStore.ts`
 * (AD-10). Callers own their own row/dashboard refresh.
 */
import { setDecision, setDecisions, type Decision } from './odpStore';
import type { Proposal } from './odpProposals';
import type { OdpDatasetEntry } from './odpCluster';

export type ValueFieldSelect = OdpDatasetEntry['select'];

export const EMPTY_VALUE_MESSAGE = 'Enter or select a value before saving a decision.';
export const RATIONALE_REQUIRED_MESSAGE = 'A rationale is required to override a value.';
export const SAVE_FAILED_MESSAGE =
  "Could not save this decision. If you're overriding, check the rationale is filled in; otherwise your browser storage may be full or unavailable.";
export const FAN_OUT_FAILED_MESSAGE =
  "Could not save this decision for every control. If you're overriding, check the rationale is filled in; otherwise your browser storage may be full or unavailable. Rows above now reflect what was actually saved.";

export function decisionKey(target: { controlSlug: string; paramId: string }): string {
  return `${target.controlSlug}:${target.paramId}`;
}

export function buildValueField(
  fieldId: string,
  select: ValueFieldSelect,
  current: string | string[] | undefined,
): HTMLElement {
  const field = document.createElement('div');
  field.className = 'odp-row__field';
  const label = document.createElement('label');
  label.setAttribute('for', fieldId);
  label.textContent = 'Value';
  field.appendChild(label);

  if (select) {
    const isMulti = select.howMany === 'one-or-more';
    const selectEl = document.createElement('select');
    selectEl.className = 'odp-row__value-input';
    selectEl.id = fieldId;
    selectEl.dataset.odpValueInput = 'true';
    if (isMulti) {
      selectEl.multiple = true;
      selectEl.size = Math.min(select.choice.length, 6) || 1;
    } else {
      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = '— choose —';
      selectEl.appendChild(placeholder);
    }
    const currentValues = Array.isArray(current) ? current : current ? [current] : [];
    for (const choice of select.choice) {
      const option = document.createElement('option');
      option.value = choice;
      option.textContent = choice;
      if (currentValues.includes(choice)) option.selected = true;
      selectEl.appendChild(option);
    }
    field.appendChild(selectEl);
  } else {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'odp-row__value-input';
    input.id = fieldId;
    input.dataset.odpValueInput = 'true';
    input.value = typeof current === 'string' ? current : '';
    field.appendChild(input);
  }

  return field;
}

export function readValue(select: ValueFieldSelect, row: HTMLElement): string | string[] {
  const input = row.querySelector('[data-odp-value-input]') as HTMLInputElement | HTMLSelectElement;
  if (select) {
    const selectEl = input as HTMLSelectElement;
    if (select.howMany === 'one-or-more') {
      return Array.from(selectEl.selectedOptions).map((o) => o.value);
    }
    return selectEl.value;
  }
  return (input as HTMLInputElement).value;
}

export function setFieldValue(select: ValueFieldSelect, row: HTMLElement, value: string | string[]): void {
  const input = row.querySelector('[data-odp-value-input]') as HTMLInputElement | HTMLSelectElement;
  if (!input) return;
  if (select) {
    const values = Array.isArray(value) ? value : value ? [value] : [];
    Array.from((input as HTMLSelectElement).options).forEach((option) => {
      option.selected = values.includes(option.value);
    });
  } else {
    (input as HTMLInputElement).value = typeof value === 'string' ? value : '';
  }
}

export function isValueEmpty(value: string | string[]): boolean {
  return Array.isArray(value) ? value.length === 0 : value.trim().length === 0;
}

export function validateValue(value: string | string[]): string | null {
  return isValueEmpty(value) ? EMPTY_VALUE_MESSAGE : null;
}

export function validateOverrideRationale(status: Decision['status'], rationale: string): string | null {
  return status === 'overridden' && rationale.trim().length === 0 ? RATIONALE_REQUIRED_MESSAGE : null;
}

export function saveDecision(baseline: string, key: string, decision: Decision): boolean {
  return setDecision(baseline, key, decision);
}

/**
 * Story 20: adopt proposals from another baseline as this baseline's own
 * decisions. Each is recorded under the SOURCE decision's status and rationale
 * (an override keeps its reasoning), as a deliberate, individually editable
 * decision — never a combined or adopted-tagged entry. One atomic write.
 */
export function adoptProposals(baseline: string, proposals: Map<string, Proposal>): boolean {
  return setDecisions(
    baseline,
    Array.from(proposals, ([key, p]) => ({
      key,
      decision: { value: p.value, status: p.status, rationale: p.rationale },
    })),
  );
}

// AD-11: one independent write per member, never a combined entry.
export function fanOutDecision<M extends { controlSlug: string; paramId: string }>(
  baseline: string,
  members: M[],
  decision: Decision,
): { member: M; ok: boolean }[] {
  return members.map((member) => ({ member, ok: setDecision(baseline, decisionKey(member), decision) }));
}
