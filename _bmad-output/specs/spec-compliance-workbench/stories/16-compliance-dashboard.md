---
title: 'Compliance Workbench — compliance dashboard'
type: 'feature'
created: '2026-09-30'
status: 'done'
review_loop_iteration: 0
baseline_commit: '9b7d453'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no answer to "how compliant are we?" — status lives per item, and any roll-up invites a denominator that flatters the number.

**Approach:** Add `utils/complianceCount.ts` (AD-15) and a dashboard at `/dashboard/`: a hero number, an overall stacked horizontal bar, and a per-family breakdown using the same mark, with baseline as a filter control above the chart.

## Boundaries & Constraints

**Always:**
- One denominator rule set in one module (AD-15): withdrawn items never counted (182); enhancements are first-class items; `not-applicable` is excluded from the denominator entirely (shown as its own segment, never complete, never outstanding); baseline-less PM-family items (13: 10 controls, 3 enhancements) are included under every baseline filter and reported on their own line, instead of being dropped like a plain `baselines.includes()` filter drops them; a missing status record is incomplete.
- Every percentage shows its raw fraction beside it: `33% (86/257)`.
- Stacked horizontal bar, not a donut. The same mark serves the overall total and every family row.
- Colour is measured, not chosen. Baseline is never a colour-encoded dimension here (compliant-green sits DeltaE 7.9 from `--color-baseline-low`); baseline is a filter control. No red "incomplete" (fails deuteranopia separation from the green at DeltaE 4.1). Status colours are their own tokens added to `:root` (`--color-status-*`), never the `--color-baseline-*` tokens: compliant `#0ca30c`, in progress `#fab219`, incomplete neutral gray `#6e7681`, not-applicable neutral fill with a 45-degree hatch.
- Status colours ship with label and icon (legend, tooltip, table), never colour alone. A table view of the same numbers ships with the chart.
- Data comes from build-time embedded item metadata and `statusStore`; no fetch. The baseline filter is a view scope independent of the working baseline (AD-13): an explicit `?baseline=` wins, otherwise it follows the working baseline.
- Marks follow the dataviz spec: thin (12px, overall 20px), 2px surface gaps with no borders, square at the baseline and 4px rounded at the data end, no inline labels that do not fit, text in text tokens, tooltips via `textContent`, focusable bars with the same tooltip as hover.

**Never:** a red status, baseline tokens as fills, a bare percentage, counting withdrawn or out-of-baseline items, editing statuses from this page.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Counts match the store | Seeded statuses | Hero, family rows and table equal an independent count | N/A |
| Not applicable | N/A items | Own hatched segment; absent from the denominator | N/A |
| Withdrawn / out-of-baseline status | Stored status on such an item | Ignored | N/A |
| Program-wide | Any baseline | 13 PM items counted and labelled on their own line | N/A |
| Switch baseline | Filter click | Denominator changes; status colours do not | N/A |
| No statuses | Fresh browser | `0% (0/162)` for Low (149 + 13), all incomplete | N/A |
| Corrupt status blob | Invalid JSON | Empty state, no crash | Console error from the store |

</frozen-after-approval>

## Code Map

- `src/utils/complianceCount.ts` -- the counter (AD-15), pure.
- `src/components/ComplianceDashboard.astro` -- hero, filter, legend, bars, table, tooltip.
- `src/pages/dashboard.astro`, `src/utils/url.ts` (`dashboardUrl`), `src/layouts/BaseLayout.astro` -- route, header link, status tokens.

## Tasks & Acceptance

**Execution:**
- [x] Counter module with the AD-15 rule set.
- [x] Status tokens in `:root`.
- [x] Dashboard component, page and header link.

**Acceptance Criteria:**
- Given statuses, then the dashboard's counts match an independent count of the store for the selected baseline.
- Given not-applicable items, then they have their own segment and are absent from the denominator.
- Given withdrawn items, then they never appear; enhancements are counted.
- Given any baseline filter, then the 13 baseline-less PM items appear, labelled.
- Given a baseline switch, then the denominator changes without repainting status colours.

## Verification

- Palette (`validate_palette.js "#0ca30c,#fab219" --mode dark --surface "#161b22" --pairs all`): CVD separation PASS (DeltaE 11.3 protan, 28.3 tritan), normal-vision floor PASS (27.6), contrast >= 3:1 PASS. Its one FAIL is the categorical lightness band, which the script scopes to categorical palettes; these are status colours, and the amber is the intended status-warning token.
- Headless Edge: Moderate 300 counted items (287 + 13), 33% (86/257) equals an independent computation from the content files, all 19 family rows match, High switch gives 25% (86/340) with unchanged colours, empty and corrupt states, 390px width with no horizontal scroll, tooltip on focus; earlier suites re-run green. Rendered and inspected.

## Suggested Review Order

- The AD-15 rule set.
  [`complianceCount.ts:1`](../../../../src/utils/complianceCount.ts#L1)

- The dashboard: bars, tooltip, table twin.
  [`ComplianceDashboard.astro:1`](../../../../src/components/ComplianceDashboard.astro#L1)

- Status tokens, separate from the baseline tokens.
  [`BaseLayout.astro:1`](../../../../src/layouts/BaseLayout.astro#L1)
