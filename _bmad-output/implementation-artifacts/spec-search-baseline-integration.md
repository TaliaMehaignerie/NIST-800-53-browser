---
title: 'Hide Baseline filter where inert; make it functional on /search'
type: 'feature'
created: '2026-09-17'
status: 'done'
review_loop_iteration: 0
baseline_commit: '0f48e5385b2beaf9790da820cdf93e2145b41d00'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-08-20/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-BMad-2026-09-07/DESIGN.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-baseline-filter.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-search.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The Baseline filter renders on Home even though Home has no `[data-baselines]` rows to filter (user-reported: "appear on the home page, but don't do anything"). Separately, it renders present-but-dimmed on `/search` per an earlier DESIGN.md decision, but doesn't actually filter search results either — the user asked for that to become real functionality instead (filter/sort results by Baseline, show each result's Baseline badge), superseding the original "dim it" carve-out.

**Approach:** Two changes. (1) `BaselineFilter` no longer renders at all on Home — it only mounts on pages where it has something to act on: Family Detail, Control Detail, and now `/search`. (2) On `/search`, wire it to Pagefind's native filter facility: Control/Family pages gain `data-pagefind-filter`/`data-pagefind-meta` attributes carrying their Baseline membership, `BaselineFilter`'s existing click handler dispatches a small custom event, and `SearchBox` listens for it to re-run the current query with `pagefind.search(query, { filters: { baseline: [...] } })` — re-using the exact same `?baseline=` URL state already shared with Family/Control pages (AD-3), so a filtered search is itself a deep-linkable URL like everywhere else in the app.

## Boundaries & Constraints

**Always:**
- `BaseLayout` stops mounting `BaselineFilter` unconditionally — it becomes opt-in per page (a `showBaselineFilter` prop), set by `families/[slug].astro`, `controls/[slug].astro`, and `search.astro` only. Home (`index.astro`) does not set it and gets no filter markup at all.
- `BaselineFilter`'s `inert` prop and its 45%-opacity styling are removed entirely — no page shows a dimmed, functionally-dead filter anymore; every page that shows it, it works.
- Control pages (`controls/[slug].astro`) gain `data-pagefind-filter="baseline:{b}"` (one per Baseline the Control belongs to) and `data-pagefind-meta="baselines:{comma-joined list}"` on an already-indexed element (the `<h1>`) — no new visible markup, pure data attributes. A withdrawn or unassigned Control (empty `baselines`) gets neither attribute, so it never matches a specific Baseline filter on `/search` — matches the existing DOM-filter behavior on Family/Control pages exactly (empty `data-baselines` never matches a specific filter).
- Family pages get no Baseline filter/meta attributes — Families aren't Baseline-tagged entities (only Controls/Enhancements are, AD-2). A Family result on `/search` shows no Baseline badge and, like an unassigned Control, disappears from results whenever a specific Baseline filter is active (only "All" shows Family results) — this is a real, accepted consequence of Families having no Baseline axis, not a bug to work around.
- `BaselineFilter`'s click handler gains one addition: dispatch a `CustomEvent('baselinefilterchange', { detail: { baseline } })` on `window` after its existing `applyFilter()`/`updateLinks()` calls — a decoupled signal `SearchBox` can listen for without `BaselineFilter` needing to know `SearchBox` exists. No change to `BaselineFilter`'s existing behavior on Family/Control pages.
- `SearchBox`'s live-query script, on `/search` only: reads `?baseline=` (same `setUrlState()`-shared param, AD-3) on every `runQuery()` call and passes it as Pagefind's `filters: { baseline: [value] }` search option when set; listens for `baselinefilterchange` and re-runs the current query when it fires; a cold `/search?q=…&baseline=…` load applies both immediately.
- Each rendered search result row shows its Baseline badge(s) (or nothing, for a Family or an unassigned/withdrawn Control) sourced from Pagefind's per-result `meta.baselines`, styled to match `BaselineBadge.astro`'s existing look. Since `/search`'s page tree never renders the actual `BaselineBadge` component, its scoped CSS isn't bundled there — duplicate the small, stable set of color rules as global CSS in `search.astro` rather than force-rendering the component to pull its styles in.
- The result count text ("{n} matches") reflects the post-filter count, matching how it already reflects the post-query count.

**Ask First:**
- Nothing anticipated — Pagefind's filter API is well-documented and the `?baseline=` URL-state convention already exists; no new architectural decisions.

**Never:**
- No changes to how Family/Control pages' own DOM-based `[data-baselines]` filtering works (`applyFilter`/`updateLinks` in `BaselineFilter.astro`) — `/search` uses a second, Pagefind-native filtering path, not a retrofit of the DOM approach (results aren't static DOM rows there).
- No Enhancement-level search results or filtering (still out of scope per `spec-search.md`'s existing resolved ambiguity).
- No new page routes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Home | Any load | No Baseline filter renders anywhere on the page | N/A |
| Family Detail | Any load | Baseline filter renders and filters exactly as before (unchanged) | N/A |
| Control Detail | Any load | Baseline filter renders and filters Enhancement rows exactly as before (unchanged) | N/A |
| `/search`, filter click | Query "account" active, click "Moderate" | Results re-query via Pagefind with the Moderate filter, `?baseline=moderate` written, only Moderate-baseline Controls remain | N/A |
| `/search`, cold load with both params | `/search?q=account&baseline=moderate` | Both apply immediately on load — filtered, queried results with no further user action | N/A |
| `/search`, Family result under a filter | Query "access" (matches "Access Control" family + several Controls), filter = "High" | The Family result disappears (no Baseline data to match); matching High-baseline Controls remain | N/A |
| `/search`, unassigned/withdrawn Control under a filter | Query matches e.g. `sa-20` (no baseline) or `ac-13` (withdrawn), filter = any specific Baseline | That Control disappears from results, same as "All" being the only state it appears in | N/A |
| `/search`, result badges | Any result with Baseline membership | Each result row shows its Baseline badge(s), matching `BaselineBadge.astro`'s visual style | N/A |
| `/search`, filter = All | Default/cleared | Unfiltered query, same as current behavior before this change | N/A |

</frozen-after-approval>

## Code Map

- `src/layouts/BaseLayout.astro` -- MODIFY: replace the `filterInert`/unconditional-mount pattern with a `showBaselineFilter?: boolean` prop; only render `<BaselineFilter />` when true. `SearchBox` mounting is unaffected (still every page).
- `src/pages/index.astro` -- read-only; does not set `showBaselineFilter`, so it now renders no filter.
- `src/pages/families/[slug].astro` -- MODIFY: pass `showBaselineFilter` to `BaseLayout`.
- `src/pages/controls/[slug].astro` -- MODIFY: pass `showBaselineFilter` to `BaseLayout`; add `data-pagefind-filter`/`data-pagefind-meta` attributes to the `<h1>`, derived from the already-destructured `baselines` array.
- `src/pages/search.astro` -- MODIFY: pass `showBaselineFilter` to `BaseLayout` (replacing the old `filterInert`); add the Baseline-badge CSS (duplicated from `BaselineBadge.astro`) for result rows.
- `src/components/BaselineFilter.astro` -- MODIFY: remove the `inert` prop and its opacity CSS entirely; add the `baselinefilterchange` `CustomEvent` dispatch after each click's existing `applyFilter()`/`updateLinks()` calls.
- `src/components/SearchBox.astro` -- MODIFY: read `?baseline=` per query, pass Pagefind's `filters` search option, listen for `baselinefilterchange`, extend `renderResults()` to render Baseline badges from `meta.baselines`.
- `src/components/BaselineBadge.astro` -- read-only reference for the color/shape rules to duplicate into `search.astro`'s global styles.

## Tasks & Acceptance

**Execution:**
- [x] `src/layouts/BaseLayout.astro` -- `showBaselineFilter` prop replacing unconditional mount + the old `filterInert`.
- [x] `src/pages/index.astro` -- confirm no filter renders (no code change needed, just verify).
- [x] `src/pages/families/[slug].astro`, `src/pages/controls/[slug].astro` -- pass `showBaselineFilter`.
- [x] `src/pages/controls/[slug].astro` -- add `data-pagefind-filter`/`data-pagefind-meta` to `<h1>`.
- [x] `src/components/BaselineFilter.astro` -- remove `inert`, add `baselinefilterchange` event dispatch.
- [x] `src/pages/search.astro` -- pass `showBaselineFilter`, add duplicated Baseline-badge CSS.
- [x] `src/components/SearchBox.astro` -- read `?baseline=`, apply as a Pagefind filter, listen for `baselinefilterchange`, render badges per result.
- [x] `npm run build` -- confirms all pages build with zero errors and the Pagefind index includes the new filter/meta data.

**Acceptance Criteria:**
- Given Home, when inspected, then no Baseline filter markup exists anywhere on the page.
- Given `/search?q=account`, when the user clicks "Moderate", then results re-query and narrow to Moderate-baseline Controls, with `?baseline=moderate` in the URL.
- Given `/search?q=account&baseline=moderate` loaded cold, when the page finishes loading, then results are already filtered and queried with no further action.
- Given a search result for a Control with Baseline membership, when rendered, then its Baseline badge(s) appear on that result row.
- Given a search result for a Family, or an unassigned/withdrawn Control, when a specific Baseline filter is active, then that result does not appear.
- Given Family Detail and Control Detail pages, when inspected, then the Baseline filter still renders and filters exactly as before this change (no regression).

## Design Notes

`controls/[slug].astro`'s `<h1>` gains (baselines already destructured from `control.data`):

```astro
<h1
  data-pagefind-filter={baselines.length > 0 ? `baseline:${baselines.join(',')}` : undefined}
  data-pagefind-meta={baselines.length > 0 ? `baselines:${baselines.join(',')}` : undefined}
>{label} {title}</h1>
```

`BaselineFilter`'s click handler, appended after its existing `setUrlState`/`markActivePill`/`applyFilter`/`updateLinks` calls:

```js
window.dispatchEvent(new CustomEvent('baselinefilterchange', { detail: { baseline: next } }));
```

`SearchBox`'s `runQuery()` reads the filter and passes it through:

```js
function currentBaselineFilter(): string | null {
  return new URLSearchParams(window.location.search).get('baseline');
}

async function runQuery(rawQuery: string) {
  // ...existing token/empty-query handling...
  const baseline = currentBaselineFilter();
  const search = await pagefind.search(query, baseline ? { filters: { baseline: [baseline] } } : undefined);
  // ...existing result mapping, plus reading r.meta.baselines (comma string) into a badge list per row...
}

window.addEventListener('baselinefilterchange', () => runQuery(input.value));
```

## Verification

**Commands:**
- `npm run build` -- expected: zero errors; spot-check `dist/pagefind/` output or a live query confirms Baseline-filtered results.

**Manual checks (requires a build, not `npm run dev`):**
- `npm run build && npm run preview` -- confirm Home shows no filter at all.
- On `/search`, search "account", click through each Baseline pill -- confirm results narrow correctly and badges appear per result.
- Load `/search?q=account&baseline=moderate` directly -- confirm both apply on cold load.
- Spot-check Family Detail and Control Detail still filter exactly as before.

## Suggested Review Order

**The Pagefind filter-syntax bug (found and fixed during implementation, before review)**

- `data-pagefind-filter` takes exactly one `key:value` pair per element -- it splits on the first colon and treats everything after as the literal value, commas included. The original comma-joined `baseline:low,moderate,high` produced one bogus combined-string facet value per Control instead of three independent ones (confirmed empirically via `pagefind.filters()` -- moderate-filtered "account" went from 0 results to the correct 23 once fixed to one element per value).
  [`controls/[slug].astro:65`](../../src/pages/controls/%5Bslug%5D.astro#L65)

**The critical review-round fix: Baseline filter dropped on result navigation**

- All three review layers independently converged on this: `renderResults()` rebuilt result `<a>` elements on every query/filter change, and `BaselineFilter`'s one-time `updateLinks()` pass could never keep up with a list that gets replaced out from under it. Every result link now carries the active `?baseline=` itself at creation time.
  [`SearchBox.astro:181`](../../src/components/SearchBox.astro#L181)

**Other review-round hardening**

- `?baseline=` from the URL is now validated against the pills BaselineFilter actually rendered before being trusted -- a stale/malformed value previously would have asked Pagefind to filter on a facet that was never indexed, silently returning zero results with no explanation.
  [`SearchBox.astro:93`](../../src/components/SearchBox.astro#L93)

- `BASELINE_LABELS` now derives from the rendered pills instead of a second hardcoded low/moderate/high/privacy map -- same derive-don't-duplicate pattern `VALID_BASELINES` already uses.
  [`SearchBox.astro:160`](../../src/components/SearchBox.astro#L160)

- Withdrawn Controls are now explicitly excluded from Pagefind filter/meta emission, even though 0 real Controls currently hit this case (verified) -- keeps search faceting in sync with what the page itself visually shows if that data guarantee ever changes.
  [`controls/[slug].astro:64`](../../src/pages/controls/%5Bslug%5D.astro#L64)

**Peripherals**

- Documented, not code-changed: Family pages intentionally carry no Baseline filter/meta data (Families aren't Baseline-tagged entities).
  [`families/[slug].astro:4`](../../src/pages/families/%5Bslug%5D.astro#L4)
