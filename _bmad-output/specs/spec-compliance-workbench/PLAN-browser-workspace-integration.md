---
id: PLAN-browser-workspace-integration
spec: ./SPEC.md
companions: ['../../planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
status: proposed
date: 2026-09-29
---

# Plan: Connect the Browser and the ODP Workspace

## Why this plan exists

The Compliance Workbench (stories 1-6) and the NIST 800-53 Browser currently
share a layout and nothing else. `workspaceUrl()` in `src/utils/url.ts` has
**zero call sites** — the workspace is an unreachable route unless you type
the URL. In the other direction, a control page renders NIST's template text
(`[Assignment: organization-defined personnel or roles]`) even when the user
has already decided that parameter, because `StatementTree.astro` resolves
placeholders at build time with no trace of which `paramId` produced which
span of text.

Two consequences:

- The browser lies by omission. Reading AC-2 tells you what NIST asks for,
  never what your organization answered.
- Deciding a parameter means leaving the control you were reading, finding
  it again in a 643-row workspace, and losing the statement context that made
  the question answerable in the first place.

This plan closes both directions.

## The architectural decision this requires

**AD-9 must be amended.** Its current rule is explicit:

> `controls/[slug].astro` and every other existing page may **link into** the
> workspace but never read or write decision data themselves.

The amendment honors AD-9's stated *intent* (`Prevents:` a per-control editor
and the workspace "independently reading/writing the same localStorage blob
and disagreeing on shape, fan-out timing, or validation") while permitting the
integration:

> **AD-9 (amended)** — `odpStore.ts` remains the sole owner of decision state
> (AD-10, unchanged) and `odpEdit.ts` becomes the sole owner of decision
> *mutation semantics*: field construction, value reading, override-rationale
> validation, and cluster fan-out. Any surface may read decisions and may
> offer editing, but only by mounting `odpEdit.ts` — never by calling
> `setDecision` directly and never by reimplementing validation or fan-out.
> `OdpWorkspace` becomes the first consumer of that module rather than the
> owner of the flow.

Without this extraction the plan produces two override-validation code paths,
and one of them eventually forgets that `status: 'overridden'` requires a
non-empty rationale. That is the single highest-risk failure mode here, and
story 7 exists to prevent it before any second editing surface is written.

**One new invariant is also needed:**

> **AD-13** — The active baseline is one persisted, app-global value with one
> read/write module (`utils/activeBaseline.ts`), seeded from `?baseline=` and
> surfaced in global chrome. Decision reads outside the workspace route
> resolve their baseline through it exclusively — no page infers a baseline
> from its own URL, its content, or a hardcoded default. The workspace route
> keeps its path-based baseline (`/workspace/{baseline}`) as the authority for
> its own page and writes it back to the active baseline on load, so the two
> never silently disagree.

A Low decision and a Moderate decision for the same `controlSlug:paramId` are
genuinely different decisions living in different blobs. Every place that
shows a decided value must be unambiguous about which baseline it is showing,
or someone exports the wrong profile. AD-13 is what makes that structural
rather than a thing each page remembers to do.

## Ordering and why

```
7  Extract odpEdit.ts            -- refactor, no user-visible change
8  Active baseline (AD-13)       -- shippable: header selector + readiness chip
9  Addressable ODP slots         -- shippable: control pages show decided values (read-only)
   --------------- derisking line: 7-9 are independently valuable ---------------
10 Editing popover               -- shippable: edit one param from the control page
11 Batch scope in the popover    -- shippable: apply to all 18 dash-one controls
12 Connective tissue             -- shippable: links, summaries, cross-tab sync
20 Cross-baseline proposals      -- shippable: reuse 643 Moderate decisions in High
```

Story 20 carries a later number only because it was identified after the
dashboard plan was written. It depends on story 8 alone (the working
baseline) and can be built any time after it — it neither blocks nor is
blocked by stories 9-19.

Stories 7-9 carry all the architectural risk and are worth shipping even if
10-12 are never built: a browser that shows your decided values, with a
working baseline selector and a readiness chip, is already a connected
product. Stories 10-12 each add one affordance on top of that foundation and
can be reordered or dropped independently.

Story 9 deliberately ships **read-only** decided values before story 10 adds
editing. This separates "does the slot addressing and the client-side overlay
work correctly across 1,600 param instances" from "does the editor behave" —
two failures that are miserable to debug together.

## Stories

### 7 — Extract the shared decision-edit module

Pull `buildValueField`, `readValue`, `setFieldValue`, `isValueEmpty`, the
override-rationale validation, and the batch fan-out loop out of the
1,475-line `OdpWorkspace.astro` into `src/utils/odpEdit.ts`. `OdpWorkspace`
imports them and behaves identically. No user-visible change.

Also amend AD-9 in the architecture spine as described above, in the same
story — the code move and the invariant that justifies it land together.

**Acceptance:** every existing workspace behavior is unchanged (set, confirm,
override with and without rationale, batch fan-out, dashboard refresh,
export). `OdpWorkspace.astro` no longer contains field construction or
validation logic. A grep for `setDecision` across `src/` shows calls only from
`odpEdit.ts`.

**Watch for:** the fan-out loop currently interleaves with `rowRegistry`
refresh and `refreshDashboard()`. Extract the *decision writes* and leave the
DOM-refresh callbacks to the caller — passing a callback is fine, importing
`rowRegistry` into `odpEdit.ts` is not.

---

### 8 — Global active baseline and readiness chip

Add `utils/activeBaseline.ts` (AD-13). Extend the header in `BaseLayout.astro`
with a baseline selector and a readiness chip reading
`Moderate · 412/643 reviewed`, linking to `workspaceUrl(activeBaseline)` —
the first call site that function has ever had.

**The filter and the working baseline are two separate controls — resolved
2026-09-29.** They answer different questions, and conflating them is what
made `All` awkward:

| control | question it answers | has `All`? |
| --- | --- | --- |
| `BaselineFilter` (existing, per-page) | *what do I want to see on this page?* | yes |
| Working baseline (new, in the header) | *whose decisions am I making?* | **no** |

Split that way, `All` exists only on the control where it means something and
the question disappears. Picking a filter value may **offer** to switch the
working baseline ("Also switch to High?") but never does it silently. The
workspace route still writes its path baseline into the working baseline on
mount, since navigating to `/workspace/high/` is an unambiguous statement of
intent.

**Acceptance:** picking Moderate on a control page, navigating to a family
page, and reloading all show Moderate still the working baseline. Setting the
filter to `All` leaves the working baseline untouched. The chip's count
matches the workspace dashboard's count exactly for the same baseline. The
workspace route at `/workspace/high/` sets the working baseline to High.

**Watch for:** the readiness count needs the dataset, so the chip loads async
and must degrade to the baseline name alone, never a flash of `0/0`. Two
baseline controls visible at once on Control and Family pages is a real
legibility risk — they need visibly different treatments and unambiguous
labels ("Viewing" vs "Working in"), or users will read them as a duplicated
widget.

---

### 9 — Addressable ODP slots, showing decided values read-only

Change `resolveParams.ts` to emit a marked element rather than bare text:

```html
<span class="odp-slot" data-param-id="ac-2_prm_1" data-control-slug="ac-2"
      data-default="[Assignment: organization-defined account types]">…</span>
```

Add an `OdpOverlay` island, mounted on control and family detail pages, that
walks `.odp-slot`, resolves the active baseline (story 8), reads
`getDecision`, and swaps in the decided value with a status treatment:
unreviewed = NIST default, dotted underline, muted; confirmed = decided value,
solid accent underline; overridden = decided value plus a marker revealing the
rationale on hover/focus.

**Controls outside the working baseline — resolved 2026-09-29.** Measured:
**591 of 1,014 non-withdrawn items belong to no baseline at all, and 395 of
those carry parameters — 754 params, 47% of the corpus's 1,600.** The
workspace never shows them (`entries.filter(e => e.baselines.includes(...))`),
so a slot on one of those pages can never hold a decision.

Therefore: a slot whose item is not in the working baseline renders as
today's plain resolved text, **non-interactive**. The explanation lives once
at the ODP-summary level — "not part of the Moderate baseline" — never
per-slot. Repeating it on every slot would add a dead affordance to the
majority of control pages to say the same thing many times.

Deciding a parameter on an out-of-baseline control is **out of scope**. Such
a decision would be invisible in the workspace and absent from the OSCAL
export — work that silently evaporates. Say so in the story rather than
leaving it half-possible.

**Acceptance:** with a Moderate decision saved for `ac-2:ac-2_prm_1`, opening
`/controls/ac-2/` shows the decided value inline. A control in no baseline
renders exactly as it does today, with no interactive slots and one summary
note. With JS disabled the page shows NIST's default text and is fully
readable. Switching the working baseline re-renders the slots without a
reload, including flipping items in and out of the non-interactive state.

**Watch for:** `resolveParams` currently returns a plain string consumed by
`StatementTree` and `EnhancementItem` as a text child. Emitting markup means
those call sites need `set:html` — audit for escaping. Statement prose is NIST
content, not user input, but the decided value substituted at runtime *is*
user input and must go in as `textContent`, never `innerHTML`. Also: the
unresolved-placeholder fallback in `resolveParams` (a param id with no
matching entry renders verbatim) must keep working and should not get a slot.

---

### 10 — Edit one parameter from the control page

Clicking a slot opens a popover anchored to it, mounting `odpEdit.ts` (story
7) for that single `controlSlug:paramId`: value field, status, rationale on
override, plus the parameter's `guidelines` from the dataset — the text that
tells someone *how* to choose, currently workspace-only. Include an
"Open in workspace" deep link to
`/workspace/{baseline}/?view=individual&family=AC`, which the workspace
already supports via `switchToView`.

**Acceptance:** setting a value from a control page popover persists, is
visible in the workspace without a reload path other than navigation, and
counts toward the readiness chip. Attempting `overridden` with an empty
rationale is refused with the same message the workspace shows. The popover is
keyboard-operable: opens on Enter/Space, traps focus, closes on Escape,
returns focus to the slot.

**Payload — resolved, measured 2026-09-29.** The popover needs `label`,
`select` and `guidelines` for each of the control's own params. **Embed them
per control at build time**, from `getCollection('controls')` — the same
collection the page is already being built from, so no new pipeline and AD-8
is untouched. Do not fetch `odp-dataset.json` from a control page.

| | |
| --- | --- |
| `dist/odp-dataset.json` as built today | **736 KB** (75 KB gzipped) |
| Params-only subset, no statement prose | 314 KB |
| **Per-control payload, median** | **343 bytes** |
| Per-control payload, worst case | 3.2 KB (`si-7-1`, 16 params) |
| Items carrying at least one param | 679 |

343 bytes inline against a 736 KB fetch is not a trade-off. Total cost across
all 679 pages is 314 KB of static HTML that no visitor downloads more than a
sliver of.

Note where the 736 KB came from: story 5 added `statementProse` per param
instance, roughly doubling the file. That is correct for the workspace, which
genuinely needs the whole set — but it is exactly why shipping it to every
control page view would be an unforced error.

**Watch for:** embed only what the popover needs. `statementProse` is already
on the page as rendered prose; do not duplicate it into the embedded payload.

---

### 11 — Batch scope in the popover

When the slot's param belongs to a dash-one cluster, the popover offers a
second scope: "Apply to all 18 dash-one controls", using
`groupDashOneClusters` and `computeClusterMatch` (story 2's module, reused
unmodified per AD-11). Show the live match count — *"14 of 18 currently
match"* — before the user applies anything.

That count is what makes batch editing from a control page trustworthy: from
inside AC-1 you cannot see the other 17 controls you are about to write to.
Applying must never be a blind overwrite.

**Acceptance:** applying a batch value from PE-1's popover writes 18
independent decisions, each individually overridable afterward — verified by
overriding one and seeing the match count drop to 17 without touching the
others. A non-clustered param's popover shows no batch scope at all.

**Payload — same resolution as story 10.** Cluster membership is computed at
build time into a `paramId` → `clusterKey` index and embedded alongside the
per-control param payload. Do not ship 1,600 entries to run
`groupDashOneClusters` client-side. The cluster's member list and current
values still have to be read at interaction time (from `odpStore`, which is
local), so only the *membership index* is precomputed — the match count stays
a fresh read-time computation per AD-11.

**Watch for:** AD-11 forbids *storing* a cluster reference in a decision. A
build-time display index is not that, but say so explicitly in the story so
the next reader does not flag it as a violation.

---

### 12 — Connective tissue

Four small additions, each independently droppable:

- **Per-control ODP summary** on the control detail page: "9 parameters —
  6 confirmed, 1 overridden, 2 unreviewed", with a jump to the first
  unreviewed. The dashboard's family table, one level down.
- **Family page readiness column** per control — the family view is where
  someone picks what to work on next.
- **Workspace rows link back out**: every row's control id becomes a link to
  `/controls/<slug>/`. Today it is dead text, so there is no path from a
  parameter to the control it governs.
- **Cross-tab sync**: `storage` event listeners in both the overlay and the
  workspace. Cheap now; deeply confusing to debug later when someone edits in
  two tabs. Note this narrows the spine's stated "last-write-wins, no
  BroadcastChannel sync" convention to "last-write-wins, with passive
  cross-tab refresh" — a refinement, not a contradiction, but worth recording.

**Acceptance:** each bullet is separately verifiable; a decision made in tab A
is reflected in tab B's slot rendering and readiness chip without a reload.

### 20 — Cross-baseline decision proposals

**Low ⊂ Moderate ⊂ High, strictly** — verified against the corpus: all 149
Low items are in Moderate, and all 287 Moderate items are in High. So a user
who finishes Moderate (643 parameters) and switches to High meets 767
parameters, **643 of which are the identical `controlSlug:paramId` they just
decided**, sitting in a different blob, every one reading as unreviewed.

Without this story they redo all 643. That is the main path between the two
most common baselines, not an edge case.

When a parameter is `unreviewed-default` in the working baseline but decided
in another, present the other baseline's value as a **proposal carrying its
provenance** — "Moderate: annually — adopt for High?" — with status remaining
`unreviewed-default` until the user explicitly confirms. Add a bulk "adopt
all 643 from Moderate" that still records each one as a deliberate confirm,
never a copy.

**Never auto-copy on baseline switch.** It fabricates review status, which is
the one thing `odpStore` is built never to do, and it is substantively wrong:
High legitimately demands stricter values than Moderate for real parameters
(scan frequency, log retention). A blanket copy produces a High profile
asserting Moderate's posture. That is exactly the unexamined-ceiling failure
this SPEC's **Why** is written against — so the proposal must cost an act of
review, which is the product's own argument, implemented.

**Acceptance:** with Moderate fully reviewed, switching to High shows 643
proposals and 124 genuinely-new parameters. A proposal counts as unreviewed
in the readiness gate until confirmed. Confirming one writes an independent
High decision without touching the Moderate one. Bulk adopt writes 643
independent decisions, each individually overridable afterward. Editing a
proposed value before confirming stores the edited value, not the proposal.

**Watch for:** storage stays per-baseline — this is a read across blobs, not
a shape change, so AD-10 is untouched and there is no migration. Privacy
barely participates (53 of its 96 items are privacy-only), so do not build
the UI around a four-way comparison. When several baselines have a decision
for the same param, propose from the **nearest stricter** one and name it;
never merge them into one unattributed suggestion.

## Open questions

All three original questions are resolved. Kept here with their resolutions
so the reasoning stays on the record.

1. ~~**`All` and the active baseline (story 8).**~~ **Resolved 2026-09-29:**
   the question dissolved rather than being answered — the per-page filter
   and the working baseline are two separate controls, and only the filter
   has `All`. See story 8. A third sub-question surfaced and is resolved in
   story 9: what a slot does on an item in no baseline, which turns out to be
   47% of all parameters.
2. ~~**Dataset delivery to control pages (stories 10-11).**~~ **Resolved
   2026-09-29:** per-control build-time embed. Measurements and reasoning in
   story 10. Stories 10, 11 and dashboard-plan story 15 are unblocked.
3. ~~**Privacy baseline overlap.**~~ **Resolved 2026-09-29, and it was
   mis-sized as a hinting question.** Because Low ⊂ Moderate ⊂ High strictly,
   all 643 Moderate parameters recur in High, so the real problem is a full
   redo of a completed baseline, not a display hint. Now story 20. Privacy
   itself is largely orthogonal (53 of 96 items are privacy-only) and is the
   minor case.

**Still genuinely open:** nothing blocking. The nearest thing to a live
question is story 8's two-baseline-controls legibility risk, which is a
design detail to resolve while building, not a decision that gates work.

## Explicitly not in this plan

- No change to `scripts/ingest.mjs` or the ingestion pipeline (AD-2).
- No backend, no accounts, no sync (SPEC Non-goals, AD-1).
- No extension of batching beyond dash-one (SPEC Constraints — the
  "frequency" label recurrence stays unbatched).
- No second URL-state writer; everything routes through `setUrlState` (AD-3).
