---
title: 'Compliance Workbench — readiness gate and dashboard'
type: 'feature'
created: '2026-09-29'
status: 'done'
review_loop_iteration: 0
baseline_commit: '58f37fc8cc82921e3b2b7fd3e3754b8827867044'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A user working through a baseline's 643 parameters (Moderate, verified real count) has no way to see how much is left, jump to what's outstanding, or be stopped from calling the baseline "ready" while parameters still sit on an unreviewed default — the exact ceiling-effect risk FedRAMP Notice 0013 exists to prevent.

**Approach:** Add a readiness dashboard to the same `OdpWorkspace` island: overall and by-Family counts of `unreviewed-default`/`confirmed`/`overridden`, a "jump to next unreviewed" action, and a hard "Mark ready" gate that's blocked while any parameter remains `unreviewed-default`. Everything is computed fresh from `odpStore.getDecision` on every render — no new persisted state, no new route.

## Boundaries & Constraints

**Always:**
- Dashboard counts (overall and by-Family) are computed fresh from `getDecision` over the baseline's full entry list — the same flat set of raw param instances story 1's individual rows already iterate (verified real Moderate data: 643 entries across 18 represented families, 16–66 per family). A key with no stored decision counts as `unreviewed-default` (AD-10).
- "Mark ready" is a hard gate, not a warning: the action is blocked while `unreviewedCount > 0` (FR-11). No new field is added to the AD-10 `localStorage` blob and `schemaVersion` is not bumped — readiness is a derived computation, recomputed every time, never persisted.
- "Jump to next unreviewed" scrolls to the first entry (document order) whose current status is `unreviewed-default`. If that entry belongs to a dash-one cluster (per `odpCluster.ts`'s `groupDashOneClusters`, story 2, reused unmodified), jump to that cluster's batch row instead of the individual row — resolving the shared decision once is the intended path, not resolving 18 individually. Never reimplement cluster matching here.
- Both the individual-row save (`handleAction`) and the batch-row save (`handleBatchAction`) trigger a dashboard refresh after a successful `setDecision` — the dashboard is never stale relative to the decisions it counts.
- The dashboard renders inside the existing `OdpWorkspace` island (AD-9) — no new page/route.

**Ask First:** none anticipated.

**Never:** OSCAL export (story 4). No new `localStorage` key or blob field for a "ready" flag — the gate is always a live computation, never a stored boolean.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh baseline, no decisions | Moderate workspace, `localStorage` empty | Dashboard shows 643 unreviewed / 0 confirmed / 0 overridden; "Mark ready" is blocked | N/A |
| One parameter still unreviewed | 642 of 643 decided, 1 left `unreviewed-default` | Clicking "Mark ready" is blocked, names the outstanding count | Action rejected, no side effect |
| Zero parameters unreviewed | All 643 `confirmed`/`overridden` | Clicking "Mark ready" succeeds, shows a ready confirmation | N/A |
| Jump lands on a clustered parameter | Next unreviewed entry is one of `prm_1`'s 18 dash-one members | View scrolls to the `prm_1` batch row, not an individual row | N/A |
| Jump lands on a non-clustered parameter | Next unreviewed entry is `sc-1`'s `odp.03` (excluded from its cluster per story 2) | View scrolls to `sc-1`'s own individual row | N/A |
| Jump with nothing left | No `unreviewed-default` entries remain | "Jump to next unreviewed" is disabled, not a dead click | N/A |
| Dashboard reflects a batch save | User confirms a dash-one cluster's shared value | Overall and by-Family counts update immediately, no reload | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/odpCluster.ts:107` (`groupDashOneClusters`, story 2, unchanged) — reused to decide whether the next unreviewed entry should jump to a batch row instead of an individual one.
- `src/utils/odpStore.ts:98` (`getDecision`, unchanged) — sole read path; every dashboard count and every jump-target check goes through it.
- `src/components/workspace/OdpWorkspace.astro:339` (`buildRow`) — individual row builder; already sets `row.dataset.odpKey`, the jump target's selector — unchanged.
- `src/components/workspace/OdpWorkspace.astro:498` (`buildBatchRow`) — batch row builder; already sets `row.dataset.odpClusterKey`, the cluster jump target's selector — unchanged.
- `src/components/workspace/OdpWorkspace.astro:436` (`handleAction`) — individual save; needs one new call to trigger a dashboard refresh after a successful `setDecision`.
- `src/components/workspace/OdpWorkspace.astro:592` (`handleBatchAction`) — batch save; same dashboard-refresh call needed after any member write succeeds.
- `src/components/workspace/OdpWorkspace.astro:652` (`init()`) — entry point; after building individual and batch rows, compute and render the dashboard from the same `entries`/`clusters` already in scope.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/workspace/OdpWorkspace.astro` -- add `computeDashboardCounts(entries, baseline)`: iterates every entry, tallies overall `{unreviewed, confirmed, overridden, total}` and a `Map<familyCode, {unreviewed, confirmed, overridden, total}>`, reading each status via `getDecision` (missing entry = `unreviewed-default`).
- [x] `src/components/workspace/OdpWorkspace.astro` -- render a "Readiness" section: overall counts/percentages, a by-Family table, a "Jump to next unreviewed" button, and a "Mark ready" button that's `disabled` with an explanatory message while `unreviewedCount > 0`, otherwise shows a ready confirmation on click.
- [x] `src/components/workspace/OdpWorkspace.astro` -- wire "Jump to next unreviewed": find the first entry in document order with a current `unreviewed-default` status; if its key belongs to any cluster's `members` (via `groupDashOneClusters`), `scrollIntoView`+focus that cluster's `[data-odp-cluster-key]` row, else the entry's own `[data-odp-key]` row.
- [x] `src/components/workspace/OdpWorkspace.astro` -- call a shared `refreshDashboard()` at the end of both `handleAction`'s and `handleBatchAction`'s success paths, so counts and the gate never go stale without a reload.

**Acceptance Criteria:**
- Given a fresh Moderate workspace with no decisions, when the dashboard renders, then it shows 643 unreviewed / 0 confirmed / 0 overridden and "Mark ready" is blocked.
- Given exactly one remaining unreviewed-default parameter, when the user clicks "Mark ready", then the action is blocked and names the outstanding count.
- Given zero remaining unreviewed-default parameters, when the user clicks "Mark ready", then the action succeeds and a ready confirmation is shown.
- Given the next unreviewed parameter belongs to a dash-one cluster, when the user clicks "Jump to next unreviewed", then the view scrolls to that cluster's batch row, not an individual row.
- Given any successful individual or batch save, when the save completes, then the dashboard's counts (overall and by-Family) reflect it without a page reload.

## Spec Change Log

## Design Notes

Computing 643 `getDecision` calls (one `localStorage` read + `JSON.parse` each, via `odpStore`'s existing corrupt-safe `readBlob`) on every dashboard refresh is the same order of magnitude as story 1/2's own row-building passes over the same entry list — no perceptible lag expected (NFR-2), and no caching is introduced, consistent with "always computed fresh, never stored."

## Verification

**Commands:**
- `npm run build` -- expected: succeeds (no route/schema changes; extends the existing `OdpWorkspace` island).

**Manual checks (if no CLI):**
- `npm run dev`, open `/workspace/moderate` fresh (clear `localStorage` first) — dashboard shows 643/0/0 and "Mark ready" is blocked.
- Confirm the `prm_1` batch cluster's value — dashboard's unreviewed count drops by 18, "Jump to next unreviewed" no longer targets `prm_1`.
- Confirm a single non-clustered row (e.g. `sc-1`'s `odp.03`) — verify the dashboard's unreviewed count drops by 1 without a reload (exercises `handleAction`'s refresh path specifically, not just the batch path).
- Manually decide all but one parameter (or corrupt/clear a subset to simulate), click "Mark ready" — verify it's blocked and names the outstanding count.
- Click "Jump to next unreviewed" when the next one is a dash-one member — verify the view scrolls to the batch row, not the individual row.
- Click "Jump to next unreviewed" when the next one is a non-clustered parameter — verify the view scrolls to its own individual row, not a batch row.
- Decide the last remaining parameter so zero are unreviewed, then click "Mark ready" — verify the button is enabled and the "Ready — all 643 parameters reviewed." confirmation appears.

## Suggested Review Order

**Readiness computation (the story's core logic)**

- Tallies overall and by-Family counts fresh from `getDecision` on every call — start here.
  [`OdpWorkspace.astro:472`](../../../../src/components/workspace/OdpWorkspace.astro#L472)

- The hard gate itself: blocks "Mark ready" while any parameter is unreviewed, independently re-checked on click (not just via the disabled attribute).
  [`OdpWorkspace.astro:529`](../../../../src/components/workspace/OdpWorkspace.astro#L529)

- Re-renders the whole dashboard (summary, by-Family table, button states) from current decision state — called on load and after every save.
  [`OdpWorkspace.astro:546`](../../../../src/components/workspace/OdpWorkspace.astro#L546)

**Cluster-aware jump (reuses story 2)**

- Finds the first unreviewed entry in document order, then decides whether to jump to its cluster's batch row or its own individual row.
  [`OdpWorkspace.astro:513`](../../../../src/components/workspace/OdpWorkspace.astro#L513)

- The cluster lookup driving that decision, built on `groupDashOneClusters` from story 2 — never reimplemented.
  [`OdpWorkspace.astro:504`](../../../../src/components/workspace/OdpWorkspace.astro#L504)

**Integration with individual/batch saves**

- Individual save now triggers a dashboard refresh on success.
  [`OdpWorkspace.astro:701`](../../../../src/components/workspace/OdpWorkspace.astro#L701)

- Batch save refreshes the dashboard unconditionally, even on partial failure, so a decision that did persist is never undercounted.
  [`OdpWorkspace.astro:858`](../../../../src/components/workspace/OdpWorkspace.astro#L858)

**Entry point**

- Captures the entries/clusters the dashboard reads against, wires the two new buttons, and triggers the first render.
  [`OdpWorkspace.astro:922`](../../../../src/components/workspace/OdpWorkspace.astro#L922)
