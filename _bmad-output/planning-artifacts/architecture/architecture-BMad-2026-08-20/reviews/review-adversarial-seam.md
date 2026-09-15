---
name: 'Adversarial Seam Review — NIST 800-53 Browser Architecture Spine'
type: architecture-review
reviews: '_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-08-20/ARCHITECTURE-SPINE.md'
created: '2026-08-20'
---

# Adversarial Seam Review — ARCHITECTURE-SPINE.md

Method: for each AD, construct two hypothetical builders working from the spine text alone (no side-channel agreement, no shared PRD wording beyond what's quoted in the spine). Each pair below is fully compliant with the letter of every AD cited, yet produces incompatible or non-functional results when their outputs meet. Seven pairs found, ranked by severity.

---

## 1. AD-1 × AD-3 — nobody is assigned the job of actually filtering the DOM (FR-2 silently never works)

**Builder A — `pages/families/[slug].astro`.** Reads AD-1 literally: "All control/baseline/crosswalk data is resolved at build time into static output." A family page is static HTML with no server. Builder A ships the *complete* list of controls for the family into the HTML — there is no other legal way to satisfy AD-1, since the page cannot know at build time what `?baseline=` an eventual visitor will request. Builder A considers the page "done": it renders every control, baseline flags are present in the DOM as data attributes, AD-1 satisfied to the letter.

**Builder B — `components/BaselineFilter` (island).** Reads AD-3 literally: "Every stateful island reads its initial state from the URL on load and writes state changes back to the URL." Builder B implements exactly that contract — on load, parse `?baseline=` and reflect it in the control's checked/selected UI state; on user interaction, call `history.replaceState` with the new `?baseline=` value. Builder B considers the island "done": state round-trips through the URL exactly as AD-3 requires, verified by loading `?baseline=moderate` and seeing the right radio pre-selected.

**The clash:** AD-3's rule is entirely about *state synchronization* with the URL — it never says the island must also *apply* that state by hiding/showing sibling DOM nodes it doesn't own. AD-1's rule is entirely about *where data is resolved* — it never says the static page must ship data-attributes an island can filter on, nor that the island is responsible for consuming them. Both ADs are satisfied to the letter by two builders who each reasonably conclude "filtering the visible list is the other side's concern." Neither the Capability Map row for FR-2 (`AD-3, AD-4, AD-7`) nor AD-1/AD-3 themselves assign ownership of the actual filter *application* step. Result: `?baseline=moderate` updates the address bar correctly and the control persists across reload — the control list on the page never changes.

**Close with:** an AD (or an explicit clause added to AD-3) that names which artifact owns DOM-level filter application — e.g. "family/index pages render baseline membership as a `data-baselines` attribute on each control row; `BaselineFilter` is the only code that hides/shows rows based on it; the initial paint before hydration is the unfiltered list" — and states this explicitly as a shared contract, not an inference either side has to make alone.

---

## 2. AD-2 — "Enhancements nested" is two different Content Collection shapes

**Builder A — `scripts/ingest.mjs`.** Reads AD-2: "one canonical Content Collection entry per Control, with Enhancements nested." Builder A implements this as literal object nesting — one JSON file per control (`ac-2.json`), with an `enhancements: [...]` array embedded inside it. This is the simplest reading of "nested" and keeps AD-2's "one entry per Control" promise exact (one file, one entry).

**Builder B — `pages/controls/[slug].astro` + `content/config.ts`.** Reads AD-2 the same sentence, but through the erDiagram, which models `CONTROL ||--o{ ENHANCEMENT` as a distinct entity with its own identity, and through Astro convention, where Content Collections are queried via `getCollection()`/`getEntry()` per file. Builder B assumes "nested" means *nested under the control's namespace as sibling collection entries* — separate files `ac-2.json` and `ac-2-1.json`, the latter carrying a `parentId: "ac-2"` field — because that's the idiomatic way Astro Content Collections express one-to-many relations, and it lets an enhancement be queried on its own (e.g., for search indexing) without deserializing the whole parent.

**The clash:** Both shapes are "one canonical Content Collection entry per Control... with Enhancements nested" under a defensible reading. If ingest.mjs (Builder A) ships the embedded-array shape but the Zod schema and page code (Builder B) were written against the sibling-entry shape (or vice versa), `entry.data.enhancements` is `undefined` at runtime/build time — enhancements silently vanish from the Control Detail Page, or `getCollection('controls', e => e.data.parentId === id)` returns nothing because no entry ever set `parentId`. Nothing in AD-2 or the Structural Seed nails down the actual field name, cardinality container (array vs. separate files), or Zod shape — `content/config.ts` is named as "the Zod schema" but its shape is never specified in the spine itself.

**Close with:** pin the exact Content Collection entry shape (or at minimum, embedded-array vs. sibling-entry, and the field name) in AD-2 or a companion schema doc, so "what ingest.mjs outputs" and "what pages assume" are the same document, not two independent readings of one sentence.

---

## 3. AD-4 — `slugify()` diverges on OSCAL-native vs. canonical-display input, and ingest.mjs may not even be bound by "component"

**Builder A — `scripts/ingest.mjs`.** OSCAL catalog JSON identifies enhancements with dot notation, e.g. `ac-2.1`. Builder A calls `slugify("ac-2.1")` while generating the filename/slug for each entry. A straightforward slugify (lowercase, non-alphanumerics → hyphen, collapse repeats) turns `ac-2.1` into `ac-2-1` — matches AD-4's example exactly. Builder A is also implementing "the ingestion script's implementation language" which the Deferred section explicitly calls out as unbound and outside "the deployed system" — so when the Consistency Conventions table says "produced by one shared `slugify()` function," Builder A reasonably treats a Node one-off script as not being "a route or component" in the Astro sense, and writes its own small local copy of the function rather than importing `src/utils/slugify.ts` into a tool AD-4 never says has to depend on `src/`.

**Builder B — `components/SearchBox` (island), building result links.** Pagefind indexes the *rendered* static HTML, which per AD-4 displays controls in canonical uppercase form, `AC-2(1)`. Builder B's search-result renderer needs to turn a matched result's displayed/stored id back into a href, and — per AD-4's "no route or component derives a slug independently" — dutifully imports the shared `src/utils/slugify.ts` and calls `slugify("AC-2(1)")` on the canonical form (which is what's available from the Pagefind result metadata). If the shared slugify's regex treats `(` and `)` differently than it treats `.` (e.g. strips parens entirely instead of hyphenating them, or leaves a trailing hyphen from the closing paren before collapse), `slugify("AC-2(1)")` does **not** produce byte-identical output to `slugify("ac-2.1")` even though both callers used "the one shared function" to the letter.

**The clash:** AD-4 names the function but never pins its *input contract* — is it meant to be called on the OSCAL-native id, the canonical display string, or a title? Two compliant callers feeding it two different (both textually reasonable) representations of the same enhancement can get two different slugs, and even if ingest.mjs correctly imports the shared function, `.` vs `(` `)` normalization is exactly the kind of edge case a generic slugify implementation gets inconsistent on unless explicitly tested. If it happens, SearchBox generates a link to `/controls/ac-21` or `/controls/ac-2-1-` that 404s against the file `ac-2-1.json` ingest.mjs actually produced.

**Close with:** AD-4 should state the single canonical *input* to `slugify()` (e.g. "always called on the OSCAL-native id, never on the canonical display string") and explicitly bind `scripts/ingest.mjs` to import the same `src/utils/slugify.ts` module used by pages/islands — closing the "script vs. component" loophole.

---

## 4. AD-3 race on the Control Detail Page — `BaselineFilter`'s URL write clobbers `EnhancementToggle`'s fragment (and vice versa)

**Builder A — `components/BaselineFilter`.** Implements AD-3's "writes state changes back to the URL" as: `history.replaceState(null, '', '?' + newSearchParams.toString())`. This is a *relative* URL with no pathname and no hash — the simplest way to satisfy "baseline filter state lives in `?baseline=`." Tested in isolation (on `/families/ac`), it works perfectly.

**Builder B — `components/EnhancementToggle`.** Implements AD-3's "expanded-enhancement state lives in the URL fragment" as: `history.pushState(null, '', '#' + anchorId)` when an enhancement is expanded, and strips the hash on collapse. Tested in isolation (on `/controls/ac-2`), it works perfectly, and using `pushState` (not `replaceState`) means the back button un-expands the last-opened enhancement — a defensible reading of "writes state changes back to the URL."

**The clash:** Per AD-7, `BaselineFilter` mounts in the *shared layout*, so it is present on `/controls/[slug]` too, alongside `EnhancementToggle`. A user on `/controls/ac-2#ac-2-1` (enhancement AC-2(1) expanded) who then touches the baseline filter fires Builder A's `replaceState('?baseline=moderate')` — which, being a bare query-string target, drops the existing `#ac-2-1` fragment, silently collapsing the enhancement the user had open. Conversely, if `EnhancementToggle` fires first and its `pushState('#ac-2-2')` doesn't preserve the existing `?baseline=moderate` query (because Builder B, testing in isolation, never needed to preserve a query string), the baseline filter selection is silently lost from the address bar — a shared link copied at that moment loses the filter. Each island is individually correct against AD-3's text; neither was told it must merge into the *other's* piece of the URL rather than overwrite the whole thing. AD-3 also never picks `pushState` vs `replaceState`, so the two islands independently chose different history semantics, producing an inconsistent back-button experience depending on which control you touch last.

**Close with:** AD-3 should mandate a single "URL-state writer" helper that merges into `location.search`/`location.hash` non-destructively (preserving whichever of query/fragment the calling island doesn't own), and should pin `pushState` vs `replaceState` per state category (e.g., filter/search changes replace; expand/collapse changes... also replace, to avoid history spam) rather than leaving it to each island.

---

## 5. AD-3 × AD-1 — "write state... without a full page reload" is unsatisfiable for `SearchBox` on non-`/search` routes, and two builders resolve the contradiction differently

**Builder A — `components/SearchBox`, pragmatic reading.** Notes that AD-1 commits this to a static multi-page Astro site with no client router in the Stack table (Astro, Pagefind, no mention of View Transitions or an SPA router). Concludes AD-3's "without a full page reload" clause can only sensibly apply *once already on `/search`* (there, keystrokes update `?q=` via `replaceState` and Pagefind re-queries client-side without reloading). From any other route, `SearchBox` in the global layout is just a form that does a normal navigation (`<a>`/form submit) to `/search?q=...` — a real, full document load. Builder A considers this compliant: the island still "reads its initial state from the URL on load" (on `/search`, from `?q=`), and "writes changes back to the URL without a full page reload" for every keystroke *after* arrival.

**Builder B — `components/SearchBox`, literal reading.** Notes AD-3 says "Every stateful island reads its initial state from the URL on load and writes state changes back to the URL (without a full page reload) rather than to local-only state" and that `SearchBox` is named as one of the three governed islands, full stop, with no route carve-out in the rule text. Builder B implements: on any route, typing in the global `SearchBox` immediately `pushState`s to `/search?q=...` and — to honor "without a full page reload" — fetches the Pagefind index client-side and DOM-patches the *current* page in place with search-result markup, without an actual navigation to the `/search` document.

**The clash:** Builder A's site works, but only because it silently reinterprets "without a full page reload" as scoped to same-page updates — a reinterpretation AD-3's text doesn't actually authorize. Builder B follows AD-3 to the letter and produces a broken app: the address bar reads `/search?q=foo` while the rendered DOM is still `/controls/ac-2`'s shell (wrong `<title>`, wrong layout affordances, back button now goes to a URL whose content was never actually loaded) — because nothing in the Stack or AD-1 provides a client-side router capable of swapping page content on a pathname change; AD-1 explicitly confines runtime JS to "already-built static assets," which a manufactured in-place `/search` render is not. Two equally-compliant readings of the same AD sentence produce either an inconsistency between the rule and the implementation (Builder A) or a broken UI (Builder B), and nothing in the spine states which reading is intended.

**Close with:** AD-3 should scope "without a full page reload" explicitly to state changes that don't cross a route boundary, and state separately that cross-route search entry (from any page's global `SearchBox` to `/search`) is a normal full navigation — consistent with the MPA model AD-1 commits to.

---

## 6. AD-5 — "collection-level metadata" is an ownership fork between `BaseLayout.astro` (AD-7) and Control Detail Page (AD-5's explicit binding)

**Builder A — `layouts/BaseLayout.astro`.** AD-7 already assigns this file ownership of everything that must appear "from any screen" (Search, BaselineFilter, and per Consistency Conventions, the disclaimer). Builder A treats AD-5's provenance stamp ("the UI surfaces both" catalog version and crosswalk date) as the same category of site-wide chrome and renders it once, in the footer, next to the disclaimer — sourced from a single meta entry it loads once (e.g. `getEntry('controls', '_meta')`).

**Builder B — `pages/controls/[slug].astro`.** AD-5's own "Binds" line names *only* "ingestion script (AD-2), Control Detail Page rendering" — not BaseLayout, not AD-7. Builder B reasonably concludes AD-5 assigns rendering responsibility specifically to the Control Detail Page (because provenance is about *this control's* text fidelity, rendered next to the statement it vouches for) and implements the stamp inline, near the control statement, reading it off the per-control entry's own fields (`entry.data.catalogVersion`, `entry.data.crosswalkDate` — duplicated onto every entry by ingest.mjs, since Builder B never assumed a singleton meta entry existed).

**The clash:** This is a shared-data-shape fork wearing an ownership-fork costume: AD-5 explicitly binds Control Detail Page (implying per-entry access to metadata is the intended path) while AD-7's chrome philosophy pulls the same responsibility toward BaseLayout (implying a singleton, layout-level source). If ingest.mjs (built against one of these two assumptions) produces only a singleton `_meta` entry, Builder B's per-entry field reads come back `undefined` and the Control Detail Page silently fails the "the UI surfaces both" requirement — while BaseLayout's footer stamp (if it exists) is the only place it appears, contradicting AD-5's binding to "Control Detail Page rendering" specifically. If ingest.mjs instead duplicates the fields onto every entry, BaseLayout (which has no per-route entry in scope without an extra collection query on every single route) either skips rendering it or pays an unnecessary "load one arbitrary entry just for its metadata" hack. Either way, two builders working from AD-5 and AD-7 respectively converge on different data shapes and different render locations, and can each point to spine text that names them, specifically, as the owner.

**Close with:** AD-5 should state exactly where the provenance stamp is rendered (footer/global vs. inline per control) and, correspondingly, AD-2 should state whether ingestion metadata is a collection-level singleton entry or a field duplicated onto every entry — the two decisions are coupled and neither AD currently makes both of them.

---

## 7. AD-2 vs. the erDiagram — enhancement-level baseline membership is asserted by the diagram, never by the rule text

**Builder A — `src/content/config.ts` (Zod schema) + `scripts/ingest.mjs`.** Reads AD-2's rule text: "Baseline flags... attached" to "one canonical Content Collection entry per Control." Builder A takes this at face value — baseline membership is a *control-level* concept (a control is "Low," "Moderate," "High," etc.), so the `Control` Zod type gets a `baselines: Baseline[]` field, and `Enhancement` (nested per pair #2's Builder-A shape) gets none — an enhancement is assumed to inherit its parent's baseline membership implicitly, since AD-2's sentence never mentions attaching baseline flags to enhancements individually.

**Builder B — `components/BaselineFilter`, applied within the Control Detail Page (per pair #1's resolution, once that gap is closed and the island is given DOM-filtering responsibility).** Reads the spine's own erDiagram, which explicitly and separately models `ENHANCEMENT }o--o{ BASELINE : "belongs to"` as its own many-to-many relation, distinct from `CONTROL }o--o{ BASELINE`. NIST enhancements are frequently *not* uniformly included across a control's baselines (e.g., a control might be Low/Moderate/High while only some of its enhancements are pulled into Moderate or High specifically) — real NIST 800-53 baseline profiles differ at the enhancement level, which is exactly why the erDiagram models it separately. Builder B implements enhancement-level filtering logic expecting `entry.data.enhancements[i].baselines` to exist per-enhancement.

**The clash:** `entry.data.enhancements[i].baselines` is `undefined` under Builder A's schema — every enhancement either silently vanishes from every baseline filter, or (worse, depending on the falsy-check chosen) shows up under *every* baseline regardless of actual membership, because the ingestion script that's supposed to be "the only code path allowed to... compute baseline membership" (AD-2's own stated purpose) never actually computed it at enhancement granularity. This is a case where the spine's own diagram and its own rule text disagree with each other, so two builders each reading only *one* of the two artifacts (rule prose vs. diagram) land on incompatible schemas without either violating the sentence they read.

**Close with:** AD-2's rule text should explicitly state that baseline membership is computed and attached at *both* Control and Enhancement granularity (matching the erDiagram), closing the gap between the diagram (binding, per the doc's own structure) and the prose (currently silent on enhancements).

---

## Summary of gaps to close

| # | Divergence | Category |
| --- | --- | --- |
| 1 | No AD assigns ownership of applying `?baseline=` to the static DOM | Ownership gap / two owners of nothing |
| 2 | Content Collection entry shape for enhancements (embedded array vs. sibling entries) unspecified | Shared-data-shape clash |
| 3 | `slugify()` input contract (OSCAL-native vs. canonical display) unspecified; ingestion script's binding to AD-4 is a loophole | Inconsistent ID/slug handling |
| 4 | `BaselineFilter` and `EnhancementToggle` both mutate the same URL non-destructively assumed, never enforced | Race in AD-3's URL-state contract |
| 5 | "Without a full page reload" is unsatisfiable for cross-route `SearchBox` in an MPA with no client router | Race / contradiction in AD-3 vs. AD-1 |
| 6 | "Collection-level metadata" rendering owner forks between BaseLayout (AD-7) and Control Detail Page (AD-5's explicit binding) | Two owners of one entity |
| 7 | Enhancement-level baseline membership asserted by the erDiagram, absent from AD-2's rule text | Ingestion-output-vs-page-assumption ambiguity |

Seven divergence pairs found. All seven arise from an AD (or the erDiagram) being *silent* on a dimension a second, equally-compliant builder had to guess at — not from any builder breaking a stated rule.
