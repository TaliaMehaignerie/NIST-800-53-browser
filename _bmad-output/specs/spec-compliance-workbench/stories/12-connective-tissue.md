---
title: 'Compliance Workbench — connective tissue between the browser and the workspace'
type: 'feature'
created: '2026-09-30'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'd5b175083c2c2dd22fc9a16c77a2e6168f32e054'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The control browser and the workspace do not reference each other's state: a control page does not say how many of its parameters are reviewed, a family page cannot show where to work next, workspace rows are dead ends, and a decision made in one tab is invisible in another.

**Approach:** Four independently droppable additions, all built on one shared counter: a per-control ODP summary, a family-page readiness column, workspace rows linking back to their controls, and passive cross-tab refresh via `storage` events.

## Boundaries & Constraints

**Always:**
- One counter: `odpCounts.ts` (`tallyStatuses`) is used by the workspace dashboard, the control summary and the family column. No third counter.
- Per-control and per-row readiness roll up the control and its enhancements, counting only items in the working baseline (AD-13); a missing decision counts as unreviewed (AD-10).
- Workspace rows link to `/controls/<slug>/`; an enhancement links to its parent control at its own fragment (AD-4: no enhancement routes).
- Cross-tab refresh is passive and last-write-wins: the workspace updates only rows whose stored decision differs from what they last displayed, so unsaved typing elsewhere survives.
- Each part is separately verifiable and separately droppable.

**Never:** locking, `BroadcastChannel`, conflict resolution, a dataset fetch on control or family pages.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Control summary | Control with decisions | "18 parameters in Moderate — 1 confirmed, …" plus jump to first unreviewed | N/A |
| Jump target in collapsed enhancement | First unreviewed slot inside one | Enhancement expands, slot focused | N/A |
| Out-of-baseline control | Not in working baseline | No summary, no family cell | N/A |
| Family row | Control with enhancements | "3/9 reviewed" rolling up enhancements | N/A |
| Enhancement row link | Workspace row for ac-17-4 | Links to `/controls/ac-17/#ac-17-4` | N/A |
| Decision in another tab | Storage event | Workspace row, chip, slots and counts update; unsaved typing kept | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/odpCounts.ts`, `src/utils/odpReadiness.ts` -- shared tally and in-baseline roll-up.
- `src/components/workspace/OdpWorkspace.astro` -- uses the shared tally; row control link; `refreshFromStorage` with per-row snapshots.
- `src/components/OdpSlotOverlay.astro`, `src/pages/controls/[slug].astro` -- summary and jump; storage listener.
- `src/components/FamilyReadiness.astro`, `src/components/ControlRow.astro`, `src/pages/families/[slug].astro` -- family column.
- `src/components/WorkingBaseline.astro` -- storage listener for the chip and selector.

## Tasks & Acceptance

**Execution:**
- [x] Shared counter and workspace switched to it.
- [x] Control summary with jump.
- [x] Family readiness column.
- [x] Workspace row links.
- [x] Cross-tab sync in workspace, overlay, chip and family column.

**Acceptance Criteria:**
- Given a decision made in tab A, then tab B's workspace row, chip, slot rendering and counts reflect it without reload.
- Given each part, then it works independently of the others.

## Verification

- `npm run build` succeeds.
- Headless Edge, two tabs in one context: summary and jump (focus on first unreviewed slot), family cells (`1/18` for AC-2 with enhancements), row links (control and enhancement fragment), remote confirm updates workspace row and chip (2 to 3 of 643) while unsaved typing in another row is kept, workspace save updates the control tab's slot and summary, working-baseline change follows across tabs, no page errors.

## Suggested Review Order

- The single counter.
  [`odpCounts.ts:1`](../../../../src/utils/odpCounts.ts#L1)

- Workspace cross-tab refresh with per-row snapshots.
  [`OdpWorkspace.astro:996`](../../../../src/components/workspace/OdpWorkspace.astro#L996)

- Control summary and jump.
  [`OdpSlotOverlay.astro:271`](../../../../src/components/OdpSlotOverlay.astro#L271)

- Family readiness column.
  [`FamilyReadiness.astro:1`](../../../../src/components/FamilyReadiness.astro#L1)
