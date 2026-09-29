---
title: 'Compliance Workbench — split workspace into views'
type: 'feature'
created: '2026-09-29'
status: 'done'
review_loop_iteration: 0
baseline_commit: '8aa292a7a20b130a497cb3ce8e1d0b38ae7af791'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Moderate workspace renders all 643 individual rows plus 9 batch rows unconditionally on load — one long page mixing two distinct modes of work (clear the 9 batch clusters, then grind the remaining 481 non-clustered params) into one scroll, and one heavy DOM (~12,000 nodes, 643 textareas) regardless of which mode the user is in.

**Approach:** Split the single scroll into three views — Dashboard, Batch entry, Individual parameters — switched by a button group whose state lives in the URL query (AD-3). The Individual view adds a required family selector (no "all families" option) and an unreviewed-only toggle, and builds rows only for the selected family — not all 643 up front. Dashboard and Batch stay exactly as they render today, just shown/hidden by view.

## Boundaries & Constraints

**Always:**
- Everything stays inside the one `OdpWorkspace` island (AD-9) — no new route, no per-family pages. AD-9 is not being amended.
- View state (`view=dashboard|batch|individual`), the selected family (`family=<CODE>`), and the unreviewed-only toggle (`unreviewed=1`, absent = off) live in the URL query, written through the existing `setUrlState()` (`src/utils/urlState.ts`) — never a second URL-writing path. Every write uses `replaceState` (already `setUrlState`'s behavior) — view/filter changes never add a history entry, consistent with `BaselineFilter.astro`'s existing convention.
- The Individual view always requires a family — there is no "all families" state. Defaults to the first represented family (alphabetical by code) when the view is selected with no valid `family` in the URL. Verified real Moderate data: 18 represented families, 16–66 rows each (average ~36) — every one is a >90% reduction from the current 643.
- Individual rows are built only for the currently selected family and unreviewed-only state — rebuilt (not just hidden) on every family or filter change. `rowRegistry` (story 2/3's live-refresh mechanism) is cleared and repopulated on each rebuild, since only one family's rows exist in the DOM at a time.
- Dashboard and Batch views keep their exact current rendering (unchanged from stories 3 and 2/5) — this story only wraps them in show/hide, it does not rebuild them per switch, since neither is large enough to need it (Batch is 9 rows; Dashboard has none).
- "Jump to next unreviewed" (story 3) still finds the next unreviewed entry and its cluster exactly as today, but now also switches the view (to `batch` for a clustered entry, to `individual` with that entry's family for a non-clustered one) before scrolling — the target must actually be rendered before `scrollIntoView` runs.
- The family selector lists exactly the families represented in the current baseline's dataset (derived from the loaded entries) — never a hardcoded or corpus-wide family list.

**Ask First:** none anticipated.

**Never:** a per-family route or page (AD-9 stays intact). No change to `odpStore`, `odpCluster`, decision keys, or storage shape — this story only changes what's rendered and when.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Fresh load, no URL params | `/workspace/moderate/` | Dashboard view shown; Batch and Individual rows not built yet | N/A |
| Switch to Individual, no prior family | Click "Individual parameters" | Defaults to the first represented family (alphabetical); only that family's rows build | N/A |
| Switch family | Family selector changed from AC to SI | AC's rows are removed from the DOM; SI's ~66 rows build fresh | N/A |
| Unreviewed-only toggled on | Individual view, family AC, some already confirmed | Only AC's still-unreviewed rows render; confirmed/overridden ones disappear from view (not from storage) | N/A |
| Jump lands on a clustered param | Dashboard → Jump, next unreviewed is a dash-one member | View switches to Batch, then scrolls to that cluster's row | N/A |
| Jump lands on a non-clustered param in a different family than currently selected | Dashboard → Jump, next unreviewed is in family SC while AC is selected | View switches to Individual, family switches to SC, then scrolls to that row | N/A |
| Deep link with explicit state | `?view=individual&family=SI&unreviewed=1` | Individual view loads directly with SI selected and the unreviewed-only filter already on | N/A |
| Invalid family in URL | `?view=individual&family=ZZ` | Falls back to the first represented family, does not error | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/urlState.ts:15` (`setUrlState`) — the sole URL-writing path to reuse; already generic enough (arbitrary `search` keys) for `view`/`family`/`unreviewed` without modification.
- `src/components/BaselineFilter.astro` — the existing reference for reading initial state from `URLSearchParams` on load and writing back via `setUrlState`; the pattern this story's view switcher mirrors.
- `src/components/workspace/OdpWorkspace.astro:22-75` — the three existing containers (`data-odp-dashboard`, `data-odp-batch`, `data-odp-rows`) to wrap in view-switching show/hide; no change to their internal markup.
- `src/components/workspace/OdpWorkspace.astro:1073` (`init()`) — currently builds all 643 individual rows unconditionally at line 1137-1139; this is the one loop to make lazy/family-scoped.
- `src/components/workspace/OdpWorkspace.astro:500` (`rowRegistry`) — cleared and repopulated per family rebuild, not per full page load.
- `src/components/workspace/OdpWorkspace.astro:602` (`jumpToNextUnreviewed`) — extend to switch view/family before the existing `scrollIntoView` call.
- `src/components/workspace/OdpWorkspace.astro:693` (`buildRow`) — unchanged; called per-entry for whichever family is currently selected instead of for all 643 entries.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/workspace/OdpWorkspace.astro` -- add a view-switcher button group (Dashboard / Batch entry / Individual parameters, `role="group"`, `aria-pressed` per button, mirroring the existing Confirm/Override button convention) above the three containers, plus a family `<select>` and an "unreviewed only" checkbox shown only when the Individual view is active.
- [x] `src/components/workspace/OdpWorkspace.astro` -- add `renderIndividualRows(family, unreviewedOnly)`: clears `rowRegistry` and the rows container, then builds rows only for entries matching `familyCode === family` (and `currentStatus === 'unreviewed-default'` when the toggle is on).
- [x] `src/components/workspace/OdpWorkspace.astro` -- add view-state read/write: on load, parse `view`/`family`/`unreviewed` from `URLSearchParams` (defaulting per Boundaries); on any switcher/selector/checkbox change, write via `setUrlState` and re-render the now-active view.
- [x] `src/components/workspace/OdpWorkspace.astro` -- `init()`: stop building all 643 rows unconditionally; instead compute the represented-families list from `entries`, populate the family selector, and call the new view-state logic once to render the initial view.
- [x] `src/components/workspace/OdpWorkspace.astro` -- `jumpToNextUnreviewed`: before the existing scroll, switch to `batch` (clustered case) or to `individual` with the target's `familyCode` (non-clustered case).

**Acceptance Criteria:**
- Given a fresh load of `/workspace/moderate/`, when the page renders, then only the Dashboard view is visible and no individual/batch rows exist in the DOM yet.
- Given the Individual view is selected with family AC, when the family selector is changed to SI, then AC's rows are removed and SI's rows (and only SI's) are built.
- Given the Individual view with the unreviewed-only toggle on, when a row is confirmed, then that row disappears from the current view without a page reload.
- Given the Dashboard's "Jump to next unreviewed" is clicked and the next entry is a dash-one member, when the jump completes, then the Batch view is active and the target cluster row is in view.
- Given the Dashboard's "Jump to next unreviewed" is clicked and the next entry belongs to a family other than the currently selected one, when the jump completes, then the Individual view is active with that family selected and the target row is in view.
- Given a URL with `?view=individual&family=SI&unreviewed=1`, when the page loads, then the Individual view renders directly with SI selected and the filter already on — no extra click required.

## Spec Change Log

## Design Notes

**Measured DOM reduction:** the Individual view now builds one family's rows at a time — 16 to 66 per family (Moderate), averaging ~36, versus 643 unconditionally today. That's roughly a 94% reduction in the common case, and the Batch view's 9 rows are already small enough that they don't need the same lazy treatment.

**Why family is required, not optional, on the Individual view:** an "all families" option on this view would silently reintroduce the exact 643-row weight this story exists to remove. Requiring a selection keeps the DOM-size guarantee structural rather than a setting a user could accidentally leave on "all."

**Live cross-sync tradeoff:** story 2's "batch save refreshes the matching individual row in place" only works for rows that are actually rendered — with family-scoped rendering, a batch save updates rows for whichever family is currently selected and leaves the other 17 dash-one members' rows simply not-yet-built (they'll show correct state, read fresh from `odpStore`, whenever their family is later selected). This is an accepted consequence of lazy rendering, not a regression — no decision data is ever affected, only which rows currently exist in the DOM.

## Verification

**Commands:**
- `npm run build` -- expected: succeeds (no route/schema changes; extends the existing `OdpWorkspace` island).

**Manual checks (if no CLI):**
- `npm run dev`, open `/NIST-800-53-browser/workspace/moderate/` fresh — only the Dashboard view renders; open DevTools and confirm no `.odp-row` elements exist yet.
- Switch to Individual — confirm a family is auto-selected and only that family's rows appear; switch families and confirm the row count changes accordingly (e.g. AC → 65 rows, PL → 16 rows).
- Toggle "unreviewed only" after confirming a couple of rows — confirm they drop out of the current view.
- From Dashboard, click "Jump to next unreviewed" for both a clustered and a non-clustered target — confirm the view switches correctly before scrolling in each case.
- Load `?view=individual&family=SI&unreviewed=1` directly — confirm it renders SI with the filter on, no clicks needed.

## Suggested Review Order

**View switching (the story's core mechanism)**

- `switchToView`: the sole entry point for changing view/family, writing through `setUrlState`, and falling back to the first represented family — start here.
  [`OdpWorkspace.astro:818`](../../../../src/components/workspace/OdpWorkspace.astro#L818)

- `setActiveView`: owns container visibility and the tab `aria-selected` state; includes the review-found empty-Batch-view guard.
  [`OdpWorkspace.astro:752`](../../../../src/components/workspace/OdpWorkspace.astro#L752)

- `jumpToNextUnreviewed`: switches view/family before scrolling, so the target actually exists in the DOM first.
  [`OdpWorkspace.astro:851`](../../../../src/components/workspace/OdpWorkspace.astro#L851)

**Lazy rendering and the review-found data-loss fix**

- `renderIndividualRows`: builds rows for one family only — the mechanism behind the DOM-size reduction.
  [`OdpWorkspace.astro:780`](../../../../src/components/workspace/OdpWorkspace.astro#L780)

- `removeRowFromIndividualViewIfFiltered`: removes just the one row that changed instead of rebuilding the whole family list — the fix for a real data-loss bug found in review (a full rebuild would have silently discarded unsaved input in sibling rows).
  [`OdpWorkspace.astro:805`](../../../../src/components/workspace/OdpWorkspace.astro#L805)

**Entry point**

- `init()`: parses initial view/family/unreviewed state from the URL, populates the family selector, wires the switcher.
  [`OdpWorkspace.astro:1336`](../../../../src/components/workspace/OdpWorkspace.astro#L1336)
