---
title: 'Compliance Workbench — progressive home page'
type: 'feature'
created: '2026-09-30'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'b5c8ed2'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Making the dashboard the front door would greet a first-time visitor with `0% complete — 0/287`: a poor entry to a catalog browser, and a worse one for a portfolio piece. Most visitors want to read NIST 800-53.

**Approach:** Keep one route. The home page is the family catalog; once the visitor has any status or decision data, the dashboard is promoted above it. The catalog never disappears.

## Boundaries & Constraints

**Always:**
- Same route (`index.astro`), conditional on whether either store holds data: a control status in `statusStore`, or a decision in any baseline's `odpStore` blob. Read through the stores' own modules (`workbenchData.ts`), never localStorage directly. A missing or corrupt blob counts as no data.
- No flash: the catalog is what renders first, and the dashboard starts hidden in the markup and is revealed after the has-data check — never the reverse.
- With JavaScript disabled the page is exactly today's family list: no dashboard, and no `<noscript>` text (it is suppressed in progressive mode).
- The home dashboard is compact: hero number, overall bar, baseline filter and a link to the full `/dashboard/`, so the catalog stays on screen. The full per-family breakdown and table live on the dashboard page.
- It follows the data: if another tab creates the first status or decision, the home page reveals it.

**Never:** replacing `index.astro`, hiding the catalog, an empty chart for a first-time visitor.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First visit | Empty localStorage | Family list only; dashboard never visible, not even transiently | N/A |
| One status set | Reload | Compact dashboard above the list | N/A |
| Decision only | ODP decision, no status | Dashboard shown | N/A |
| Corrupt data | Invalid blobs | Treated as no data; list only | N/A |
| Data from another tab | Storage event | Dashboard is revealed without reload | N/A |
| No JavaScript | JS disabled | Exactly the family list | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/workbenchData.ts` -- `hasWorkbenchData()` over both stores.
- `src/components/ComplianceDashboard.astro` -- `progressive`, `compact` and `title` props; detail section and noscript made conditional.
- `src/pages/index.astro` -- mounts the dashboard above the catalog.

## Tasks & Acceptance

**Execution:**
- [x] Has-data check over both stores.
- [x] Progressive and compact modes of the dashboard component.
- [x] Mount on the home page.

**Acceptance Criteria:**
- Given empty localStorage, then the home page shows today's family list and no chart.
- Given one status set, then on reload the dashboard appears above the list.
- Given JavaScript disabled, then the catalog renders as it does today.

## Verification

- `npm run build` succeeds; the home HTML carries no `<noscript>`.
- Headless Edge: empty storage with a mutation observer from before any script (never visible), status reveals with the dashboard above the list (y 250 vs 711) and 20 families still present, decision-only reveals, corrupt blobs do not, a status written in another tab reveals it, JS disabled shows the plain list; dashboard-page and earlier suites re-run green. Rendered and inspected.
- Cost: the home HTML grows to about 45 KB because it carries the item metadata for the dashboard (the same payload the dashboard page embeds).

## Suggested Review Order

- The has-data check over both stores.
  [`workbenchData.ts:1`](../../../../src/utils/workbenchData.ts#L1)

- Progressive reveal and compact mode.
  [`ComplianceDashboard.astro:1`](../../../../src/components/ComplianceDashboard.astro#L1)

- The home page mount.
  [`index.astro:1`](../../../../src/pages/index.astro#L1)
