---
name: 'NIST 800-53 Browser — UX/Architecture Reconciliation'
status: draft
created: '2026-09-07'
sources:
  - ../../architecture/architecture-BMad-2026-08-20/ARCHITECTURE-SPINE.md
  - ./DESIGN.md
  - ./EXPERIENCE.md
---

# Reconciliation — Architecture Spine vs. UX Spines

Checked every AD in `ARCHITECTURE-SPINE.md` against `DESIGN.md` and `EXPERIENCE.md` for UX-relevant implications dropped or contradicted. Findings below; ADs with no gap are noted as clean.

## Gap 1 — AD-3: Enhancement expand/collapse never reconciles "multiple open at once" with the single-value URL fragment

**AD-3's contract:** expanded-enhancement state lives in the URL fragment, one value: `#{control-slug}-{n}`. The `Deep-link load` Interaction Primitive in `EXPERIENCE.md` explicitly lists "expanded enhancement" as one of the URL states that "loads directly to that state cold."

**What EXPERIENCE.md actually says (Component Patterns → Enhancement toggle):** "click/tap the row to expand; multiple Enhancements can be open at once (no accordion-style auto-collapse of siblings). Expanding never navigates away or loses scroll position."

**The gap:** a single fragment (`#ac-2-1`) cannot represent two or more simultaneously-expanded enhancements. EXPERIENCE.md never says:
- whether expanding an enhancement writes to `location.hash` at all (it may be intentionally local-only UI state, in which case the `Deep-link load` bullet's claim that "expanded enhancement" is deep-linkable is itself the thing in tension with "multiple open at once"), or
- if it does write, which one wins when several are open (last-toggled? first?), or what happens to the fragment when a second enhancement is opened while one is already reflected in the URL, or
- that landing on a URL carrying `#ac-2-1` should auto-expand that specific enhancement on load (the reverse direction of AD-3's contract is never stated).

This is a real contradiction, not just a missing detail: "multiple open at once" and "a single fragment is the source of truth for expand state" cannot both be true as currently written. Needs one of: (a) only the most-recently-toggled enhancement is URL-tracked while others remain ephemeral/non-shareable, explicitly stated, or (b) the fragment scheme is widened to a list, which would itself be an architecture-level change AD-3 doesn't currently authorize.

## Gap 2 — AD-3: no mention that filter/expand/search URL writes use `replaceState`, not `pushState`

**AD-3's contract:** "Every state category uses `replaceState`, not `pushState` — filter, search, and expand/collapse changes do not spam browser history."

**What's missing:** `EXPERIENCE.md`'s State Patterns and Interaction Primitives sections never mention browser-back behavior. A reader of the UX spine alone would reasonably assume each filter/expand/search interaction is a normal history-entry-producing action (since that's the default web mental model), and could design/QA a "press Back to undo my last filter click" affordance that the architecture explicitly rules out. Not a contradiction, but a dropped detail with real behavioral consequence (pressing Back after selecting a Baseline filter does *not* revert the filter — it goes to whatever the *previous route* was). Worth a one-line addition to State Patterns or Interaction Primitives.

## Gap 3 — AD-7: Baseline filter's reach into the Search results page is undefined

**AD-7's contract:** `BaselineFilter`'s DOM-level row-hiding mechanism is scoped explicitly to "Family/control list pages," which render rows with a build-time `data-baselines` attribute. Nothing in AD-7 extends this mechanism to `/search`, where result rows come from Pagefind's runtime index, not the Content Collection's build-time HTML.

**What EXPERIENCE.md says (Component Patterns → Baseline filter):** "Selecting one narrows every list view on the current page client-side (no reload)." Since `BaselineFilter` is global chrome present on `/search` too (per the IA table), "every list view on the current page" reads as if it also applies to search results — but AD-7's actual mechanism (a `data-baselines` attribute set at ingestion/build time) has no defined equivalent for Pagefind's runtime-generated result rows. `EXPERIENCE.md` never states whether: Baseline filter is inert/hidden on `/search`, Pagefind results also carry baseline metadata that `BaselineFilter` can read, or filtering search results is simply out of scope for v1. UJ-2 (the search flow) never exercises the Baseline filter, so this ambiguity has gone untested by the one flow that would surface it.

**Note:** the other explicit ask — whether the "pre-hydration filter flash" State Pattern note matches what AD-7 says — checked clean. `EXPERIENCE.md`'s wording ("family/control lists render statically unfiltered and BaselineFilter narrows them client-side after hydration") matches AD-7's rule ("pre-hydration paint is always the unfiltered list... filtering is a client-side effect of BaselineFilter") correctly, including which pages it applies to.

## Gap 4 — AD-2: an Enhancement's own Baseline membership (independent of its parent Control's) is never surfaced in either UX spine

**AD-2's contract:** "Baseline membership is computed and attached at both Control and Enhancement granularity — an Enhancement does not inherit its parent's baselines implicitly; NIST baselines routinely include a control without pulling in all of its enhancements." This is a deliberate, called-out modeling decision (separate `ENHANCEMENT }o--o{ BASELINE` relation in the erDiagram) — meaning a user filtered to, say, Moderate could land on a Control that qualifies for Moderate while one or more of its Enhancements do not, or vice versa.

**What's missing in both spines:**
- `DESIGN.md`'s `enhancement-toggle` component token set has no Baseline-badge slot at all — compare to `control-row`, which explicitly carries "Baseline badge(s) right-aligned." The Components section (`DESIGN.md`) describes the enhancement toggle as "collapsed: mono ID + title... Expanded: ...full statement renders inline" — no badge, in either state.
- `EXPERIENCE.md`'s Enhancement toggle Component Pattern describes only the expand/collapse interaction, never Baseline membership display, and never says whether `BaselineFilter`'s row-hiding (AD-7) reaches into the Enhancement list nested inside an already-rendered Control Detail card.
- Net effect: if a user filters to "Moderate" and opens a Control that's in Moderate but has an Enhancement that is *not*, there is no defined UX — the enhancement isn't visually flagged as out-of-baseline, and it's unclear if it's hidden, shown-but-unmarked, or shown identically to an in-baseline enhancement. This directly contradicts the spirit of AD-2's granularity decision: the data model deliberately tracks this distinction, but nothing in the UX spines reads it back out to the user.

## Clean — AD-4 (routing/slugs)

No UX-relevant gap found. `EXPERIENCE.md`'s IA table (`/families/{slug}`, "Control Detail", etc.) and its "Control not found" state align with AD-4's routing/slug contract. `DESIGN.md`'s mono-type treatment of IDs is applied to canonical uppercase display strings (`AC-2`, `AC-2(1)`), consistent with AD-4's rule that slugs are URL/filename-only and canonical uppercase is used for all display text — the UX spines never conflate the two.

## Clean — AD-1, AD-5, AD-6

No UX-relevant contradictions found. AD-5's single-render provenance/version stamp maps cleanly onto `EXPERIENCE.md`'s "Provenance footer" (global chrome, once). AD-1 and AD-6 are build/deploy-path invariants with no UX surface to check against.

---

## Summary Table

| AD | UX-relevant? | Status |
| --- | --- | --- |
| AD-1 | No | Clean |
| AD-2 | Yes | **Gap** — Enhancement's independent Baseline membership not surfaced (badges, filter reach) |
| AD-3 | Yes | **Gap** — multi-open enhancements vs. single URL fragment unreconciled; replaceState-vs-history silently dropped |
| AD-4 | Yes (checked) | Clean |
| AD-5 | Yes (checked) | Clean |
| AD-6 | No | Clean |
| AD-7 | Yes | **Gap** — Baseline filter's reach onto `/search` results undefined; pre-hydration flash note itself is accurate |
