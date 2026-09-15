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
