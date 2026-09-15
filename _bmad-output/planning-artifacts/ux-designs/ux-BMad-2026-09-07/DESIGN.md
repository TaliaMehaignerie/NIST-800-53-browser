---
name: 'NIST 800-53 Browser'
description: 'Dark-mode-default reference reader for NIST SP 800-53 Rev 5. Calm, high-signal, text-first — reads like a well-typeset technical doc, not a government form.'
status: final
created: '2026-09-07'
updated: '2026-09-07'
colors:
  surface-base: '#0D1117'
  surface-raised: '#161B22'
  surface-overlay: '#1C2128'
  ink-primary: '#E6EDF3'
  ink-secondary: '#8B949E'
  ink-disabled: '#484F58'
  border-hairline: '#21262D'
  accent: '#58A6FF'
  baseline-low: '#3FB950'
  baseline-moderate: '#D29922'
  baseline-high: '#F85149'
  baseline-privacy: '#A371F7'
typography:
  heading:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontWeight: 600
    lineHeight: '1.3'
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: '16px'
    lineHeight: '1.65'
  meta:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    fontSize: '13px'
    lineHeight: '1.4'
  mono:
    fontFamily: "ui-monospace, 'SF Mono', Consolas, monospace"
    fontSize: '0.9em'
rounded:
  sm: 6px
  md: 10px
  full: 9999px
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px
  '5': 24px
  '6': 32px
  '7': 48px
components:
  control-row:
    background: transparent
    backgroundHover: '{colors.surface-raised}'
    padding: '{spacing.3} {spacing.4}'
    borderBottom: '1px solid {colors.border-hairline}'
  baseline-badge:
    rounded: '{rounded.full}'
    typography: '{typography.meta}'
    paddingX: '{spacing.2}'
    paddingY: '2px'
  control-detail-card:
    background: '{colors.surface-raised}'
    rounded: '{rounded.md}'
    padding: '{spacing.5}'
  enhancement-toggle:
    background: transparent
    backgroundExpanded: '{colors.surface-overlay}'
    rounded: '{rounded.sm}'
  search-box:
    background: '{colors.surface-overlay}'
    rounded: '{rounded.sm}'
    border: '1px solid {colors.border-hairline}'
    borderFocus: '1px solid {colors.accent}'
  baseline-filter:
    background: transparent
    backgroundActive: '{colors.surface-overlay}'
    opacityInert: 0.45
    rounded: '{rounded.full}'
    typography: '{typography.meta}'
  withdrawn-marker:
    background: '{colors.surface-overlay}'
    color: '{colors.ink-secondary}'
    rounded: '{rounded.full}'
    typography: '{typography.meta}'
    paddingX: '{spacing.2}'
    paddingY: '2px'
  provenance-footer:
    typography: '{typography.meta}'
    color: '{colors.ink-secondary}'
    borderTop: '1px solid {colors.border-hairline}'
---

## Brand & Style

This is a reading tool, not a marketing surface — the posture is calm, high-signal, and gets out of the way of dense regulatory text. Dark by default because that's how most technical reference material actually gets read (screens open next to code, at night, mid-meeting on a phone). One chromatic accent for interactive elements; four semantic colors reserved exclusively for Baseline badges, never used decoratively. No gradients, no card shadows, no illustration — the content is the interface.

## Colors

- **Surface Base (`#0D1117`)** — the canvas. Deep near-black blue rather than pure black; easier on the eyes for long reading sessions than true `#000`.
- **Surface Raised (`#161B22`)** — Control rows on hover, the Control Detail card, any surface that needs to read as "one level up" from the canvas. Distinguished from base by tone only, never by shadow.
- **Surface Overlay (`#1C2128`)** — Search box, expanded-enhancement background, anything actively in use.
- **Ink Primary (`#E6EDF3`)** — body text and control statements. Soft white, not pure `#FFF` — reduces glare against the dark canvas. Contrast against Surface Base: ≈16:1, clears WCAG AAA (7:1) even though no formal audit is committed for v1.
- **Ink Secondary (`#8B949E`)** — metadata, captions, the provenance footer, the disclaimer. Present but quiet. Contrast against Surface Base: ≈6.2:1, clears AA (4.5:1) for normal-size text.
- **Accent (`#58A6FF`)** — the only chromatic color for interactive elements: links, the active search focus ring, the "expand" affordance. Never used for anything decorative.
- **Baseline colors** — `baseline-low` (calm green), `baseline-moderate` (amber), and `baseline-high` (coral) read as a severity ramp; `baseline-privacy` (violet) is deliberately a different hue, not a fourth severity step, since Privacy is a separate axis, not "worse than High." These four exist *only* on Baseline badges — never reused as generic UI accent colors, so a glance at any list instantly reads Baseline membership without reading text.

Avoid: any color implying urgency/error outside the Baseline severity ramp itself (this is a reference tool, not a security-incident dashboard) — no red toasts, no warning icons on ordinary content.

## Typography

System font stack throughout — no webfont loading cost, consistent with the architecture's zero-JS-by-default posture and the ~2s load-time target. `body` carries a deliberately generous `1.65` line-height: control statements are dense, legalistic sentences, and breathing room is what makes them "easy to digest" rather than a wall of text. `mono` is reserved for Control/Enhancement IDs (`AC-2`, `AC-2(1)`) wherever they appear inline in prose or as row labels — a small technical cue that helps an ID stand out from the surrounding sentence at a glance, the same way inline code does in a docs site.

No display/hero type — the biggest text on any page is a Control's title, set in `heading`.

## Layout & Spacing

Scale: 4 / 8 / 12 / 16 / 24 / 32 / 48px. Family/Control list rows use the tighter end of the scale (`spacing.3`–`spacing.4`) so a long family list stays scannable; the Control Detail card and the space around a control statement use the generous end (`spacing.5`–`spacing.7`) so reading doesn't feel cramped. That split is the whole "airy but scannable" balance: dense where you're hunting, spacious where you're reading.

Single column at every breakpoint — no sidebar, no multi-pane desktop layout. The content is the same shape on phone and desktop; wider viewports just get more margin, not more UI.

## Elevation & Depth

No shadows anywhere. Hierarchy comes from the `surface-base` → `surface-raised` → `surface-overlay` tone ladder and from spacing, never from elevation. A flat, quiet reading surface stays quiet.

## Shapes

`rounded/sm` for the Search box, list rows on hover, and the Enhancement toggle surface. `rounded/md` for the Control Detail card. `rounded/full` for Baseline badges and the Withdrawn marker — the one shape family where a pill earns its keep, since it's what makes a badge read as a tag rather than a button.

## Components

- **Control row** (family/list views) — one line: mono ID, title, Baseline badge(s) right-aligned. Hairline `border-hairline` divider, no fill except on hover (`surface-raised`). A withdrawn Control/Enhancement (see "Withdrawn marker" below) shows no Baseline badges — NIST never assigns a withdrawn entry to a Baseline — and its title renders in `ink-secondary` instead of `ink-primary`, so a scanned list reads it as present-but-inactive rather than equal-weight with live entries.
- **Baseline badge** — small pill, semantic Baseline color as background at low opacity with the same color as text (not white-on-color — keeps it quiet against the dark surface). One badge per Baseline the Control belongs to.
- **Withdrawn marker** — a small `meta`-type pill reading "Withdrawn", `ink-secondary` text on `surface-overlay`, sitting where a Baseline badge would (same position, same size) — deliberately the *only* place a non-Baseline pill appears there, so it never gets mistaken for a fifth Baseline. On the Control Detail card, pairs with one line beneath the title: "Withdrawn — see {label}" (comma-joined for more than one successor), each `{label}` a real `accent`-colored link to its successor Control or Family page — one phrasing regardless of whether OSCAL called it `incorporated-into` or `moved-to`, since the ingested schema already collapses that distinction into one `incorporatedInto` list. When NIST withdrew an entry without naming a successor, the line reads "Withdrawn" alone — never invents a reason.
- **Control Detail card** — the statement in `body` type on `surface-raised`, generous internal padding. Enhancements list below, each collapsed by default.
- **Enhancement toggle** — collapsed: mono ID + title + its own Baseline badge(s), one line, `accent`-colored chevron/affordance. The badge shows the Enhancement's own Baseline membership, which may differ from that of the Control row above it (architecture AD-2; see EXPERIENCE.md → Component Patterns). Expanded: background shifts to `surface-overlay`, full statement renders inline, no navigation.
- **ISO Crosswalk entry** — sits inside the Control Detail card, below the statement. Clause reference in `mono` type (matches the ID-scannability convention), clause title in `body` type, `ink-secondary` for the "ISO/IEC 27001:2022" label prefix. When none is published, the empty-state text (see EXPERIENCE.md → State Patterns) renders in its place, same position.
- **Search box** — lives in the global header (every page). `surface-overlay` background, hairline border; on focus, the border switches to solid `accent` (`{components.search-box.borderFocus}`) rather than a separate outline ring, keeping the box itself the affordance. No icon-only affordance — always has visible placeholder text.
- **Baseline filter** — toggle group in the global header (All / Low / Moderate / High / Privacy). Inactive options are plain `meta`-type text; the active one gets a `surface-overlay` pill background — the same visual grammar as a Baseline badge, so the filter reads as "which badge color is active" at a glance. On `/search`, where it's present but inert (EXPERIENCE.md → Component Patterns), the whole group renders at `{components.baseline-filter.opacityInert}` (45%) — visibly there, visibly not doing anything, rather than silently absent.
- **Provenance footer** — quiet, `meta` type, `ink-secondary`. States the OSCAL Catalog version and crosswalk transcription date. The same footer also carries the "unofficial, not for audit use" disclaimer — grouped together since both are quiet, trust-relevant metadata, not primary content.

## Do's and Don'ts

| Do | Don't |
|---|---|
| One accent color for interaction, four semantic colors for Baseline only | Introduce new chromatic colors elsewhere in the UI |
| Generous line-height on control statement body text | Compress reading text to fit more on screen |
| Tight row density on list/family views | Carry that same tightness into the Control Detail card |
| Flat surfaces, tone-based hierarchy | Shadows, gradients, elevation as a visual device |
| Mono type for Control/Enhancement IDs inline | Mono type for anything else (titles, statements, UI labels) |
| Pill badges for Baseline only | Pill shape anywhere else in the UI |
