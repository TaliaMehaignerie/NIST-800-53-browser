---
title: 'Compliance Workbench — the ODP interlock'
type: 'feature'
created: '2026-09-30'
status: 'done'
review_loop_iteration: 0
baseline_commit: '6156073'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The workspace and the status tracker are two separate checklists: a control can be marked compliant while its organization-defined parameters are still NIST's unexamined defaults — a control whose implementation nobody specified, the "unexamined ceiling" one layer up.

**Approach:** A control or enhancement cannot be marked compliant while any of its own parameters is unreviewed-default in the working baseline. It is a hard block that names the count and the baseline and links to the outstanding parameters.

## Boundaries & Constraints

**Always:**
- Hard block, not a warning: there is no way to save compliant while blocked. The Save button is disabled and `save()` re-checks, so a forced click is refused with the same message and nothing is written.
- The item's parameter list comes from the page's embedded per-control payload (story 10), read through `slotPayload.ts`; statuses come from `odpStore`. No dataset fetch, no second delivery path.
- The verdict is per working baseline (AD-10/AD-13) while status is per system (AD-14), so it can legitimately differ between Moderate and High for the same item. The message always names the baseline.
- Counting is the shared `odpCounts` tally via `odpReadiness` — no new counter.
- An item with no parameters is never blocked (72 controls in the build carry none).
- An item not in the working baseline is not gated: its parameters are invisible to the workspace (AD-13), so blocking on them would be a block that can never be cleared.
- Only a move INTO compliant is blocked. An item already compliant gets a note ("Marked compliant, but N of M parameters still unreviewed in the High baseline") instead, so a baseline switch can never trap edits to owner or evidence.
- The verdict re-evaluates live on a decision made in the page's popover, in another tab, and on a working-baseline switch.

**Never:** a dataset fetch, auto-changing a stored status, gating not-applicable.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Blocked | Compliant chosen, 9 of 9 unreviewed | "Cannot mark compliant: 9 of 9 parameters still unreviewed in the Moderate baseline." plus workspace link, Save disabled | Forced save refused, nothing stored |
| Cleared | Last parameter decided in the popover | Block lifts without reload | N/A |
| Baseline differs | Reviewed in Moderate, viewed in High | Gated again, message names High | N/A |
| Already compliant | Stored compliant, parameters unreviewed in High | Note shown, Save still enabled | N/A |
| Out of baseline | Item not in working baseline | Not gated | N/A |
| No parameters | e.g. AC-3 | Never blocked | N/A |
| Enhancement | AC-2(1) | Gated by its own parameters | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/odpInterlock.ts` -- new: `interlockFor`, messages.
- `src/utils/slotPayload.ts` -- new: single reader of the embedded page payload (also used by the overlay).
- `src/components/StatusControl.astro` -- gate region, Save disabling, re-check in `save()`, live re-evaluation.

## Tasks & Acceptance

**Execution:**
- [x] Interlock function and messages.
- [x] Gate UI and enforcement in the status control.
- [x] Shared payload reader.

**Acceptance Criteria:**
- Given an item with unreviewed parameters in the working baseline, then compliant cannot be saved and the message names the count and baseline.
- Given the last parameter is decided, then the block clears without a reload.
- Given an item with zero parameters, then it is never blocked.

## Verification

- `npm run build` succeeds.
- Headless Edge: every matrix row, including a forced-click bypass attempt (refused, nothing stored); ODP popover, batch and cross-tab suites re-run green.

## Suggested Review Order

- The gate rule and messages.
  [`odpInterlock.ts:1`](../../../../src/utils/odpInterlock.ts#L1)

- Gate wiring and the enforcement re-check.
  [`StatusControl.astro:1`](../../../../src/components/StatusControl.astro#L1)
