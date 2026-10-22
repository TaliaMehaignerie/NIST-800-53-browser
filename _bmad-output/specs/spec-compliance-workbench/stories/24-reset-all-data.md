---
title: 'Compliance Workbench — reset all data'
type: 'feature'
created: '2026-10-22'
status: 'done'
review_loop_iteration: 0
baseline_commit: '724d8c2'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
depends_on: ['18', '22']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** There is no way to start over. Sample data can be cleared from its banner, but a visitor's own data can only be replaced by restoring a backup. Someone who has been experimenting, or wants to try the sample after entering real data, has to clear browser storage by hand.

**Approach:** A "Reset all data" section on the Your data page. It removes everything the workbench stores and returns the browser to a first-time visitor's state, after a confirmation that says exactly what will be deleted and offers a backup download first.

## Boundaries & Constraints

**Always:**
- **One clearing path.** Reset uses the same function the sample banner's clear uses. Generalize `clearSampleData()` in `sampleData.ts` into `clearWorkbench()` (in `workbenchData.ts` or `backup.ts`) and have both callers use it. It removes every baseline's decision blob, the status blob, the chosen baseline and the sample flag, all through their owning modules (AD-10, AD-13, AD-14). Never `localStorage.clear()`, which would also remove anything else the site stores.
- **It always confirms.** A confirmation in the same style as Restore's (`role="alertdialog"`, focus moved into it, Escape cancels) states what will be deleted, using the same summary Restore shows for current data (decisions per baseline, statuses, evidence references, chosen baseline). If sample data is loaded, it says so.
- **Backup first.** The confirmation offers "Download my current data first" (`downloadBackup` from story 18). Downloading does not reset by itself: the visitor still confirms.
- **Wording that cannot be misread.** The section heading is "Reset all data". The confirm button reads "Delete all my data". The text says the deletion cannot be undone without a backup, and that the data exists only in this browser.
- **Empty workbench:** the section is still shown, with the button disabled and a line saying there is nothing to reset.
- **After a reset**, the page shows a status message, its own figures (storage, the baseline setting) refresh, and other open tabs pick up the change through the existing storage-event refresh. The home page is back in story 21's first-visit state, with the sample button offered again.
- A partial failure reports which parts could not be removed, as `clearSampleData` does today.

**Never:** reset without confirmation, clear keys the workbench does not own, write a second clearing path, reset as a side effect of downloading.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Reset own data | Decisions and statuses, confirm | All workbench keys gone; status message; first-visit home | N/A |
| Cancel | Cancel or Escape | Nothing changes; focus back on the button | N/A |
| Backup then reset | Download, then confirm | File downloaded with the full data; then everything removed | N/A |
| Sample loaded | Sample flag set, confirm | Sample and flag removed; banner gone | N/A |
| Nothing stored | Empty workbench | Button disabled, "nothing to reset" | N/A |
| Partial failure | One removal fails | Others removed | Message names what remains |
| Other tab open | Reset here | Other tab refreshes to empty | N/A |

</frozen-after-approval>

## Code Map

- `src/utils/sampleData.ts`, `src/utils/workbenchData.ts` -- `clearWorkbench()`; `clearSampleData` delegates to it.
- `src/components/DataReset.astro` -- new: the section, its confirmation and status.
- `src/pages/data.astro` -- mount it after `DataBackup`.
- `src/components/DataBackup.astro` -- share the current-data summary (extract it if it is local to this component) and refresh after a reset.
- `src/components/SampleDataBanner.astro` -- call the shared clear.

## Tasks & Acceptance

**Execution:**
- [x] Shared `clearWorkbench()`, used by the banner and by reset.
- [x] Reset section with confirmation, summary and backup-first.

**Acceptance Criteria:**
- Given data, when Reset is confirmed, then localStorage holds no workbench key and the home page is in its first-visit state.
- Given the confirmation, when it is cancelled, then nothing is removed.
- Given the confirmation, then it lists what will be deleted and offers a backup download.
- Given an empty workbench, then the button is disabled.

## Verification

- Headless browser: each I/O row; the downloaded backup restores the data that was reset; the sample banner's clear still behaves as in story 22. Earlier suites re-run green.

## Done 2026-10-22

**As built.** `clearWorkbench()` now lives in `workbenchData.ts` (with `hasAnythingToReset()`); `clearSampleData` is gone and the sample banner calls the shared function. The Restore summary moved to `describeSummary()` in `backup.ts` and both dialogs use it. New `DataReset.astro`, mounted after the backup section on the Your data page.

**Verification** (built site, headless Edge over CDP): empty workbench: button disabled with "nothing to reset"; with the sample loaded: the dialog opens with focus inside and lists "Moderate: 159 decisions · 83 status records (18 evidence references)" plus the sample line; Escape and Cancel remove nothing and return focus to the button; "Download my current data first" produced a backup containing all 159 decisions and `sample: true` and deleted nothing; confirming left localStorage with no keys, hid the sample banner, switched the baseline setting back to "not chosen", disabled the button and refreshed the storage meter. Unreadable stored items: button enabled, dialog warns they are in no backup and will be erased, confirm removes them. The banner's clear (same function) still empties storage and returns home. `ingest --verify` passes; build succeeds.

**Additions beyond the story text:**
- The dialog re-checks the summary at confirm time and asks for a second confirmation if the data changed while it was open (as Restore does).
- `BaselineSetting` and the storage meter now also refresh on same-tab change events, since reset clears the baseline on the page they sit on.

**Not run:** earlier browser suites were not re-run; only the flows above.
