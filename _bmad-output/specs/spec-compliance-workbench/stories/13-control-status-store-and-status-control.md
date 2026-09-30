---
title: 'Compliance Workbench — control status store and per-item status control'
type: 'feature'
created: '2026-09-30'
status: 'done'
review_loop_iteration: 0
baseline_commit: '2b544f2'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The workbench tracks parameter decisions but not whether a control is actually implemented, and every decision read re-parses the whole blob (643 parses per dashboard refresh), a cost a second store would inherit.

**Approach:** Add `utils/statusStore.ts` (AD-14) and one status control on every control page and every enhancement fragment: incomplete / in-progress / compliant / not-applicable, plus owner, with a justification required for not-applicable. Give both stores a read-through cache.

## Boundaries & Constraints

**Always:**
- Status lives in ONE blob, key `control-status`, not per baseline. This is deliberately asymmetric with AD-10 (ODP values differ by baseline, implementation status does not) and is recorded in the module header and the spine.
- Corrupt or missing blob is empty state: never a crash, never a fabricated status. A missing record reads as incomplete; nothing is stored for it.
- `not-applicable` requires a non-empty justification, refused at the store boundary (`setStatus` returns false), the same idiom as `overridden` requiring a rationale. The blob's read-side validation mirrors it.
- Status attaches to enhancements as well as controls, keyed by slug. One component (`StatusControl.astro`) in both places, never two. No new routes (AD-4).
- Withdrawn items get no status control (never counted, AD-15).
- Both stores cache reads inside the module with no API change. The cache is keyed on the raw stored string, so it is invalidated on write and stays correct across tabs without an event hook. `setDecision` builds a new object instead of mutating the cached one.
- `data-pagefind-ignore` keeps the form out of search; the control is hidden until JS runs.

**Never:** storing status per baseline, evidence (story 14), gating on ODPs (story 15).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Independent items | Set AC-2 and AC-2(1) | Both persist separately | N/A |
| N/A without justification | Empty justification | Refused with visible message, nothing stored | N/A |
| Owner round trip | Owner text saved | Reloaded unchanged | N/A |
| Repeated save | Save twice | `updatedAt` advances | N/A |
| Corrupt blob | Invalid JSON | Empty state, console error | No crash |
| Other tab writes | Storage event | Changed controls update; others untouched | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/statusStore.ts` -- new: store, validation, cache.
- `src/components/StatusControl.astro` -- new: the one control and its script.
- `src/pages/controls/[slug].astro`, `src/components/EnhancementItem.astro` -- mount it.
- `src/utils/odpStore.ts` -- read-through cache; copy-on-write `setDecision`.
- `src/utils/storageSync.ts` -- also reacts to the status key.

## Tasks & Acceptance

**Execution:**
- [x] `statusStore.ts` with corrupt-safe contract, N/A enforcement and cache.
- [x] `StatusControl.astro` mounted on control page and every non-withdrawn enhancement.
- [x] `odpStore` read-through cache.

**Acceptance Criteria:**
- Given AC-2 and AC-2(1), then each persists independently.
- Given not-applicable with an empty justification, then a visible message appears and nothing is written.
- Given a corrupt `control-status` blob, then the page shows incomplete and logs a console error.
- Given a workspace load, then the decision blob is parsed once, not once per entry.

## Verification

- `npm run build` succeeds; 13 status controls on AC-2 (control plus 12 enhancements).
- Headless Edge: all matrix rows; blob parsed once on a 643-entry workspace load (was 643+); earlier popover, batch, cross-tab and workspace suites re-run green.

## Suggested Review Order

- The store: AD-14 header, N/A enforcement, raw-keyed cache.
  [`statusStore.ts:1`](../../../../src/utils/statusStore.ts#L1)

- The single status control and its script.
  [`StatusControl.astro:1`](../../../../src/components/StatusControl.astro#L1)

- The odpStore cache and copy-on-write.
  [`odpStore.ts:62`](../../../../src/utils/odpStore.ts#L62)
