---
id: PLAN-compliance-dashboard
spec: ./SPEC.md
companions: ['../../planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
follows: ./PLAN-browser-workspace-integration.md
status: proposed
date: 2026-09-29
---

# Plan: Compliance Dashboard

Depends on `PLAN-browser-workspace-integration.md` (stories 7-12) landing
first — specifically story 7's `odpEdit.ts` extraction, story 8's active
baseline (AD-13), and story 10's per-control parameter payload.

That payload question is **resolved (2026-09-29): per-control build-time
embed**, measured at a 343-byte median against a 736 KB whole-dataset fetch.
Story 15 reads the same embedded payload and is no longer blocked. The
measurements are in story 10 of the integration plan.

## What this adds

Every control and enhancement gets an implementation status
(`incomplete` / `in-progress` / `compliant` / `not-applicable`), a proof-of-
completion field, and an owner. The home page becomes a dashboard showing what
fraction of the baseline is complete, filterable by baseline.

The ODP workspace answers *what did we decide this parameter should be*. This
layer answers *have we actually done it, and can we show someone*. Story 15 is
what makes them one product rather than two checklists sharing a stylesheet.

## Corpus facts this plan is built on

Measured from the committed Content Collection on 2026-09-29, not estimated:

| | value |
| --- | --- |
| Moderate baseline | **177 controls + 110 enhancements = 287 items** |
| Moderate items with at least one ODP | 198 of 287 |
| Corpus, non-withdrawn | 300 controls + 714 enhancements |
| Withdrawn (must never appear) | 182 |
| PM family | 37 controls, **13 with no baseline at all** |
| Low / Moderate / High / Privacy item counts | 149 / 287 / 370 / 96 |

Re-measure rather than trusting these if the corpus is re-ingested.

## Three decisions that have to be made before any code

### 1. Status attaches to items, not to controls

AC-2(1) is a separately assessed line item in a Moderate authorization. Status
must cover enhancements or the dashboard is confidently wrong in the worst
direction: statusing base controls only covers **177 of 287 Moderate items —
62% of the obligation, displayed as 100%**.

This rubs against AD-4, which gives enhancements no route of their own; they
render as fragments inside the parent control page. Nothing needs to change
about AD-4 — the status affordance is a per-fragment control inside
`EnhancementItem`, keyed by the enhancement's own slug, and the dashboard's
denominator comes from `getCollection('controls')` rather than from a page
count.

### 2. Status is per-system, not per-baseline (new invariant AD-14)

ODP decisions are per-baseline because they genuinely differ — High may demand
a scan frequency Moderate does not. Implementation status does not work that
way. You pursue one authorization; AC-2 is either implemented in your system
or it is not.

> **AD-14** — Control implementation status, evidence, and owner live in one
> `localStorage` blob keyed `control-status`, not one per baseline. Baseline is
> a **view filter over that single dataset**, never a data partition: "of the
> 287 items in Moderate, how many are compliant?" reads the same records as the
> same question about High. One module, `utils/statusStore.ts`, owns all reads
> and writes, mirroring `odpStore.ts`'s corrupt-safe contract (AD-10) — a
> missing or unparseable blob is empty state, never a crash, never a fabricated
> status.

The asymmetry with AD-10 is deliberate and load-bearing. Storing status
per-baseline produces two AC-2 statuses that drift apart within a day, and
makes "filter by baseline" ambiguous between filtering a view and switching a
dataset. Record the reason in the spine, because to anyone reading the two
modules side by side this looks like an inconsistency someone should clean up.

### 3. The completion denominator is one rule set in one place (new invariant AD-15)

> **AD-15** — Completion counts are computed by exactly one module,
> `utils/complianceCount.ts`, under one rule set: withdrawn items never
> counted; enhancements counted as first-class items; `not-applicable`
> **excluded from the denominator entirely**, never counted as complete;
> baseline-less PM controls always included regardless of the active filter
> and reported as their own line. Every surface that displays a percentage
> displays the raw fraction beside it.

Each of those four is a bug if missed, and every one of them is the kind of
bug that inflates the number. Folding N/A into "done" turns 275 real
obligations into a 287-item denominator with 12 free wins.

The 13 baseline-less PM controls are the subtle one. The workspace already
drops them — `entries.filter(e => e.baselines.includes(baseline))` in
`OdpWorkspace.astro` — so a baseline-filtered dashboard would drop them the
same way while they remain real obligations. They show in every filter, tagged
"program-wide", never silently.

## On evidence: reference it, do not host it

The plan is a text box, as asked — with one change that costs nothing now and
is impossible to retrofit later.

**Do not store uploaded files.** Base64 in `localStorage` inflates ~33% against
a ~5MB quota **shared with the ODP decision blobs**. Two screenshots exhausts
it, and the failure is cross-feature and invisible: `setDecision` starts
returning `false` ([odpStore.ts](../../../src/utils/odpStore.ts) handles this
honestly) and the *workspace* silently refuses to save parameter decisions
because of a file someone attached on a different page. Nobody would ever
diagnose that.

**The better framing is that a static site should not be the system of record
for evidence artifacts anyway** — no access control, no retention policy, no
backup. Real evidence already lives somewhere: a ticket, a wiki page, a scan
report in a pipeline, an S3 path. The tool's job is to *point at it*
durably, which is also what an assessor actually wants.

So: the UI is a textarea plus an optional URL field. The **stored shape is
structured from day one**:

```ts
interface EvidenceRef {
  note: string;        // the text box
  url: string | null;  // optional, one field beside it
  collectedAt: string; // ISO date, captured automatically on save
}
```

`collectedAt` is the field worth insisting on. Evidence staleness is a real
finding — a penetration test from 2023 substantiates nothing in 2026 — and an
"older than 12 months" flag is trivial once the field exists and impossible to
add to records that never captured it. Capture it automatically; surface it
later or never.

If file attachment is genuinely wanted later, it is IndexedDB (separate quota,
blob-native) as its own story, not a stretch of this one.

## Ordering

```
13 Status store + per-item status control   -- shippable: status every item, owner, N/A justification
14 Evidence references                      -- shippable: proof-of-completion field
15 The ODP interlock                        -- shippable: compliant requires reviewed parameters
    -------------- the two above are what make this a workbench --------------
16 Compliance dashboard                     -- shippable: the visual, baseline-filtered
17 Progressive home page                    -- shippable: dashboard as front door, safely
18 Backup / restore + storage budget        -- shippable: the durability story
19 Workflow accelerators                    -- shippable: bulk N/A, baseline delta, blocking view
```

13 and 14 are the data foundation and are useful alone. 15 is small and is the
highest-value story in this plan. 16 is the thing that was asked for and is
deliberately fourth, because a dashboard over a half-designed data model is a
dashboard you rebuild.

## Stories

### 13 — Control status store and per-item status control

Add `utils/statusStore.ts` (AD-14) and a status control on every control
detail page and every enhancement fragment.

Record shape, keyed by item slug:

```ts
interface StatusRecord {
  status: 'incomplete' | 'in-progress' | 'compliant' | 'not-applicable';
  justification: string;  // required iff status === 'not-applicable'
  owner: string;          // free text, may be empty
  updatedAt: string;      // ISO timestamp, set on every write
}
```

A missing record defaults to `incomplete`. `not-applicable` requires a
non-empty justification, refused at the store boundary exactly as
`overridden` requires a rationale in `odpStore` — same idiom, same
enforcement point, so the two stores read as siblings.

**Also in this story:** fix the read-amplification in `odpStore`. `getDecision`
calls `readBlob`, which does a full `JSON.parse` of the whole blob, and
`computeDashboardCounts` calls it once per entry — **643 full parses of the
same JSON on every dashboard refresh** today. Add a read-through cache
invalidated on write, inside the module, no API change, and give
`statusStore` the same treatment from the start. Doing this now rather than
in story 16 keeps the two modules symmetrical and stops the home dashboard
from inheriting the problem at 287 more reads per page load.

**Acceptance:** setting a status on AC-2 and on AC-2(1) independently
persists both. `not-applicable` with an empty justification is refused with a
visible message. A corrupt `control-status` blob yields empty state and a
console error, never a crash. Owner text round-trips. `updatedAt` advances on
every write. The ODP dashboard parses the decision blob once per refresh,
not once per entry.

**Watch for:** the status control lives in two places (control page,
enhancement fragment) and must be one component, not two. `EnhancementItem`
already receives `slug`. Keyboard operability is a requirement, matching the
existing `role`/`aria-pressed`/`focus-visible` patterns.

---

### 14 — Evidence references

Add `evidence: EvidenceRef[]` to the status record. The UI is a textarea for
the note plus an optional URL field, repeatable — an item may carry several
references. `collectedAt` is captured automatically on save and is not a user
field.

**Acceptance:** multiple evidence references per item persist and round-trip.
A reference with a note and no URL is valid. A malformed `evidence` array in
a hand-edited blob fails validation and yields empty state, consistent with
the rest of the store's contract. URLs render as links and are escaped —
this is user input.

**Watch for:** no file upload, for the reasons in the section above; if the
question comes up during implementation, the answer is IndexedDB in a
separate story, not base64 here. Evidence text is the least recoverable data
in the app — it is hand-written and exists nowhere else — which is what makes
story 18 non-optional once this ships.

---

### 15 — The ODP interlock

**A control cannot be marked `compliant` while any of its own ODPs is
`unreviewed-default`.** A hard block with an explanatory message naming the
count, and a link to those parameters — not a warning.

A hard block mirrors the existing readiness gate, whose blocking behavior is
the SPEC's own stated Success signal. A control marked compliant with three
unreviewed parameters is a control whose implementation nobody has actually
specified — the "unexamined ceiling" from the SPEC's Why, one layer up.

**Acceptance:** attempting to mark AC-2 compliant with any of its Moderate
parameters unreviewed is refused, and the message names how many. Reviewing
them all makes the same action succeed with no reload. An item with zero
parameters (89 of 287 in Moderate) is never blocked. Changing the active
baseline re-evaluates the block, since parameter scope is baseline-dependent
even though status is not.

**Watch for:** this needs the item's parameter list on a control page, which
story 10's build-time embed already provides — read that payload, do not
fetch `odp-dataset.json` and do not add a second delivery path. Their
*statuses* come from `odpStore`, which is local and needs no payload at all.
The baseline dependency is the subtle part: status is
per-system (AD-14) but the parameters gating it are per-baseline (AD-10), so
the gate's verdict can differ between Moderate and High for the same item.
That is correct, and the UI must say which baseline it is gating against.

---

### 16 — Compliance dashboard

Add `utils/complianceCount.ts` (AD-15) and the dashboard view: a hero number,
an overall stacked horizontal bar, and a per-family breakdown using the same
mark. Baseline is a filter control above the chart.

**Form.** Stacked horizontal bar, not a donut. A donut of four statuses forces
angle comparison; a stacked bar reads directly, and the same mark serves the
overall total and every family row, so one grammar covers the whole page.

**Color — validated, not chosen by eye.** Two saturated statuses only:

| status | token | note |
| --- | --- | --- |
| Compliant | `#0ca30c` | status-good |
| In progress | `#fab219` | status-warning |
| Incomplete | neutral gray | the absence state, not an alarm |
| Not applicable | neutral + 45° hatch | excluded from the denominator; texture marks the exclusion |

Two constraints produced that table, both measured:

- **Baseline must never be a color-encoded dimension on this page.**
  `--color-baseline-low` is green and `--color-baseline-high` is red. A
  compliant-green sits **ΔE 7.9 from the low-baseline green** under normal
  vision — two meanings, one color. Baseline stays a filter control, which
  dissolves the conflict instead of tuning around it. (The existing
  `BaselineBadge` is fine; it carries a text label. A chart segment does not.)
- **No red "incomplete."** Red against the compliant green fails
  deuteranopia separation at **ΔE 4.1**. Green + amber alone pass on the dark
  surface: ΔE 11.3 protan, 27.6 normal vision, contrast ≥ 3:1.

Reproduce before changing any of these:

```
node scripts/validate_palette.js "#0ca30c,#fab219" --mode dark --surface "#161b22" --pairs all
```

Status colors ship with label and icon, never color alone. Every percentage
displays its raw fraction — `64% (176/275)` — because a bare percentage over
an invisible denominator is unauditable, and auditability is the point. A
table view of the same numbers ships with the chart.

**Acceptance:** the dashboard's counts match `statusStore` exactly for the
selected baseline. N/A items appear in their own segment and are absent from
the denominator. Withdrawn items never appear. Enhancements are counted. The
13 baseline-less PM controls appear under every baseline filter, labelled.
Switching baseline changes the denominator without repainting status colors.

**Watch for:** `--color-baseline-*` tokens are for badges and filters only,
never chart fills. The four status colors need their own tokens in
`BaseLayout.astro`'s `:root` — do not reuse baseline tokens for status.

---

### 17 — Progressive home page

`index.astro` currently lists families. Do not simply replace it: a
first-time visitor would land on `0% complete — 0/287`, a poor front door for
a catalog browser and a worse one for a portfolio piece. Most visitors want
to read NIST 800-53.

Same route, conditional: catalog browse when no decision or status data
exists; the dashboard promoted above the catalog once there is. The catalog
never disappears.

**Acceptance:** a browser with empty `localStorage` sees today's family list
and no empty chart. After one status is set, the dashboard appears above it
on reload. With JS disabled the catalog renders as it does today.

**Watch for:** the "has data" check reads two stores and must not flash — the
page renders the catalog first and reveals the dashboard once the check
resolves, never the reverse.

---

### 18 — Backup, restore, and the storage budget

A **Download all data** / **Restore from file** pair covering both blobs in
one versioned envelope, plus a storage-budget indicator.

OSCAL export is a *product*, not a backup — it is lossy about owner, status
and evidence notes, and it cannot be re-imported. Losing an OSCAL export is
annoying; you regenerate it. Losing hand-written evidence and N/A
justifications is unrecoverable work that exists in exactly one browser
profile. This gap arguably exists today; story 14 makes it serious.

**Acceptance:** a full export, `localStorage.clear()`, and a restore
reproduces every decision, status, evidence reference and owner exactly.
Restoring a file from a different schema version is refused with a clear
message rather than partially applied. The budget indicator shows actual
usage against the quota and warns before writes start failing.

**Watch for:** restore is the only destructive action in the app — it must
confirm, and it must state what will be overwritten. One envelope with its
own version, not two files; the two blobs' `schemaVersion` fields travel
inside it.

---

### 19 — Workflow accelerators

Three additions, each independently droppable:

- **Bulk N/A by family**, with a structured justification type. Marking all
  of PE not-applicable one control at a time is the friction that makes
  people abandon a tracker, and provider inheritance is the most common real
  N/A reason — so offer "inherited from provider" as a first-class
  justification type alongside free text, since it is the one an assessor
  will actually ask about.
- **Baseline delta.** "Moving Moderate → High adds 121 items, 94 of them
  unstatused." A real question, exactly answerable from data already loaded.
- **What's blocking me.** Items that are in-progress, or would be compliant
  but for unreviewed ODPs (story 15's gate, inverted). More actionable than
  any percentage on the dashboard.

**Acceptance:** each bullet is separately verifiable. Bulk N/A writes N
independent records, each individually editable afterward — same fan-out
discipline as AD-11's batch writes, and for the same reason.

## Spec amendments this plan requires

- **New:** AD-14 (status is per-system, single blob), AD-15 (one denominator
  rule set).
- **Non-goals, restate rather than rely on the technicality.** The current
  text reads *"Not an SSP narrative generator — FedRAMP 20x deprecates that
  artifact."* Status plus evidence is the substance an SSP carries, so a
  reader will ask. Restate as: **structured status and evidence references,
  never generated prose.** That is a defensible line and a stronger position —
  machine-readable, continuously-verifiable evidence is closer to where
  FedRAMP 20x is heading than an SSP narrative. Verify against current FedRAMP
  guidance before using that as a positioning claim in any write-up; it is
  moving quickly.
- **New capabilities** for status (CAP-6), evidence (CAP-7), and the
  dashboard (CAP-8), so the SPEC's capability list still describes the
  product.

## Explicitly not in this plan

- **No extension of `oscalExport.ts`.** Status and evidence belong to a
  different OSCAL model than the profile it emits — an SSP's
  `implemented-requirements` or an Assessment Results document. That is a
  sibling module and a later plan, not a stretch of the existing one.
- No file upload (see the evidence section); IndexedDB is a separate story if
  it is ever wanted.
- No multi-user, accounts, or sync (SPEC Non-goals, AD-1).
- No per-item routes for enhancements (AD-4 stands).
- No second URL-state writer; everything routes through `setUrlState` (AD-3).
