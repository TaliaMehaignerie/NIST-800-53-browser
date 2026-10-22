---
title: Compliance Workbench
status: final
created: 2026-09-21
updated: 2026-09-21
---

# PRD: Compliance Workbench

*Working title — not chosen. [ASSUMPTION: naming is unresolved; see Open Questions.]*

## 0. Document Purpose

This PRD scopes a portfolio project: a small, focused extension of the existing [NIST 800-53 Browser](../prd-BMad-2026-08-20/prd.md) that demonstrates real domain depth in cybersecurity compliance, specifically the organization-defined parameter (ODP) tailoring problem that FedRAMP's 2026 rule changes pushed onto individual organizations. It is written for a technical hiring audience evaluating both compliance-domain judgment and AI-assisted engineering practice — not for a compliance team who would actually adopt it in production. Rigor target: internal-tool tier (~5-8 pages), since the audience reads it end to end rather than skimming for a go/no-go decision.

## 1. Vision

**The problem.** As of FedRAMP Notice 0013 (2026), FedRAMP stopped publishing centralized default values for organization-defined parameters. A Moderate-baseline system carries roughly 287 controls and enhancements with ODPs — including 18 "dash-one" policy-and-procedure controls (AC-1, AU-1, CM-1, etc.) that each carry the same 9 ODPs, 2 of them review-frequency parameters. Every one of those values is now a decision the organization's compliance lead has to make and defend, not a value they can copy from NIST. FedRAMP's own stated reason for the change is that centralized defaults had become unexamined ceilings — values nobody actually reviewed, adopted by default rather than by judgment.

**What it is.** Compliance Workbench is an ODP tailoring workspace layered on top of the existing static NIST 800-53 Browser. It lets someone working through a baseline assign values to the corpus's organization-defined parameters, batching structurally identical decisions (like the 18 dash-one controls' review-frequency ODPs) into one action instead of answering the same question 18 times — while still requiring a reviewed status and, on override, a written rationale for every parameter before a baseline can be marked ready. It exports a valid OSCAL profile with each decision's rationale preserved in `remarks`, because OSCAL's `set-parameter` primitive has no batching concept of its own — the fan-out and the rationale-linkage are this tool's job, not the standard's.

**Why this, not the original four features.** The original pivot conversation named four candidate features — status tracking, notes, a readiness dashboard, export — as generic "corporate compliance tool" table stakes. Research into how ODPs actually get decided (CNSSI 1253's own language permitting one policy-level answer to cover many controls; FedRAMP's 2026 default-removal rationale) showed those four features aren't separate feature ideas — they're facets of one real, specific, defensible problem:
- **Status** → per-parameter state: unreviewed default / confirmed / overridden.
- **Notes** → the rationale a reviewer writes when confirming or overriding a value — the exact artifact a 3PAO asks for.
- **Dashboard** → baseline-readiness view: what fraction of a baseline's ODPs are still sitting on an unreviewed default.
- **Export** → a real OSCAL profile, not a CSV — because that's the artifact format the domain actually uses.

This reframing is the core decision this PRD makes: build one well-grounded feature that happens to cover all four original asks, instead of four shallow ones.

**Non-goals** (carried and sharpened from the original Browser PRD's exclusions): not a multi-user tool (no backend, no auth — localStorage only, same static-site architecture as AD-1); not an assessment-workflow tool (no SAP/SAR authoring, no POA&M tracking); not a replacement for a real GRC platform or a 3PAO's own tooling; not scoped to any baseline beyond Moderate for v1. Not an SSP narrative generator — FedRAMP 20x replaces the narrative SSP with Key Security Indicators (mandatory Jan 1 2027), so building toward that deprecating artifact would target the wrong future state. Not an OSCAL-native editor — real-world OSCAL adoption is still near zero (FedRAMP RFC-0024: 100+ 2025 Rev5 authorizations, zero OSCAL submissions), so OSCAL is a supported *export* target, not the primary working format.

## 2. User Journeys

### UJ-1. Dana assigns her Moderate baseline's ODPs before the 3PAO arrives.

Dana is the compliance lead at a ~40-person SaaS company pursuing FedRAMP Moderate. FedRAMP's 2026 rules stripped out most of the parameter values FedRAMP used to assign — the 643 organization-defined parameters across her 287 in-scope controls and enhancements are now hers to decide and document.

She starts with the 18 dash-one controls in her baseline — AC-1, AU-1, CM-1, and so on — each carrying the same 9 ODPs, two of them "frequency." Instead of answering "how often is this policy reviewed" 18 separate times, the tool shows her the parameter once, with NIST's own guideline text alongside it, and lets her set a value that fans out with one action. She sets annual review as her default and moves to the next cluster.

The tool doesn't let the default sit unexamined. It flags every parameter still carrying an un-reviewed default and won't let her mark the baseline "ready" until each one has either been confirmed with a one-line rationale or overridden. When she gets to PE-1 (Physical and Environmental Policy and Procedures), she catches that her facility's actual review cadence is quarterly, not annual, and overrides it with a reason.

Six months later the 3PAO asks why her physical security policy review is quarterly when everything else is annual. She has the sentence she wrote, not a guess.

**Climax:** she exports an OSCAL profile — 643 individual `set-parameters` entries fanned out from her batched decisions, each with rationale in `remarks` — and runs `oscal-cli validate` against it. It passes: a machine-readable record where every value traces back to either a deliberate default or a documented override, never a silent, unexamined ceiling.

## 3. Functional Requirements

### 3.1 Baseline scoping

- **FR-1.** The user selects a baseline (Moderate for v1, per Non-Goals) and the workspace derives its working set: every Control and Enhancement in that baseline (`baselines` includes it, per the existing `controls` collection) that carries at least one `params` entry.
- **FR-2.** Withdrawn entries are excluded from the working set, consistent with how withdrawn entries are already treated elsewhere in the Browser (no baseline membership, no active parameters to decide).

### 3.2 Dash-one clustering and batched entry

- **FR-3.** The workspace identifies "dash-one" controls automatically — `kind === 'control'` and `id` matching `<familyCode>-1` (e.g. `ac-1`, `au-1`) — no manual tagging or hardcoded list, so the clustering stays correct if NIST's catalog changes.
- **FR-4.** For each `param.id` shared by name/semantics across the dash-one cluster (e.g. the policy-review-frequency parameter that recurs across all 18), the user sees it once, with its `label` and `guidelines` shown alongside, and sets one value.
- **FR-5.** Setting a clustered value fans it out to every dash-one control's matching parameter as an individual decision (see FR-7) — this is a UI batching convenience, not a data-model shortcut; each fanned-out decision is independently visible, independently overridable, and independently exported (per the OSCAL constraint that `set-parameter` has no batch primitive — see FR-13).
- **FR-6.** Non-dash-one parameters (the remaining ~481 of 643 for a Moderate baseline — 643 minus the 18 dash-one controls' 9 ODPs each) are presented and decided individually, one per parameter per control/enhancement. This is a deliberate, investigated exclusion, not an unexamined default: other labels do recur across many controls (e.g. "organization-defined frequency" appears on 15 distinct non-dash-one controls including AC-16, AT-2, and CA-7), but unlike dash-one's parameters — whose one-answer-covers-many-controls treatment is grounded in CNSSI 1253's own language — these recurrences carry no such grounding and no disambiguating guideline text. AC-16's review frequency and CA-7's reassessment frequency are plausibly different real-world decisions that happen to share a generic label; batching them risks a wrong default silently propagating to an unrelated control, which is the exact ceiling-effect failure this feature exists to prevent.

### 3.3 Parameter decision state and rationale

- **FR-7.** Every parameter instance (one per `param.id` per Control/Enhancement) has a decision record: `value` (free text, or a `select` choice when `param.select` is present), `status` (`unreviewed-default` | `confirmed` | `overridden`), and `rationale` (required when `status` is `overridden`, optional but encouraged when `confirmed`).
- **FR-8.** A parameter's decision defaults to `unreviewed-default` with no value until the user acts on it — the workspace never silently assumes NIST's own example/guideline text as a de facto value (this is the FedRAMP Notice 0013 ceiling-effect risk made concrete: unreviewed defaults must stay visibly unreviewed, not quietly resolved).
- **FR-9.** Changing a decision's `status` to `overridden` requires a non-empty `rationale` before the change is accepted; the UI blocks save and explains why.

### 3.4 Readiness gate and dashboard

- **FR-10.** A baseline-level readiness view shows the count/percentage of parameters still at `unreviewed-default` vs. `confirmed` vs. `overridden`, broken down by Family.
- **FR-11.** The baseline cannot be marked "ready" while any parameter remains `unreviewed-default`. This is a hard gate, not a warning — it is the mechanism that makes FR-8's ceiling-effect protection actually bind, rather than being an ignorable suggestion.
- **FR-12.** From the dashboard, the user can jump directly to any Control/Enhancement with outstanding `unreviewed-default` parameters.

### 3.5 OSCAL export

- **FR-13.** The user can export the current set of decisions as an OSCAL profile document containing one `set-parameter` entry per decided parameter (fanned out from any batched dash-one entries per FR-5) — never a single combined entry, since OSCAL's profile model has no parameter-reuse/batch primitive.
- **FR-14.** Each exported `set-parameter` carries the decision's `value` and its `rationale` in `remarks`, so the causal link between a value and its justification survives the round-trip into a format OSCAL itself doesn't natively preserve that relationship for.
- **FR-15.** The exported profile is valid against the OSCAL profile schema (verified via `oscal-cli validate` or equivalent during development/testing — this is a build-time/manual verification step, not a shipped in-app validator, per the no-backend constraint).

### 3.6 Persistence

- **FR-16.** All decisions persist in the browser via `localStorage`, keyed by baseline — consistent with AD-1 (no backend) and the "no multi-user" Non-Goal. No account, sync, or server round-trip exists or is planned.
- **FR-17.** Decisions persist across sessions on the same browser/device; there is no cross-device sync (explicit limitation, not a gap — stated in Non-Goals).

## 4. Non-Functional Requirements

- **NFR-1 (data durability).** `localStorage` is the sole store and can be cleared by the browser, the user, or a private-window session with no warning. The workspace does not implement auto-backup for v1 — the OSCAL export (FR-13) *is* the durable/portable copy, so export is framed in the UI as "your backup," not an optional afterthought. Losing unexported in-progress decisions to a cleared browser is an accepted, documented limitation at this scope, not a gap to silently paper over.
- **NFR-2 (performance).** Deriving the working set, clustering, and readiness counts for a full Moderate baseline (~287 entries, 643 parameters) runs client-side with no perceptible lag on page interaction — consistent with the Browser's existing all-static, no-backend performance profile (AD-1).
- **NFR-3 (accessibility).** Batch-entry controls, per-parameter status toggles, and the readiness dashboard are keyboard-operable and screen-reader-navigable, following the same patterns already established in the Browser (`role="button"`, `aria-expanded`, `focus-visible` — see `EnhancementItem.astro`, `BaselineFilter.astro`).
- **NFR-4 (data sensitivity).** Rationale text a user enters is their own organization's internal reasoning; it never leaves the browser (no backend, no analytics beacon, no export destination other than the user's own downloaded file). The workspace is not itself a system of record and makes no claim to be audit-grade storage — only the exported OSCAL file is meant to leave the browser.
- **NFR-5 (browser support).** Modern evergreen browsers only (current Chrome/Firefox/Safari/Edge) — no polyfills, consistent with the Browser's existing zero-framework approach.

## Open Questions

- [ASSUMPTION] Working title "Compliance Workbench" is a placeholder; not yet chosen.

## Resolved Since Finalization

- Whether structural clusters beyond dash-one exist (originally an Open Question here): investigated during spec work by querying the corpus directly. Other labels do recur across many controls, but none carry dash-one's external grounding for treating the recurrence as one decision — see FR-6. Batching stays scoped to dash-one only.
