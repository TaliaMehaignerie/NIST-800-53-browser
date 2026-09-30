---
title: 'Compliance Workbench — cross-baseline decision proposals'
type: 'feature'
created: '2026-09-30'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'ad33058'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Low is a strict subset of Moderate is a strict subset of High. A user who completes Moderate's 643 parameters and moves to High meets 767, of which 643 are the identical `controlSlug:paramId` in a different blob, all unreviewed. Without help they redo 643 identical decisions.

**Approach:** When a parameter is unreviewed in the working baseline but decided in another, propose that value with its provenance and require an explicit confirm, plus a bulk adopt that still records each as a deliberate review. This story is the product's own argument, implemented: a proposal costs an act of review.

## Boundaries & Constraints

**Always:**
- NEVER auto-copy on a baseline switch. It would fabricate review status, the one thing `odpStore` is built never to do, and it is substantively wrong: High legitimately demands stricter values for real parameters (scan frequency, log retention), so a blanket copy yields a High profile asserting Moderate's posture, the unexamined ceiling the SPEC is written against.
- A proposal leaves the decision `unreviewed-default` and still counts as unreviewed in the readiness gate until confirmed. It only prefills a row or popover, marked "Proposed from Moderate (confirmed): value. Nothing is saved until you confirm or override it."
- Storage stays per baseline: a proposal is a READ across blobs (`odpProposals.ts`), nothing is stored for it, there is no migration, AD-10 is untouched.
- When several baselines hold a decision for the same parameter, propose from the NEAREST one and name it; never merge sources. Distance is by strictness, ties go to the stricter (Moderate is offered High's answer before Low's). Privacy is not a four-way comparison: as a target it is offered High, then Moderate, then Low; as a source it is last resort.
- Editing a proposed value before confirming stores the edited value, not the proposal. An overridden source carries its rationale.
- Bulk adopt is previewed with counts and provenance, confirmed, and re-checked against the data as it is at confirm time (refused if the proposals changed). It writes N independent decisions in one atomic pass (`setDecisions`), each under the source decision's own status and rationale, never adopted-tagged, each individually editable afterward. An existing decision in the working baseline is never overwritten; the other baselines are never changed.
- All mutation goes through `odpEdit.ts` (`adoptProposals`), the sole caller of the store's mutators (AD-9).
- Proposals surface in the workspace (rows and a dashboard block) and in the control-page popover, and slots name an available proposal in their tooltip.

**Never:** copy on baseline switch, store provenance in a decision, merge sources, count a proposal as reviewed.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Moderate then High | Moderate fully decided (643) | 643 proposals, 124 with no decision anywhere; readiness still 767 unreviewed; High blob empty | N/A |
| Confirm one | Edit then confirm | Independent High decision with the edited value; Moderate untouched | N/A |
| Bulk adopt | Confirm | 642 independent High decisions (one already decided separately), each with its source status and rationale; nothing reads unreviewed | N/A |
| Stale adopt | Source changes before confirm | Refused; nothing written | N/A |
| Write failure | Quota error | No decision written | Message |
| Several sources | Low and Moderate decided, working High | Proposal from Moderate, named | N/A |
| Tie | Low and High decided, working Moderate | Proposal from High | N/A |
| Already decided | High decision exists | Excluded from proposals, preserved by adopt | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/odpProposals.ts` -- new: `proposalsFor`, `sourceOrder`, provenance text.
- `src/utils/odpStore.ts` -- `setDecisions`: atomic bulk write.
- `src/utils/odpEdit.ts` -- `adoptProposals`.
- `src/components/workspace/OdpWorkspace.astro` -- row prefill and note, proposals block, confirmed bulk adopt, storage refresh across baselines.
- `src/utils/odpSlotPopover.ts`, `src/components/OdpSlotOverlay.astro` -- popover prefill and note, slot tooltip.

## Tasks & Acceptance

**Execution:**
- [x] Proposal computation across blobs with nearest-source ordering.
- [x] Workspace rows, dashboard block and confirmed atomic bulk adopt.
- [x] Popover and slot tooltip.

**Acceptance Criteria:**
- Given Moderate fully reviewed, when High opens, then 643 proposals and 124 new parameters are shown and nothing is written.
- Given a proposal, when it is edited and confirmed, then an independent High decision stores the edited value and Moderate is untouched.
- Given bulk adopt, then each decision is independent and individually overridable afterward.

## Verification

- Headless Edge on the real 767/643 dataset: proposals text, unreviewed count unchanged, nothing stored, edited value wins, override rationale carried, stale and quota-failure adoption write nothing, 642 adopted with status and rationale equal to source (65 overridden), then one overridden individually; nearest-source in all four targets; popover note and confirm writing only the working baseline; switch copies nothing; existing decision preserved. Earlier suites re-run green; grep confirms only `odpEdit.ts` calls the mutators. Rendered and inspected.
- Deferred: batch rows do not show proposals; a row already rendered does not refresh its prefill when another tab changes a source.

## Suggested Review Order

- The proposal rule: nearest source, never stored.
  [`odpProposals.ts:1`](../../../../src/utils/odpProposals.ts#L1)

- Atomic bulk write and its odpEdit entry point.
  [`odpEdit.ts:111`](../../../../src/utils/odpEdit.ts#L111)

- Workspace rows, dashboard block and confirmed adopt.
  [`OdpWorkspace.astro:1`](../../../../src/components/workspace/OdpWorkspace.astro#L1)
