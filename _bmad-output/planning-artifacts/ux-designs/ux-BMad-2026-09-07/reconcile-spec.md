# Reconciliation: SPEC.md vs. DESIGN.md / EXPERIENCE.md

Source: `_bmad-output\specs\spec-nist-800-53-browser\SPEC.md` + `glossary.md`
Checked against: `DESIGN.md` + `EXPERIENCE.md` (ux-BMad-2026-09-07)

## Method

Walked every CAP-1..6, every Constraint, every Non-goal against both UX spines; separately scanned for glossary-term drift (synonyms for Control, Control Family, Control Enhancement, Baseline, Control Detail Page, Deep Link, ISO Crosswalk).

## Gaps Found

### 1. Enhancement rows have no specified Baseline badge (CAP-2 under-specified)
CAP-2's success criterion is explicit: **"Each Control/Enhancement in view shows its Baseline membership."** The glossary reinforces that this is a real, independent data field: *"Inherits its parent Control's Family, but not its Baseline membership — enhancement-level Baseline membership is independent (see the adopted spine's AD-2)."*

But `DESIGN.md`'s Enhancement toggle component spec only describes: *"collapsed: mono ID + title, one line, accent-colored chevron/affordance. Expanded: background shifts to surface-overlay, full statement renders inline, no navigation."* No Baseline badge is specified for either the collapsed or expanded Enhancement row. `EXPERIENCE.md`'s "Enhancement toggle" component-pattern entry is purely behavioral (click to expand, multiple open at once) and likewise never mentions a Baseline indicator.

Net effect: as currently specified, a user viewing an expanded Control with Enhancements has no way to see which Baseline(s) each Enhancement belongs to — even though CAP-2 requires it, and the glossary explicitly flags enhancement-level Baseline as independent from the parent's (i.e., not inferable by just looking at the Control's own badges).

**Recommendation:** add a Baseline badge (or badge set) to the Enhancement toggle row spec in `DESIGN.md`, and confirm in `EXPERIENCE.md` whether the Baseline filter narrows/highlights Enhancements by their own membership when active on a Control Detail page (currently the filter is only described as narrowing "list view[s]," and Control Detail isn't clearly one).

### 2. ISO Crosswalk has no visual/component spec in DESIGN.md (CAP-4 under-specified)
CAP-4 requires the Control Detail page to show "the related ISO/IEC 27001:2022 clause(s)," and `EXPERIENCE.md`'s IA table correctly lists "ISO Crosswalk" as part of the Control Detail page's purpose, with a State Patterns entry for the missing-mapping case ("No ISO 27001 mapping published for this control.").

However, `DESIGN.md`'s Components section — which covers Control row, Baseline badge, Control Detail card, Enhancement toggle, Search box, Baseline filter, Provenance footer — has no entry at all for how ISO Crosswalk clause(s) render when present (placement within the Control Detail card, typography, whether clause IDs get `mono` treatment like Control IDs, etc.). The *absence* case is specified; the *present* case is not.

**Recommendation:** add an ISO Crosswalk component entry to `DESIGN.md` (or fold it explicitly into the Control Detail card spec) so the common case — a control with a published mapping — has a defined visual treatment, not just the edge case.

### 3. "Reachable without a page reload" (CAP-5) reads ambiguously against the spec'd search behavior
CAP-5's success criterion says: *"search is reachable without a page reload from any screen."* `EXPERIENCE.md` resolves this as "the SearchBox is globally present, not that search execution is reload-free" — explicitly stating that submitting a search from any page *other than* `/search` is "a normal submit... full page load," with live no-reload updates reserved for the `/search` page itself.

This is a defensible reading (and matches the architecture's MPA scoping per AD-3), but the SPEC wording is genuinely ambiguous on its face — a literal reading could expect search execution itself to be reload-free everywhere. Since SPEC.md is the canonical contract and currently under-specifies this, worth a one-line confirmation added to either SPEC.md or EXPERIENCE.md's Search box entry making the resolution explicit and citing it as intentional, so it doesn't read as a drift later.

### 4. URL "merged non-destructively" combination behavior isn't demonstrated
The Constraint *"URL-owned shareable state... merged non-destructively"* requires Baseline filter, expanded-enhancement, and search-query state to compose in the URL rather than clobber each other. `EXPERIENCE.md`'s UJ-1 flow demonstrates one pairing well (Baseline filter surviving navigation into a Control Detail URL: `?baseline=moderate`), but no flow or state pattern demonstrates the harder case — e.g., a Control Detail URL carrying both an expanded-enhancement anchor/param *and* a `?baseline=` filter simultaneously. The "Deep-link load" primitive lists the state types as a flat list ("family, control, filtered list, expanded enhancement, search query") without confirming they compose pairwise. Minor, but worth a concrete example given the SPEC explicitly calls out non-destructive merging as a constraint (not just a nice-to-have).

## Terminology Check (glossary consistency)

No drift found. Both spines use "Control Family" / "Family" (shorthand), "Control," "Control Enhancement" / "Enhancement" (shorthand), "Baseline," "Control Detail" (page/card), and "ISO Crosswalk" the same way SPEC.md itself shortens them on second reference — no competing synonyms introduced (e.g., no "section," "rule," "clause-group," or similar alternate terms for Control Family; no "tag" instead of "Baseline badge" etc.). "Control Detail Page" from the glossary appears as "Control Detail" (IA table), "Control Detail page" (prose), and "Control Detail card" (the component) — these are consistent uses of one concept (page vs. its central component), not synonym drift.

## Clean Areas (no issues)

- CAP-1 (Family→Control→Detail browse), CAP-3 (inline expand/collapse, per-Enhancement deep link), CAP-6 (deep-linkability of every state) are fully and consistently covered across both spines.
- Constraints: Content fidelity, Data provenance, Not-an-authoritative-source disclaimer, Mobile-first/no-WCAG-mandate, and Static-site/no-accounts are all explicitly reconciled in `EXPERIENCE.md` (Voice and Tone, Provenance footer, Accessibility Floor, Foundation sections).
- Non-goals: no contradictions — neither spine introduces accounts, collaboration features, native-app scope, multi-framework mappings, or GRC workflow elements.
