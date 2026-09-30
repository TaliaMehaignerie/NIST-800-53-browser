---
title: 'Compliance Workbench — backup, restore, and the storage budget'
type: 'feature'
created: '2026-09-30'
status: 'done'
review_loop_iteration: 0
baseline_commit: 'f75034f'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Hand-written evidence and N/A justifications live in exactly one browser profile. OSCAL export is a product, not a backup: it omits owners, statuses and evidence notes and cannot be re-imported. Losing the profile loses unrecoverable work, and a full localStorage quota would silently stop saves.

**Approach:** A Download all data / Restore from file pair covering both blobs in one versioned envelope, plus a storage-budget indicator that warns before writes start failing.

## Boundaries & Constraints

**Always:**
- One envelope with its own `envelopeVersion`, not two files; both blobs' `schemaVersion` fields travel inside it. The envelope carries every baseline's decisions and the control-status blob.
- Restore validates the WHOLE file before writing anything. A different envelope version, a blob on another schema version, a damaged blob, an unknown baseline, a wrong app or non-JSON is refused with a clear message and "Nothing was changed" — never partially applied.
- Restore is the only destructive action in the app: it always confirms, and the confirmation states what is overwritten (current decisions and status records) and what replaces it (the file's). It offers to download the current data first.
- Restore is all-or-nothing: a failed write restores every key to what it was.
- All storage access stays in `odpStore.ts` / `statusStore.ts` (AD-10, AD-14): they gain raw read/write functions; `backup.ts` uses only those.
- The budget shows real usage (this app's blobs, counted in characters) against the quota and warns at 80%, more strongly at 95%, site-wide, before writes fail. Browsers do not expose localStorage's limit, so ~5M characters is used and labelled approximate.
- Text says OSCAL export is not a backup.

**Never:** a restore without confirmation, two files, merging silently, partially applying a file.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Round trip | Export, `localStorage.clear()`, restore | Every stored key deep-equal to before | N/A |
| Other schema | Blob or envelope on another version | Refused naming both versions; data unchanged | N/A |
| Damaged or partial file | Valid decisions, invalid status | Refused; data unchanged | N/A |
| Write failure | Quota error mid-restore | Previous data restored; message says so | Rollback |
| Cancel | Confirm dialog | Nothing changed | N/A |
| Near full | Usage 85% / 97% | Site-wide banner, stronger at 97%; full meter on the data page | N/A |
| Another tab fills storage | Storage event | Banner appears without reload | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/backup.ts` -- envelope build/parse/summarize/apply, storage usage.
- `src/utils/odpStore.ts`, `src/utils/statusStore.ts` -- raw read/write, exported schema versions and validators.
- `src/components/DataBackup.astro`, `src/pages/data.astro` -- the Your data page.
- `src/components/StorageWarning.astro`, `src/layouts/BaseLayout.astro`, `src/utils/url.ts` -- site-wide warning and header link.

## Tasks & Acceptance

**Execution:**
- [x] Store raw access and exports.
- [x] Envelope, validation, atomic apply, budget.
- [x] Data page with confirmation, and the site-wide warning.

**Acceptance Criteria:**
- Given a full export, `localStorage.clear()` and a restore, then every decision, status, evidence reference and owner is reproduced exactly.
- Given a file from a different schema version, then it is refused with a clear message and nothing changes.
- Given usage over 80%, then a warning appears before writes fail.

## Verification

- Headless Edge: real download, clear, restore via the file chooser, every key deep-equal; eight refusals each leaving storage byte-identical; forced quota error mid-restore rolls back; cancel; budget 50/85/97% with the reported percentage equal to the measured one; banner live across tabs; earlier suites re-run green. Rendered and inspected.
- The active working baseline is a preference, not work product, and is not part of the backup.

## Suggested Review Order

- Envelope validation and atomic apply.
  [`backup.ts:1`](../../../../src/utils/backup.ts#L1)

- The Your data page and the confirmation step.
  [`DataBackup.astro:1`](../../../../src/components/DataBackup.astro#L1)

- Raw store access that keeps localStorage inside the stores.
  [`statusStore.ts:1`](../../../../src/utils/statusStore.ts#L1)
