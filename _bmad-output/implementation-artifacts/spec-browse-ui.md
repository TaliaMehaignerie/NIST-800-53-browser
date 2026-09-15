---
title: 'CAP-1 browse UI: Home, Family, and Control Detail pages'
type: 'feature'
created: '2026-09-15'
status: 'done'
review_loop_iteration: 0
baseline_commit: '12d246a7afc763acf343a6bf873bd3ed34c17d08'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-08-20/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-BMad-2026-09-07/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-BMad-2026-09-07/EXPERIENCE.md'
  - '{project-root}/_bmad-output/specs/spec-nist-800-53-browser/SPEC.md'
  - '{project-root}/src/content.config.ts'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Goal A's ingestion pipeline produced 1,196 committed entries and nobody can read any of them — there is no route, no layout, and no rendering for any of it.

**Approach:** Build the static-only browse surface — a shared layout plus three page types (Home/Family-list, Family, Control Detail) — reading directly from the Content Collections. Zero interactivity in this slice: no search, no baseline filtering, no enhancement expand/collapse island. Those are CAP-5, CAP-2, and CAP-3 respectively, each adding a client island into this layout later without restructuring it.

## Boundaries & Constraints

**Always:**
- All internal links go through `src/utils/url.ts`, never a hardcoded leading-slash path — AD-4's base-path rule (the site deploys to a GitHub Pages project subpath; a hardcoded `/controls/ac-2` 404s in production while working in `astro dev`).
- Every route is statically generated (`getStaticPaths`) — no server, no client fetch (AD-1).
- Withdrawn Controls/Enhancements render with the Withdrawn marker (DESIGN.md), not hidden and not shown as if live — resolved decision, not this spec's to relitigate.
- Enhancements render as static content on their parent Control's page, never their own route (AD-4) — full statement always visible, no collapse/toggle (that's CAP-3).
- ISO Crosswalk section always renders the "No ISO 27001 mapping published for this control." state (EXPERIENCE.md) — no control entry currently carries crosswalk data (CAP-4 unbuilt), so this is the factually correct state for every entry today, not a shortcut.
- Provenance footer (catalog version, crosswalk-not-yet-transcribed) and the disclaimer render on every page via `BaseLayout.astro` (AD-5, AD-7) — one render location, not per-page.
- 404 page (bad slug) follows EXPERIENCE.md's "Not found" state: "Control not found." plus a link home — not a generic framework page.

**Ask First:**
- Any change to which fields the Content Collection schema exposes (that's Goal A's contract).
- Rendering `guidance` (NIST "Discussion" text) — ingested but not required by any of the 6 SPEC.md capabilities; out of scope here unless you want it now.

**Never:**
- No SearchBox or BaselineFilter markup/islands in this slice — CAP-5 and CAP-2 own those; BaseLayout ships only branding + the provenance/disclaimer footer, structured so those capabilities can add a header island later without a rewrite.
- No client-side JS at all in this slice (matches AD-1; nothing here needs it).
- No accounts, no dynamic routes beyond family/control slugs.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Home | `/` | All 20 Families, sorted by `catalogOrder`, each linking to its Family page | N/A |
| Family page | `/families/ac` | AC's Controls in catalog order, each a Control row with Baseline badges (or Withdrawn marker) | N/A |
| Control Detail, live | `/controls/ac-2` | Title, Baseline badges, statement tree, Enhancements listed with their own badges/statements, ISO Crosswalk empty-state | N/A |
| Control Detail, withdrawn, single successor | `/controls/ac-2-10` (AC-2(10)) | Withdrawn marker, "Withdrawn — see AC-2" linking to `/controls/ac-2` | N/A |
| Control Detail, withdrawn, family successor | `/controls/sa-12` | "Withdrawn — see SR" linking to `/families/sr`, not a 404 | N/A |
| Control Detail, withdrawn, multiple successors | `/controls/ac-3-6` | "Withdrawn — see MP-4, SC-28", both real links | N/A |
| Control Detail, withdrawn, no successor | `/controls/cp-10-3` | "Withdrawn" alone; statement still shown (NIST kept one) | N/A |
| Deep statement nesting | `ac-2` statement (prose + children on the same node) | Nested prose renders in order, not flattened | N/A |
| Unresolvable param placeholder | `{{ insert: param, ... }}` with no matching param | Renders the raw placeholder text verbatim (AD-5) | N/A |
| Bad slug | `/controls/xx-99` | 404 page: "Control not found." + link home | Astro's static 404, not a crash |
| Deployed base path | any route, once deployed | Every link resolves under `/NIST-800-53-browser/...`, not the domain root | N/A |

</frozen-after-approval>

## Code Map

- `src/content.config.ts` -- read-only. `controls` (id, slug, label, kind, parentSlug, enhancementSlugs, title, familyCode, sortId, withdrawn, incorporatedInto, baselines, statement, guidance, params, related), `families` (slug, catalogOrder, code, name, controlSlugs, controlCount, enhancementCount), `meta` (catalogTitle, catalogVersion, oscalVersion, lastModified, crosswalkTranscribedAt, counts, baselineCounts).
- `src/content/{controls,families,meta}/*.json` -- read-only, committed (Goal A output). 324 `kind:"control"` + 872 `kind:"enhancement"` + 20 families + 1 `meta/provenance.json`.
- `_bmad-output/planning-artifacts/ux-designs/ux-BMad-2026-09-07/DESIGN.md` -- tokens: `colors.{surface-base,surface-raised,surface-overlay,ink-primary,ink-secondary,accent,baseline-*}`, `typography.{heading,body,meta,mono}`, `rounded.{sm,md,full}`, `spacing.1-7`, `components.{control-row,baseline-badge,withdrawn-marker,control-detail-card,provenance-footer}`.
- `_bmad-output/planning-artifacts/ux-designs/ux-BMad-2026-09-07/EXPERIENCE.md` -- IA table, Voice and Tone (disclaimer register text, "not found" copy), State Patterns.
- `astro.config.mjs` -- existing; `site`/`base` already set for the GitHub Pages project path. No change expected.
- `src/pages/index.astro` -- REPLACE (currently a scaffold placeholder).
- `src/utils/url.ts`, `src/layouts/BaseLayout.astro`, `src/pages/families/[slug].astro`, `src/pages/controls/[slug].astro`, `src/pages/404.astro` -- CREATE.
- `src/components/{FamilyRow,ControlRow,BaselineBadge,WithdrawnMarker,StatementTree,EnhancementItem,ProvenanceFooter}.astro` -- CREATE.

Withdrawn successor resolution note: `incorporatedInto` slugs resolve against **either** the `controls` collection **or** the `families` collection (the `sa-12 -> sr` exception) -- check both, never assume one.

## Tasks & Acceptance

**Execution:**
- [ ] `src/utils/url.ts` -- export `homeUrl()`, `familyUrl(slug)`, `controlUrl(slug)` built from `import.meta.env.BASE_URL` -- one base-aware link builder, per AD-4, so no page hand-rolls a path.
- [ ] `src/components/ProvenanceFooter.astro` -- reads the `meta` singleton (`getEntry('meta', 'provenance')`), renders catalog version + "crosswalk not yet published" + the disclaimer sentence from EXPERIENCE.md's Voice and Tone table verbatim -- resolves PRD Open Question 2 with the already-drafted register text.
- [ ] `src/layouts/BaseLayout.astro` -- page shell: `<head>` (title, viewport, dark-mode-only -- no `prefers-color-scheme` branch), site title linking to `homeUrl()`, `<slot />`, `ProvenanceFooter` -- the one render location for provenance/disclaimer (AD-5).
- [ ] `src/components/BaselineBadge.astro` + `src/components/WithdrawnMarker.astro` -- per DESIGN.md tokens; `WithdrawnMarker` resolves each `incorporatedInto` slug against `controls` then `families`, comma-joins multiple, renders "Withdrawn" alone when empty.
- [ ] `src/components/FamilyRow.astro` -- code, name, control count, link via `familyUrl()`.
- [ ] `src/components/ControlRow.astro` -- mono ID, title, `BaselineBadge`s or `WithdrawnMarker`, link via `controlUrl()`; withdrawn rows render `ink-secondary` title per DESIGN.md.
- [ ] `src/components/StatementTree.astro` -- recursive: label + prose, then children, matching Goal A's `{label, prose, children}` shape exactly (order preserved, AD-5).
- [ ] `src/components/EnhancementItem.astro` -- mono ID, title, its own `BaselineBadge`s/`WithdrawnMarker`, full `StatementTree` always visible (no toggle in this slice).
- [ ] `src/pages/index.astro` -- REPLACE placeholder: `getCollection('families')` sorted by `catalogOrder`, `FamilyRow` per family, inside `BaseLayout`.
- [ ] `src/pages/families/[slug].astro` -- `getStaticPaths` from `families`; per family, resolve `controlSlugs` to entries preserving order, `ControlRow` per control.
- [ ] `src/pages/controls/[slug].astro` -- `getStaticPaths` from `controls` filtered to `kind === 'control'` (enhancements never get their own route); title, badges/marker, `StatementTree`, resolved `EnhancementItem`s, ISO Crosswalk empty-state.
- [ ] `src/pages/404.astro` -- "Control not found." + link via `homeUrl()`.
- [ ] `npm run build` -- confirms all family/control routes generate with zero errors (1 home + 20 families + 324 controls = 345 pages; 872 enhancements are never separate routes).

**Acceptance Criteria:**
- Given a clean build, when it completes, then exactly 345 HTML pages exist under `dist/` for family/control/home routes, plus the 404 page -- 872 enhancements are never separate pages.
- Given any generated `<a href>` to an internal route, when inspected, then it starts with the deployed base path, never a bare `/controls/...`.
- Given AC-2(10) (a withdrawn enhancement) rendered inside its parent `/controls/ac-2` page, when inspected, then its own Enhancement row shows the Withdrawn marker and "Withdrawn — see AC-2".
- Given `/controls/sa-12`, when rendered, then its successor link points at `/families/sr` and renders without error (the one incorporatedInto target that isn't a control).
- Given `/controls/does-not-exist`, when requested, then the 404 page renders "Control not found." with a working link to Home.
- Given any Control's statement, when rendered, then unresolvable `{{ insert: param, ... }}` placeholders appear verbatim, never resolved or stripped.
- Given the provenance footer on any page, when inspected, then it names the catalog version and does not claim a crosswalk transcription date exists.

## Design Notes

`StatementTree` recursion mirrors Goal A's shape exactly:

```astro
---
// src/components/StatementTree.astro
const { nodes } = Astro.props; // { label: string|null, prose: string|null, children: [...] }[]
---
{nodes.map((n) => (
  <div>
    {n.prose && <p>{n.label ? `${n.label} ` : ''}{n.prose}</p>}
    {n.children.length > 0 && <StatementTree nodes={n.children} />}
  </div>
))}
```

Successor resolution (used by `WithdrawnMarker`) checks both collections because of the one `sa-12 -> sr` exception:

```ts
const control = await getEntry('controls', targetSlug);
const target = control ?? (await getEntry('families', targetSlug));
const label = control ? control.data.label : target?.data.code;
const url = control ? controlUrl(targetSlug) : familyUrl(targetSlug);
```

## Verification

**Commands:**
- `npm run build` -- expected: zero errors, 345 static pages + 404 generated.
- Manual: open `dist/controls/sa-12/index.html`, `dist/controls/ac-3-6/index.html`, `dist/controls/cp-10-3/index.html` -- confirms the three withdrawn edge cases (family successor, multi-successor, no-successor) render correctly.
- Manual: grep the built HTML for a bare `href="/controls` or `href="/families` (missing base path) -- expected: zero matches.

**Manual checks (if no CLI):**
- Load `dist/index.html`, click through Home -> a Family -> a Control with Enhancements -> confirm every hop works and every Enhancement's full text is visible without JS.

## Suggested Review Order

**Base-path link builder (AD-4)**

- Entry point: every internal link routes through here; `BASE_URL` is not guaranteed to end in `/`, so this strips a trailing slash and each builder owns its own separator — a real bug caught during build verification (first build produced `href="/NIST-800-53-browserfamilies/sr/"`).
  [`url.ts:19`](../../src/utils/url.ts#L19)

- The one page shell; ships branding + provenance footer only, no SearchBox/BaselineFilter (those are CAP-5/CAP-2's job later).
  [`BaseLayout.astro:1`](../../src/layouts/BaseLayout.astro#L1)

- Accessibility Floor's focus-visible ring, added after review flagged it as spec-mandated ("not optional") and missing from the first pass.
  [`BaseLayout.astro:85`](../../src/layouts/BaseLayout.astro#L85)

**Withdrawn-control successor resolution**

- Checks `controls` then `families` because of the one `sa-12 -> sr` exception (a whole Family named as a Control's successor) — verified against the real fixture in the build output.
  [`WithdrawnMarker.astro:21`](../../src/components/WithdrawnMarker.astro#L21)

- Renders the "Withdrawn" pill and, on Control Detail, the "Withdrawn — see {label}" successor line or "Withdrawn" alone when there's no successor.
  [`WithdrawnMarker.astro:1`](../../src/components/WithdrawnMarker.astro#L1)

**Content fidelity (AD-5)**

- Recursive statement render; fixed post-review to show a node's label even when it has no prose (label-only structural nodes were silently dropped before this fix).
  [`StatementTree.astro:21`](../../src/components/StatementTree.astro#L21)

- Enhancements never get their own route — filtered out of `getStaticPaths` here, rendered as static fragments on the parent Control page instead.
  [`controls/[slug].astro:14`](../../src/pages/controls/%5Bslug%5D.astro#L14)

**Empty-baseline handling (591 real entries affected)**

- Added post-review: a live (non-withdrawn) entry with zero Baseline memberships previously rendered a blank badge slot with no indicator.
  [`ControlRow.astro:30`](../../src/components/ControlRow.astro#L30)

- Same fix applied to Enhancement rows, where the case is far more common (most Enhancements aren't in any baseline).
  [`EnhancementItem.astro:40`](../../src/components/EnhancementItem.astro#L40)

**Pages**

- Home: all 20 Families sorted by `catalogOrder`.
  [`index.astro:1`](../../src/pages/index.astro#L1)

- Family page: resolves `controlSlugs` to entries in catalog order.
  [`families/[slug].astro:1`](../../src/pages/families/%5Bslug%5D.astro#L1)

- Control Detail: statement, resolved Enhancements, and the always-empty ISO Crosswalk state (no control carries crosswalk data yet — CAP-4 unbuilt).
  [`controls/[slug].astro:1`](../../src/pages/controls/%5Bslug%5D.astro#L1)

- 404: EXPERIENCE.md's "Control not found." state, not a generic framework page.
  [`404.astro:1`](../../src/pages/404.astro#L1)

**Peripherals**

- Provenance/disclaimer footer — the one render location (AD-5), reads the `meta` singleton and hard-throws if it's missing (an ingestion-pipeline failure, not a state to degrade through).
  [`ProvenanceFooter.astro:1`](../../src/components/ProvenanceFooter.astro#L1)

- Baseline pill styling; added a fallback label for an unrecognized baseline value as defensive hardening.
  [`BaselineBadge.astro:1`](../../src/components/BaselineBadge.astro#L1)

- Family list row.
  [`FamilyRow.astro:1`](../../src/components/FamilyRow.astro#L1)
