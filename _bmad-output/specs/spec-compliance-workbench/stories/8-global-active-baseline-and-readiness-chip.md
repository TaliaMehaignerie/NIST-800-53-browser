---
title: 'Compliance Workbench — global active baseline and readiness chip'
type: 'feature'
created: '2026-09-30'
status: 'done'
baseline_commit: '959f6bbb2fcefcce7c7e4bb59af69265987887a2'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Nothing outside `/workspace/{baseline}` knows which baseline the user is deciding for, and the workspace is unreachable from the rest of the site (`workspaceUrl()` has no call site). Later stories that show or edit decisions on control pages have no unambiguous baseline to resolve against.

**Approach:** Add `utils/activeBaseline.ts` (AD-13), the one persisted app-global working baseline, and a global-header control: a "Working in" selector plus a readiness chip (`Moderate · 412/643 reviewed`) linking to that baseline's workspace.

## Boundaries & Constraints

**Always:**
- `activeBaseline.ts` is the only reader/writer of the working baseline (localStorage key `active-baseline`, try/catch-wrapped). Missing, unreadable, or invalid value resolves to `moderate` — a default owned by this module, not inferred by any page. No page reads its own URL or hardcodes a baseline for this purpose.
- The working baseline and the existing `BaselineFilter` are two separate controls. The working baseline offers Low / Moderate / High / Privacy with no `All`. The filter is unchanged behaviorally and keeps `All`; setting it never changes the working baseline.
- The two must read as different things: the header control is labelled "Working in" and is a select with the chip beside it; `BaselineFilter` gains a "Viewing" label. Neither reuses the other's styling.
- `/workspace/{baseline}` stays authoritative for its own page: on mount the island writes its path baseline to the working baseline. Changing the header selector while on a workspace page navigates to that baseline's workspace; on any other page it only updates the working baseline and chip.
- The chip degrades to the baseline name alone until counts load, and again if the load fails; it never shows `0/0` or a fabricated count. Total comes from a per-baseline param count added to `odp-meta.json` (AD-8 endpoint, same collection); reviewed is the number of decisions in that baseline's `odpStore` blob whose status is not `unreviewed-default`. Must equal the workspace dashboard's count for the same baseline.
- The chip refreshes when the working baseline changes and when the workspace saves a decision (window event), so it is not stale on the workspace page.
- Chip link built with `workspaceUrl()` (AD-4). With JS disabled the new control is hidden; the rest of the header is unchanged.

**Ask First:** none anticipated.

**Never:** offering or performing a working-baseline switch when the filter changes (deferred). No fetch of `odp-dataset.json` from the header. No second localStorage path for decisions (AD-10). No change to decision keys or storage shape.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First visit | No stored value | Selector and chip show Moderate | N/A |
| Pick High on a control page, navigate, reload | Select High | Working baseline stays High on every page | Storage unavailable: per-page state only, no crash |
| Filter set to All | Working baseline High | Working baseline still High | N/A |
| Open `/workspace/low/` | Working baseline High | Working baseline becomes Low, header updates | N/A |
| Change selector on a workspace page | Select Privacy | Navigates to `/workspace/privacy/` | N/A |
| Counts not loaded / meta fetch fails | Any | Chip shows `Moderate` only, still links to workspace | Logged, no error UI |
| Confirm a parameter in the workspace | Chip visible | Reviewed count increments without reload | N/A |
| Corrupt stored value | `active-baseline` = `"xyz"` | Treated as `moderate` | N/A |

</frozen-after-approval>

## Code Map

- `src/layouts/BaseLayout.astro:40-47` -- global header; mount the new working-baseline component here (AD-7 chrome).
- `src/components/BaselineFilter.astro` -- add the "Viewing" label only; behavior untouched.
- `src/pages/odp-meta.json.ts` -- extend with `paramCounts` per baseline from `getCollection('controls')` (non-withdrawn entries' params, grouped by `baselines`), mirroring `odp-dataset.json.ts` filtering.
- `src/utils/odpStore.ts:99` -- `getDecisions(baseline)` for the reviewed count.
- `src/utils/url.ts:38` -- `workspaceUrl()`, first call site.
- `src/components/workspace/OdpWorkspace.astro` (`init()`, `refreshDashboard()`) -- write path baseline to the working baseline on mount; dispatch the decisions-changed event from `refreshDashboard`.
- `src/utils/activeBaseline.ts` -- new: `getActiveBaseline`, `setActiveBaseline` (dispatches `activebaselinechange`), `BASELINES`.
- `src/components/WorkingBaseline.astro` -- new: select, chip, script.

## Tasks & Acceptance

**Execution:**
- [x] `src/utils/activeBaseline.ts` -- create per Boundaries.
- [x] `src/pages/odp-meta.json.ts` -- add `paramCounts`.
- [x] `src/components/WorkingBaseline.astro` -- create selector + chip with async count load and event listeners; mount in `BaseLayout.astro`.
- [x] `src/components/BaselineFilter.astro` -- add "Viewing" label.
- [x] `src/components/workspace/OdpWorkspace.astro` -- set working baseline on mount; dispatch decisions-changed event.
- [x] Spine -- confirm AD-13 text matches (module name, default, event); adjust only wording.

**Acceptance Criteria:**
- Given any page, when the header renders, then a "Working in" selector (no All) and a chip linking to `workspaceUrl(working baseline)` are present, and the filter, where mounted, is labelled "Viewing".
- Given Moderate is picked on a control page, when navigating to a family page and reloading, then Moderate remains the working baseline.
- Given the filter is set to All, then the working baseline is unchanged.
- Given `/workspace/high/` loads, then the working baseline is High.
- Given the same baseline, then the chip's reviewed/total equals the workspace dashboard's confirmed+overridden / total.
- Given counts have not loaded, then the chip shows the baseline name only.

## Spec Change Log

## Design Notes

**Why `odp-meta.json`, not the dataset:** the plan said the count "needs the dataset", but the dataset is ~736 KB and would load on every page for one number. Per-baseline totals are tiny and already belong in the endpoint the workspace fetches; reviewed is a local read. The workspace never writes `unreviewed-default`, so non-unreviewed decisions equal the dashboard's reviewed count.

**Why a module default:** AD-13 forbids pages from inventing a baseline, not the module. Moderate is the V1 verified baseline.

## Verification

**Commands:**
- `npm run build` -- expected: succeeds; `dist/odp-meta.json` contains `paramCounts` with `moderate: 643`.

**Manual checks (if no CLI):**
- `npm run dev`: walk the I/O matrix — pick High on a control page, navigate, reload; set filter to All; open `/workspace/low/`; confirm a param and watch the chip count; compare chip to dashboard; block the meta request and confirm the chip shows the name only.

## Suggested Review Order

- The one owner of the working baseline, its default, and the change event.
  [`activeBaseline.ts:1`](../../../../src/utils/activeBaseline.ts#L1)

- Header control: selector, async-degrading chip, workspace-page navigation rule.
  [`WorkingBaseline.astro:1`](../../../../src/components/WorkingBaseline.astro#L1)

- Per-baseline param totals, so the header never fetches the dataset.
  [`odp-meta.json.ts:1`](../../../../src/pages/odp-meta.json.ts#L1)

- Workspace writes its path baseline on mount and announces decision changes.
  [`OdpWorkspace.astro:1250`](../../../../src/components/workspace/OdpWorkspace.astro#L1250)

- Mount point and the "Viewing" label that separates the filter from the working baseline.
  [`BaseLayout.astro:40`](../../../../src/layouts/BaseLayout.astro#L40)
