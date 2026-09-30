---
title: 'Compliance Workbench — addressable ODP slots showing decided values'
type: 'feature'
created: '2026-09-30'
status: 'done'
review_loop_iteration: 0
baseline_commit: '7df2baef10e763a9ca04cf37f3cf99f16afc39ed'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A control page shows what NIST asked (`[Assignment: …]`) but not what the organization answered in the workspace.

**Approach:** Make each resolved parameter an addressable span (`paramId`, `controlSlug`) and add a read-only client overlay that swaps in the decided value, with a status treatment, for the working baseline (AD-13). Editing is story 10.

## Boundaries & Constraints

**Always:**
- One resolver, run at build time (AD-5): `resolveParamSegments` is the resolver; `resolveParams` (used by the dataset) joins its text. No client-side resolution.
- Slots are rendered as Astro elements, not `set:html`; decided values are written with `textContent` only.
- A placeholder with no matching param renders verbatim with no slot. With JS disabled the page shows NIST's text.
- Out-of-baseline items (control not in the working baseline): slots stay plain, non-interactive; one note per statement ("Not part of the X baseline — parameters shown as NIST wrote them"), never per slot. No decisions can be made there.
- Status shown by underline style plus a text tag, never color alone: unreviewed dotted, confirmed solid, overridden double.

**Never:** a second resolver, editing, reading `odp-dataset.json`, changing odpStore or decision keys.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Decided in baseline | Confirmed/overridden decision | Slot shows the value plus status tag | N/A |
| No decision | In baseline | NIST text, dotted underline | N/A |
| Out of baseline | Control not in working baseline | NIST text, no treatment, one note | N/A |
| Baseline switched | Header selector | Slots and note re-render | N/A |
| Hostile value | `<img onerror>` | Shown as literal text | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/resolveParams.ts` -- `resolveParamSegments` (new), `resolveParams` now derives from it.
- `src/components/StatementTree.astro` -- emits `.odp-slot` spans when `controlSlug` is passed.
- `src/pages/controls/[slug].astro`, `src/components/EnhancementItem.astro` -- pass `controlSlug`, add `data-odp-baselines` scope and note element.
- `src/components/OdpSlotOverlay.astro` -- overlay script and status styles.

## Tasks & Acceptance

**Execution:**
- [x] Resolver segments and StatementTree slot output.
- [x] Scope attribute and note on control and enhancement statements.
- [x] Overlay component mounted on the control page.

**Acceptance Criteria:**
- Given a built control page, then its visible text is identical to before the change.
- Given a stored decision in the working baseline, then its slot shows the value and status.
- Given a baseline that excludes the control, then slots show NIST's text and one note appears.

## Verification

- `npm run build` succeeds; AC-2 and PE-1 text identical to pre-change output; 1,201 slots across control pages.
- Headless Edge check: confirmed/overridden render, HTML payload stays text, privacy baseline shows note, no page errors.

## Suggested Review Order

- The single resolver and its segment output.
  [`resolveParams.ts:41`](../../../../src/utils/resolveParams.ts#L41)

- Slot emission in the statement tree.
  [`StatementTree.astro:45`](../../../../src/components/StatementTree.astro#L45)

- Overlay: baseline scoping, textContent substitution, status tags.
  [`OdpSlotOverlay.astro:47`](../../../../src/components/OdpSlotOverlay.astro#L47)
