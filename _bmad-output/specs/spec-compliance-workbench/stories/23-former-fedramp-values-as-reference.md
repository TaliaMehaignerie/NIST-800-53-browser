---
title: 'Compliance Workbench — former FedRAMP values as reference'
type: 'feature'
created: '2026-10-22'
status: 'done'
review_loop_iteration: 0
baseline_commit: '724d8c2'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md', '{project-root}/_bmad-output/planning-artifacts/prds/prd-BMad-2026-09-21/prd.md']
depends_on: ['10']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Many parameters are hard to answer from a blank field. "Organization-defined frequency" gives no sense of scale, and NIST's discussion text explains what a control is for, not what a typical value looks like. Until 2026, FedRAMP answered this by assigning values for its Low, Moderate and High baselines. Notice 0013 withdrew most of them on purpose, because "a minimum bar also effectively establishes a ceiling": almost no providers went beyond the assigned values. Users have lost a reference point they used to have, and the product exists to stop that reference point turning back into a ceiling.

**Approach:** Show the withdrawn FedRAMP value next to the parameter as reference, labelled with its source and its withdrawn status, in the same place as NIST's discussion. It is something to compare against, not something to adopt. There is no "Use this value" button, no prefill and no placeholder, so a value only reaches a decision if the user types it. This keeps FR-8: the workspace never treats any outside text as a de facto value.

## Boundaries & Constraints

**Always:**
- **Reference, never a suggestion.** The value is plain text beside the field. Never a placeholder, never prefilled, never copied into the field by any control, and never counted as reviewed. A parameter with a reference value is still `unreviewed-default` until the user acts on it (FR-8, FR-11).
- **Labelled with source, baseline and status every time**, for example "Former FedRAMP Moderate value (withdrawn 2026): at least annually". The source is always named, so nobody mistakes it for a NIST requirement. If the snapshot holds a value FedRAMP still assigns today, it is labelled as current ("FedRAMP Moderate value: …"), not as withdrawn. Which values are current is verified against FedRAMP's published material, never assumed.
- **Visible by default.** The reference line is shown without any click, not hidden behind a disclosure (resolved 2026-10-22). It is the human's call that seeing it matters more than the anchoring risk, which the labelling, the no-adopt rule and the per-surface note are there to contain.
- **One explanation per surface, not per row.** Each workspace view and each popover has one short note saying why these values were withdrawn and that they are shown for comparison only. Rows carry only the label. This follows story 9's precedent for out-of-baseline slots.
- **Matched to the working baseline (AD-13).** Low, Moderate and High show FedRAMP's value for that baseline. Privacy has no FedRAMP equivalent and shows nothing. A parameter FedRAMP never assigned shows nothing: no empty row and no "none".
- **Batch rows (CAP-1):** if every member of a dash-one cluster had the same FedRAMP value, the batch row shows it once. If the members differed, the row says so and shows the values with the controls they applied to, never one value picked from among them.
- **Ingested like every other source (AD-2, AD-6, AD-8):** a snapshot of FedRAMP's Rev 5 OSCAL baseline profiles from before Notice 0013 is committed to `data/raw/`, read only by `scripts/ingest.mjs`, and written into the Content Collection. No network calls and no hand-typed values. The snapshot's upstream source, commit and date are recorded in the provenance entry and shown in the explanation note.
- **Verbatim (AD-5).** The FedRAMP value or constraint text is copied exactly as published, never paraphrased or normalized.
- **Delivered through the existing paths.** Control pages carry it in story 10's build-time per-control embed. The workspace loads it lazily alongside, or in the same way as, `odp-discussion.json`. `odp-dataset.json` is not enlarged.
- **Never stored, exported or backed up.** It is not written to `odpStore`, not included in OSCAL export `set-parameters`, not included in backup envelopes and not used in sample data. It is catalog content, like the discussion text.

**Never:** a "Use this value" control, a placeholder, prefill, counting a reference as reviewed, showing a value without its source and status, merging differing cluster values into one, hand-typing values, fetching anything at runtime from FedRAMP.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Assigned value | Moderate, parameter FedRAMP assigned | Labelled reference line beside the field; field empty; status unreviewed | N/A |
| Not assigned | Parameter FedRAMP left open | No reference line | N/A |
| Privacy | Working baseline Privacy | No reference lines; no explanation note | N/A |
| Baseline switch | Moderate to High | Lines show High's former values | N/A |
| Cluster agrees | All dash-one members share a value | Batch row shows it once | N/A |
| Cluster differs | Members' values differ | Batch row lists each value with its controls | N/A |
| User types the same value | Field set to the former value, confirmed | Ordinary decision; nothing marks it as adopted | N/A |
| Unmatched id | Snapshot param id not in the catalog | Ingest reports it; not shown anywhere | `ingest.mjs --verify` lists unmatched ids |
| Export | OSCAL export | No reference values; set-parameters as before | N/A |
| Load fails | Workspace fetch fails | Field and discussion still work; reference line shows a retry message | Message |

</frozen-after-approval>

## Code Map

- `data/raw/` -- new: the pre-Notice-0013 FedRAMP Rev 5 baseline profiles (Low, Moderate, High).
- `scripts/ingest.mjs` -- read the profiles' `set-parameters`, map each `param-id` to the catalog, write values per baseline onto each item's params, extend `--verify`.
- `src/content/meta/provenance.json` -- FedRAMP snapshot source, commit and date.
- `src/pages/odp-discussion.json.ts` or a sibling endpoint -- per-item reference values for the workspace.
- `src/utils/odpContext.ts` -- the reference line and the per-surface explanation, beside `buildDiscussionToggle`.
- `src/components/workspace/OdpWorkspace.astro` -- individual and batch rows.
- `src/utils/odpSlotPopover.ts`, `src/pages/controls/[slug].astro` -- popover line from the per-control embed.

## Tasks & Acceptance

**Execution:**
- [x] Find and commit the last FedRAMP Rev 5 OSCAL baseline profiles from before Notice 0013. Record source and commit. Confirm which values, if any, are still current.
- [x] Ingest values per baseline, with unmatched ids reported by `--verify`.
- [x] Reference line and explanation in workspace rows, batch rows and the popover.

**Acceptance Criteria:**
- Given Moderate and a parameter FedRAMP assigned, when its row or popover opens, then the former value is shown with source, baseline and withdrawn status, the field is empty, and the parameter still counts as unreviewed.
- Given any surface, then no control copies the reference value into the field.
- Given the Privacy baseline or a parameter FedRAMP never assigned, then no reference line appears.
- Given a dash-one cluster whose members had different FedRAMP values, then the batch row shows each value with its controls.
- Given an OSCAL export or a backup, then neither contains any reference value.

## Verification

- `node scripts/ingest.mjs --verify` passes and reports matched and unmatched counts per baseline. Record the figures here.
- `npm run build` succeeds; `odp-dataset.json` is the same size as before.
- Headless browser: each I/O row above; readiness and blocking counts unchanged before and after the feature; export and backup grepped for a known reference value find nothing. Earlier suites re-run green.

## Resolved by the human (2026-10-22)

- Notice 0013's date and wording as recorded in the PRD research are confirmed.
- The reference line is visible by default.

## Done 2026-10-22

**Source found.** The official `GSA/fedramp-automation` repository is no longer on GitHub (404), so the snapshots are Internet Archive captures of its raw files: Low and High from 2025-04-21, Moderate from 2025-06-18, all profile version `fedramp2.1.0-oscal1.0.4`. `data/raw/fedramp/SOURCE.json` records each archive URL. Every one of the 668 assigned values maps to a catalog param id, one constraint each.

**Figures.** Assigned / kept (on entries in NIST's own baseline): Low 156 / 153, Moderate 236 / 217, High 276 / 256. The rest (3, 19, 20) sit on items FedRAMP added beyond NIST's baseline, which the workspace never shows, so they are counted by `ingest --verify` and not stored. Moderate: 217 of 643 parameters carry a reference. `odp-dataset.json` is unchanged at 736 KB; `fedramp-reference.json` is 41 KB.

**Verification.** `node scripts/ingest.mjs --verify` passes, with new assertions: every id exists in the catalog, no value on an entry outside its baseline, none for Privacy, provenance counts match. `npm run build` succeeds. Headless Edge over CDP against the built site: Moderate AC individual view 65 rows / 20 reference lines (independent count from the content files: 65 / 20); High AC 26 (expected 26); Privacy AC 11 rows, 0 lines, no note, and `fedramp-reference.json` never fetched; Moderate batch view 9 clusters, 4 with a reference: the three that agree show one line, `prm_1` (SR-1 has a value, 17 controls none) lists both groups; popover on AC-1 shows the line and one note, both fields empty; localStorage held only `active-baseline` after all of it. Grep: no reference to FedRAMP in `odpStore`, `oscalExport`, `backup` or the sample data.

**Deviations from the frozen text:**
- **Label wording.** Lines read "FedRAMP Moderate value before Notice 0013: …", not "Former FedRAMP Moderate value (withdrawn 2026)". Checking the notice itself showed it announces removal of "the vast majority" of values, applying to assessments after 2027-01-01, with no list of which survive. "Withdrawn" overstated that; "before Notice 0013" is exact.
- **"Labelled as current" was not built.** The story asked for values FedRAMP still assigns to be labelled current. The notice does not say which remain, so nothing can be verified and no value is labelled current. The note says some values may still be assigned today.
- **Load failure** is reported once in the view's note, not in every row.

**Not done / for later:** the review-mode card (`ReviewCard`) shows no reference line; the story named the workspace and the control-page popover only. These values are minimums in many cases ("at least annually"), which the note says only in general terms.
