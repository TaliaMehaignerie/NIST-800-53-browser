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
