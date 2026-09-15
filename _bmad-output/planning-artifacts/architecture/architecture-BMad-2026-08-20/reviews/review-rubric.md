# Rubric Review — ARCHITECTURE-SPINE.md (NIST 800-53 Browser)

**Reviewed:** `_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-08-20/ARCHITECTURE-SPINE.md`
**Against:** `_bmad-output/planning-artifacts/prds/prd-BMad-2026-08-20/prd.md`
**Calibration:** hobby-scope, solo builder — enterprise concerns (multi-team seams, SLAs, formal change management) are explicitly not expected and are not penalized here.

## Overall Verdict

**Pass, with minor findings.** The spine correctly identifies the real divergence points for a static, no-backend, deep-linkable catalog reader (canonical single-source ingestion, URL-as-state, one slug scheme, global chrome placement, CI-only deploy) and every AD's rule text is independently enforceable and does prevent the divergence it names. All five FRs are covered in the Capability → Architecture Map, and named tech was checked against current (Aug 2026) sources and is accurate. Findings below are traceability/consistency gaps and one real but contained product-architecture tension (Pagefind's default fuzzy matching vs. the PRD's stated search scope) — nothing rises to a divergence risk that would let two build units silently disagree.

## Findings by Severity

- **Critical:** 0
- **High:** 0
- **Medium:** 2
- **Low:** 4

---

### Medium

**M1 — Capability → Architecture Map is inconsistent with the ADs' own "Binds" claims.**
AD-2 declares `Binds: content layer, all of FR-1 through FR-5`, and AD-4 declares `Binds: all pages, FR-1 through FR-5`. But the Capability → Architecture Map omits AD-2 from the FR-2 and FR-5 rows, and omits AD-4 from the FR-4 row:

| Row | Lists | Missing per the AD's own "Binds" |
| --- | --- | --- |
| FR-2 Baseline filter | AD-3, AD-4, AD-7 | AD-2 |
| FR-5 Search | AD-3, AD-7 | AD-2 |
| FR-4 ISO crosswalk | AD-2, AD-5 | AD-4 |

This matters concretely for FR-2: AD-2's own rule text says the ingestion script's output has "Baseline flags ... attached" — i.e., baseline membership data is a direct product of the single canonical pipeline AD-2 exists to protect. A story-writer for FR-2 who trusts the map as the routing table could reasonably miss that baseline data must come only from that pipeline and build a second, divergent baseline computation in the presentation layer — exactly the divergence AD-2 is written to prevent. FR-4's missing AD-4 is lower-stakes (same route as FR-3, which does list AD-4) but same category of defect. Not a flaw in the AD rules themselves — the map is the piece that drifted from them.

**M2 — Deferred section is silent on PRD Open Question 3 (fuzzy/typo-tolerant search), and the chosen search tool sits in unaddressed tension with FR-5's stated scope boundary.**
FR-5 explicitly puts fuzzy/typo-tolerant matching **out of scope**: "plain substring/keyword match is sufficient for v1 (see Open Questions)." Open Question 3 asks whether that will hold up. The spine's Deferred section covers Open Questions 1, 2, and 4 but never mentions 3 or Pagefind's relationship to it — and Pagefind (the tool AD names for FR-5) ships fuzzy/typo-tolerant matching as default behavior. That's not necessarily wrong — it could simply *resolve* Open Question 3 in the PRD's favor — but the spine doesn't say so, and doesn't address the more concrete risk: Pagefind's default word-based tokenization may not treat hyphenated control IDs (`AC-2`, `AC-2(1)`) as clean search tokens out of the box, which is precisely what FR-5's testable consequence requires ("Searching 'AC-2' ... surface AC-2, Account Management"). Left unaddressed, this is a real divergence risk for the FR-5 implementation story — one build attempt might rely on Pagefind defaults and silently fail that consequence, another might add custom ID-field weighting/attributes to compensate, with no spine rule saying which is correct.

---

### Low

**L1 — Deferred section misattributes the disclaimer-placement rule to AD-7.**
The Deferred entry for disclaimer placement says "*that* the disclaimer exists on every page is fixed by AD-7." AD-7's rule text, as written, only governs where `SearchBox` and `BaselineFilter` mount — it never mentions the disclaimer. The actual commitment ("`BaseLayout.astro` always renders" the disclaimer statement) lives in the Consistency Conventions table, not in AD-7. The substance is still correctly fixed (disclaimer-on-every-page is not open), just misfiled — worth a one-line fix so a reader tracing "governed by AD-7" doesn't land on a rule that doesn't mention it.

**L2 — AD-6 and the structural diagram target the older `gh-pages`-branch deploy pattern rather than GitHub's now-standard artifact-based Pages deploy.**
As of Aug 2026, GitHub's documented/recommended flow is `actions/upload-pages-artifact` + `actions/deploy-pages`, which publishes through a Pages-managed environment without needing a `gh-pages` branch at all. AD-6 and the Structural Seed diagram both describe deploying *to* a `gh-pages` branch (the older, still-supported pattern). This isn't incorrect — both approaches work today — but it's worth a conscious choice rather than a default, since the artifact-based flow removes a moving part (the branch) that AD-6's own rule is partly written to guard ("no local push to gh-pages bypassing CI").

**L3 — Named tech is current but two adjacent facts are worth a glance before scaffolding (informational, not a defect).**
Verified via web search against Aug 2026 sources: Astro 7.2.4 is accurate (npm shows 7.2.3 published hours before the check, so .4 is plausible/current); Node 22 is still a supported Maintenance LTS through Apr 2027 (Node 24 is the current Active LTS, but "22 LTS or later" as stated covers that fine); GitHub Pages + Actions remains a standard, actively supported static-hosting path. Two adjacent facts don't invalidate any AD but are worth knowing: (1) Astro's stewardship changed — Cloudflare acquired the Astro team in Jan 2026, and Astro 6's dev server now runs on Cloudflare's `workerd` runtime — though `astro build`'s static-export output (what AD-1 depends on) is unaffected. (2) The `astro-pagefind` integration's UI wrapper component is now in maintenance mode, with new projects steered toward Pagefind's own native UI component instead — doesn't block anything named in the spine, just means the specific wrapper isn't the actively evolving integration surface.

**L4 — Operational envelope (rollback, DNS/custom domain, monitoring) is silent rather than explicitly decided/deferred.**
Deployment (AD-6), environments (Deferred: single prod env, no staging), and hosting/infra (Stack: GitHub Pages via Actions) are all explicitly decided. What's left fully silent: what happens on a failed/bad CI deploy (GitHub Pages' default is to leave the previous build live — reasonable, but never stated), whether a custom domain is in scope, and whether any monitoring is wanted. At hobby/solo scope this is genuinely low-stakes and none of it needs a formal answer — but the checklist calls this dimension out specifically because a whole-dimension silence is easy to miss. A one-line addition to Deferred ("no rollback/monitoring tooling — accept GitHub Pages' default of leaving the last good build live on a failed Action; no custom domain planned") would close this cleanly.

---

## Checklist Walk-Through

| Checklist item | Result |
| --- | --- |
| Fixes real divergence points for epics/stories, misses none | Pass — canonical ingestion (AD-2), URL-state (AD-3), slug scheme (AD-4), content fidelity/provenance (AD-5), CI-only deploy (AD-6), global chrome placement (AD-7) are the real seams for this shape of app. See M2 for one search-specific gap. |
| Every AD's Rule is enforceable and prevents its stated divergence | Pass — all 7 rules are concrete and checkable in review (single script, URL read/write, one `slugify()`, verbatim rendering + stamped metadata, CI-only publish path, layout-mounted chrome). |
| Nothing under Deferred is load-bearing / could let two units diverge | Pass — each Deferred item either resolves to an explicit decision (single environment) or is a genuinely non-blocking revisit (scheduled re-ingestion, docx-parsing automation, a11y target, ingestion-script language, other frameworks). See M2 for the one item that arguably *should* be there but isn't. |
| Named tech is verified-current | Pass, verified via web search — Astro 7.2.4, Node 22 LTS+, Pagefind, GitHub Pages/Actions all confirmed current as of Aug 2026. See L2/L3 for adjacent, non-blocking notes. |
| Covers PRD's FR-1–FR-5 via the Capability → Architecture Map | Pass on coverage; M1 flags internal inconsistency between the map and two ADs' own "Binds" fields. |
| Every dimension "feature altitude" owns is decided/deferred/open — especially operational/environmental envelope | Mostly pass — deployment, environments, hosting/infra are explicit. L4 flags the remaining sliver (rollback/DNS/monitoring) as silent rather than explicitly waved off. |
