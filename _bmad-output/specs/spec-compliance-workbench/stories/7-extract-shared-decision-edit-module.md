---
title: 'Compliance Workbench — extract shared decision-edit module'
type: 'refactor'
created: '2026-09-30'
status: 'done'
baseline_commit: '35813ad7a4a7c4e45b64ebe75fa2f102dc547879'
review_loop_iteration: 0
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Decision mutation semantics (value-field construction, value read/write, empty-value and override-rationale validation, the dash-one fan-out loop) live inside the 1,475-line `OdpWorkspace` island. Every later story that edits a decision from another surface (the control-page popover, stories 10-11) would have to copy them.

**Approach:** Move those semantics into `src/utils/odpEdit.ts`, the sole caller of `setDecision` (AD-9, already amended in the spine). No user-visible change.

## Boundaries & Constraints

**Always:**
- Pure refactor: set, confirm, override with and without rationale, batch fan-out (including partial-failure resync), dashboard refresh, filtered-row removal, and export behave and read byte-identically, including every error message string.
- `odpStore.ts` stays the sole localStorage path (AD-10, unchanged).
- Extract decision WRITES and their validation only. `rowRegistry`, `refreshDashboard()`, `applyStatus`, `removeRowFromIndividualViewIfFiltered` stay in the island; fan-out returns per-member results and the caller does the row/dashboard refresh. `odpEdit.ts` must not import or reference `rowRegistry`.
- Individual and batch rows keep their distinct validation order: individual checks empty value, then override-without-rationale, then `setDecision`; batch checks empty value only and relies on `setDecision`'s own rationale rejection.

**Never:** change `odpStore`, `odpCluster`, decision keys, storage shape, markup, or CSS. No new behavior, no tests framework additions.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Individual confirm | Non-empty value | Saved, status Confirmed, dashboard refreshed | N/A |
| Individual override, blank rationale | Value set, rationale empty | Refused with "A rationale is required to override a value." | Row error shown, nothing written |
| Empty value | Either row kind | "Enter or select a value before saving a decision." | Nothing written |
| Batch partial storage failure | `setDecision` fails for some members | Succeeded members' rows resync; "Could not save this decision for every control..." shown | Unchanged message |

</frozen-after-approval>

## Code Map

- `src/components/workspace/OdpWorkspace.astro:532-625` -- `decisionKey`, `buildValueField`, `readValue`, `setFieldValue`, `isValueEmpty`: move to `odpEdit.ts`.
- `src/components/workspace/OdpWorkspace.astro:1057-1089` (`handleAction` in `buildRow`) -- validation + `setDecision` call: replace with `odpEdit` validation + save; UI and refresh calls stay.
- `src/components/workspace/OdpWorkspace.astro:1267-1328` (`handleBatchAction`) -- fan-out `results` map: replace with `odpEdit` fan-out; the `rowRegistry` resync loop stays.
- `src/utils/odpStore.ts:118` -- `setDecision`; after this story imported only by `odpEdit.ts`.
- `_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md:85-97` -- AD-9 already amended and already names `odpEdit.ts`; verify, do not rewrite.

## Tasks & Acceptance

**Execution:**
- [x] `src/utils/odpEdit.ts` -- create: export `decisionKey`, `buildValueField`, `readValue`, `setFieldValue`, `isValueEmpty`, the three message constants (empty value, rationale required, save failed), `validateValue`/`validateOverrideRationale` returning `string | null`, `saveDecision(baseline, key, decision)`, and `fanOutDecision(baseline, members, decision)` returning `{ member, ok }[]` -- sole `setDecision` caller.
- [x] `src/components/workspace/OdpWorkspace.astro` -- delete the moved functions, import from `odpEdit`, drop the `setDecision` import; rewire `handleAction` and `handleBatchAction` to the module, leaving refresh logic in place.
- [x] `_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md` -- confirm AD-9 and the file-tree entry for `odpEdit.ts` match the final exported surface; adjust wording only if they differ.

**Acceptance Criteria:**
- Given the refactor, when `grep -rn "setDecision(" src` runs, then the only call site is in `src/utils/odpEdit.ts` (plus its definition in `odpStore.ts`).
- Given the workspace, when any item in the I/O matrix is exercised, then behavior and message text match the pre-refactor build.
- Given `odpEdit.ts`, when its imports are inspected, then it does not import from `OdpWorkspace` or reference `rowRegistry`.

## Verification

**Commands:**
- `npm run build` -- expected: succeeds.
- `grep -rn "setDecision" src` -- expected: call only in `odpEdit.ts`.

**Manual checks (if no CLI):**
- `npm run dev`, `/workspace/moderate/`: confirm one row, override with and without rationale, apply a batch value and see the matching individual row update, check dashboard counts move, toggle unreviewed-only and confirm the row drops, export still downloads.

## Suggested Review Order

- Sole mutation path: value fields, validation, `saveDecision`, `fanOutDecision`; only `setDecision` caller.
  [`odpEdit.ts:1`](../../../../src/utils/odpEdit.ts#L1)

- Individual row: validation chain and save now go through the module; refresh stays local.
  [`OdpWorkspace.astro:975`](../../../../src/components/workspace/OdpWorkspace.astro#L975)

- Batch row: fan-out via module, `rowRegistry` resync loop intentionally kept in the island.
  [`OdpWorkspace.astro:1183`](../../../../src/components/workspace/OdpWorkspace.astro#L1183)

- AD-9 amendment already in the spine; matches the final exports.
  [`ARCHITECTURE-SPINE.md:85`](../../../planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md#L85)
