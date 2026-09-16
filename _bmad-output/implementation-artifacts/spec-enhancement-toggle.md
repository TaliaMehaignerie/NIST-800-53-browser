---
title: 'CAP-3: Enhancement expand/collapse'
type: 'feature'
created: '2026-09-16'
status: 'done'
review_loop_iteration: 0
baseline_commit: '3b66172beb74ad73861d0276027c13eecf516332'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-08-20/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-BMad-2026-09-07/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-BMad-2026-09-07/EXPERIENCE.md'
  - '{project-root}/_bmad-output/specs/spec-nist-800-53-browser/SPEC.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-baseline-filter.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every Enhancement on a Control Detail page always renders fully expanded (Goal B's static placeholder) — there's no way to collapse the list to just IDs/titles, and no way to deep-link to one specific Enhancement's expanded state.

**Approach:** Convert `EnhancementItem` from always-expanded to a collapsed-by-default disclosure: click/tap the header to expand, reusing CAP-2's `setUrlState()` helper (already built generic enough for this — AD-3) to track the most-recently-opened Enhancement in `location.hash`. No new infrastructure needed; this is a markup/behavior change to one existing component plus a one-line prop passthrough in its parent page.

## Boundaries & Constraints

**Always:**
- Multiple Enhancements can be open at once — no accordion-style auto-collapse of siblings (EXPERIENCE.md → Component Patterns). Expanding never navigates away or loses scroll position.
- Each Enhancement's anchor id is its own `slug` (already `{control-slug}-{n}` shaped, e.g. `ac-2-1` — this is the existing Content Collection `slug` field, no new id scheme). `controls/[slug].astro` must pass `slug` through to `EnhancementItem` (it currently doesn't).
- Only the most-recently-opened Enhancement's slug is written to `location.hash` via `setUrlState({ hash })`, using `replaceState` (AD-3) — closing an Enhancement does not clear the hash; only opening another one overwrites it.
- On cold load, an Enhancement whose slug matches `location.hash` (with or without the leading `#`) auto-expands.
- The toggle interacts correctly with CAP-2's Baseline filter: a filtered-out Enhancement (`display: none` via `[data-baselines]`) stays visibly absent even if its own expand state is "open" underneath — no visual conflict, since `display: none` suppresses the whole row including its body.
- Keyboard: the header is reachable and operable via Tab + Enter/Space, with the `{colors.accent}` focus-visible ring already established in the codebase (Accessibility Floor — not optional per EXPERIENCE.md). Use `role="button" tabindex="0" aria-expanded` on the header since it's a `<div>`, not a native `<button>` (a `<button>` can't contain the block-level statement body without invalid nesting once expanded).
- `setUrlState()` (`src/utils/urlState.ts`) is read-only, reused as-is — CAP-2 already built its `hash` parameter generically for this.

**Ask First:**
- Nothing anticipated — no schema changes, no new routes, no changes to `setUrlState()`'s signature.

**Never:**
- No changes to `BaselineFilter.astro` or the Baseline filter's own behavior (CAP-2 is done).
- No new page routes, no SearchBox (CAP-5 is a separate goal).
- No UI framework dependency added — plain `<script>`, matching the existing zero-framework stack.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Collapsed by default | `/controls/ac-2` loaded cold, no hash | All Enhancements render collapsed (header only: chevron, id, title, badge/no-baseline indicator) | N/A |
| Toggle open | Click a collapsed Enhancement's header | Expands in place (statement visible), chevron flips, `location.hash` updates to that Enhancement's slug via `replaceState` | N/A |
| Toggle closed | Click an expanded Enhancement's header again | Collapses; `location.hash` is left as-is (still points at this Enhancement, per the "most-recently-opened" rule) | N/A |
| Multiple open | Open AC-2(1), then AC-2(3) | Both stay expanded simultaneously; hash now reads `#ac-2-3` (most recent) | N/A |
| Deep link to an enhancement | Load `/controls/ac-2#ac-2-1` cold | AC-2(1) auto-expands on load; others stay collapsed | N/A |
| Deep link, no match | Load `/controls/ac-2#does-not-exist` | No Enhancement auto-expands; no error | N/A |
| Deep link + filter together | Load `/controls/ac-2?baseline=low#ac-2-1` where AC-2(1) is Moderate-only | Filter hides AC-2(1)'s entire row (including its expanded body); AC-2(1) is still "open" in state, just not visible | N/A |
| Keyboard-only use | Tab to a collapsed header, press Enter/Space | Same effect as a click; focus-visible accent ring shows throughout | N/A |
| Withdrawn Enhancement | Any withdrawn Enhancement (e.g. AC-2(10)) | Toggles open/closed exactly like a live one; its Withdrawn marker/successor line is part of the always-visible header, statement (if any) is in the collapsible body | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/urlState.ts` -- read-only (CAP-2). `setUrlState({ search, hash })` already handles `hash` independently of `search` — reused unmodified.
- `src/components/BaselineFilter.astro` -- read-only (CAP-2). No changes; its `applyFilter()` already operates on `[data-baselines]` regardless of expand state.
- `src/components/EnhancementItem.astro` -- MODIFY: add a `slug` prop, restructure to collapsed-by-default (header always visible, statement body hidden until expanded), `id={slug}` on the root, `role="button" tabindex="0" aria-expanded="false"` on the header, chevron indicator, inline `<script>` for click/keyboard toggle + hash read (on load) and write (on expand).
- `src/pages/controls/[slug].astro` -- MODIFY: pass `slug={e.data.slug}` to `EnhancementItem` (currently omitted — only `label`/`title`/`withdrawn`/`incorporatedInto`/`baselines`/`statement` are passed).
- `src/content.config.ts` -- read-only. `slug: z.string()` already exists on every `controls` entry (Control and Enhancement kind) — no change.

## Tasks & Acceptance

**Execution:**
- [x] `src/components/EnhancementItem.astro` -- add `slug` prop; collapsed-by-default markup (chevron, `aria-expanded`, hidden body); toggle script (click + Enter/Space on the header); on load, read `location.hash` and auto-expand a matching Enhancement; on expand, call `setUrlState({ hash: slug })`.
- [x] `src/pages/controls/[slug].astro` -- pass `slug` to `EnhancementItem`.
- [x] `npm run build` -- confirms all 346 pages (345 + 404) still build with zero errors.

**Acceptance Criteria:**
- Given `/controls/ac-2` loaded cold with no hash, when the page finishes loading, then every Enhancement renders collapsed (header only, no statement text visible).
- Given a collapsed Enhancement, when the user clicks its header, then it expands without navigating away or losing scroll position, and `location.hash` updates to that Enhancement's slug via `replaceState`.
- Given two Enhancements opened in sequence, when both are expanded, then both remain visibly expanded simultaneously (no auto-collapse of the first).
- Given `/controls/ac-2#ac-2-1` loaded cold, when the page finishes loading, then AC-2(1) is already expanded and no other Enhancement is.
- Given keyboard-only navigation, when the user Tabs to a collapsed header and presses Enter/Space, then the same effect as a click occurs, with a visible accent focus ring throughout.
- Given a withdrawn Enhancement, when its header is clicked, then it expands/collapses identically to a live Enhancement (the Withdrawn marker and successor line are part of the header, not gated by expand state).

## Design Notes

Toggle script sketch (one `<script>` per `EnhancementItem` instance; Astro scopes `document.currentScript`-relative queries automatically per-component when the markup+script live in the same `.astro` file, since each instance gets its own script execution in the rendered output):

```js
const item = document.currentScript.closest('.enhancement-item');
const header = item.querySelector('.enhancement-item__header');
const body = item.querySelector('.enhancement-item__statement');

function toggle() {
  const expanded = header.getAttribute('aria-expanded') === 'true';
  header.setAttribute('aria-expanded', String(!expanded));
  if (body) body.hidden = expanded;
  if (!expanded) setUrlState({ hash: item.id });
}

header.addEventListener('click', toggle);
header.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
});

if (window.location.hash === `#${item.id}`) toggle();
```

If `document.currentScript` proves unreliable inside Astro's per-instance script execution model (verify during implementation — Astro de-duplicates identical inline scripts across repeated component instances by default, which would break a `closest()`-from-currentScript pattern), fall back to a single page-level `<script>` that iterates `document.querySelectorAll('.enhancement-item')` and attaches one listener per instance — matching `BaselineFilter.astro`'s existing pattern of a single delegated script over multiple elements.

## Verification

**Commands:**
- `npm run build` -- expected: zero errors, all 346 pages still generated (structure unchanged from Goal B/C).

**Manual checks:**
- `npm run dev`, open a Control with 2+ Enhancements (e.g. AC-2) -- confirm all collapsed by default.
- Click two different Enhancement headers -- confirm both stay expanded, `location.hash` reflects the most recently opened.
- Reload with `#ac-2-1` in the URL -- confirm AC-2(1) is expanded on load and others aren't.
- Combine with the Baseline filter (`?baseline=low#ac-2-1` where AC-2(1) isn't Low) -- confirm AC-2(1)'s row stays hidden despite being "open" underneath.
- Tab to a header with keyboard only, press Enter/Space -- confirm it toggles and the focus ring is visible.

## Suggested Review Order

**Toggle behavior**

- Entry point: delegated single-script pattern over all `.enhancement-item` instances (per this spec's own pre-approved fallback) — `toggle()` flips `aria-expanded`/`hidden` and writes the hash only when opening.
  [`EnhancementItem.astro:141`](../../src/components/EnhancementItem.astro#L141)

- Guard added post-review: no statement means no toggle affordance was ever rendered server-side, so the script skips wiring a header with no `role="button"` — a real, common case (157 Enhancements, mostly withdrawn ones, have no statement).
  [`EnhancementItem.astro:160`](../../src/components/EnhancementItem.astro#L160)

- `reveal()` added post-review to auto-expand on a matching deep-link hash without redundantly rewriting the URL back to the value it already has.
  [`EnhancementItem.astro:162`](../../src/components/EnhancementItem.astro#L162)

**Markup: conditional affordance**

- Header's `role`/`tabindex`/`aria-expanded`/`aria-controls` are all conditional on `statement.length > 0` — post-review fix so a clickable-looking header never reveals nothing.
  [`EnhancementItem.astro:43`](../../src/components/EnhancementItem.astro#L43)

- `aria-controls` added post-review, linking the header to the statement region it expands (was previously undiscoverable to assistive tech).
  [`EnhancementItem.astro:46`](../../src/components/EnhancementItem.astro#L46)

- `cursor: pointer` scoped to `[role="button"]` so a non-interactive header doesn't look clickable.
  [`EnhancementItem.astro:89`](../../src/components/EnhancementItem.astro#L89)

**Peripherals**

- `slug` prop passthrough — the one line `controls/[slug].astro` needed to supply the anchor id.
  [`controls/[slug].astro:55`](../../src/pages/controls/%5Bslug%5D.astro#L55)
