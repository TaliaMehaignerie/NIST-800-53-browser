---
title: 'Compliance Workbench — workflow accelerators'
type: 'feature'
created: '2026-09-30'
status: 'done'
review_loop_iteration: 0
baseline_commit: '225978d'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Three frictions make people abandon a tracker: marking a whole family not-applicable one control at a time, not knowing what moving to a stricter baseline costs, and not knowing which items are stuck.

**Approach:** Three independently droppable additions: bulk not-applicable by family with a structured inheritance justification, a baseline delta view, and a "what's blocking me" list.

## Boundaries & Constraints

**Always:**
- Each addition is separately verifiable and separately droppable: bulk N/A is its own component on the family page; the delta and blocking sections are separate blocks of one dashboard component that share only their payload.
- Bulk N/A writes N fully independent records (same fan-out discipline as AD-11's batch writes), in ONE atomic pass (`statusStore.setStatuses`: all validated first, then all written or none). Nothing marks them bulk-derived and each stays individually editable. Owner and evidence are preserved; items already not applicable keep their own justification.
- "Inherited from a provider" is a first-class justification type alongside free text, stored as a structured optional `inheritedFrom` on the status record (schema version unchanged; older records read as before) and offered on the per-item status control too, so individual and bulk N/A share one shape. The provider is required for that reason; the justification defaults to "Inherited from {provider}" unless details are given.
- Bulk is previewed and confirmed: the preview and the confirmation state the item count and what they currently are (compliant, in progress, incomplete), and the plan is re-checked against the data at confirm time so it can never be stale.
- Baseline delta is answered from data already embedded (no fetch): "Moving from Moderate to High adds 83 items; 63 of them have no status yet", with the status breakdown and a per-family table, and any items dropped. Baseline-less PM items are program-wide and never "added".
- "What's blocking me" is story 15's gate inverted, scoped to the dashboard's baseline: in progress and ready to mark compliant; in progress but held back by unreviewed parameters (most unreviewed first, with a workspace link); already compliant with unreviewed parameters. The last group resolves the gap deferred from story 16.

**Never:** bulk writes without confirmation, overwriting an existing N/A justification, a partial bulk write, a dataset fetch.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Bulk, inherited | PE family, provider named | N items marked N/A with `inheritedFrom`; existing N/A untouched; owner and evidence kept | N/A |
| No provider / no justification | Missing required field | Refused with a message; nothing written | N/A |
| Data changes before confirm | Another tab edits | Refused; preview refreshed | N/A |
| Write failure | Quota error | No item changed | Message |
| Edit one afterward | Control page | Shows the inherited reason and provider; editing one leaves siblings alone | N/A |
| Delta | Moderate to High | Adds and unstatused counts equal an independent count | N/A |
| Blocking | Seeded in-progress and compliant items | Groups match an independent gate calculation; follows the dashboard filter and live changes | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/statusStore.ts` -- `inheritedFrom`, `inheritedJustification`, `setStatuses` (atomic bulk), shared record builder.
- `src/components/BulkNotApplicable.astro` + `src/pages/families/[slug].astro` -- bulk N/A.
- `src/components/DashboardAccelerators.astro` + `src/pages/dashboard.astro` -- blocking and delta sections.
- `src/utils/dashboardBaseline.ts` -- the dashboard's baseline, shared with the sections scoped to it.
- `src/components/StatusControl.astro` -- reason type and provider on the per-item control.

## Tasks & Acceptance

**Execution:**
- [x] Structured inheritance in the store and the per-item control.
- [x] Bulk N/A with preview, confirmation and atomic write.
- [x] Baseline delta and "what's blocking me".

**Acceptance Criteria:**
- Given a family, then bulk N/A writes N independent records, each individually editable afterward.
- Given a delta, then its counts equal an independent count from the content.
- Given in-progress items, then the blocking groups equal an independent application of the story 15 gate.

## Verification

- Headless Edge against independent counts from the content files: PE (18 in Moderate of 51) bulk with validation, stale-confirm refusal, forced write failure changing nothing, preserved owner/evidence, untouched existing N/A, out-of-scope items untouched; edit one afterward; delta 83 added and 63 unstatused, breakdown, 16-family table, reverse direction, same-baseline prompt; blocking groups and detail match; filter and live changes; structured reason on the control page including the missing-provider error and a backup round trip. Earlier suites re-run green. Rendered and inspected.

## Suggested Review Order

- Atomic bulk write and structured inheritance in the store.
  [`statusStore.ts:1`](../../../../src/utils/statusStore.ts#L1)

- Bulk N/A: preview, confirm, re-check, write.
  [`BulkNotApplicable.astro:1`](../../../../src/components/BulkNotApplicable.astro#L1)

- Blocking and delta sections.
  [`DashboardAccelerators.astro:1`](../../../../src/components/DashboardAccelerators.astro#L1)
