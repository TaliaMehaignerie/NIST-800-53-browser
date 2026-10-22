---
title: 'Compliance Workbench — try it with sample data'
type: 'feature'
created: '2026-10-21'
status: 'done'
review_loop_iteration: 0
baseline_commit: '724d8c2'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
depends_on: ['21']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A first-time visitor's workbench is empty. The Progress page reads 0%, the "what's blocking me" list is empty, the hard block on undecided parameters never fires, and the export holds nothing. A reviewer with a few minutes sees none of what the tool is built to show, and setting up enough data to see it takes far longer than they will spend.

**Approach:** One button on the home page, "See it with sample data", loads a realistic, partly finished Moderate review for an invented system. Every page then works as it would mid-project, with a banner on every page saying the data is sample data and offering to clear it. The sample is delivered as a backup envelope and loaded through the existing restore path, so it is validated the same way any backup is.

## Boundaries & Constraints

**Always:**
- **Offered only to an empty workbench.** The button appears in the hero (story 21) only when `hasWorkbenchData()` is false and no baseline is chosen, and the check is repeated at click time. Loading sample data never overwrites, merges with or sits beside a visitor's own data.
- **Loaded through the restore path, not a new write path:** the sample is a `BackupEnvelope`, parsed by `parseEnvelope` and written by `applyEnvelope` (all-or-nothing, rolled back on failure). All storage access stays in `odpStore` / `statusStore` / `activeBaseline` (AD-10, AD-13, AD-14).
- **Generated at build time from the Content Collection,** not committed as a hand-made JSON file: a build-time endpoint (`sample-data.json.ts`) builds the envelope deterministically from `getCollection('controls')`, so every key is a real `controlSlug:paramId` and the sample can never drift from the catalog (AD-8). It is fetched only when the button is pressed.
- **What the sample contains,** chosen so each feature has something to show (approximate targets, exact figures recorded in the story when built):
  - Baseline Moderate.
  - Dash-one batch: the shared parameters set once across the AC and AU dash-one controls (CAP-1).
  - The AC and AU families' parameters fully reviewed, mostly confirmed, with a handful overridden, each with a rationale. A few more families part-reviewed; the rest untouched.
  - Statuses on roughly a fifth of the Moderate items: compliant ones with evidence references (note, `https://example.com/...` link, collected-on date), some in progress, and a family of PE controls not applicable as inherited from a named example cloud provider.
  - At least three items that would be compliant but are held back by unreviewed parameters, so "what's blocking me" and the interlock both have something to show (CAP-3, story 15).
  - At least one parameter decided in Moderate and not in High, so switching baseline on Your data shows a proposal (CAP-9).
- **Sample data is unmistakable as sample data:**
  - The system is invented and named as such ("Example System (sample data)"). Owners are roles, never people's names ("ISSO", "Cloud operations lead"). Evidence links use only the reserved `example.com` domain. Every rationale and justification starts with "Sample:".
  - While sample data is loaded, a banner on every page (in `BaseLayout`, beside `StorageWarning`) reads "You're looking at sample data. Anything you change is mixed into it." with a "Clear sample data" button.
  - The envelope carries `sample: true`, optional so older backups still restore, and the flag is stored under its own key. A downloaded backup of sample data carries the flag, so restoring it brings the banner back. Restoring a backup without the flag clears it.
  - The OSCAL export made while sample data is loaded says so in the profile's `metadata` remarks.
- **Clearing is explicit and complete.** "Clear sample data" asks for confirmation, then removes both stores' blobs for every baseline, the chosen baseline and the sample flag, through the same modules, leaving the browser as a first-time visitor's. If the visitor has edited the sample, the confirmation says those edits go too, and offers a backup download first (story 18's download).
- Once cleared, the home page is back to the first-visit state of story 21, and the button is offered again.

**Never:** load sample data into a non-empty workbench, write sample data through any path other than `applyEnvelope`, name real people or real organizations, link to a real domain, let sample data appear without the banner, clear anything without confirmation.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Load | Empty storage, press button | Sample written; banner on every page; home steps show mid-project state; Progress, blocking list, workspace and export all populated | N/A |
| Data appeared in another tab | Real data written before click | Nothing loaded | Message: you already have data |
| Fetch fails | Offline / 404 | Nothing written | Message, button stays |
| Quota failure | Write fails part-way | Rolled back; nothing remains | Restore path's message |
| Edit the sample | Change a decision | Saved like any decision; banner stays | N/A |
| Clear | Confirm | All workbench keys removed; first-visit home | N/A |
| Clear cancelled | Cancel | Nothing changes | N/A |
| Backup of sample | Download, clear, restore | Sample and banner both back | N/A |
| Restore a real backup over sample | Restore without the flag | Real data, no banner | N/A |
| Export | OSCAL export with sample loaded | Profile remarks state it is sample data | N/A |

</frozen-after-approval>

## Code Map

- `src/pages/sample-data.json.ts` -- new: the deterministic sample envelope from the Content Collection.
- `src/utils/sampleData.ts` -- new: load (fetch, empty check, `parseEnvelope`, `applyEnvelope`, set flag), clear, `isSampleData()`.
- `src/utils/backup.ts` -- optional `sample` field in the envelope, carried by download and restore.
- `src/utils/activeBaseline.ts` -- a clear function (today the baseline can only be set).
- `src/components/SampleDataBanner.astro` -- new: the banner and clear confirmation, mounted in `BaseLayout`.
- `src/components/HomeHero.astro` -- the "See it with sample data" button (from story 21).
- `src/utils/oscalExport.ts` -- the sample remark in `metadata`.

## Tasks & Acceptance

**Execution:**
- [x] Build-time sample envelope meeting the content targets above.
- [x] Load and clear through the backup modules, with the sample flag.
- [x] Banner on every page, home-page button, export remark.

**Acceptance Criteria:**
- Given empty storage, when the button is pressed, then the dashboard, the blocking list (at least three items), a proposal on switching to High, and a non-empty OSCAL export are all visible without further input.
- Given any existing data, then the button is not offered and a forced load writes nothing.
- Given sample data, when it is cleared and confirmed, then localStorage holds no workbench key and the home page is in its first-visit state.
- Given sample data, then no page renders without the banner.

## Verification

- `npm run build` succeeds; the sample envelope passes `parseEnvelope` and every key resolves to a real item and parameter; the generated file is identical across two builds.
- Grep the sample for real-looking names and non-`example.com` URLs: none.
- Exported OSCAL profile with sample data passes `oscal-cli validate`. **Not run: `oscal-cli` is not installed here.** The export is the existing profile plus `metadata.remarks`, a field the OSCAL metadata model defines; run the validator once before relying on it.
- Headless browser: each I/O row above, with figures checked against an independent computation from the envelope; earlier suites re-run green.

**Done 2026-10-21.** The sample as built: 159 parameter decisions (148 confirmed, 11 overridden, each with a "Sample:" rationale), 83 statuses (44 compliant, 21 in progress, 18 not applicable as inherited from "Example Cloud Provider"), 18 evidence references, 8 items in progress and blocked by unreviewed parameters, no compliant item with unreviewed parameters, and the dash-one controls of six families (AC, AU, IA, CM, CP, SC) agreeing on every shared parameter. Every URL is `example.com`. The file is byte-identical across two builds.

Headless Edge: empty offer at desktop and phone widths; load gives step counts and a compliance figure equal to figures computed from the envelope (`15% (44/282)`); the banner on eight kinds of page; the Progress page's blocking list; the interlock refusing "compliant" on a blocked control (CM-3); switching to High offering 159 proposals; the OSCAL export carrying the sample remark with 159 set-parameters; a downloaded backup carrying `sample: true`; cancel and confirmed clear leaving no workbench key and the first-visit home; restoring the sample backup bringing the banner back and restoring one without the flag clearing it; an edited sample warning about the visitor's changes and offering a backup that contains the edit, with Escape closing the confirmation; refusal when data appears after the page loaded (nothing overwritten), when the fetch fails, and when a write fails part-way (rolled back, nothing remains).

**Deviations and additions made while building:**
- The sample flag lives in `sampleFlag.ts` (its own key, `sample-data`), so `backup.ts` and `sampleData.ts` can both use it without a cycle. Its value is a fingerprint of the stored blobs at load or restore, which is how "edited since it was loaded" is known; a restored backup counts as unedited from that moment.
- The download used by the Your data page moved into `backup.ts` (`downloadBackup`) so the banner shares it; `DataBackup.astro` now calls it.
- The invented system's name appears in evidence notes and justifications, not in the banner, which keeps the banner's sentence exactly as specified.
- Clearing runs `clearActiveBaseline()` (new), which notifies like `setActiveBaseline`, then goes to the home page.
