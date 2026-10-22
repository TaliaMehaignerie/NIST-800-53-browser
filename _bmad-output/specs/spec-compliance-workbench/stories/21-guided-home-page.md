---
title: 'Compliance Workbench — guided home page'
type: 'feature'
created: '2026-10-21'
status: 'done'
review_loop_iteration: 0
baseline_commit: '724d8c2'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
supersedes: ['17 (in part): the home page is no longer catalog-first, and the compact dashboard leaves it']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Tested 2026-10-21 by opening the live site as an interviewer with little context. The first thing seen is the header search box, then a "Control Families" heading and 20 family rows. Nothing says what the tool does, what an ODP is, or that a workbench exists; it sits behind three small header links (Review, Progress, Your data). The visitor clicked around without direction. Story 17 made the home page catalog-first on the assumption that most visitors want to read NIST 800-53. For this project's real audience (reviewers of a portfolio piece) the assumption is wrong: they need the product's story and a path, and the catalog is the supporting evidence.

**Approach:** Same route (`index.astro`), restructured top to bottom: a hero that says what the tool is and why ODPs matter, then a visible four-step path whose cards reflect the visitor's real state and link to the place each step is done, then the catalog below under its own heading. The page answers "what is this, and what do I do first?" in about ten seconds without scrolling.

## Boundaries & Constraints

**Always:**
- **Hero, above the fold at 1280×800 and 390×844.** A heading naming the tool, one sentence on what it does ("Browse NIST SP 800-53 Rev 5 and decide what each control requires of your system"), and a short ODP explainer that uses a real parameter: AC-2's statement "Review accounts for compliance with account management requirements [Assignment: organization-defined frequency]" (`ac-02_odp.10`), followed by one line on why it matters (a control can be called implemented while nobody has decided the frequency). The quoted sentence is rendered at build time from the Content Collection through the existing `resolveParams` (AD-5, AD-8), never hand-typed, so it cannot drift from the catalog.
- **Four steps, in order, each a card with a title, one line of explanation, a state line and one button:**
  1. *Choose your baseline* — button to Review (the only place the baseline is first chosen, AD-13). State: "Not chosen yet" / "Moderate ✓".
  2. *Decide the parameters* — button to Review. State: "N of M parameters reviewed" for your baseline.
  3. *Record status and evidence* — button to Review. State: "N of M controls and enhancements have a status."
  4. *Track progress and export* — button to Progress, with a secondary link to the OSCAL export on the workspace. State: the compliance figure with its raw fraction, e.g. "12% (34/275) compliant".
- **The first unfinished step is the current one:** visually emphasised, with the primary-style button; later steps use the secondary style. The cards are an ordered list (`<ol>`), so the sequence is in the markup, not just the styling.
- **Counts come from the existing modules, never a new counter:** parameter progress through `reviewItems.ts` (`reviewProgress`) over the item payload, compliance through `complianceCount.ts` (AD-15, raw fraction always shown, rounding down). Stores are read only through `odpStore` / `statusStore` / `activeBaseline` (AD-10, AD-13, AD-14).
- **No flash of wrong state.** State lines start empty and fill once the script has read the stores; they never show "0 of 0" or a default baseline's numbers first. Before a baseline is chosen, steps 2–4 read "After step 1" instead of numbers. Never fabricate a baseline (AD-13: `hasChosenBaseline()` decides, not `getActiveBaseline()`'s default).
- **Returning visitors.** Once any workbench data exists (`hasWorkbenchData()`), the hero shrinks to its heading and one sentence, and the ODP explainer moves behind a "What's an ODP?" disclosure. The steps stay, now acting as "where you left off". The page follows other tabs' writes through the existing storage-sync events (`storageSync.ts`).
- **The catalog stays on the page,** below the steps under the heading "Browse the catalog", with the 20 family rows unchanged. The header search box stays where it is.
- **The compact dashboard leaves the home page** (superseding that part of story 17): step 4 carries the figure and links to the full Progress page. Two progress displays on one page would compete with the step path.
- **With JavaScript disabled:** the hero, all four steps with their explanations and buttons (no state lines), and the catalog. No `<noscript>` notice.
- Keyboard and screen reader: every button is a real link with visible focus; each card's state line is part of its accessible name or description; the current step is marked with `aria-current="step"`.
- Copy is plain language. RMF and FedRAMP terms appear only where a step needs them, and "ODP" is always expanded on first use.

**Never:** a separate landing route, a splash screen or modal before the catalog, removing the catalog or the search box, a second counting implementation, choosing a baseline from the home page (AD-13 keeps that on Review), showing numbers for a baseline the visitor has not chosen.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| First visit | Empty localStorage | Full hero; step 1 current, "Not chosen yet"; steps 2–4 "After step 1"; catalog below | N/A |
| Baseline chosen, nothing decided | `active-baseline` = moderate | Step 1 "Moderate ✓"; step 2 current, "0 of 643 parameters reviewed" | N/A |
| Partway through | Some decisions and statuses | Step 2 or 3 current with live counts; compact hero | N/A |
| All parameters reviewed | 643/643, statuses outstanding | Step 2 done; step 3 current | N/A |
| Everything has a status | All parameters and statuses done | Step 4 current, figure shown | N/A |
| Corrupt blob | Unparseable decision blob | Read as empty (the stores' own contract); counts reflect that | N/A |
| Another tab writes | Storage event | Step states update without reload | N/A |
| No JavaScript | JS disabled | Hero, static steps, catalog | N/A |
| Narrow screen | 390 px wide | Hero and step 1 visible without scrolling; no horizontal scroll | N/A |

</frozen-after-approval>

## Code Map

- `src/pages/index.astro` -- restructured: hero, step list, catalog; compact dashboard removed.
- `src/components/HomeHero.astro` -- new: heading, sentence, ODP explainer (build-time resolved AC-2 sentence), compact mode.
- `src/components/GettingStarted.astro` -- new: the four step cards and the script that fills their state lines.
- `src/utils/reviewItems.ts`, `src/utils/complianceCount.ts`, `src/utils/workbenchData.ts` -- reused unchanged.
- `src/components/ComplianceDashboard.astro` -- `progressive` mode loses its only caller; remove it if nothing else uses it.
- `_bmad-output/specs/spec-compliance-workbench/stories/17-progressive-home-page.md` -- note that it is superseded in part.

## Tasks & Acceptance

**Execution:**
- [x] Hero with the build-time ODP example and the compact returning-visitor mode.
- [x] Four step cards with live state from the existing count modules.
- [x] Restructure the home page and remove the compact dashboard from it.

**Acceptance Criteria:**
- Given empty storage, when the home page loads, then the hero and step 1 ("Choose your baseline", current) are visible without scrolling at 1280×800 and 390×844, and no number is shown in any step.
- Given a chosen baseline with some decisions, then step 2's count equals `reviewProgress` computed independently from the stores, and step 4's figure equals the Progress page's figure.
- Given any workbench data, then the hero is compact and the ODP explainer sits behind a disclosure.
- Given JavaScript disabled, then the hero, four steps and 20 family rows render.

## Verification

- `npm run build` succeeds; the home HTML contains the AC-2 sentence as resolved from the catalog.
- Headless browser: each I/O row above, with the counts checked against an independent computation from the stores; screenshots at both viewport sizes; keyboard pass through the steps; earlier suites re-run green.
- Cold-read check: one person who has not seen the tool reads the home page for ten seconds and says what it does and what the first step is. **Not yet done: needs a person.**

**Done 2026-10-21.** Headless Edge against the built site, each I/O row checked against figures computed independently from the content files (300 counted Moderate items, 643 parameters): first visit and a chosen baseline at 1280×800 and 390×844 (hero and step 1 button above the fold, no horizontal scroll); partway state; step 3 becoming current when another tab finishes the parameters; everything done (step 4 current, `100% (300/300)`); corrupt blobs read as empty; keyboard focus ring; JavaScript disabled shows the hero, four steps and 20 family rows with no state text and no `<noscript>`. The Progress page still renders after the dashboard's `progressive` and `compact` modes were removed.

**Deviations from the text above, made while building:**
- Once a baseline is chosen, step 1's button reads "Change baseline" and links to Your data, not Review: a baseline is changed only there (AD-13), so "Choose baseline" would mislead.
- On a phone the "What's an ODP?" explainer starts folded on a first visit, so the first step stays in view once story 22 adds its button. At desktop width it starts open.
- Step 3 counts items with a recorded status other than incomplete (the `hasStatus` rule in `reviewItems.ts`).
