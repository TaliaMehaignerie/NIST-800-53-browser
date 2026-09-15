---
title: NIST 800-53 Browser
status: final
created: 2026-08-20
updated: 2026-09-07
---

# PRD: NIST 800-53 Browser
*Working title — confirm. [ASSUMPTION: "NIST 800-53 Browser" is a placeholder name, not a chosen product name.]*

## 0. Document Purpose

This PRD defines a hobby-scope, public web tool for browsing NIST SP 800-53 Rev 5. It's written for the builder (also the PM here) to hold scope steady while building, and as a handoff point if UX or architecture work follows. Terms in the Glossary (§3) are used verbatim throughout; features are grouped with their Functional Requirements (FRs) nested underneath; inline `[ASSUMPTION]` tags mark inferred decisions, indexed in §9.

## 1. Vision

NIST SP 800-53 Rev 5 is published as a several-hundred-page PDF, and the government's own search tool over it is clunky. Anyone who needs to actually *use* the catalog — check what a control requires, see which enhancements apply, confirm it's in the Moderate baseline, find the matching ISO 27001 clause — ends up fighting the document instead of reading the requirement.

The NIST 800-53 Browser is a fast, deep-linkable, phone-readable web reader over the official OSCAL representation of the Rev 5 catalog. It renders the family tree, lets you filter by baseline, expands control enhancements inline instead of burying them in appendices, and surfaces the related ISO 27001 clause on every control page. The goal is simple: someone can get a straight, correct answer about a control faster than they could find the same passage in the PDF — on a phone, mid-meeting, without an account.

## 2. Target User

### 2.1 Jobs To Be Done
- Quickly confirm what a specific control (or enhancement) actually requires, without reading around it in a PDF.
- Check whether a control applies to a given baseline (Low / Moderate / High / Privacy) before treating it as a requirement.
- Find the ISO/IEC 27001 clause that corresponds to a control, when working across both frameworks.
- Browse a control family to understand its shape before diving into one control.
- Share a precise, stable link to a specific control or enhancement with a colleague.

### 2.2 Non-Users (v1)
Not built for audit-ready compliance records, control tailoring/POA&M/assessment workflows, or frameworks beyond 800-53 and the ISO 27001 crosswalk — full list and rationale in §5 Non-Goals. [ASSUMPTION — the unofficial/non-audit positioning; see §11 Constraints and Guardrails.]

### 2.3 Key User Journeys

- **UJ-1. Priya checks the Moderate baseline before authorizing a system.**
  Priya, an ISSO prepping an ATO package, filters the catalog to the Moderate baseline, skims the family list to see what's in scope, and sends her engineering lead a direct link to AC-2.

- **UJ-2. Jordan answers a control question mid-standup, from his phone.**
  Jordan gets asked whether the team's logging meets AU-2; on his phone he searches "AU-2", reads the control statement and its enhancements expanded inline, and answers before standup ends.

*(Lighter scope dial used per hobby/solo project — single-sentence journeys, no numbered flow.)*

## 3. Glossary

- **OSCAL** — Open Security Controls Assessment Language, NIST's machine-readable format for security control catalogs. This product's data source of record.
- **Catalog** — The full set of Control Families and Controls published as the OSCAL representation of NIST SP 800-53 Rev 5.
- **Control Family** — A named grouping of related Controls, identified by a two-letter prefix (e.g., AC = Access Control). A Catalog contains many Control Families; a Control belongs to exactly one.
- **Control** — A single named requirement (e.g., AC-2 Account Management). Belongs to one Control Family; may have zero or more Control Enhancements.
- **Control Enhancement** — A refinement of a base Control, identified by the base Control ID plus a parenthetical number (e.g., AC-2(1)). Inherits its parent Control's Family.
- **Baseline** — A named subset of Controls/Enhancements NIST designates as a minimum for a given impact level: Low, Moderate, High, or Privacy.
- **ISO Crosswalk** — NIST's official published mapping between 800-53 Controls and corresponding ISO/IEC 27001:2022 clauses.
- **Control Detail Page** — The page for a single Control: its statement, its Enhancements (expandable inline), its Baseline membership, and its ISO Crosswalk entries.
- **Deep Link** — A URL that loads directly to a specific piece of state (a Control, an expanded Enhancement, a Baseline-filtered list) without prior navigation.

## 4. Features

**Information architecture (for context):** Home (Family list) → Family page (Controls in that family) → Control Detail Page (statement, inline Enhancements, Baseline badges, ISO Crosswalk). Search and Baseline filter are available globally, not nested under any one screen.

### 4.1 Catalog & Family Navigation
**Description:** The home view lists all Control Families in the Rev 5 Catalog. Selecting a Family shows its Controls; selecting a Control opens its Control Detail Page. Realizes UJ-1, UJ-2.

**Functional Requirements:**

#### FR-1: Browse the catalog by family
A user can browse the full Rev 5 catalog organized by Control Family, drilling from family → control → detail.

**Consequences (testable):**
- Every published Rev 5 Control Family and Control renders somewhere in the tree — none silently dropped.
- Family and Control lists load without requiring Baseline or search state to be set first.

### 4.2 Baseline Filtering
**Description:** A user can filter what they're looking at down to a single Baseline. Realizes UJ-1.

**Functional Requirements:**

#### FR-2: Filter by baseline
A user can filter the Family/Control lists to show only Controls and Enhancements in a selected Baseline (Low, Moderate, High, or Privacy).

**Consequences (testable):**
- Each Control/Enhancement in list and detail views shows which Baseline(s) it belongs to.
- The active Baseline filter is reflected in the URL, so a filtered view is itself deep-linkable (realizes the deep-linking NFR — see Cross-Cutting NFRs).
- Clearing the filter returns to the unfiltered full catalog.

### 4.3 Control Detail with Inline Enhancements
**Description:** A Control Detail Page shows the Control's statement and lets the user expand any of its Enhancements in place, without navigating to a separate page. Realizes UJ-2.

**Functional Requirements:**

#### FR-3: View a control and expand its enhancements inline
A user can read a Control's full statement and expand/collapse any of its Enhancements on the same page.

**Consequences (testable):**
- Expanding an Enhancement does not navigate away from the parent Control's page or lose scroll position.
- An Enhancement's expanded state is addressable by its own Deep Link (e.g., loading a link to AC-2(1) opens AC-2's page with that enhancement already expanded).

### 4.4 ISO 27001 Crosswalk
**Description:** Every Control Detail Page shows the related ISO/IEC 27001:2022 clause(s), sourced from NIST's own OSCAL crosswalk data. Realizes UJ-1.

**Functional Requirements:**

#### FR-4: Show related ISO 27001 clause(s) on every control page
A user viewing a Control Detail Page sees the ISO 27001 clause(s) mapped to that Control, when NIST's crosswalk publishes one.

**Consequences (testable):**
- When no mapping exists for a Control, the page states that explicitly (e.g., "No ISO 27001 mapping published") rather than showing nothing.
- The crosswalk source/version is attributed on the page (ties to the data-provenance constraint below).

### 4.5 Search
**Description:** A user can search for a control by ID, title, or keyword and jump straight to it, addressing the "government's search is clunky" pain point named in the Vision.

**Functional Requirements:**

#### FR-5: Search the catalog
A user can search by Control ID, title, or statement keyword and reach the matching Control Detail Page directly from results.

**Consequences (testable):**
- Searching "AC-2" or "account management" both surface AC-2, Account Management (ID and title matches at minimum).
- The search entry point is available on every screen; submitting a search from a page other than `/search` performs a normal full-page navigation to `/search` (no client-side router in this architecture — see the architecture spine's AD-3). Once on `/search`, typing updates results in place with no reload.

**Out of Scope:** Fuzzy/typo-tolerant matching — plain substring/keyword match is sufficient for v1 (see Open Questions).

## 5. Non-Goals (Explicit)

- Not a GRC/compliance-management platform — no control tailoring, POA&M tracking, or assessment workflows.
- Not an official NIST publication or an authoritative compliance record — an unofficial reading tool.
- Not multi-framework in v1 — only 800-53 plus the ISO 27001 crosswalk NIST already publishes; no CMMC, PCI-DSS, or other framework mappings.
- Not collaborative — no accounts, comments, or shared annotations in v1.
- Not a native app — web only in v1 (see Cross-Cutting NFRs).

## 6. MVP Scope

### 6.1 In Scope
- Full NIST SP 800-53 Rev 5 Catalog (all Control Families, Controls, Enhancements).
- All four Baselines (Low, Moderate, High, Privacy) with filtering.
- Family tree browsing, Control Detail Pages, inline Enhancement expansion.
- ISO/IEC 27001:2022 Crosswalk display, sourced from NIST's OSCAL Crosswalk.
- Keyword/ID search.
- Deep-linkable URLs for every meaningful state (Family, Control, expanded Enhancement, Baseline filter).
- Responsive, phone-readable web layout. Public, free, no login.

### 6.2 Out of Scope for MVP
- Other frameworks (CMMC, PCI-DSS, HIPAA, etc.) — deferred, revisit if there's real demand. `[NOTE FOR PM]`
- Withdrawn/historical control tracking and Rev 4 comparison.
- Assessment procedures from NIST SP 800-53A.
- Accounts, saved views, annotations, or export/reporting.
- Native mobile app — responsive web only.

## 7. Success Metrics

Hobby-scope — kept intentionally light.

**Primary**
- **SM-1**: I reach for this instead of the PDF or NIST's search whenever I personally need to look up a control, and still do a month after launch. Validates FR-1 through FR-5.

**Secondary**
- **SM-2**: Other people who find it come back more than once (rough signal it replaced their old workflow, not just curiosity traffic). Validates FR-1 through FR-5.

**Counter-metrics (do not optimize)**
- **SM-C1**: Session length / time-on-page. A fast, correct answer followed by leaving is success, not a failure to "engage" — do not optimize for longer sessions. Counterbalances SM-2.

## 8. Open Questions

1. How and when does the site pick up NIST updates or errata to the Rev 5 catalog or the ISO crosswalk — manual rebuild on each release, or something scripted? (See Assumptions Index.)
2. Should an "unofficial / not for audit use" disclaimer appear on every page, or once in a footer/about page?
3. Is plain substring/keyword search good enough long-term, or will typo-tolerant/fuzzy search be needed once real usage shows people mistyping control IDs?
4. Demand for other frameworks (CMMC, PCI-DSS) or a Rev 4 comparison view — explicitly deferred per §6.2, but worth a revisit if requested more than once. `[NOTE FOR PM]`

## 9. Assumptions Index

- §Title — "NIST 800-53 Browser" is a placeholder working title, not a confirmed product name.
- §2.2 — This tool is positioned as unofficial / not an audit-ready record; no formal disclaimer language has been drafted yet (see Open Question 2).
- §10 Cross-Cutting NFRs — Performance targets (~2s initial load, ~200ms navigation) are rough hobby-scope bounds, not measured or benchmarked.

*Resolved during review: search in v1 scope, no-backend/static-site approach, and no formal accessibility target (phone-readability itself still required) — confirmed by user 2026-08-20, folded into §4.5 and Cross-Cutting NFRs directly rather than left as assumptions.*

---

## 10. Cross-Cutting NFRs

- **Performance:** Initial page load under ~2s on a typical mobile connection; navigating between controls (family → control → enhancement) feels close to instant, with a target under ~200ms since it's static/client-rendered with no server round trip. The entire point is beating a several-hundred-page PDF for speed of finding an answer. `[ASSUMPTION: targets are rough hobby-scope bounds, not measured/benchmarked yet.]`
- **Deep-linkability:** Every meaningful state (a Family, a Control, an expanded Enhancement, a Baseline filter, a search result) has a stable, human-readable URL that loads directly to the right state with no prior navigation required.
- **No backend:** Static-site generation from the OSCAL Catalog and Crosswalk data, with search running client-side; no server or database to build, host, or secure.
- **Responsive / phone-readable:** Core requirement, not a nice-to-have — layout and typography must work well from phone width up through desktop, tuned for reading dense regulatory text on a small screen. No formal accessibility standard (e.g., WCAG 2.1 AA) is targeted for v1, but phone readability itself is not optional.
- **No accounts:** Public and free, no login — nothing to build or secure around user data.

## 11. Constraints and Guardrails

- **Content fidelity:** Control statements are rendered verbatim from the OSCAL Catalog — no paraphrasing or editorializing of requirement text.
- **Data provenance:** Every page sourced from NIST data (Catalog, Baselines, Crosswalk) shows which OSCAL release/version it's rendering, so a stale copy is visible rather than silently trusted.
- **Not an authoritative source:** The site clearly states it's an unofficial reading tool, not a substitute for the published NIST SP 800-53 Rev 5 document in any audit or compliance context (see Open Question 2 for exact placement).
- **Cost:** Free-tier/low-cost static hosting — no paid infrastructure, matching hobby scope.
