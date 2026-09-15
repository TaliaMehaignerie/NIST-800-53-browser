---
title: 'CAP-2: Baseline filter'
type: 'feature'
created: '2026-09-15'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'e3a5e75b15829209afa45423216ecdec9eb3e2f3'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-08-20/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-BMad-2026-09-07/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-BMad-2026-09-07/EXPERIENCE.md'
  - '{project-root}/_bmad-output/specs/spec-nist-800-53-browser/SPEC.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-browse-ui.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Goal B's browse UI is fully static — there's no way to narrow a Family or Control Detail page's rows to a single Baseline (Low/Moderate/High/Privacy).

**Approach:** A `BaselineFilter` toggle group, mounted once in `BaseLayout` (AD-7), plus a generic `setUrlState()` helper (AD-3) it uses to write `?baseline=` via `replaceState`. Plain `<script>`, no UI framework — none is installed.

**Resolved ambiguity — filter's scope:** AD-7's `data-baselines` mechanism only applies where AD-2 entries (Controls, Enhancements) are listed — Family Detail (Control rows) and Control Detail (Enhancement rows). Home lists Families, which carry no per-entry Baseline flag, so filtering cannot act there; UJ-1's "every Family's control count narrows in place" is imprecise flavor text (the same category of staleness as the FR-5/CAP-5 language corrected earlier this project), not a binding requirement — PRD FR-2 and SPEC CAP-2 both say "Family/Control lists," and AD-7's literal mechanism can't touch Family rows. `BaselineFilter` still renders active (not inert) on Home so the pill state is visible and persists across navigation (see below); it's inert only on the not-yet-built `/search` page, per DESIGN.md's explicit carve-out.

**Resolved ambiguity — filter persistence across navigation:** UJ-1 describes Priya filtering on Home, then opening a Family and seeing it still filtered. Since this is a static MPA (AD-1, no client router), the only way state survives a full navigation is via the link's query string. `FamilyRow`/`ControlRow` links append the current `?baseline=` (if set) at click time via a small shared script, so the filter carries forward without any schema or server involvement.

## Boundaries & Constraints

**Always:**
- `BaselineFilter` writes through one shared `src/utils/urlState.ts` `setUrlState()` helper using `replaceState`, never `pushState`, merging into `location.search`/`location.hash` without clobbering the piece it doesn't own (AD-3). Build `setUrlState()` generically enough (handles both `search` and `hash` independently) that CAP-3's later Enhancement toggle can reuse it unmodified — but do not build any Enhancement-toggle behavior itself.
- `data-baselines` (space-separated: `low moderate high privacy`, empty string for withdrawn/no-baseline entries) is added to `ControlRow`'s root element, sourced from the existing `baselines: string[]` field — no Content Collection schema change.
- Pre-hydration paint is always the full unfiltered list (EXPERIENCE.md State Patterns: "Pre-hydration filter flash" is accepted as-is for v1).
- On Control Detail, `data-baselines` also goes on `EnhancementItem`'s root element (Enhancements have their own Baseline membership, AD-2) so the filter narrows the Enhancement list too — this is markup-only piggybacking on Goal B's existing static Enhancement rendering; it does not touch CAP-3's still-unbuilt expand/collapse behavior.
- Keyboard: filter pills are reachable and operable via Tab + Enter/Space, with the `{colors.accent}` focus-visible ring already established in `BaseLayout.astro` (Accessibility Floor — not optional per EXPERIENCE.md).
- Withdrawn Controls/Enhancements need no special-case filter logic: their `baselines` array is always empty, so they're hidden under any specific filter and reappear under "All" for free.

**Ask First:**
- Nothing anticipated — no schema changes, no new routes.

**Never:**
- No Enhancement expand/collapse behavior (CAP-3 is a separate, deferred goal — see `deferred-work.md`). Enhancements keep Goal B's current fully-expanded static rendering.
- No new page routes, no `/search` page, no SearchBox markup/behavior (CAP-5 is a separate goal).
- No UI framework dependency added (React/Vue/etc.) — plain `<script>` only, matching the current zero-framework stack.
- `BaselineFilter` never filters `/search` results (out of scope for v1 per DESIGN.md/EXPERIENCE.md; the page doesn't exist yet anyway).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Family Detail, filter click | User clicks "Moderate" on `/families/ac` | Only `[data-baselines]` rows containing `moderate` stay visible; `?baseline=moderate` written via `replaceState` | N/A |
| Family Detail, cold load with query | Load `/families/ac?baseline=high` directly | Filter narrows on load (post-hydration), "High" pill shows active | N/A |
| Clear filter | Click "All" (or the currently-active pill again) | All rows visible again; `?baseline=` removed from URL | N/A |
| Home, filter click | User clicks "Low" on `/` | Pill shows active, `?baseline=low` written; Family rows unaffected (no `data-baselines` there) | N/A |
| Home -> Family navigation with filter active | `?baseline=moderate` active on Home, user clicks a Family row | Landed Family Detail URL carries `?baseline=moderate` and is pre-filtered on load | N/A |
| Control Detail, filter click | `/controls/ac-2?baseline=high` | Only High-baseline Enhancement rows stay visible; the Control's own statement/card is never hidden (only Enhancement rows are) | N/A |
| Withdrawn entry under a filter | Withdrawn Control/Enhancement (`baselines: []`) with any specific filter active | Hidden (empty array matches nothing); reappears under "All" | N/A |
| Keyboard-only use | Tab to a filter pill, press Enter/Space | Same effect as a click; focus-visible accent ring shows throughout | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/url.ts` -- read-only (Goal B). `homeUrl()`/`familyUrl()`/`controlUrl()` unchanged.
- `src/content.config.ts` -- read-only. `baselines: z.array(baseline)` already exists on both Control- and Enhancement-kind entries -- no change.
- `src/layouts/BaseLayout.astro` -- MODIFY: mount `<BaselineFilter />` in the header, after the site title.
- `src/components/ControlRow.astro` -- MODIFY: add `data-baselines={baselines.join(' ')}` on the root `<a>`.
- `src/components/EnhancementItem.astro` -- MODIFY: add `data-baselines={baselines.join(' ')}` on the root element only (no other change -- CAP-3 owns the toggle behavior).
- `src/components/BaselineFilter.astro` -- CREATE: toggle group (All/Low/Moderate/High/Privacy) per `DESIGN.md` -> `components.baseline-filter` and `mockups/key-home.html`'s `.filter-pill`/`.filter-pill.active` styling. Inline `<script>`: read `?baseline=` on load, mark the matching pill active, filter any `[data-baselines]` elements present on the page, append the current baseline to internal `families/`/`controls/` links found in `main`, and on click call `setUrlState()` + re-filter + re-mark active pill.
- `src/utils/urlState.ts` -- CREATE: `setUrlState({ search, hash })` -- merges partial updates into `location.search`/`location.hash` via `history.replaceState`, leaving whichever piece the caller doesn't pass untouched (AD-3). Generic now so CAP-3 can reuse it without modification.

## Tasks & Acceptance

**Execution:**
- [x] `src/utils/urlState.ts` -- `setUrlState()` merging `search`/`hash` independently via `replaceState`, matching AD-3's non-clobbering rule.
- [x] `src/components/BaselineFilter.astro` -- markup + script: read `?baseline=` on load, filter `[data-baselines]` rows, mark active pill, handle clicks, append `?baseline=` to same-content internal links.
- [x] `src/layouts/BaseLayout.astro` -- mount `<BaselineFilter />` in the header.
- [x] `src/components/ControlRow.astro` -- add `data-baselines`.
- [x] `src/components/EnhancementItem.astro` -- add `data-baselines` (markup-only; no toggle behavior).
- [x] `npm run build` -- confirms all 345 pages still build with zero errors; no JS errors possible to catch at build time, so also do the manual checks below.

**Acceptance Criteria:**
- Given `/families/ac?baseline=moderate` loaded cold, when the page finishes loading, then only Moderate-baseline Control rows are visible and the "Moderate" pill shows active.
- Given a Baseline filter is active on Home, when the user clicks a Family row, then the resulting Family Detail page URL carries the same `?baseline=` and is pre-filtered on load.
- Given `/controls/ac-2?baseline=high`, when the page finishes loading, then only High-baseline Enhancement rows stay visible and the Control's statement card is unaffected.
- Given a withdrawn Control or Enhancement under any specific Baseline filter, when the page filters, then it is hidden (empty `baselines` array matches nothing).
- Given keyboard-only navigation, when the user Tabs to a filter pill and presses Enter/Space, then the same effect as a click occurs, with a visible accent focus ring throughout.

## Design Notes

`setUrlState()` shape:

```ts
// src/utils/urlState.ts
export function setUrlState({ search, hash }: { search?: Record<string, string | null>; hash?: string | null }) {
  const url = new URL(window.location.href);
  if (search) {
    for (const [key, value] of Object.entries(search)) {
      if (value === null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
  }
  if (hash !== undefined) {
    url.hash = hash ? `#${hash}` : '';
  }
  window.history.replaceState(null, '', url);
}
```

`BaselineFilter` link-preservation: on script init, `document.querySelectorAll('main a[href*="/families/"], main a[href*="/controls/"]')`, append the active `baseline` param (if set) to each `href` via `URL`/`searchParams`, preserving whatever `href` already had (base path, existing query).

## Verification

**Commands:**
- `npm run build` -- expected: zero errors, all 345 pages + 404 still generated (structure unchanged from Goal B).

**Manual checks:**
- `npm run dev`, open Home, click each filter pill, confirm the pill highlights (visual only -- Home has no rows to hide).
- From Home with "Moderate" active, click into Access Control -- confirm the Family Detail URL carries `?baseline=moderate` and only Moderate rows show.
- Open a Control with Enhancements at different Baselines (e.g. AC-2) with a filter active -- confirm only matching Enhancement rows stay visible.
- Tab through the filter pills with keyboard only -- confirm Enter/Space works and the focus ring is visible.

## Suggested Review Order

**Filter/URL infrastructure**

- Entry point: `setUrlState()` merges `search`/`hash` independently via `replaceState` (AD-3), matching the Design Notes shape exactly.
  [`urlState.ts:15`](../../src/utils/urlState.ts#L15)

- Core filter logic: hides/shows `[data-baselines]` rows and, per-group, toggles a sibling `.baseline-empty-state` message — added post-review after confirming 8 of 20 families (e.g. PM, PT) render a fully empty list under some real filter.
  [`BaselineFilter.astro:87`](../../src/components/BaselineFilter.astro#L87)

- `VALID_BASELINES` derives from the rendered pills instead of a second hardcoded list — a review patch removing a duplication risk flagged independently by two review layers.
  [`BaselineFilter.astro:71`](../../src/components/BaselineFilter.astro#L71)

- `aria-pressed` added to each pill (both the static `false` default and the click-driven update) — the active/inactive state was previously conveyed by CSS class only, with no programmatic signal for assistive tech.
  [`BaselineFilter.astro:26`](../../src/components/BaselineFilter.astro#L26)

**Cross-navigation filter persistence**

- `updateLinks()` appends the active `?baseline=` to in-page Family/Control links so the filter survives a full MPA navigation (AD-1 has no client router) — realizes UJ-1's "still filtered after opening a Family" flow.
  [`BaselineFilter.astro:96`](../../src/components/BaselineFilter.astro#L96)

**Empty-state markup (new, added during review)**

- Family Detail's empty-state paragraph, hidden by default, revealed by `applyFilter()` when a filter matches zero Controls in this family.
  [`families/[slug].astro:38`](../../src/pages/families/%5Bslug%5D.astro#L38)

- Same pattern for Control Detail's Enhancement list, wrapped in `.enhancement-list` so the empty-state element can sit as its sibling.
  [`controls/[slug].astro:65`](../../src/pages/controls/%5Bslug%5D.astro#L65)

**Markup-only row tagging**

- `data-baselines` added to `ControlRow`'s root `<a>`.
  [`ControlRow.astro:21`](../../src/components/ControlRow.astro#L21)

- Same attribute on `EnhancementItem`'s root — markup-only, no toggle behavior (that's CAP-3, deferred).
  [`EnhancementItem.astro:28`](../../src/components/EnhancementItem.astro#L28)

**Peripherals**

- `BaselineFilter` mounted in the header; `.site-title` picked up `display: block` + spacing to sit above it.
  [`BaseLayout.astro:26`](../../src/layouts/BaseLayout.astro#L26)

- `.filter-pill:hover` style added during review for visual consistency with `.control-row:hover` elsewhere in the codebase.
  [`BaselineFilter.astro:50`](../../src/components/BaselineFilter.astro#L50)
