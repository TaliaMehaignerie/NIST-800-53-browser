---
title: 'CAP-5: Search'
type: 'feature'
created: '2026-09-17'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'cbafcb62148d499d22ffc50c9c04e352758055ba'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-08-20/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-BMad-2026-09-07/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-BMad-2026-09-07/EXPERIENCE.md'
  - '{project-root}/_bmad-output/specs/spec-nist-800-53-browser/SPEC.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-baseline-filter.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The site has no search — every other capability (browse, filter, expand, crosswalk) is now built, but a user must already know which Family a Control lives in to find it. Pagefind's build-time index already exists (`npm run build` produces `dist/pagefind/`) but nothing reads it.

**Approach:** A global `SearchBox` mounted in `BaseLayout`'s header (AD-7) plus a new `/search` page. On any page other than `/search`, the box is a plain HTML form — zero JS, a normal full-page GET navigation to `/search?q=…` (AD-3, matches AD-1's zero-JS-by-default posture: no JS is needed for this case at all). On `/search` itself, a small script intercepts input, queries Pagefind's JS API client-side, and live-updates the result list plus `?q=` via the existing `setUrlState()` helper (reused from CAP-2, `replaceState`, no reload).

**Resolved ambiguity — result granularity:** `mockups/key-search.html` shows an Enhancement (`AC-2(1)`) as its own result row, but PRD FR-5's binding consequence only requires "Searching 'AC-2' ... surface AC-2 ... reach the matching Control Detail Page directly" — Control-level, not Enhancement-level. Pagefind's default indexing returns whole-page results; giving Enhancements their own sub-results would require semantic heading markup in `EnhancementItem` (currently a `<div>`, added in CAP-3) plus `data-pagefind-meta` wiring for the mockup's Baseline badge per row — real, deferred work, not required by the binding spec. This build ships Control (and Family) page results only, no Baseline badge per row; the mockup's Enhancement-row/badge detail is logged to `deferred-work.md` as a v2 polish item, matching how this project has repeatedly resolved mockup/binding-spec gaps elsewhere.

**Resolved ambiguity — indexing scope:** the current build log reports "Did not find a data-pagefind-body element on the site ↳ Indexing all `<body>` elements," meaning Pagefind currently indexes the header/footer chrome (nav links, the disclaimer, provenance text) on every page, polluting every search result's relevance. `BaseLayout.astro`'s `<main>` gets `data-pagefind-body` so only actual page content — Family names, Control titles/statements, crosswalk codes — is indexed.

## Boundaries & Constraints

**Always:**
- `SearchBox` is a plain `<form method="get" action={searchUrl()}>` with a single `<input name="q">` on every page except `/search` — no JavaScript required for that path (AD-1). Submitting performs a normal full-page navigation.
- On `/search` only, a script hydrates the same form: prevents the default GET submit, queries Pagefind's JS API (`{BASE_URL}pagefind/pagefind.js`, dynamically imported, base-path-aware per AD-4 — never the astro-pagefind integration, which the architecture spine already ruled out) on every input change, and writes `?q=` via `setUrlState()` using `replaceState` (AD-3) — matches CAP-2/CAP-3's existing pattern exactly, no new URL-state mechanism.
- `/search?q=…` loaded cold (i.e. arriving via the plain-form navigation from any other page) must show results immediately on load, not just after the user types again — read `?q=` on page load, populate the input, and run one initial query.
- Result rows: mono id + title, linking via the existing `familyUrl()`/`controlUrl()` helpers (`src/utils/url.ts`) — no new link-building logic. A "{n} matches" count line above the list (EXPERIENCE.md/mockup). Loading state is plain "Searching…" text, no spinner (EXPERIENCE.md State Patterns). Empty state is exactly `No controls match "{query}".` (EXPERIENCE.md, verbatim).
- `BaseLayout.astro`'s `<main>` gets `data-pagefind-body` so only real page content is indexed, not header/footer chrome.
- `BaselineFilter` renders present-but-inert on `/search` at `{components.baseline-filter.opacityInert}` (45%) per DESIGN.md's explicit carve-out — it already has nothing to filter there (no `[data-baselines]` rows on this page), this only adds the visual dimming. Implemented via a `filterInert` boolean prop on `BaseLayout`, set only by `search.astro`.
- Keyboard/Accessibility Floor: the search input is a native `<input>` (keyboard-native for free); result rows are native `<a>` links (same).

**Ask First:**
- Whether to tighten Pagefind's default fuzzy/typo-tolerant matching toward PRD's "plain substring is sufficient" framing (PRD Open Question 3, still explicitly unreconciled in the architecture spine's own Deferred list) — ship with Pagefind's default matching behavior first, then flag if results read noisier than expected once real queries are tried.

**Never:**
- No Enhancement-level sub-results or per-row Baseline badges in this slice (resolved ambiguity above — logged to `deferred-work.md`).
- No `astro-pagefind` integration or Pagefind's prebuilt UI widget (`pagefind-ui.js`) — the architecture spine already ruled this out; `SearchBox` talks to Pagefind's raw JS API directly.
- No changes to `BaselineFilter`'s or `EnhancementItem`'s functional behavior — `filterInert` is presentation-only.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Submit from Home/Family/Control page | Type "account" in the header SearchBox, press Enter | Full-page navigation to `/search?q=account` (plain GET, zero JS) | N/A |
| `/search?q=account` cold load | Navigate directly to this URL | Input pre-filled with "account", results render immediately without further typing, showing AC-2/AC-2's title text match at minimum | N/A |
| Typing on `/search` | Already on `/search`, user types "au-2" | Result list updates in place via Pagefind, `?q=au-2` written via `replaceState`, no reload | N/A |
| No matches | Query "xyz123" | Empty state: `No controls match "xyz123".` | N/A |
| Empty query | `/search` with no `?q=` and nothing typed | No result list, no result count, no "no matches" text either (nothing entered yet — distinct from a real empty-results state) | N/A |
| Baseline filter on `/search` | Any state | Renders at 45% opacity, clickable but has nothing to filter (no `[data-baselines]` rows on this page) | N/A |
| Index not yet built (`npm run dev`, no prior `npm run build`) | `/pagefind/pagefind.js` doesn't exist yet | Documented as a known local-dev limitation in Verification -- not a runtime bug to fix, Pagefind's index is build-time-only by design (AD-1) | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/url.ts` -- MODIFY: add `searchUrl()` alongside the existing `homeUrl()`/`familyUrl()`/`controlUrl()`, same base-aware pattern.
- `src/layouts/BaseLayout.astro` -- MODIFY: mount `<SearchBox />` in the header, add `data-pagefind-body` to `<main>`, add an optional `filterInert` prop passed through to `<BaselineFilter inert={filterInert} />`.
- `src/components/BaselineFilter.astro` -- MODIFY: accept an `inert?: boolean` prop; when true, render the existing `.baseline-filter` wrapper with `opacity: 0.45` (DESIGN.md's `opacityInert` token) -- presentation only, no change to its filtering script.
- `src/components/SearchBox.astro` -- CREATE: the form described in Boundaries. Plain HTML everywhere; the live-query script only runs when `window.location.pathname` matches the search route (checked once at hydration, not per-page-type prop threading, since the component is mounted identically on every page via `BaseLayout`).
- `src/pages/search.astro` -- CREATE: `<BaseLayout filterInert>` wrapping a results container. Reads `?q=` server-side only to pre-fill the input's initial HTML value (no server-side search execution -- AD-1, everything after that is client-side Pagefind).
- `src/content.config.ts` -- read-only; no schema changes needed (search reads indexed HTML, not the Content Collection, at runtime).

## Tasks & Acceptance

**Execution:**
- [x] `src/utils/url.ts` -- add `searchUrl()`.
- [x] `src/components/BaselineFilter.astro` -- add the `inert` prop and its opacity styling.
- [x] `src/layouts/BaseLayout.astro` -- mount `<SearchBox />`, add `data-pagefind-body` to `<main>`, thread `filterInert` through to `BaselineFilter`.
- [x] `src/components/SearchBox.astro` -- plain-form markup + the `/search`-only live-query script (Pagefind init, query-on-input, `setUrlState({ search: { q } })`).
- [x] `src/pages/search.astro` -- page shell, initial `?q=` prefill, result list/count/loading/empty states.
- [x] `npm run build` -- confirms all pages (now 347: the prior 346 + `/search`) build with zero errors and the Pagefind index regenerates.

**Acceptance Criteria:**
- Given any non-`/search` page, when the user types a query into the header SearchBox and presses Enter, then the browser performs a full-page navigation to `/search?q=<query>` with zero JavaScript involved in that step.
- Given `/search?q=account` loaded cold, when the page finishes loading, then the input shows "account" and at least AC-2 appears in the results without any further user action.
- Given the user is already on `/search` and types a new query, when the list updates, then no full-page reload occurs and `location.search` reflects the new `q` via `replaceState`.
- Given a query with zero matches, when results render, then the exact text `No controls match "xyz123".` appears (verbatim, per EXPERIENCE.md).
- Given `/search`, when inspected, then the Baseline filter is visibly present but rendered at reduced opacity, and no other page shows this reduced-opacity treatment.
- Given `npm run build`, when it completes, then `dist/search/index.html` exists and the Pagefind index still builds successfully afterward (order in `package.json`'s `build` script already runs `astro build` before `pagefind --site dist`, so `/search`'s own static HTML is indexed like any other page -- confirm its indexed content doesn't create a self-referential noise problem, i.e. the search page's own "type to search" placeholder text shouldn't itself become a false-positive match target).

## Design Notes

`SearchBox`'s live-query script (only active on `/search`):

```js
import { setUrlState } from '../utils/urlState';

const isSearchPage = window.location.pathname.endsWith('/search') || window.location.pathname.endsWith('/search/');
if (isSearchPage) {
  const input = document.querySelector('.search-box__input');
  const pagefind = await import(`${import.meta.env.BASE_URL}pagefind/pagefind.js`);
  await pagefind.init();

  async function runQuery(query) {
    if (!query) { /* render nothing-entered-yet state */ return; }
    const search = await pagefind.search(query);
    const results = await Promise.all(search.results.map((r) => r.data()));
    // render results (url, meta.title) into the results container
  }

  const initialQuery = new URLSearchParams(window.location.search).get('q') ?? '';
  input.value = initialQuery;
  if (initialQuery) runQuery(initialQuery);

  input.addEventListener('input', () => {
    setUrlState({ search: { q: input.value || null } });
    runQuery(input.value);
  });
}
```

`BaseLayout`'s `<main data-pagefind-body>` -- the one line closing the "indexing all `<body>` elements" gap noted in Intent.

## Verification

**Commands:**
- `npm run build` -- expected: zero errors, 347 pages (346 existing + `/search`), Pagefind index regenerates and now excludes header/footer chrome from indexed content (spot-check: search for a word that only appears in the provenance footer/disclaimer and confirm it doesn't match every page).

**Manual checks (requires a build, not `npm run dev` -- Pagefind's index is build-time only):**
- `npm run build && npm run preview`, type "account" into the header SearchBox from Home, press Enter -- confirm full-page navigation to `/search?q=account` and results appear.
- On `/search`, clear the box and type "xyz123" -- confirm the exact empty-state text appears with no reload.
- Load `/search?q=au-2` directly (paste the URL) -- confirm results appear without typing anything first.
- Visually compare `/search`'s Baseline filter opacity against any other page's.

## Suggested Review Order

**Live-query script (the entry point)**

- `queryToken`, added post-review to guard against out-of-order async results — a fast keystroke firing a second query before the first resolves could otherwise overwrite the list with stale results.
  [`SearchBox.astro:162`](../../src/components/SearchBox.astro#L162)

- Debounce + query-run, both added post-review: `queueQuery()` writes `?q=` immediately but delays the actual Pagefind call by 150ms, and the input is prefilled *before* the async Pagefind load starts — a real bug found in review where typing during that load window could get silently overwritten once init resolved.
  [`SearchBox.astro:208`](../../src/components/SearchBox.astro#L208)

- Two `catch` blocks added post-review around Pagefind's async init and each search call — previously an unhandled rejection (e.g. `npm run dev` with no prior build) left the box silently non-functional with no signal to the user.
  [`SearchBox.astro:176`](../../src/components/SearchBox.astro#L176), [`SearchBox.astro:229`](../../src/components/SearchBox.astro#L229)

**Zero-JS submit path**

- `preventDefault()` on the form's `submit` event, added post-review — without it, pressing Enter on `/search` still triggered a full native reload of the page JS had already live-updated, directly contradicting AD-3's "no reload once already on /search."
  [`SearchBox.astro:85`](../../src/components/SearchBox.astro#L85)

**Indexing scope**

- `data-pagefind-ignore` on `/search`'s own content, added post-review — confirmed via a decompressed fragment inspection that the page was indexing its own "Search" heading; `classify()` already filtered it from rendered results, but this keeps the index itself clean (347 indexed pages → 346).
  [`search.astro:14`](../../src/pages/search.astro#L14)

**Peripherals**

- `--opacity-inert` token added post-review, replacing a hardcoded `0.45` that broke from this codebase's otherwise-consistent `var(--color-...)` token pattern.
  [`BaseLayout.astro:70`](../../src/layouts/BaseLayout.astro#L70)
