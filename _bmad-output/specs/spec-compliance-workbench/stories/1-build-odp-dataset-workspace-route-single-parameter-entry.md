---
title: 'Compliance Workbench — ODP dataset, workspace route, single-parameter entry'
type: 'feature'
created: '2026-09-29'
status: 'done'
review_loop_iteration: 0
baseline_commit: '19b6e9758f77661c5a4e79be8df5ccbf60506f9e'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** FedRAMP Notice 0013 removed centralized ODP defaults, so ~643 organization-defined parameters per Moderate baseline now need an explicit, documented decision — and the Browser has no way to view, set, or persist one.

**Approach:** Add a build-time ODP dataset endpoint, a `/workspace/{baseline}` route hosting one stateful workspace component, and the ability to set/confirm/override a single parameter's value with rationale, persisted to `localStorage`. This is the foundation story 2 (dash-one batching), story 3 (readiness dashboard), and story 4 (OSCAL export) build on.

## Boundaries & Constraints

**Always:**
- `src/pages/odp-dataset.json.ts` derives the dataset only from `getCollection('controls')` (AD-8) — never raw OSCAL, never `scripts/ingest.mjs`.
- `src/pages/workspace/[baseline].astro` renders exactly one client component, `src/components/workspace/OdpWorkspace.astro`, which owns the entire decision flow (AD-9). No other page reads/writes a decision.
- All `localStorage` access goes through one shared module, `src/utils/odpStore.ts` (AD-10). Blob: `localStorage['odp-decisions:<baseline>'] = { schemaVersion: number, decisions: { "<controlSlug>:<paramId>": { value, status, rationale } } }`.
- Decision `value` is `string | string[]` — array iff the dataset entry's `select.howMany === 'one-or-more'`; never assume single-string.
- `status` is `'unreviewed-default' | 'confirmed' | 'overridden'`; setting `overridden` is rejected client-side unless `rationale` is non-empty.
- A missing or unparseable blob is treated as empty state (all params default `unreviewed-default`, no value) — never a thrown error, never a fabricated value.
- Route/dataset are built for all 4 baselines (`getStaticPaths` returns low/moderate/high/privacy), but only Moderate is manually verified this story (SPEC V1 scope).
- No client framework: `OdpWorkspace` follows `BaselineFilter.astro`/`EnhancementItem.astro`'s existing pattern — plain `<script>`, `querySelectorAll`, delegated listeners, no React/Vue/etc.
- Interactive elements (status controls, inputs) are keyboard-operable with visible focus, per the `role`/`aria-expanded`/`focus-visible` conventions already in `EnhancementItem.astro`.

**Ask First:** none anticipated — if the dataset needs a `controls` collection field not already in `src/content.config.ts`'s schema, HALT and ask before touching the schema.

**Never:** dash-one batching/clustering, the readiness dashboard/gate, OSCAL export — all deferred to stories 2–4. Don't add a second localStorage access path outside `odpStore.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Set free-text value, confirm | Param has no `select`; user types a value, sets status `confirmed` | Decision written to blob with that `value`, `status: 'confirmed'` | N/A |
| Set select value (`howMany: 'one-or-more'`) | User picks 2 choices | `value` stored as a 2-element array | N/A |
| Override without rationale | User sets status `overridden`, leaves rationale empty | Change is blocked; UI explains rationale is required | Save rejected, no partial write |
| Override with rationale | Non-empty rationale provided | Decision written with `status: 'overridden'`, `rationale` set | N/A |
| Reload after set | Page reloaded after a prior decision was saved | Same value/status/rationale reappear, read from `localStorage` | N/A |
| Corrupt blob | `odp-decisions:<baseline>` contains invalid JSON | Workspace loads as if no decisions exist; logs to console | No crash, no uncaught exception |
| Invalid baseline in URL | `/workspace/foo` | 404 (baseline not in `getStaticPaths`) | Astro's static 404 |

</frozen-after-approval>

## Code Map

- `src/content.config.ts` — `controls` collection schema: `slug`, `kind`, `withdrawn`, `baselines`, `familyCode`, `params[]` (`id`, `label`, `select`, `guidelines`). Dataset source; read-only.
- `src/pages/controls/[slug].astro` — reference for `getStaticPaths`/`getCollection`/`getEntry` usage pattern; not modified.
- `src/components/BaselineFilter.astro`, `src/components/EnhancementItem.astro` — the existing "no-framework island" pattern (delegated `<script>`, `querySelectorAll`, `init()`, `role`/`aria-expanded`/`focus-visible`) — `OdpWorkspace.astro` follows this shape.
- `src/utils/url.ts` — `BASE_URL`-aware link builder; add a `workspaceUrl(baseline)` export here rather than hand-rolling a path elsewhere.
- `src/utils/slugify.ts` — read-only reference; not needed for this story (params keyed by existing `controlSlug`/`paramId`, no new slugging).
- `src/layouts/BaseLayout.astro` — page shell; workspace route uses it with `showBaselineFilter={false}` (not relevant — the workspace scopes to one baseline via the route itself).
- `astro.config.mjs` — confirms `base: '/NIST-800-53-browser'`, `output: 'static'` (AD-1); no changes needed.

## Tasks & Acceptance

**Execution:**
- [x] `src/pages/odp-dataset.json.ts` -- new build-time JSON endpoint reading `getCollection('controls')`, emitting a flat array of `{ controlSlug, controlId, familyCode, paramId, label, guidelines, select, baselines }`, one per param instance, non-withdrawn only -- AD-8 dataset source for the workspace.
- [x] `src/utils/odpStore.ts` -- new module: `getDecisions(baseline)`, `getDecision(baseline, key)`, `setDecision(baseline, key, { value, status, rationale })`, all reading/writing the AD-10 blob, corrupt-safe -- sole localStorage path for this feature.
- [x] `src/pages/workspace/[baseline].astro` -- new route, `getStaticPaths` over the 4 baseline enum values, renders `BaseLayout` + `OdpWorkspace` with the `baseline` prop -- AD-9 entry point.
- [x] `src/components/workspace/OdpWorkspace.astro` -- new component: on init, `fetch()`s `odp-dataset.json`, filters to this baseline's non-withdrawn entries with `params.length > 0`, renders one row per parameter (label, guidelines, free-text or select input, status control), reads/writes decisions via `odpStore.ts` -- AD-9's single owner of the flow.
- [x] `src/utils/url.ts` -- add `workspaceUrl(baseline: string): string` following the existing builder pattern.

**Acceptance Criteria:**
- Given the Moderate baseline's workspace page, when a user sets a non-select parameter's value and confirms it, then reloading the page shows the same value and `confirmed` status.
- Given a parameter with `select.howMany === 'one-or-more'`, when the user picks multiple choices, then the persisted decision's `value` is an array of those choices.
- Given a user sets status to `overridden` with an empty rationale, then the save is blocked and no decision is written.
- Given a corrupted `odp-decisions:moderate` blob in `localStorage`, when the workspace loads, then it renders as if no decisions exist, without throwing.

## Spec Change Log

## Design Notes

`OdpWorkspace` fetches `odp-dataset.json` at runtime (client-side `fetch()`, not a build-time `getCollection` call inside the route) — this keeps row-building/filtering logic in one client-side place, matching the architecture diagram's `Dataset --> Workspace island` edge, and sets up story 2/3's dynamic re-grouping (dash-one clusters, live readiness counts) without a second data path. The route itself only picks the baseline and mounts the component; it does not pre-render per-parameter rows server-side.

## Verification

**Commands:**
- `npm run build` -- expected: succeeds, emits `dist/odp-dataset.json` and `dist/NIST-800-53-browser/workspace/{low,moderate,high,privacy}/index.html` (site's `base` applies).

**Manual checks (if no CLI):**
- `npm run dev`, open `/workspace/moderate`, set a value on a non-select and a `one-or-more` select parameter, confirm each, reload — values/status persist.
- Attempt `overridden` with empty rationale — save is blocked with an explanation.
- In DevTools, corrupt `localStorage['odp-decisions:moderate']` (set to `"{not json"`), reload — page renders with all params unreviewed, no console error thrown as uncaught.

## Suggested Review Order

**Decision flow (AD-9)**

- Entry point: fetches the dataset, filters to the current baseline, and builds one row per parameter — start here to see the whole flow.
  [`OdpWorkspace.astro`](../../../../src/components/workspace/OdpWorkspace.astro) (`init()`; story 2 has since extended this file, so line numbers below are approximate)

- Confirm/Override validation and save, including the generic failure message covering both rejection reasons (empty rationale or a failed `localStorage` write).
  [`OdpWorkspace.astro`](../../../../src/components/workspace/OdpWorkspace.astro) (`handleAction`)

**Persistence invariants (AD-10)**

- Sole write path: rejects `overridden` without a non-empty rationale, and now returns `false` (not `true`) when the underlying write itself fails.
  [`odpStore.ts:118`](../../../../src/utils/odpStore.ts#L118)

- Read-path shape validation: mirrors the write-path rationale invariant so a hand-edited or corrupted `overridden` entry with no rationale can't pass validation.
  [`odpStore.ts:32`](../../../../src/utils/odpStore.ts#L32)

- Corrupt/missing-blob-safe read — never throws, always falls back to empty state.
  [`odpStore.ts:63`](../../../../src/utils/odpStore.ts#L63)

**Dataset source (AD-8)**

- Build-time endpoint: flattens `getCollection('controls')` into one entry per non-withdrawn param instance — the sole data source for the workspace.
  [`odp-dataset.json.ts:20`](../../../../src/pages/odp-dataset.json.ts#L20)

**Routing (AD-9)**

- One route, one mount point, all four baselines built — this file intentionally does nothing else.
  [`[baseline].astro:12`](../../../../src/pages/workspace/%5Bbaseline%5D.astro#L12)

**Supporting**

- New base-aware URL builders (`workspaceUrl`, `odpDatasetUrl`) added alongside the existing pattern (AD-4).
  [`url.ts:37`](../../../../src/utils/url.ts#L37)
