---
title: 'Compliance Workbench — parameter control and statement context'
type: 'feature'
created: '2026-09-29'
status: 'done'
review_loop_iteration: 0
baseline_commit: '07c18af724f72a54af07c1f4840b0c46ae59ae5b'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A parameter row reading `prm_1 / organization-defined personnel or roles` is unanswerable on sight — you can't tell which control it belongs to or what it's asking. Measured against the real corpus: **266 of 1600 params have the statement sentence as their only context source, and that sentence is never rendered** (`prm_1` is one of them; its `guidelines` are empty). The control's title is shown nowhere at all.

**Approach:** Emit the control title and the build-time-resolved statement sentence from the dataset endpoint, and render both on every parameter row. On batch rows, show cluster-level context only where it is genuinely identical across all members, since it often isn't.

## Boundaries & Constraints

**Always:**
- The endpoint stays the single dataset source (AD-8): extend `odp-dataset.json.ts` via `getCollection('controls')` — never raw OSCAL, never a second dataset path.
- `{{ insert: param, … }}` placeholders are resolved **at build time** using the existing `src/utils/resolveParams.ts`, unmodified — one resolver in the codebase, run once; the client receives display-ready text and never resolves placeholders itself.
- `statementProse` is the first statement node whose prose references that `paramId`, prefixed with the node's `label` when present (e.g. `"a. Develop, document, and disseminate to …"`), and `null` when no node references it — measured: **399 of 1600 params are unreferenced**, of which **392 carry `guidelines` instead**, so a null here is normal, not an error.
- A batch row shows a shared title or shared sentence **only when it is identical across every cluster member**, applying the same identical-across-members test `odpCluster.ts` already uses for `select`. Measured: all 18 dash-one controls share the title `"Policy and Procedures"` and share one identical `prm_1` sentence, but `odp.03` has **18 distinct sentences** (each names its own family's policy). When they diverge, show one member's sentence explicitly attributed to that control — never present a non-shared sentence as if it applied to all 18.
- A batch row lists the control ids it covers (collapsed by default), closing the deferred-work item logged from story 2's review.
- Existing `guidelines` rendering is unchanged — it remains the primary context for the 392 guidelines-only params.
- The **7 params with neither a statement reference nor guidelines** (`sc-36` ×2, `si-7.1` ×5) render title and label only — never an empty context block, never fabricated text.

**Ask First:** none anticipated.

**Never:** a second placeholder resolver, or client-side placeholder resolution. No change to decision keys, storage shape, or any story 1–4 behavior — this story only adds display context.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Statement-only param | `ac-1`'s `prm_1` (no guidelines) | Row shows `AC-1 — Policy and Procedures` and `a. Develop, document, and disseminate to [Assignment: organization-defined personnel or roles]:` | N/A |
| Guidelines-only param | `ac-01_odp.01` (no statement reference) | No sentence block; existing guidelines line renders as today; title still shown | N/A |
| Batch row, shared sentence | `prm_1` cluster — all 18 sentences identical | One shared sentence shown, no per-control attribution | N/A |
| Batch row, divergent sentences | `odp.03` cluster — 18 distinct sentences | One member's sentence shown, explicitly attributed to that control | N/A |
| Param with no context at all | `si-7.1`'s `prm_3` (1 of the 7) | Title and label only; no empty sentence block, no fabricated text | N/A |
| Batch member list | `prm_1` cluster | Collapsed list expands to the 18 covered control ids | N/A |

</frozen-after-approval>

## Code Map

- `src/pages/odp-dataset.json.ts:20` — the `GET` handler to extend; currently emits `controlSlug, controlId, familyCode, paramId, label, guidelines, select, baselines` (no title, no prose).
- `src/utils/resolveParams.ts:41` — `resolveParams(prose, params)` already turns placeholders into `[Assignment: …]` / `[Selection (one-or-more): …]` text; reuse unmodified at build time.
- `src/content.config.ts` — `controls` schema: `title`, and the recursive `statement` tree (`label`, `prose`, `children`) that must be walked to find the node referencing a param.
- `src/utils/odpCluster.ts:84` (`selectDeepEqual`) — the existing identical-across-members pattern the new shared-title/shared-prose check should mirror.
- `src/utils/odpCluster.ts:107` (`groupDashOneClusters`) — where per-cluster shared context is computed.
- `src/components/workspace/OdpWorkspace.astro:664` (`buildRow`) — individual row; currently renders controlId, paramId, status, label, guidelines.
- `src/components/workspace/OdpWorkspace.astro:824` (`buildBatchRow`) — batch row; currently renders only the raw cluster key and a member count.

## Tasks & Acceptance

**Execution:**
- [x] `src/pages/odp-dataset.json.ts` -- add `controlTitle: string` and `statementProse: string | null` per entry: walk the entry's `statement` tree for the first node whose prose references that `paramId`, prefix the node's `label` when present, and run it through `resolveParams` at build time.
- [x] `src/utils/odpCluster.ts` -- extend `Cluster` with `sharedTitle: string | null` and `sharedProse: string | null` (non-null only when identical across every member, mirroring `selectDeepEqual`), plus a representative `{ controlId, statementProse }` for the divergent case.
- [x] `src/components/workspace/OdpWorkspace.astro` -- `buildRow`: render `{controlId} — {controlTitle}` in the header and the statement sentence above the existing label/guidelines, omitting the sentence block entirely when `statementProse` is null.
- [x] `src/components/workspace/OdpWorkspace.astro` -- `buildBatchRow`: render the shared title and shared sentence when present; when prose diverges, render the representative member's sentence attributed to that control; add a collapsed, expandable list of covered control ids using the site's existing `role`/`aria-expanded` disclosure pattern.

**Acceptance Criteria:**
- Given `ac-1`'s `prm_1` row, when it renders, then it shows `AC-1 — Policy and Procedures` and the resolved sentence `a. Develop, document, and disseminate to [Assignment: organization-defined personnel or roles]:`.
- Given `ac-01_odp.01` (no statement reference), when its row renders, then no sentence block appears and its existing guidelines text still renders.
- Given the `prm_1` batch row, when it renders, then it shows one shared sentence with no per-control attribution.
- Given the `odp.03` batch row (18 distinct sentences), when it renders, then it shows one member's sentence explicitly attributed to that control, never presented as shared.
- Given `si-7.1`'s `prm_3` (neither context source), when its row renders, then only title and label appear, with no empty sentence block.
- Given any batch row, when the member list is expanded, then every control id in that cluster is listed.

## Spec Change Log

## Design Notes

**Measured size cost** of adding both fields to all 1600 entries: raw `odp-dataset.json` grows 414 KB → 676 KB, gzipped 43.9 KB → 75.5 KB (**+31.6 KB over the wire**). Accepted: it's a single fetch on page load from a static host that serves compressed, and it's the difference between an answerable row and an unanswerable one.

**Why the two context sources are complementary** (measured across the corpus): 935 params have both a sentence and guidelines, 266 have a sentence only (`prm_1`'s bucket — the one currently rendering blind), 392 have guidelines only (the `odp.NN` assessment-layer params, whose guidelines read as self-contained questions like *"personnel or roles to whom the access control policy is to be disseminated is/are defined;"*), and 7 have neither. Rendering both sources covers 1593 of 1600.

## Verification

**Commands:**
- `npm run build` -- expected: succeeds; `dist/odp-dataset.json` carries `controlTitle` on all 1600 entries and `statementProse` non-null on exactly 1201 of them.

**Manual checks (if no CLI):**
- `npm run dev`, open `/NIST-800-53-browser/workspace/moderate/` — the `prm_1` batch row shows the shared "Policy and Procedures" title and the disseminate-to sentence; expanding its member list shows all 18 control ids.
- Find the `odp.03` batch row — its sentence is attributed to a single control, not presented as shared.
- Scroll to `AC-1`'s individual `ac-01_odp.01` row — no sentence block, guidelines still present.

## Suggested Review Order

**Sentence resolution (the story's core logic, and where the real bug was)**

- Groups clusters and computes `sharedTitle`/`sharedProse`/`representative` — start here. Includes the review-found fix: the fallback picks the first member that actually has a sentence, not just the first member.
  [`odpCluster.ts:129`](../../../../src/utils/odpCluster.ts#L129)

- Finds the first statement node referencing a param, at build time — the sole source of `statementProse`.
  [`odp-dataset.json.ts:21`](../../../../src/pages/odp-dataset.json.ts#L21)

**Rendering**

- Individual row: control title + resolved sentence, omitted entirely when null.
  [`OdpWorkspace.astro:693`](../../../../src/components/workspace/OdpWorkspace.astro#L693)

- Batch row: shared title/sentence, the divergent-cluster attribution fallback, and the expandable member list (including the review-found `aria-controls` fix).
  [`OdpWorkspace.astro:863`](../../../../src/components/workspace/OdpWorkspace.astro#L863)
