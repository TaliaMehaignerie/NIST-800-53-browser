/**
 * Story 23: what FedRAMP assigned a parameter before Notice 0013, shown beside
 * the field as REFERENCE ONLY. Nothing here fills a field, offers to, or
 * touches a decision (FR-8): a value reaches `odpStore` only if the user types
 * it. Every line names its source, baseline and "before Notice 0013", so it
 * cannot be mistaken for a NIST requirement or a current FedRAMP rule.
 *
 * The values are catalog content (ingested like the discussion text, AD-2,
 * AD-8). Control pages carry their own in the embedded payload; the workspace
 * fetches `fedramp-reference.json` once. Privacy has no FedRAMP equivalent, so
 * it never fetches, never renders and never shows the explanatory note.
 */
import { baselineLabel } from './activeBaseline';
import { fedrampReferenceUrl } from './url';

export type FedrampValues = Partial<Record<'low' | 'moderate' | 'high', string>>;

export interface FedrampReferenceData {
  /** e.g. "captured 2025-04-21 to 2025-06-18". */
  sourceText: string;
  /** controlSlug -> paramId -> value per baseline. */
  values: Record<string, Record<string, FedrampValues>>;
}

/** One cluster member, just enough to name it and look it up. */
export interface ReferenceMember {
  controlSlug: string;
  controlId: string;
  paramId: string;
}

export function hasFedrampBaseline(baseline: string): boolean {
  return baseline === 'low' || baseline === 'moderate' || baseline === 'high';
}

export function valueFor(values: FedrampValues | undefined, baseline: string): string | null {
  if (!values || !hasFedrampBaseline(baseline)) return null;
  return values[baseline as 'low' | 'moderate' | 'high'] ?? null;
}

function labelText(baseline: string, plural = false): string {
  return `FedRAMP ${baselineLabel(baseline)} value${plural ? 's' : ''} before Notice 0013`;
}

/** The one explanation per surface: why the values are shown and what they are not. */
export function explanationText(baseline: string, sourceText: string): string {
  return (
    `FedRAMP used to assign values for some of these parameters. In Notice 0013 (June 2026) it announced it is ` +
    `removing most of them, because a minimum tends to become a ceiling. Where a line reads "${labelText(baseline)}", ` +
    `it shows what FedRAMP assigned, from an archived copy of its Rev 5 baselines (${sourceText}). Some values may ` +
    `still be assigned today. It is for comparison only: nothing is filled in, and the parameter stays unreviewed ` +
    `until you decide it.`
  );
}

export function buildExplanation(baseline: string, sourceText: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'odp-fedramp__note';
  p.dataset.odpFedrampNote = 'true';
  p.textContent = explanationText(baseline, sourceText);
  return p;
}

export function buildReferenceLine(baseline: string, value: string): HTMLElement {
  const p = document.createElement('p');
  p.className = 'odp-fedramp';
  p.dataset.odpFedramp = 'true';
  const label = document.createElement('span');
  label.className = 'odp-fedramp__label';
  label.textContent = `${labelText(baseline)}: `;
  const text = document.createElement('span');
  text.className = 'odp-fedramp__value';
  text.textContent = value;
  p.append(label, text);
  return p;
}

/**
 * Reference for a dash-one batch row. One line when every member had the same
 * value; otherwise each distinct value with the controls it applied to, plus
 * the members with none. Never one value picked from among differing ones.
 */
export function buildClusterReference(
  baseline: string,
  members: ReferenceMember[],
  values: Record<string, Record<string, FedrampValues>>,
): HTMLElement | null {
  if (!hasFedrampBaseline(baseline)) return null;
  const groups = new Map<string, string[]>();
  const without: string[] = [];
  for (const m of members) {
    const value = valueFor(values[m.controlSlug]?.[m.paramId], baseline);
    if (value === null) without.push(m.controlId.toUpperCase());
    else groups.set(value, [...(groups.get(value) ?? []), m.controlId.toUpperCase()]);
  }
  if (groups.size === 0) return null;
  if (groups.size === 1 && without.length === 0) return buildReferenceLine(baseline, [...groups.keys()][0]);

  const wrap = document.createElement('div');
  wrap.className = 'odp-fedramp';
  wrap.dataset.odpFedramp = 'true';
  const heading = document.createElement('p');
  heading.className = 'odp-fedramp__label';
  heading.textContent = `${labelText(baseline, true)} differed by control:`;
  const list = document.createElement('ul');
  list.className = 'odp-fedramp__list';
  const add = (value: string, controls: string[]): void => {
    const li = document.createElement('li');
    li.textContent = `${value} — ${controls.join(', ')}`;
    list.appendChild(li);
  };
  for (const [value, controls] of groups) add(value, controls);
  if (without.length > 0) add('none assigned', without);
  wrap.append(heading, list);
  return wrap;
}

let referencePromise: Promise<FedrampReferenceData> | null = null;

/** The workspace fetches every value once, only for baselines FedRAMP covered. */
export function loadFedrampReference(): Promise<FedrampReferenceData> {
  referencePromise ??= fetch(fedrampReferenceUrl()).then((response) => {
    if (!response.ok) throw new Error(`fedramp-reference.json fetch failed: ${response.status}`);
    return response.json() as Promise<FedrampReferenceData>;
  });
  const pending = referencePromise;
  pending.catch(() => {
    if (referencePromise === pending) referencePromise = null; // allow a retry after a failure
  });
  return pending;
}

/**
 * An empty, hidden slot that fills itself once the values arrive. Hidden while
 * empty so a row without a reference never shows a blank block; a failed load
 * is reported once by the surface's note, not per row.
 */
export function buildReferenceSlot(
  baseline: string,
  build: (data: FedrampReferenceData) => HTMLElement | null,
): HTMLElement {
  const slot = document.createElement('div');
  slot.className = 'odp-fedramp-slot';
  slot.hidden = true;
  if (!hasFedrampBaseline(baseline)) return slot;
  loadFedrampReference()
    .then((data) => {
      const node = build(data);
      if (node) {
        slot.appendChild(node);
        slot.hidden = false;
      }
    })
    .catch(() => {
      /* surfaced once by fillExplanation */
    });
  return slot;
}

/**
 * Fill a surface's single explanation note: the explanation when values are
 * available, a retry message when the load failed, nothing for Privacy.
 */
export function fillExplanation(note: HTMLElement, baseline: string): void {
  note.hidden = true;
  if (!hasFedrampBaseline(baseline)) return;
  loadFedrampReference()
    .then((data) => {
      note.textContent = explanationText(baseline, data.sourceText);
      note.hidden = false;
    })
    .catch((err) => {
      console.error('fedrampReference: could not load reference values', err);
      note.textContent = 'Could not load the FedRAMP reference values. Reload the page to try again.';
      note.hidden = false;
    });
}
