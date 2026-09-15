---
name: 'NIST 800-53 Browser'
status: final
sources:
  - ../../prds/prd-BMad-2026-08-20/prd.md
  - ../../architecture/architecture-BMad-2026-08-20/ARCHITECTURE-SPINE.md
  - ../../../specs/spec-nist-800-53-browser/SPEC.md
updated: '2026-09-07'
---

# NIST 800-53 Browser — Experience Spine

> Single-surface responsive web, dark-mode-only for v1. Paired with `DESIGN.md`, which is the visual identity reference; this spine owns behavior, states, and flows. Both spines win on conflict with any mock or wireframe.

## Foundation

Single-surface responsive web — no native app, no multi-surface handoff (matches PRD/spine: web-only, no accounts). No UI system named; a small hand-styled component set, matching the architecture spine's "no CSS framework pinned" decision. Dark mode is the only mode for v1 — `[ASSUMPTION: no light-mode toggle; "default dark mode" was confirmed, a light variant was not explicitly requested]`.

## Information Architecture

| Surface | Reached from | Purpose |
| --- | --- | --- |
| Home (Family list) | Cold open, logo/home link (global chrome) | Every Control Family at a glance |
| Family page | Home row tap, deep link | Controls within one Family |
| Control Detail | Family/search result tap, deep link | Full statement, inline Enhancements, Baseline badges, ISO Crosswalk |
| Search results (`/search`) | Global Search box submit from any page, deep link | Keyword/ID matches |

Global chrome, present on every surface (architecture AD-7): Search box, Baseline filter, and the provenance/disclaimer footer. No sidebar, no drawer — single column at every breakpoint, chrome lives in a slim header and footer only.

→ Composition reference: `mockups/key-home.html` (Home, chrome at rest), `mockups/key-control-detail.html` (Control Detail, an Enhancement expanded), `mockups/key-search.html` (Search results + empty state). Spines win on conflict with any of these.

## Voice and Tone

Microcopy only — brand voice lives in `DESIGN.md` → Brand & Style. Control content itself is rendered verbatim from OSCAL (never rewritten); this table covers the product's own chrome text.

| Do | Don't |
| --- | --- |
| "No ISO 27001 mapping published for this control." | "Oops! Nothing here yet 🤷" |
| "No controls match “{query}”." | "0 results found!" |
| "Control not found." (with a link back to the Family list) | "404 — Whoops, wrong turn!" |
| Plain, complete sentences for the disclaimer and provenance footer | Legal-sounding boilerplate walls of text |
| One plain sentence for the disclaimer, e.g. register: "This is an unofficial reading tool — not a substitute for the published NIST SP 800-53 Rev 5 document in any audit or compliance context." (exact wording still open, see PRD Open Question 2) | A multi-paragraph legal notice, or burying the point in hedge words |
| A fast, correct answer followed by leaving is success — no "related controls," "you might also like," or return-visit nudges | Any copy or pattern designed to extend session length (PRD's SM-C1 counter-metric) |

## Component Patterns

Behavioral specs; visuals live in `DESIGN.md` → Components.

- **Baseline filter** — single-select toggle group: All / Low / Moderate / High / Privacy.
  - Only one active at a time — matches the PRD's "filter to a single Baseline," not a multi-select facet. Selecting one narrows every list view on the current page client-side (no reload); reflected in `?baseline=` per architecture AD-3.
  - Applies to Family/Control list rows only (their Baseline membership is captured in a build-time `data-baselines` attribute per AD-7); it does **not** filter `/search` results — Pagefind's client-generated result rows aren't part of that build-time mechanism, and adding one is out of scope for v1.
  - `[ASSUMPTION: search results always show across all Baselines; the filter visibly stays present but inert on /search rather than being hidden, so its state doesn't silently vanish mid-session.]` → `mockups/key-search.html`.
- **Enhancement toggle** — click/tap the row to expand.
  - Multiple Enhancements can be open at once (no accordion-style auto-collapse of siblings) — better for comparing a Control's Enhancements side by side than forcing one-at-a-time. Expanding never navigates away or loses scroll position.
  - Each Enhancement shows its own Baseline badge(s), independent of its parent Control's (architecture AD-2).
  - URL semantics: the fragment (`#{control-slug}-{n}`, architecture AD-3) tracks the *most recently toggled-open* Enhancement only — that's the one a deep link auto-expands on cold load. Additional Enhancements opened afterward during the same session stay local UI state; they don't each claim the URL, avoiding the "which of several open enhancements does one fragment mean" ambiguity.
  → `mockups/key-control-detail.html`.
- **Search box** — on any page other than `/search`, it's a normal submit: Enter/tap navigates to `/search?q=…` (full page load, per architecture AD-3's MPA scoping — the PRD's FR-5 "no reload from any screen" phrasing predates this architecture decision and is now stale; flagged for the PRD/SPEC to be updated to match). On `/search` itself, typing live-updates the result list in place via Pagefind, no reload.
- **Control row** — the entire row is the tap target (not just the title), navigating to the Control Detail page.

## State Patterns

- **Loading (search)** — brief inline "Searching…" text while Pagefind's index resolves. No spinner icon — matches the text-first, icon-light posture.
- **Empty (search)** — "No controls match “{query}”." Plain text, no illustration.
- **Missing crosswalk** — "No ISO 27001 mapping published for this control." (PRD/spec-mandated; never a blank section.)
- **Not found** — bad slug/control ID renders "Control not found." with a link back to the Family list, not a generic framework 404 page.
- **Pre-hydration filter flash** — because Family/Control lists render statically unfiltered and the Baseline filter narrows them client-side after hydration (architecture AD-7), a page loaded with `?baseline=moderate` briefly shows the full list before narrowing. `[ASSUMPTION: accepted as-is for v1 — the flash is sub-second on a static site, and avoiding it would mean either server-rendering per-baseline pages (multiplying the page count) or a loading-state hack that adds complexity for a cosmetic issue. Flag if it reads as jarring in practice.]`

## Interaction Primitives

- **Expand/collapse** — click/tap; keyboard Enter/Space when focused. Focus-visible ring uses `{colors.accent}`.
- **Filter select** — click/tap a toggle; immediate visual update, no confirmation step.
- **Deep-link load** — any URL (family, control, filtered list, expanded enhancement, search query) loads directly to that state cold, no required prior navigation (PRD's core deep-linking requirement).
- **Back button** — every URL write (filter, expand, search-in-place) uses `replaceState`, never `pushState` (architecture AD-3) — none of these actions add a history entry. Back always returns to wherever the user was *before* they started interacting with chrome/toggles on the current page, not through a stack of intermediate filter/expand states.

## Accessibility Floor

No formal WCAG 2.1 AA audit is committed for v1 (explicit PRD/spine decision) — but the floor below is not optional:

- Semantic landmarks (`header`, `nav`, `main`, `footer`) so the page structure is navigable without relying on visual layout.
- Every interactive element (Enhancement toggle, Baseline filter, Search box) is keyboard-reachable and operable, with a visible focus indicator (`{colors.accent}` ring) — never mouse/touch-only.
- Color is never the only signal: each Baseline badge carries its label as text ("Moderate"), not color alone.
- Body and secondary text both clear WCAG AA (primary text clears AAA too) — exact contrast ratios are computed and stated in `DESIGN.md` → Colors.

## Key Flows

Mirrors the PRD's UJ-1 and UJ-2 verbatim.

- **UJ-1. Priya checks the Moderate baseline before authorizing a system.**
  Priya lands on Home, selects the Moderate Baseline filter (global chrome, visible immediately) — every Family's control count narrows in place. She opens Access Control, skims the now Moderate-only list of Control rows, taps AC-2. On the Control Detail card she confirms the statement, copies the URL (already carrying `?baseline=moderate`), and sends it to her engineering lead. **Climax:** the link she pastes opens directly to AC-2 with Moderate still applied — no "wait, which baseline was I on" moment for the recipient.

- **UJ-2. Jordan answers a control question mid-standup, from his phone.**
  Jordan taps the global Search box, types "AU-2," hits Enter — full navigation to `/search?q=au-2`, one match. He taps through to the Control Detail page, reads the statement in `body` type (generous line-height, readable one-handed), taps the AU-2(3) Enhancement toggle to check a sub-requirement, and answers before standup ends. **Climax:** zero pinch-zooming or PDF-scrolling — the answer was on-screen in two taps and one search.

## Responsive & Platform

Single column at every breakpoint (`DESIGN.md` → Layout & Spacing) — phone is the design center, not an afterthought scaled down; wider viewports add margin, never new panes or layout restructuring. Baseline badges wrap to a second line on narrow Control rows rather than truncating the Control title — the title is always the priority element.
