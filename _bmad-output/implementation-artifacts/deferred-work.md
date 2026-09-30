- source_spec: none
  summary: Build the CAP-1 browse UI — BaseLayout.astro global chrome, index.astro family list, families/[slug].astro, and controls/[slug].astro (324 control pages, enhancements inline per AD-4).
  evidence: Split from the CAP-1 intent because the canonical ingestion pipeline (AD-2) it depends on is shared foundation for FR-1 through FR-5, not a CAP-1 implementation detail, and the combined spec exceeded the 900-1600 token scope target. Ingestion sequenced first; this goal is written against the Content Collection schema that spec defines.

- source_spec: `_bmad-output/implementation-artifacts/spec-ingestion-pipeline.md`
  summary: isOscalControlId() accepts zero-padded ids (ac-02.01), which are not real entry ids -- combined with hrefTarget's `_` truncation, a malformed href could theoretically slugify to a dangling reference.
  evidence: Real risk in principle (raised by the blind-hunter review), but --verify's 93 assertions found zero occurrences across the actual catalog; tightening the regex is speculative hardening against a case that has never appeared in NIST's data.

- source_spec: `_bmad-output/implementation-artifacts/spec-ingestion-pipeline.md`
  summary: The provenance singleton records catalogVersion/oscalVersion/lastModified but not which raw files (or their checksums) produced it, so AD-2's byte-reproducibility claim is taken on trust rather than independently verifiable from the committed output alone.
  evidence: Real observability gap (edge-case-hunter), but no capability currently needs it and it adds a field with no consumer -- worth adding if/when the browse UI wants to surface "verified against source" provenance.

- source_spec: `_bmad-output/implementation-artifacts/spec-ingestion-pipeline.md`
  summary: Families carry controlCount/enhancementCount but not withdrawnCount, so a family page showing "25 controls" cannot say how many of those are withdrawn without loading all 25 control entries.
  evidence: Real (blind-hunter) but purely a browse-UI concern -- CAP-1 hasn't been built yet, and it's cheap to add to buildEntry's family aggregation once that UI actually needs the number.

- source_spec: `_bmad-output/implementation-artifacts/spec-ingestion-pipeline.md`
  summary: lastModified is typed and stored as a bare string; the catalog's actual value ("2026-05-11T16:01:09.00000-00:00") has 5-digit fractional seconds and a non-normalized "-00:00" offset that z.string().datetime() would reject, so nothing currently validates it parses as a real timestamp.
  evidence: Real (blind-hunter), but AD-5 only requires the value be rendered verbatim, not parsed -- validating a format the pipeline never parses would be testing a property nothing depends on yet.

- source_spec: `_bmad-output/implementation-artifacts/spec-ingestion-pipeline.md`
  summary: The pipeline assumes every control lives under catalog.groups[].controls[] and would silently drop any control OSCAL placed at a top-level catalog.controls[] instead.
  evidence: Real (edge-case-hunter) but unverified against actual data -- the master catalog has zero top-level controls today (confirmed: groups account for all 324). Worth a defensive check only if a future NIST release changes that structure.

- source_spec: `_bmad-output/implementation-artifacts/spec-browse-ui.md`
  summary: Family and Control Detail pages have no breadcrumb or "back to Family" link -- only the site-title logo and browser back button return the user to a parent surface.
  evidence: Real (blind-hunter), but EXPERIENCE.md's IA is deliberately single-column with no sidebar/breadcrumb pattern specified, and neither the spec's I/O matrix nor its acceptance criteria required one. Worth adding if user feedback shows the logo-only return path is insufficient.

- source_spec: `_bmad-output/implementation-artifacts/spec-browse-ui.md`
  summary: No deep-link anchors (`id` attributes) on individual Enhancements or statement parts, so a URL cannot point at one specific Enhancement within a Control Detail page.
  evidence: Real (blind-hunter), but no SPEC.md capability (CAP-6 deep-linking covers Control/Family routes only) requires enhancement-level fragments. Cheap to add later without restructuring.

- source_spec: `_bmad-output/implementation-artifacts/spec-browse-ui.md`
  summary: BaseLayout ships no `<meta name="description">`, Open Graph tags, canonical link, or favicon -- only `<title>`.
  evidence: Real (blind-hunter) but no PRD/SPEC.md requirement covers SEO/social metadata for v1; purely additive whenever it's prioritized.

- source_spec: `_bmad-output/implementation-artifacts/spec-browse-ui.md`
  summary: No automated test exercises WithdrawnMarker's controls-then-families successor resolution (the sa-12 -> sr case) or url.ts's base-path handling -- both were verified by hand against the real build output, not by a repeatable check, so a future refactor of either could regress silently.
  evidence: Real (verification-gap), but the repo has no test runner at all yet (Goal A also relies on `ingest.mjs --verify`, a hand-rolled script, rather than a framework) -- introducing one is a bigger decision than this slice's scope.

- source_spec: `_bmad-output/implementation-artifacts/spec-browse-ui.md`
  summary: `controls/[slug].astro` and `families/[slug].astro` silently drop any `enhancementSlugs`/`controlSlugs` entry that fails to resolve via `getEntry`, unlike `ProvenanceFooter.astro`'s fail-fast pattern for a missing `meta` entry.
  evidence: Real inconsistency (blind-hunter/verification-gap), but Goal A's `ingest.mjs --verify` already asserts referential integrity of these slug arrays as part of its 93 assertions, so the silent-drop path is currently unreachable dead code, not an active bug. Worth tightening to fail loudly if that guarantee ever changes.

- source_spec: none
  summary: CAP-3 (Enhancement expand/collapse in place, with per-Enhancement deep-linking via `location.hash`) — split off Goal C to keep the Baseline filter (CAP-2) spec within the token scope target.
  evidence: CAP-2 and CAP-3 touch almost entirely different files (`BaselineFilter.astro`/`ControlRow.astro` vs. `EnhancementItem.astro`) and share only the small `setUrlState()` helper, which CAP-2 builds generically enough (`search`/`hash` both handled) that CAP-3 can reuse it unmodified — a clean, low-coupling split unlike Goal A/B's ingestion-pipeline/browse-UI dependency.

- source_spec: `_bmad-output/implementation-artifacts/spec-baseline-filter.md`
  summary: No live-region/announcement (e.g. "3 of 12 controls shown") when the Baseline filter changes what's visible, so a screen-reader user gets no feedback beyond the empty-state message when a filter narrows or empties a list.
  evidence: Real (blind-hunter), but EXPERIENCE.md's Accessibility Floor doesn't require live regions (only landmarks, keyboard operability, color-not-only-signal, and contrast) — an enhancement beyond the stated floor, not a floor violation.

- source_spec: `_bmad-output/implementation-artifacts/spec-baseline-filter.md`
  summary: Clicking the site-title/home logo while a Baseline filter is active does not carry `?baseline=` forward (`updateLinks()` only rewrites `main a[href*="/families/"], main a[href*="/controls/"]`, not the header's home link) — the filter resets on returning home.
  evidence: Real (blind-hunter), but debatable as a bug: "home = reset" is a defensible default and the spec's resolved ambiguity only committed to Home -> Family persistence (UJ-1), not the reverse. Revisit if user feedback says the reset is surprising.

- source_spec: `_bmad-output/implementation-artifacts/spec-baseline-filter.md`
  summary: `updateLinks()`'s `href*="/families/"` / `href*="/controls/"` substring match could rewrite a link it shouldn't (e.g. one containing that fragment in a query string, or an external URL) as more content is added.
  evidence: Real (blind-hunter) but zero actual occurrence today — no such links exist anywhere in `main` content currently (checked). Cheap to harden (e.g. also check `new URL(a.href).origin === location.origin`) once a link shape that could trigger it actually exists.

- source_spec: `_bmad-output/implementation-artifacts/spec-baseline-filter.md`
  summary: No `popstate`/`pageshow` handling for browser back/forward via bfcache — `init()` only runs once at load, so a bfcache-restored page could show pill/row state stale relative to the address bar.
  evidence: Real (blind-hunter), but the site's usage pattern is mostly forward navigation via clicks and deep links (UJ-1/UJ-2), and there's no browser-automation test tool in this environment to verify a fix. Revisit if back/forward becomes a reported pain point.

- source_spec: `_bmad-output/implementation-artifacts/spec-baseline-filter.md`
  summary: No automated test exercises `setUrlState()`, `BaselineFilter`'s filter/pill/link-rewriting logic, or the new empty-state toggle — all verified by hand against real build output (including the confirmed-real PM/PT zero-count cases), not by a repeatable check.
  evidence: Real (blind-hunter/verification-gap), consistent with the same gap already logged for Goal B — the repo still has no test runner (only `ingest.mjs --verify`, a hand-rolled script for the ingestion layer). Introducing one is a bigger decision than any single slice's scope.

- source_spec: `_bmad-output/implementation-artifacts/spec-baseline-filter.md`
  summary: The set of valid Baselines now exists in two places that could drift — `src/content.config.ts`'s `z.enum(['low','moderate','high','privacy'])` schema, and `BaselineFilter.astro`'s server-rendered `BASELINES` list (the client script's own `VALID_BASELINES` was patched during review to derive from the rendered pills, removing the third copy, but the schema-vs-component duplication remains).
  evidence: Real (verification-gap), but the schema and the UI component are necessarily two different layers (data contract vs. presentation) with no realistic single-source mechanism given the current stack (no shared constants module imported by both a `.ts` schema file and an `.astro` frontmatter today). Worth a shared `src/utils/baselines.ts` constant if a fifth capability ever touches this list.

- source_spec: `_bmad-output/implementation-artifacts/spec-enhancement-toggle.md`
  summary: No `hashchange` listener on `EnhancementItem` — the hash is only read once at script init, so a later in-page hash change (browser back/forward through hash states, or a future feature linking directly to another Enhancement anchor) won't open/close the matching Enhancement.
  evidence: Real (blind-hunter/edge-case-hunter), but no current UI writes a second hash change after initial load besides the toggle's own `setUrlState()` calls (which already update the DOM directly), and there's no in-page anchor navigation feature yet to exercise it. Revisit if a future capability adds one.

- source_spec: `_bmad-output/implementation-artifacts/spec-enhancement-toggle.md`
  summary: `EnhancementItem`'s header uses `role="button"` + manual `tabindex`/`keydown` handling rather than a native `<button>`, even though the header's children (chevron SVG, id, title, badges) contain no nested interactive elements and could be wrapped in a real `<button>` without invalid nesting.
  evidence: Real (blind-hunter) — the spec's own stated rationale for avoiding `<button>` ("can't contain the block-level statement body") doesn't hold, since the header and the statement body are siblings, not nested. The `role="button"` pattern is still a valid, WAI-ARIA-compliant disclosure pattern and functions correctly (verified), so this is a simplification opportunity, not a bug. Worth revisiting the spec's rationale if `EnhancementItem` is touched again.

- source_spec: `_bmad-output/implementation-artifacts/spec-enhancement-toggle.md`
  summary: No `scrollIntoView()` call when a deep-linked Enhancement auto-expands on load — relies entirely on the browser's native fragment-scroll (which targets the collapsed header, present in the DOM at parse time) rather than re-scrolling after the body expands and adds height below it.
  evidence: Real (blind-hunter) but the native fragment-scroll already lands the user on the right row before the body expands, so the degraded case (content appearing below an already-scrolled-past fold) is a minor polish issue, not a broken deep link. No browser-automation tool available in this environment to verify a fix live.

- source_spec: `_bmad-output/implementation-artifacts/spec-enhancement-toggle.md`
  summary: No automated test exercises `EnhancementItem`'s toggle/keyboard/deep-link-auto-expand logic — verified by hand against real build output (including the confirmed-real 157-enhancement no-statement case), not by a repeatable check.
  evidence: Real (blind-hunter/verification-gap), consistent with the identical gap already logged for Goal B and Goal C — the repo still has no test runner. Introducing one is a bigger decision than any single slice's scope.

- source_spec: `_bmad-output/implementation-artifacts/spec-iso-crosswalk.md`
  summary: `meta.crosswalkTranscribedAt` is a hardcoded date constant in `ingest.mjs` with nothing forcing it to be bumped/reviewed if `data/crosswalk.json` is edited later (e.g. fixing a transcription error) — the date and the data it describes live in two files with no automated check that they're kept in sync.
  evidence: Real (blind-hunter), but this matches an explicit spec decision (Boundaries: "an explicit committed value... not derived from file mtime or git history") rather than an oversight. Worth a process note (bump the constant whenever `data/crosswalk.json` changes) rather than a code fix.

- source_spec: `_bmad-output/implementation-artifacts/spec-iso-crosswalk.md`
  summary: `content.config.ts`'s `crosswalk: z.array(z.string())` has no format constraint (e.g. a regex for valid ISO clause shapes) — a future manual edit to `data/crosswalk.json` with a stray-whitespace or malformed code would pass schema validation silently.
  evidence: Real (blind-hunter), but `scripts/ingest.mjs`'s new `readCrosswalk()` (added during this review) already rejects non-string/non-array values at the ingestion layer, which is the only place `data/crosswalk.json` is read — the Zod schema is a second, redundant validation layer, not the sole guard. Worth adding if `crosswalk` data is ever produced by a path other than `ingest.mjs`.

- source_spec: `_bmad-output/implementation-artifacts/spec-iso-crosswalk.md`
  summary: The ISO Crosswalk pills render as bare `<span>` elements with no list semantics (`<ul>/<li>`) or `aria-label` describing the group, and the partial-match legend has no `aria-describedby` tying it back to which specific pill(s) triggered it.
  evidence: Real (blind-hunter), but this is a static, non-interactive list (no keyboard/focus requirement applies), and EXPERIENCE.md's Accessibility Floor doesn't require list semantics for this case — both the code-only rendering and the literal-asterisk-plus-legend treatment were explicit user decisions this session, not oversights. Worth polishing if it reads as a real a11y gap in practice.

- source_spec: `_bmad-output/implementation-artifacts/spec-search.md`
  summary: No Enhancement-level sub-results or per-row Baseline badge in `/search` result rows — `mockups/key-search.html` shows AC-2(1) as its own row with a Baseline badge, but this build ships Control/Family page results only.
  evidence: Explicit spec decision (Intent -> "Resolved ambiguity — result granularity"), not an oversight: PRD FR-5's binding consequence only requires reaching the matching Control, and giving Enhancements their own sub-results would need semantic heading markup in `EnhancementItem` (a `<div>` today) plus `data-pagefind-meta` wiring per row — real, deferred v2 work.

- source_spec: `_bmad-output/implementation-artifacts/spec-search.md`
  summary: Pagefind's default fuzzy/typo-tolerant matching is noisy against the PRD's "plain substring is sufficient" v1 framing — verified live with Playwright against a real build: querying "au-2" on `/search` returns 149 results (nearly half the catalog), not just AU-2 and its close relatives.
  evidence: Explicitly flagged as an "Ask First" item in the spec's Boundaries, not a bug to silently fix — shipped with Pagefind's default matching behavior first per that instruction. This confirms PRD Open Question 3 / the architecture spine's Deferred item ("does Pagefind's default matching need tightening") with a concrete number; worth tightening Pagefind's config (e.g. `ranking`/term weighting or ID-aware tokenization) if this reads as too noisy in practice.

- source_spec: `_bmad-output/implementation-artifacts/spec-search.md`
  summary: No automated test exercises `SearchBox`'s live-query script (Pagefind init, query-on-input, result classification/link-building, empty/loading states) — verified by hand (Playwright against a real `npm run build` + `npm run preview`), not by a repeatable check.
  evidence: Real, consistent with the identical gap already logged for every prior slice (Goal B/C/CAP-4) — the repo still has no test runner. Introducing one is a bigger decision than this slice's scope.

- source_spec: `_bmad-output/implementation-artifacts/spec-search.md`
  summary: `SearchBox.astro`'s `splitTitle()` parses each page's `<title>` text back into a mono id + title pair via a hardcoded regex/suffix match, with no shared constant or test tying it to the actual `<title>` templates in `controls/[slug].astro`/`families/[slug].astro` — if either title format drifts, the parser silently falls back to an empty id with no error.
  evidence: Real (blind-hunter), verified correct against both current title formats by hand, but the coupling is real and undetected by anything automated. Consider using `data-pagefind-meta` for the id/title instead of parsing `<title>` if this component is touched again — would also unblock the deferred Enhancement-sub-result/badge work above, which already needs `data-pagefind-meta` wiring.

- source_spec: `_bmad-output/implementation-artifacts/spec-search-baseline-integration.md`
  summary: Selecting a Baseline pill on `/search` with an empty query does nothing (`runQuery()` returns early via `renderNothingEntered()` whenever there's no query text, regardless of an active Baseline filter) — there's no way to "browse all Low-baseline controls" from `/search` by Baseline alone, only to narrow an already-typed text query.
  evidence: Real (blind-hunter), but this is a new capability (search-by-filter-alone, no text query) beyond this goal's stated Intent ("filter/sort search results by baseline"), which presupposes results already exist from a query. Worth a deliberate scoping decision (does Pagefind's API support a filters-only, query-less search meaningfully?) if browse-by-Baseline-from-search becomes a real want.

- source_spec: `_bmad-output/implementation-artifacts/spec-search-baseline-integration.md`
  summary: `.baseline-badge` CSS is hand-duplicated in `search.astro`'s global styles from `BaselineBadge.astro`'s scoped styles, since `/search`'s results are built client-side (never render the real component, so its scoped CSS isn't bundled there). A future color/shape change to `BaselineBadge.astro` won't propagate here unless someone remembers to hand-edit this copy too.
  evidence: Real (blind-hunter), already flagged in a code comment at the duplication site, but no structural fix applied — would require extracting the shared rules to a non-scoped global stylesheet both files import, a bigger refactor than this fix's scope.

- source_spec: `_bmad-output/implementation-artifacts/spec-search-baseline-integration.md`
  summary: No timeout/fallback if Pagefind's dynamic `import()`/`init()` stalls (slow network) rather than rejecting outright — the existing `try/catch` only handles a rejection, not a hang, leaving the search box silently inert with no loading or error feedback in that specific case.
  evidence: Real (edge-case-hunter), a rare degraded-network edge case beyond what the existing error handling (added in the prior search-fixes round) covers. Low priority given the existing catch already handles the common case (missing pagefind.js in dev).

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/1-build-odp-dataset-workspace-route-single-parameter-entry.md`
  summary: `/workspace/{baseline}` has no discoverable entry point from any other page — no link from Home, Search, Family, or Control detail pages, and no back link/breadcrumb on the workspace page itself back to Home/Search.
  evidence: Real (blind-hunter), but the story's frozen Intent and Tasks scope only the dataset endpoint, route, and single-parameter entry — navigation wiring was never a task. The architecture spine's own Deferred section similarly declines to commit a per-control deep-link badge for v1. Revisit once story 3's dashboard exists, which is the more natural nav entry point.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/1-build-odp-dataset-workspace-route-single-parameter-entry.md`
  summary: No action reverts a decision back to `unreviewed-default` or clears it entirely — `OdpWorkspace.astro` only offers Confirm/Override, both of which overwrite in place.
  evidence: Real (blind-hunter), but not required by the spec's Intent ("set/confirm/override") or its I/O matrix. A user can already correct a wrong value by re-entering and re-confirming; only reverting to the unreviewed state has no path. Worth adding alongside story 3's dashboard, which will need a way to jump back to unreviewed items.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/1-build-odp-dataset-workspace-route-single-parameter-entry.md`
  summary: `odpStore.ts`'s `isOdpBlob` discards the entire blob (every decision for that baseline) if even one entry in `decisions` fails `isDecision` shape validation, rather than dropping only the malformed entry and keeping the rest.
  evidence: Real (verification-gap "Other findings"), stricter than the spec's stated "missing or unparseable blob is treated as empty state" (written for JSON-level corruption, not a single bad entry in an otherwise-valid blob). Worth a per-entry-drop policy once story 2+ adds more write paths that could produce partially-invalid blobs.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/1-build-odp-dataset-workspace-route-single-parameter-entry.md`
  summary: `OdpWorkspace.astro`'s `init()` trusts the fetched `odp-dataset.json` response shape completely (`await response.json()` straight into `.filter`/`.flatMap`, and `entry.baselines.includes(...)` assumes `baselines` is always an array) — a malformed response would throw uncaught rather than degrading like the localStorage corrupt-blob path does.
  evidence: Real (blind-hunter/edge-case-hunter), but `odp-dataset.json.ts` is a build-time endpoint whose shape is Zod-validated at build via `content.config.ts`, so a malformed response can only occur from a broken deployment or manual DevTools tampering — much lower probability than the localStorage case the spec's I/O matrix actually tests. Worth a defensive `Array.isArray` guard if this endpoint ever gains a second producer.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/1-build-odp-dataset-workspace-route-single-parameter-entry.md`
  summary: A previously-saved decision's stored `value` can silently fail to render (blank/unselected field, no indication) if the dataset's shape for that `paramId` changes between builds (e.g. a param converted from free-text to `select`, or a choice removed from `select.choice`).
  evidence: Real (edge-case-hunter), but requires the ingested OSCAL corpus to change a param's shape across builds while old localStorage decisions persist — no evidence this has happened or is likely mid-baseline. Revisit if `schemaVersion` migration (also deferred) is ever built.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/1-build-odp-dataset-workspace-route-single-parameter-entry.md`
  summary: No `aria-live` region announces a decision's status change (e.g. "Confirmed") after Confirm/Override is clicked — only the validation error (`role="alert"`) is announced to screen readers; a successful save is silent.
  evidence: Real (blind-hunter), and the spec's Boundaries only require following the site's existing `role`/`aria-expanded`/`focus-visible` conventions (which don't include live-region success announcements anywhere else in the codebase either — e.g. `BaselineFilter`'s pill state change isn't announced). An enhancement beyond the established floor, not a regression from it.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/1-build-odp-dataset-workspace-route-single-parameter-entry.md`
  summary: A `select`-typed parameter with an empty `choice` array would render a permanently empty, unusable multi-select with no explanatory message, blocking Confirm/Override forever for that parameter.
  evidence: Real in principle (blind-hunter) but unverified against actual corpus data — an OSCAL `select` assignment with zero offered choices would be a meaningless authoring error upstream, and no such case is confirmed to exist in the ingested Moderate baseline. Worth a guard if real data ever shows this.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/1-build-odp-dataset-workspace-route-single-parameter-entry.md`
  summary: Multi-select fields (`select.howMany === 'one-or-more'`) render as a bare native `<select multiple>` with no instructional text on how to select more than one option (e.g. Ctrl/Cmd-click), a common usability trap.
  evidence: Real (blind-hunter), pure UX polish not covered by any spec requirement. Cheap to add (a short hint line) whenever this component is next touched.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/2-add-batched-dash-one-entry.md`
  summary: A batch cluster row's "N/total controls match this value" count doesn't distinguish an undecided member (no decision yet) from a diverged one (decided differently) — both lower the displayed ratio identically.
  evidence: Real (blind-hunter), but no acceptance criterion requires the distinction, and the two ACs that do exercise the count (all-confirmed, and one-override-drops-to-17/18) are unambiguous either way. Worth splitting into two counts ("N confirmed, M diverged") if user feedback finds the merged ratio confusing.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/2-add-batched-dash-one-entry.md`
  summary: When `groupDashOneClusters` excludes a member for diverging `select` shape (the real `sc-1`/`odp.03` case), the batch row gives no visual cue that a member was excluded — only a bare `17 dash-one controls` count, no different in style from any other cluster's `18`.
  evidence: Real (blind-hunter), but the spec's acceptance criterion only requires the exclusion to happen correctly and `sc-1`'s own row to still render individually below — not that the batch UI announce the exclusion. Worth a small note ("1 control excluded — differing options") if this proves confusing in practice.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/2-add-batched-dash-one-entry.md`
  summary: No `aria-live`/`role="status"` on the batch row's match-count label, so a screen-reader user isn't notified when it updates after a Confirm/Override.
  evidence: Real (blind-hunter), consistent with the same accessibility-floor gap already logged for story 1 (no live-region announcement of a saved decision) — an enhancement beyond the established floor, not a regression from it.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/2-add-batched-dash-one-entry.md`
  summary: `odpCluster.ts`'s `clusterKey()` silently no-ops (returns the raw `paramId` unchanged) if a `paramId` doesn't actually start with the expected `^<familyCode>-1_`/`^<familyCode>-01_` prefix, rather than flagging a data-integrity problem.
  evidence: Real (blind-hunter/edge-case-hunter) but unreachable against real data today — every dash-one entry's `paramId` was verified to match the expected prefix pattern across all 9 clusters. Worth a loud failure if the ingested corpus's naming convention ever changes.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/2-add-batched-dash-one-entry.md`
  summary: `selectDeepEqual` (used to decide whether a member belongs in a cluster) compares `select.choice` order-sensitively, while `valuesMatch` (used for "does this member's stored value match the batch value") is deliberately order-independent — an inconsistency within the same file's design philosophy.
  evidence: Real (blind-hunter), but no real dash-one param currently has the same choice set in a different order across members (verified: the only real divergence, `sc-1`'s `odp.03`, differs by exact text, not order) — a plausible future data shape, not a demonstrated one.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/2-add-batched-dash-one-entry.md`
  summary: `computeClusterMatch`'s tie-break when two distinct values tie for the largest group is undocumented and unflagged — the batch row pre-fills whichever value happened to appear first among members, presented identically to a genuine majority.
  evidence: Real (edge-case-hunter), a real but narrow window (only mid-way through manually deciding a cluster one-by-one, before any batch action has run). Worth returning an explicit "no majority" signal if this proves confusing in practice.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/2-add-batched-dash-one-entry.md`
  summary: A batch cluster row shows only a member count ("18 dash-one controls"), not the actual control IDs it covers — a user confirming or overriding a batched value can't see the exact scope from the batch UI itself without cross-referencing the individual rows below.
  evidence: Real (blind-hunter/edge-case-hunter), pure UX polish not required by any acceptance criterion. Worth a "AC-1, AU-1, ... (show all)" expandable list if this proves too opaque in practice.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/2-add-batched-dash-one-entry.md`
  summary: `clusterKey()`'s `new RegExp(\`^${fc}-0?1_\`)` interpolates `familyCode` into a regex without escaping regex metacharacters.
  evidence: Real (edge-case-hunter) but `familyCode` is always one of 20 fixed uppercase letter-pairs from the ingested catalog (verified, no metacharacters possible) — theoretical hardening against input that can't occur today, consistent with similarly-scoped deferred items already logged for the ingestion pipeline.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/3-readiness-gate-and-dashboard.md`
  summary: The dashboard's overall summary line rounds each status's percentage independently (`Math.round`), so the three percentages shown can visibly fail to sum to 100% (e.g. three-way near-even splits rendering as 33/33/33).
  evidence: Real (blind-hunter), a cosmetic rounding artifact with no functional consequence — the underlying counts (not percentages) are exact and drive the actual gate. Worth a reconciling rounding scheme (e.g. largest-remainder) if this reads as sloppy in practice.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/3-readiness-gate-and-dashboard.md`
  summary: `statusField()` maps `DecisionStatus` to a `StatusCounts` key via a two-branch inference (`unreviewed-default` → `'unreviewed'`, else pass-through) rather than an exhaustive switch — if `DecisionStatus` ever gains a fourth member, the pass-through branch would silently produce a key not in `StatusCounts` with no compiler error.
  evidence: Real (blind-hunter), but `DecisionStatus` is a fixed 3-member union defined once in `odpStore.ts` and load-bearing everywhere else in the workspace (row status labels, cluster matching) — a fourth status would require touching many other places first, making this an unlikely silent-break vector. Worth an exhaustive switch if the status enum is ever extended.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/3-readiness-gate-and-dashboard.md`
  summary: The dashboard's summary line (`[data-odp-dashboard-summary]`) has no `aria-live` region, so a screen-reader user gets no announcement when the counts change after a save — only the blocked/ready message (`role="status"`) is announced.
  evidence: Real (blind-hunter), consistent with the same accessibility-floor gap already logged for stories 1 and 2 (no live-region announcement of state changes beyond errors) — an enhancement beyond the established floor, not a regression from it.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/3-readiness-gate-and-dashboard.md`
  summary: `refreshDashboard()` rebuilds the entire by-Family `<tbody>` (`innerHTML = ''` + recreate every row) on every single confirm/override, including batch actions with 18 members — tears down and rebuilds all 18 family rows each time instead of patching just the changed family's row, and drops any focus that was inside the table.
  evidence: Real (blind-hunter), but the table is small (18 rows for Moderate) and rebuilt only after a user-initiated save, not on a hot path — no perceptible lag expected (NFR-2). Worth patching individual rows if the table grows or focus-preservation becomes a real complaint.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/3-readiness-gate-and-dashboard.md`
  summary: `handleMarkReady()` independently recomputes `computeDashboardCounts` and re-derives the same "Not ready — N unreviewed" message that `refreshDashboard()` already writes into the same element on every state change — two independent implementations of the same string that could drift.
  evidence: Real (blind-hunter/verification-gap), a simplification opportunity rather than a bug: the blocked branch is unreachable in normal use since the button is already `disabled` by `refreshDashboard` whenever `unreviewed > 0`. Worth having `handleMarkReady` just call `refreshDashboard()` plus append the "Ready — all N reviewed" confirmation on the success path, removing the duplicate computation.
  
- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/3-readiness-gate-and-dashboard.md`
  summary: `jumpToNextUnreviewed()` permanently adds `tabindex="-1"` to whatever row/cluster element it focuses and never removes it — over a session, many rows can accumulate stray `tabindex="-1"` attributes.
  evidence: Real (blind-hunter), harmless DOM accumulation (doesn't affect tab order since `-1` excludes an element from the natural tab sequence either way). Worth cleaning up on blur if a future accessibility audit flags it.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/3-readiness-gate-and-dashboard.md`
  summary: `jumpToNextUnreviewed`'s selector interpolates `cluster.clusterKey`/`decisionKey(next)` into a `querySelector` attribute-value string without `CSS.escape`, so a value containing a `"` would break the selector.
  evidence: Real (edge-case-hunter) but unreachable against real data — cluster keys (`prm_1`, `odp.01`..`odp.08`) and decision keys (`${controlSlug}:${paramId}`) never contain quote characters in the ingested catalog (verified). Same class of theoretical hardening already deferred for `clusterKey()`'s regex interpolation in story 2.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/3-readiness-gate-and-dashboard.md`
  summary: `findClusterForEntry` does a linear scan of every cluster's every member on each "Jump to next unreviewed" click, with no precomputed lookup map.
  evidence: Real (blind-hunter) but negligible at real scale (9 clusters × ≤18 members, once per button click, not a render-loop hot path). Worth a `Map<entryKey, Cluster>` built once alongside `dashboardEntries` if cluster/entry counts grow substantially.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/3-readiness-gate-and-dashboard.md`
  summary: The by-Family table's `<th>` header cells have no visual weight differentiation from `<td>` body cells (same padding/border/color, no bold or background tint) — the header row is distinguishable only by tag semantics, not appearance.
  evidence: Real (blind-hunter), pure visual polish not covered by any spec requirement or the site's existing design tokens for tables (no prior table exists elsewhere in the Browser to match). Cheap to add (`font-weight: 600`) whenever this component is next touched.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/4-oscal-export.md`
  summary: `oscalExport.ts`'s `buildSetParameter` assumes `decision.rationale`/`decision.value` are always defined (per `Decision`'s type and `odpStore.isDecision`'s shape validation), and `BASELINE_SOURCE_FILENAME[baseline]` assumes `baseline` is always one of the four route-generated literals — none of these are defensively re-checked at the export boundary.
  evidence: Real (blind-hunter/edge-case-hunter) but unreachable in practice today: every `Decision` read via `getDecisions` already passed `odpStore.ts`'s `isDecision` shape validation (rationale/value always present and correctly typed), and `baseline` always comes from the route's own `Baseline` union via `getStaticPaths`. Worth hardening if `oscalExport.ts` is ever called from a path that bypasses those guarantees.
  
- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/4-oscal-export.md`
  summary: `src/pages/odp-meta.json.ts` silently returns `{ oscalVersion: '' }` if the `meta`/`provenance` Content Collection entry is ever missing, rather than failing the build loudly.
  evidence: Real (edge-case-hunter/blind-hunter), but this is a build-time endpoint reading from the same always-present singleton every other page already depends on (`ProvenanceFooter.astro`) — if it were ever actually missing, other pages would already be visibly broken first. The client now independently guards against an empty `oscalVersion` (disables export, shows an error) as a second line of defense.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/4-oscal-export.md`
  summary: The exported Profile's `version` field is hardcoded to `'1.0.0'` on every export — nothing increments it across repeated exports of the same baseline, so two exports minutes apart are distinguishable only by `last-modified`.
  evidence: Real (blind-hunter), minor and non-blocking — no spec requirement or OSCAL constraint requires a meaningful version sequence for this document's own `version` field. Worth deriving from an export counter or timestamp if downstream tooling ever needs to distinguish export iterations.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/4-oscal-export.md`
  summary: The export button reuses the `.odp-dashboard__action` CSS class for styling, even though it's not part of the dashboard section — couples the button's appearance to a class whose name/purpose belongs to a different feature.
  evidence: Real (blind-hunter), a naming/organization nit with no functional effect (the shared styles are visually correct for this button too). Cheap to split into its own class whenever this component is next touched.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/4-oscal-export.md`
  summary: `profile.imports[0].href` is a bare filename (e.g. `NIST_SP-800-53_rev5_MODERATE-baseline-resolved-profile_catalog-min.json`) with no path or URI scheme — unclear how external OSCAL tooling would resolve it outside this project's own `data/raw/` layout.
  evidence: Explicit spec decision (Boundaries: "references the actual ingested source filename... truthful provenance, never a fabricated or unverified live URL"), not an oversight — flagged by two reviewers as worth double-checking, but the spec deliberately chose traceable-but-not-necessarily-resolvable provenance over inventing an unverified live URL. Revisit if this tool ever needs to interoperate with external OSCAL tooling that requires a resolvable import.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/5-parameter-control-and-statement-context.md`
  summary: `OdpDatasetEntry` is declared as two independent, hand-copied interfaces (`odp-dataset.json.ts` and `odpCluster.ts`) rather than one shared type — this story had to add `controlTitle`/`statementProse` to both by hand, and nothing enforces they stay in sync on the next change.
  evidence: Real (blind-hunter), pre-existing since story 2 (not introduced by this story), which this story's own diff extended consistently. Worth consolidating into one shared type the endpoint imports from `odpCluster.ts` (or a third shared module) next time either file is touched.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/5-parameter-control-and-statement-context.md`
  summary: `findStatementProse` re-walks a control's entire statement tree from scratch for every one of its params, rather than building one paramId→prose map per control and doing O(1) lookups.
  evidence: Real (blind-hunter) but negligible at real scale (324 controls, small statement trees, run once at build time, not per-request). Worth a per-control map if the corpus grows substantially or build time becomes a concern.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/5-parameter-control-and-statement-context.md`
  summary: A divergent-cluster batch row's fallback sentence is rendered with app-generated commentary concatenated directly into the same text node as the actual NIST prose (`"${prose} (shown for ${controlId}; wording varies...)"`), rather than as a visually/semantically separate element.
  evidence: Real (blind-hunter), a presentation nitpick with no functional effect — the attribution is still readable and accurate. Worth splitting into two elements (quoted sentence + a separate meta-text attribution) if this reads as muddled in practice.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/5-parameter-control-and-statement-context.md`
  summary: The batch row's covered-control list renders as one comma-joined `<p>` rather than a real `<ul>/<li>` list, so assistive tech won't announce it as "list of N items."
  evidence: Real (blind-hunter), matches the same accessibility-floor-not-required pattern already logged for the ISO crosswalk pills (bare `<span>`s, explicit prior decision) — an enhancement beyond the established floor. Also relevant to story 6: the toggle's expand/collapse state isn't preserved across a future filter-driven re-render, worth handling together when that story adds row rebuilding.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/5-parameter-control-and-statement-context.md`
  summary: `statementProse` is duplicated verbatim per param entry in `odp-dataset.json` rather than deduplicated — a cluster of 18 controls sharing one identical sentence stores that full sentence 18 times, adding to the already-measured +31.6 KB gzipped size cost.
  evidence: Real (blind-hunter), but the size cost was already measured and explicitly accepted in this story's own Design Notes before implementation — a further optimization (e.g. a lookup table keyed by sentence hash), not a correctness gap. Worth it only if dataset size becomes a real complaint.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/6-split-workspace-into-views.md`
  summary: When a row is removed from the Individual view by the unreviewed-only filter (after a confirm/override), focus isn't moved anywhere — it silently falls back to `<body>` for keyboard/screen-reader users.
  evidence: Real (blind-hunter), an accessibility enhancement beyond the established floor (no other interaction in this component moves focus after a DOM removal either). Worth moving focus to the next remaining row or a status message if this proves disorienting in practice.
  
- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/6-split-workspace-into-views.md`
  summary: Landing directly on the Dashboard or Batch view (via the tab, not a URL) leaves any stale `family`/`unreviewed` query params sitting unused in the address bar instead of being cleared, since the initial-load branch for those two views never calls `setUrlState` the way `switchToView` does.
  evidence: Real (blind-hunter), cosmetic only — the stale params have no effect on behavior (Individual view always recomputes fresh from `representedFamilies`/`unreviewedOnly` when next selected). Worth a one-line `setUrlState` call on initial dashboard/batch load if a clean address bar matters.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/6-split-workspace-into-views.md`
  summary: Switching views/families/the unreviewed toggle never pushes a browser history entry (`setUrlState` is `replaceState`-only, by design) — the back button doesn't step through Dashboard → Batch → Individual the way one might expect from "URL-reflected state."
  evidence: Explicit, sitewide design decision (EXPERIENCE.md: "filter/expand/search-in-place never add a history entry"), not an oversight — matches `BaselineFilter.astro`'s identical behavior. Not a bug; flagged by one reviewer as worth confirming, now confirmed intentional.
  
- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/6-split-workspace-into-views.md`
  summary: No `aria-live` announcement when switching views, changing family, or toggling the unreviewed-only filter — screen-reader users get no confirmation that a change took effect beyond whatever becomes visible.
  evidence: Real (blind-hunter), consistent with the same accessibility-floor-not-required pattern already logged for stories 1, 3, and 5 (no live-region announcement of state changes beyond validation errors) — an enhancement beyond the established floor.

- source_spec: `_bmad-output/specs/spec-compliance-workbench/stories/15-odp-interlock.md`
  summary: The interlock's workspace link opens the family's unreviewed parameters, not just the blocked item's.
  evidence: The workspace filters by family and unreviewed only; a per-control filter (e.g. `control=ac-2-1`) would need a workspace change. The block message already names the item's own count.
