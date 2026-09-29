---
title: 'Compliance Workbench — OSCAL export'
type: 'feature'
created: '2026-09-29'
status: 'done'
review_loop_iteration: 0
baseline_commit: '3e7a9aa502efd596c2a23ad9aa1f330844b8ad91'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Every decision a user records lives only in this browser's `localStorage` (NFR-1: no auto-backup) and has no portable, real-world artifact — the compliance domain's actual working format for parameter decisions is an OSCAL Profile's `set-parameter` entries, not a proprietary export.

**Approach:** Add an "Export OSCAL Profile" action to the workspace that serializes the baseline's current decisions (via the existing `odpStore.getDecisions`, unmodified) into a valid OSCAL Profile document and triggers a client-side file download — no server round-trip, no new storage. Always available, not gated by the readiness gate, since it doubles as the user's durable backup copy (NFR-1).

## Boundaries & Constraints

**Always:**
- `oscal-version` in the exported document comes from the ingested corpus's own `meta` collection entry (`oscalVersion`, verified real value `"1.2.2"`) — fetched at runtime from a new small build-time endpoint, never hardcoded or re-derived independently (AD-12).
- One `set-parameter` per stored decision — `Object.entries(getDecisions(baseline))` is iterated directly, one entry per call. AD-11 already guarantees every dash-one cluster member is its own fully independent decision in the blob, so no cluster-awareness is needed in export itself — never re-fan-out or combine here.
- `values: Array.isArray(value) ? value : [value]` — OSCAL's `values` is always an array regardless of whether the source decision's `value` was a string or an array.
- `remarks` is included only when the decision's `rationale` is non-empty (`trim().length > 0`) — never a fabricated or empty `remarks` field.
- `param-id` is the original OSCAL param id — recovered from the decision key (`${controlSlug}:${paramId}`) by taking everything after the first `:`, never the cluster-stripped key.
- `profile.imports[].href` references the actual ingested source filename for that baseline (e.g. `NIST_SP-800-53_rev5_MODERATE-baseline-resolved-profile_catalog-min.json`) — truthful provenance, never a fabricated or unverified live URL.
- The download is triggered entirely client-side (`Blob` + object URL + a temporary `<a download>` click) — no server, consistent with AD-1.
- Export is always available, including with zero decisions recorded — never gated by the readiness gate (story 3); it is the user's backup copy, not a reward for finishing.

**Ask First:** none anticipated.

**Never:** ship a client-side OSCAL schema validator (FR-15 — validation is a manual, dev-time step only). Never block the export button behind "Mark ready."

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Mixed decided/undecided baseline | Some of 643 params decided, rest untouched | `modify.set-parameters` has exactly one entry per *decided* param, not 643 | N/A |
| Array-valued decision | A `one-or-more` select decision, e.g. `odp.03` with 2 choices | That `set-parameter`'s `values` is the exact 2-element array, in stored order | N/A |
| Confirmed, no rationale | `status: 'confirmed'`, `rationale: ''` | `set-parameter` has no `remarks` field | N/A |
| Overridden with rationale | `status: 'overridden'`, non-empty `rationale` | `set-parameter.remarks` equals the rationale verbatim | N/A |
| Fresh baseline, zero decisions | `localStorage` empty for this baseline | Export still succeeds: a structurally valid Profile with `set-parameters: []` | N/A |
| Batch-derived decisions | 18 dash-one members set via a story 2 batch confirm | Each of the 18 appears as its own independent `set-parameter` — never combined | N/A |

</frozen-after-approval>

## Code Map

- `src/content.config.ts` — `meta` collection schema (`oscalVersion: z.string()`, verified real value `"1.2.2"`); source for the new endpoint below. Read-only.
- `src/pages/odp-dataset.json.ts` (story 1, unchanged) — existing per-param endpoint; not touched by this story.
- `src/utils/odpStore.ts:90` (`getDecisions`, unchanged) — sole source of what to export; already returns exactly the confirmed/overridden decisions (an absent key is `unreviewed-default` and is never written, so no filtering is needed).
- `src/components/workspace/OdpWorkspace.astro:922` (`init()`) — entry point; fetch the new meta endpoint alongside `odp-dataset.json`, wire the new export button.
- `data/raw/NIST_SP-800-53_rev5_{BASELINE}-baseline-resolved-profile_catalog-min.json` — the real ingested source filenames this story's `imports[].href` references per baseline (verified: `LOW`/`MODERATE`/`HIGH`/`PRIVACY` variants all exist).

## Tasks & Acceptance

**Execution:**
- [x] `src/pages/odp-meta.json.ts` -- new build-time JSON endpoint: reads `getEntry('meta', 'provenance')`, emits `{ oscalVersion: string }` -- AD-12's version source.
- [x] `src/utils/oscalExport.ts` -- new module: `buildOscalProfile({ baseline, decisions, oscalVersion })` returns a Profile document object (`uuid` via `crypto.randomUUID()`, `metadata.oscal-version` from the passed-in `oscalVersion`, `imports: [{ href: <baseline's source filename> }]`, `modify.set-parameters` built 1:1 from `decisions` per the Boundaries above); `downloadOscalProfile(profile, baseline)` serializes it to formatted JSON and triggers a client-side file download.
- [x] `src/components/workspace/OdpWorkspace.astro` -- in `init()`, fetch `odp-meta.json` once; render an "Export OSCAL Profile" button (always enabled, not gated on the readiness gate) that calls `getDecisions(baseline)`, then `buildOscalProfile`/`downloadOscalProfile`.

**Acceptance Criteria:**
- Given a baseline with decisions on some but not all parameters, when the user exports, then `modify.set-parameters` contains exactly one entry per stored decision, each `param-id` matching the original OSCAL param id.
- Given a decision with an array value, when exported, then that `set-parameter`'s `values` matches the stored array exactly.
- Given a decision with an empty rationale, when exported, then that `set-parameter` has no `remarks` field.
- Given an overridden decision with a rationale, when exported, then `remarks` equals that rationale verbatim.
- Given a fresh baseline with zero decisions, when the user clicks export, then the download still succeeds with `set-parameters: []`.
- Given the exported document's `oscal-version`, when compared to the ingested corpus's own value, then they match exactly (`"1.2.2"`), sourced from the `meta` collection, never a literal in `oscalExport.ts`.

## Spec Change Log

## Design Notes

`oscal-cli` is not installed in this development environment (confirmed) — this story's own boundary already scopes schema validation to a manual, dev-time step (FR-15), so this is a known, accepted limitation, not a gap to silently paper over: the export's structural correctness is verified by hand-tracing the OSCAL Profile model's required fields (`uuid`, `metadata.title/last-modified/version/oscal-version`, `imports` non-empty, `modify.set-parameters`) rather than by a schema validator run.

`crypto.randomUUID()` is used for the document `uuid` — supported in all evergreen browsers (NFR-5), no polyfill needed.

## Verification

**Commands:**
- `npm run build` -- expected: succeeds, emits `dist/odp-meta.json`.

**Manual checks (if no CLI):**
- `npm run dev`, open `/workspace/moderate`, decide a few individual parameters and confirm one dash-one batch cluster, click "Export OSCAL Profile" — a JSON file downloads.
- Open the downloaded file: verify `metadata.oscal-version` is `"1.2.2"`, `imports[0].href` names the Moderate baseline's real source filename, and `modify.set-parameters` has one entry per decision made (including all 18 batch cluster members independently), each shaped per the Boundaries above.
- On a fresh baseline with zero decisions, click export — verify the download still succeeds with an empty `set-parameters` array, not an error.

## Suggested Review Order

**Export serialization (the story's core logic)**

- Builds the Profile document from stored decisions: `param-id` recovery, array normalization, conditional `remarks` — start here.
  [`oscalExport.ts:90`](../../../../src/utils/oscalExport.ts#L90)

- `param-id` recovery from a decision key — everything after the first `:`, never the cluster-stripped key.
  [`oscalExport.ts:65`](../../../../src/utils/oscalExport.ts#L65)

- Client-side download trigger: `Blob` + object URL + a temporary `<a download>` click, no server round-trip.
  [`oscalExport.ts:118`](../../../../src/utils/oscalExport.ts#L118)

**Version sourcing (AD-12: never hardcoded)**

- The build-time endpoint surfacing the ingested corpus's own `oscal-version`.
  [`odp-meta.json.ts:13`](../../../../src/pages/odp-meta.json.ts#L13)

**Integration and the review-found fix**

- `init()`: the export button starts `disabled` and is only enabled once `oscalVersion` has actually loaded — the fix for a race found in review (the button was previously clickable before, or even if, the meta fetch resolved, silently producing an empty `oscal-version`).
  [`OdpWorkspace.astro:982`](../../../../src/components/workspace/OdpWorkspace.astro#L982)

- `handleExport`: wraps the export in a try/catch so a failure surfaces a message instead of a silent console-only error.
  [`OdpWorkspace.astro:494`](../../../../src/components/workspace/OdpWorkspace.astro#L494)
