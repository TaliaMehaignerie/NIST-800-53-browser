---
title: PRD ↔ UX Spine Reconciliation
source-prd: ../../prds/prd-BMad-2026-08-20/prd.md
source-ux:
  - DESIGN.md
  - EXPERIENCE.md
created: 2026-09-07
---

# PRD ↔ UX Spine Reconciliation

Scope: qualitative/behavioral UX content (tone, voice, feel, interaction behavior implied by NFRs/constraints/non-goals) checked against `DESIGN.md` and `EXPERIENCE.md`. Missing FRs as such are out of scope (architecture/build concern) — this is about what the PRD implies for how the product should *behave/feel/look* that the spines dropped, contradicted, or under-specified.

## Gaps / Contradictions Found

### 1. Search behavior contradicts FR-5's own testable consequence — full page reload vs. "no reload"
- **PRD** (§4.5, FR-5 consequence): "Search results are reachable **without a page reload** from any screen."
- **EXPERIENCE.md** (Component Patterns → Search box): "global `SearchBox` on any page other than `/search` is a normal submit: Enter/tap navigates to `/search?q=…` (**full page load**, per architecture AD-3's MPA scoping). On `/search` itself, typing live-updates... no reload."
- These are in direct tension: the PRD's explicit, testable acceptance criterion says reaching search results from any screen should not reload the page; the spine explicitly specifies a full page load for that exact action (search submitted from anywhere except `/search` itself — i.e., the common case). Only the in-page retyping on `/search` itself is reload-free.
- This may be an intentional, defensible architecture tradeoff (static MPA, per AD-3) that the UX spine correctly inherited — but the spine should have flagged the conflict with the PRD's explicit FR consequence rather than silently satisfying the architecture decision. Worth a decision: either amend/soften the PRD's FR-5 consequence, or reconsider the search entry-point behavior.

### 2. Enhancement-level Baseline badges are missing from the component spec
- **PRD** (§4.2, FR-2 consequence): "**Each Control/Enhancement** in list and detail views shows which Baseline(s) it belongs to." This is explicit that Enhancements — not just parent Controls — need their own baseline membership shown, since an Enhancement can belong to a different baseline subset than its parent Control (e.g., a base control in all four baselines with an enhancement only required at Moderate/High).
- **DESIGN.md** (Components): `Control row` (family/list view) explicitly gets "Baseline badge(s) right-aligned." But `Enhancement toggle` is specified only as "collapsed: mono ID + title, one line, `accent`-colored chevron... Expanded: background shifts to `surface-overlay`, full statement renders inline" — **no baseline badge anywhere in the enhancement toggle spec**, collapsed or expanded.
- **EXPERIENCE.md** doesn't fill the gap either — Baseline filter behavior is described as narrowing "every list view," with no mention of how (or whether) it affects enhancement visibility within an already-open Control Detail page.
- Net effect: as specified, a user filtered to "Moderate" who opens a control could see enhancement rows with no indication of which enhancements are actually in the Moderate baseline and which aren't — the exact ambiguity FR-2 exists to prevent.

### 3. The "do not optimize for engagement" counter-metric (SM-C1) has no corresponding UX guardrail
- **PRD** (§7, SM-C1): "A fast, correct answer followed by leaving is success, not a failure to 'engage' — do not optimize for longer sessions." This is a deliberate anti-pattern the PRD calls out as a design-relevant counter-metric, not just an analytics footnote.
- Neither spine translates this into an explicit design principle or a "Don't." `DESIGN.md`'s Do's/Don'ts table and `EXPERIENCE.md`'s Voice/Tone Do/Don't table cover visual restraint and copy tone, but nothing addresses interaction-pattern restraint — e.g., no stated guardrail against "related controls you might also like," "recently viewed" rabbit holes, return-visit nudges, or other session-extending patterns that a future iteration might reach for by default.
- Current spec doesn't violate SM-C1 (no such features are proposed), but the principle itself — quantified as "leaving fast is success" — has no home in either spine, so it's not protected against being eroded later (e.g., by a well-meaning "you might also want to check AC-3" cross-link pattern added in a future iteration).

### 4. Minor: "unofficial / not an authoritative source" positioning is structural only, not voiced
- **PRD** (§11 Constraints): "The site clearly states it's an unofficial reading tool, not a substitute for the published NIST SP 800-53 Rev 5 document in any audit or compliance context."
- **EXPERIENCE.md** places the disclaimer correctly (global footer, every page, per Foundation/IA) but the Voice and Tone Do/Don't table — which otherwise gives concrete phrasing examples for empty states, 404s, and missing-crosswalk copy — has no example line for the disclaimer/positioning language itself, even though the PRD leaves the exact wording as an open question (Open Question 2). Low severity since the PRD hadn't drafted wording either, but worth flagging so the disclaimer doesn't end up as generic legal boilerplate when it's eventually written (which would itself violate the Voice/Tone table's "Don't: Legal-sounding boilerplate walls of text" row).

## Confirmed as Covered (no gap)

For contrast, the following PRD-implied qualitative/behavioral items were checked and are well-represented in the spines:
- **Deep-linking as an Interaction Primitive** — `EXPERIENCE.md` → Interaction Primitives explicitly states "any URL (family, control, filtered list, expanded enhancement, search query) loads directly to that state cold, no required prior navigation," matching the PRD's Cross-Cutting NFR and Glossary definition verbatim in spirit.
- **Phone-readable as a hard, non-optional requirement** — `EXPERIENCE.md` → Responsive & Platform ("phone is the design center, not an afterthought") and `DESIGN.md` typography (16px body, 1.65 line-height, single column at every breakpoint) both give this concrete, non-negotiable treatment consistent with the PRD's Cross-Cutting NFR wording.
- **Content fidelity (verbatim, no editorializing)** — `EXPERIENCE.md` → Voice and Tone: "Control content itself is rendered verbatim from OSCAL (never rewritten)."
- **Single-baseline (not multi-select) filter** — `EXPERIENCE.md` explicitly cites the PRD language ("matches the PRD's 'filter to a single Baseline'").
- **Data provenance / footer** — provenance footer carries OSCAL version + crosswalk date on every page (global chrome), matching the PRD constraint.
- **Accessibility floor despite no formal WCAG commitment** — both spines carry this exactly as the PRD frames it (no formal audit, but contrast/keyboard/semantic-landmark floor still enforced).
