---
title: 'Compliance Workbench — evidence references'
type: 'feature'
created: '2026-09-30'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'fc0573d'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A status of "compliant" has nothing behind it: there is nowhere to record what proves it.

**Approach:** Add a repeatable proof-of-completion field to the status record: a note and an optional URL per reference, stored as a structured `EvidenceRef` with a `collectedAt` date the store captures itself.

## Boundaries & Constraints

**Always:**
- The UI is a textarea plus an optional URL, but the STORED shape is structured from day one: `{ note, url, collectedAt }`.
- `collectedAt` is captured automatically and is never a user field. An unchanged reference keeps its date; a new or edited one is stamped on save.
- Never store uploaded files. Base64 in localStorage inflates ~33% against a ~5MB quota shared with the ODP decision blobs, and a full quota would silently stop parameter decisions saving on other pages. File attachment, if ever asked for, is IndexedDB in its own story.
- Notes and URLs are user input: written with `.value`/`textContent` only. A URL must be http(s) (validated at the store boundary by the same `validateEvidence` the UI uses) and only a safe URL becomes a link, with `rel="noopener noreferrer"`; a hand-edited unsafe URL in storage renders as text, never a link.
- Each reference needs a non-empty note. Rows left fully empty are dropped on save.
- `schemaVersion` stays 1: `evidence` is optional on read and normalized to `[]`, so existing blobs are not treated as corrupt.
- A `setStatus` call that omits `evidence` preserves the stored references, so a status-only write can never wipe them.

**Never:** file storage, evidence staleness flagging (separate, trivial once the field exists), a second status store.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Multiple refs | Two references | Both persist and round-trip | N/A |
| Missing note | URL only | "Each evidence reference needs a note.", nothing written | N/A |
| Unsafe URL | `javascript:` | "Evidence URLs must start with http:// or https://.", nothing written | N/A |
| Unchanged ref | Re-save | Keeps original `collectedAt` | N/A |
| Edited ref | Note changed | New `collectedAt` | N/A |
| Legacy blob | Record without `evidence` | Loads as no evidence, not corrupt | N/A |
| Hostile note | `<img onerror>` | Shown as literal text | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/statusStore.ts` -- `EvidenceRef`/`EvidenceInput`, `validateEvidence`, `isSafeEvidenceUrl`, normalized read, evidence-preserving `setStatus`.
- `src/components/StatusControl.astro` -- evidence list UI, dirty tracking, save wiring.

## Tasks & Acceptance

**Execution:**
- [x] Store: structured evidence, store-stamped `collectedAt`, boundary validation.
- [x] UI: add/edit/remove rows, read-only collected date, safe link.

**Acceptance Criteria:**
- Given two references on one item, then both persist and round-trip.
- Given a reference with no note or an unsafe URL, then a visible message appears and nothing is written.
- Given an unchanged reference, then its `collectedAt` is preserved on re-save.

## Verification

- `npm run build` succeeds.
- Headless Edge: every matrix row; earlier status-control and cross-tab suites re-run green.

## Suggested Review Order

- Evidence model, validation and date stamping in the store.
  [`statusStore.ts:1`](../../../../src/utils/statusStore.ts#L1)

- Evidence rows: safe rendering and unchanged-date detection.
  [`StatusControl.astro:1`](../../../../src/components/StatusControl.astro#L1)
