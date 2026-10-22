---
title: 'Compliance Workbench — sample data button on the Your data page'
type: 'feature'
created: '2026-10-22'
status: 'done'
review_loop_iteration: 0
baseline_commit: '724d8c2'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
depends_on: ['22', '24']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The "See it with sample data" button exists only in the home-page hero, and only on a first visit: once a baseline is chosen or anything is stored, it disappears. A visitor who has clicked around, or comes back later, has no way to find it. Your data, where people go to manage what is stored, never mentions it.

**Approach:** A "Sample data" section on the Your data page with the same button, loading the same sample through the same function. When the workbench is not empty, the section explains why the sample can't be loaded and points to Reset (story 24).

## Boundaries & Constraints

**Always:**
- **Same sample, same path.** The button calls `loadSampleData()` from `sampleData.ts`. No second sample, no new write path, content unchanged from story 22 (159 decisions, 83 statuses).
- **Same rule: empty workbench only** (`canLoadSampleData()`, re-checked at click time). When data exists, the section stays visible with the button disabled and the text "Sample data can only be loaded into an empty workbench. To try it, download a backup and use Reset all data below." with a link to the reset section.
- **While sample data is loaded**, the section says so and points to the banner's clear (or Reset), instead of offering to load it again.
- The section describes what the sample is in one sentence: a partly finished Moderate review for an invented system.
- After loading, the page's own figures (storage, baseline setting, reset availability) refresh, and the banner appears, as on the home page.
- The home-page hero button is unchanged.

**Never:** load into a non-empty workbench, duplicate the load logic, hide the section when the sample can't be loaded.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Empty, load | Press button | Sample loaded; banner; page figures refresh | N/A |
| Has data | Own data stored | Button disabled; explanation and link to Reset | N/A |
| Baseline chosen only | No data, baseline set | Button disabled (same rule as the hero) | N/A |
| Sample loaded | Flag set | Section says sample is loaded; no load button | N/A |
| Data appears in another tab | Before click | Nothing loaded | `ALREADY_HAVE_DATA_MESSAGE` |
| Fetch fails | Offline | Nothing written | Message, button stays |
| Reset, then load | Story 24 reset, press button | Sample loaded | N/A |

</frozen-after-approval>

## Code Map

- `src/components/DataSample.astro` -- new: the section, using `canLoadSampleData`, `loadSampleData`, `isSampleData`.
- `src/pages/data.astro` -- mount it between `DataBackup` and the reset section.

## Tasks & Acceptance

**Execution:**
- [x] Sample section with its three states (can load, has data, sample loaded).

**Acceptance Criteria:**
- Given an empty workbench, when the button is pressed, then the same sample as the home page is loaded and the banner shows.
- Given any stored data or a chosen baseline, then the button is disabled and the section points to Reset.
- Given sample data loaded, then the section says so and offers no second load.

## Verification

- Headless browser: each I/O row; the stored data after a load here is byte-identical to a load from the home page. Earlier suites re-run green.

## Done 2026-10-22

**As built.** New `DataSample.astro`, mounted on the Your data page between the backup sections and Reset. It calls `canLoadSampleData()` and `loadSampleData()` unchanged and reloads the page on success, as the home hero does, so the banner and every section read the stores fresh. Three states: loadable (button enabled), blocked (button disabled, explanation, link to `#reset`), sample loaded (note pointing to the banner or Reset, no load button).

**Verification** (built site, headless Edge over CDP): empty workbench: button enabled, no blocked note; pressing it loads the sample, shows the banner and the "loaded" note and enables Reset; the four stored keys are byte-identical to a load from the home page; after a Reset the button is enabled again and loads the sample; with only a chosen baseline stored the button is disabled and the note links to `#reset` (which exists); data appearing after the page rendered (no event delivered) makes the click refuse with `ALREADY_HAVE_DATA_MESSAGE` and write nothing. Build succeeds.

**Not run:** the offline-fetch row, and earlier browser suites.
