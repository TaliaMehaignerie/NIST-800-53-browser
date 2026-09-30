---
title: 'Compliance Workbench — batch scope in the control-page popover'
type: 'feature'
created: '2026-09-30'
status: 'done'
review_loop_iteration: 0
baseline_commit: '4312d9724e493fa54b537703a547958e86c2adbb'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A dash-one parameter opened from AC-1 can only be set for AC-1, though the same answer usually applies to every dash-one control; batching lives only in the workspace.

**Approach:** When the slot's parameter belongs to a dash-one cluster in the working baseline, the popover offers a second scope that applies the value to all members, with a live match count shown before anything is written.

## Boundaries & Constraints

**Always:**
- Membership comes from `groupDashOneClusters` (AD-11), precomputed per baseline at build time into a display index embedded alongside the per-control payload; `odp-dataset.json` is not shipped. Match count is a fresh read-time computation from `odpStore` using `valuesMatch`.
- The index is not a stored cluster reference (AD-11 unchanged): fan-out writes N fully independent, individually overridable decisions via `odpEdit.fanOutDecision`; nothing marks them batch-derived.
- Nothing is written until Confirm/Override is pressed; the count is visible first, including how many different decided values would be replaced.
- Same validation and messages as single scope; on partial storage failure, slots resync and the popover stays open with the fan-out failure message.
- Scope is offered only when the cluster has at least 2 members in the working baseline. Membership is per baseline, never a fixed "18".

**Never:** reimplementing matching, storing cluster data in decisions, changing `odpCluster.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Apply to all | Scope "All", value entered | N independent decisions written, slot and chip update | N/A |
| Count before apply | Some members decided | "X of N already have this value … replacing Y different" | N/A |
| No value yet | Scope "All" | Prompt to enter a value | N/A |
| Privacy baseline | Working baseline Privacy | "All 12 …" | N/A |
| Non-dash-one control | e.g. AC-2 | No scope control | N/A |
| Override, no rationale | Scope "All" | Workspace message, nothing written | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/odpClusterIndex.ts` -- build-time per-baseline membership, deduped lists.
- `src/pages/controls/[slug].astro` -- embeds the index with the popover payload.
- `src/utils/odpSlotPopover.ts` -- scope radios, live count, fan-out via `odpEdit`.
- `src/components/OdpSlotOverlay.astro` -- parses the payload, passes the index, styles.
- Spine AD-11 -- build-time index clarification.

## Tasks & Acceptance

**Execution:**
- [x] Membership index and page embed.
- [x] Popover scope, count and fan-out.
- [x] Spine note.

**Acceptance Criteria:**
- Given AC-1's popover with scope "All", when a value is entered, then the count appears before any write.
- Given Apply, then one independent decision per member is stored and the chip reflects it.
- Given a non-dash-one control, then no scope control appears.

## Verification

- `npm run build` succeeds; payload median ~0.6 KB, dash-one pages ~8.5 KB.
- Headless Edge on AC-1: count before apply (2 of 18, replacing 1), nothing written beforehand, 18 independent confirmed decisions after, single scope leaves others untouched, Privacy shows 12, AC-2 shows no scope, no page errors.

## Suggested Review Order

- Build-time index, per baseline, reusing `groupDashOneClusters`.
  [`odpClusterIndex.ts:1`](../../../../src/utils/odpClusterIndex.ts#L1)

- Scope UI, live count, fan-out through `odpEdit`.
  [`odpSlotPopover.ts:118`](../../../../src/utils/odpSlotPopover.ts#L118)

- Spine clarification that the index is not a stored reference.
  [`ARCHITECTURE-SPINE.md:109`](../../../planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md#L109)
