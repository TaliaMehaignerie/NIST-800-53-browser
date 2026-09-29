---
title: 'Compliance Workbench — batched dash-one entry'
type: 'feature'
created: '2026-09-29'
status: 'done'
review_loop_iteration: 1
baseline_commit: '2dd6a56a40a6a742a244d7d6334a7f9df3aeedcd'
context: ['{project-root}/_bmad-output/specs/spec-compliance-workbench/SPEC.md', '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md']
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The 18 Moderate-baseline "dash-one" policy/procedure controls (AC-1, AU-1, CM-1, ...) each carry the same 9 organization-defined parameters — including one `one-or-more` select (`odp.03`) present in every one. Story 1's workspace makes a user answer each of those 162 instances one at a time, even though CNSSI 1253 permits one policy-level answer to cover the whole cluster.

**Approach:** Add a batch-entry section to the workspace: one row per shared parameter across the dash-one cluster, whose Confirm/Override writes N independent decisions in one pass (one per matching control) via the existing `odpStore.setDecision`. Clustering is computed at render time from `paramId`/`familyCode` — never stored — so every fanned-out decision stays individually visible and overridable through story 1's existing per-control rows, unchanged.

## Boundaries & Constraints

**Always:**
- Cluster membership is computed at render time only, in one new module `src/utils/odpCluster.ts`, imported by the batch UI (and, in story 3, the dashboard) — never stored as a cluster reference (AD-11).
- A dash-one control is `kind === 'control'` with `id` matching `^[a-z]{2}-1$` — detected structurally, never a hardcoded list.
- A cluster's shared key is a param's `paramId` with the `^<familyCode>-1_` or `^<familyCode>-01_` prefix stripped (lowercase `familyCode`) — verified against the real Moderate dataset: 18 controls, 9 params each, identical stripped keys (`prm_1`, `odp.01`..`odp.08`).
- A cluster only includes members whose `select` shape (`howMany` + exact `choice` array, deep-equal) matches every other member sharing that `clusterKey` — a member whose `select` diverges is excluded from the cluster and falls back to individual-only entry for that param, the same treatment AD-11 already gives the structural outlier `pm-1`. Real-data grounding: `odp.03`'s 18 dash-one members are otherwise identical, but `sc-1` spells one choice `"mission/business-process-level"` (hyphenated) where the other 17 spell it `"mission/business process-level"` (space) — an upstream NIST catalog inconsistency, not a bug in this codebase. Never resolve a divergence by silently picking one member's shape for the whole cluster.
- Setting a cluster's shared value writes N fully independent decisions via `odpStore.setDecision` (story 1, unchanged) — one call per member — never a combined or batch-tagged storage entry.
- "Does this member still match the batch value" is order-independent set equality when the value is an array (the `odp.03` case), plain string equality otherwise — never a naive `===` on arrays.
- Story 1's individual per-control rows are unchanged and still render for every entry, including dash-one ones — this is what keeps every fanned-out decision independently overridable (FR-5), not new code.
- The batch action reuses `setDecision`'s existing override-requires-rationale rule unmodified — do not reimplement that check in the cluster UI.

**Ask First:** none anticipated.

**Never:** extending clustering to other same-labeled but ungrounded recurring parameters (e.g. "frequency" on AC-16/AT-2/CA-7) — investigated and rejected in SPEC.md. No readiness dashboard, no OSCAL export (stories 3–4). No second clustering implementation outside `odpCluster.ts`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Set a cluster's shared value, confirm | User sets the `prm_1` cluster row's value, clicks Confirm | All 18 members get an independent `confirmed` decision with that value | N/A |
| Set the `one-or-more` cluster (`odp.03`) | User selects 2 choices, confirms | Each of the 18 members' decision `value` is that same 2-element array | N/A |
| One member later diverges | After a batch confirm, the user opens PE-1's individual `odp.03` row and overrides it with a different selection + rationale | Reloading the cluster row shows 17/18 members still matching the batch value; PE-1 shows as diverged | N/A |
| Override cluster value without rationale | User sets the cluster row's status to `overridden`, rationale empty | Blocked — same rejection as an individual row; no member is written | Save rejected, no partial fan-out |
| Array-aware match check | A member's stored value is `['b','a']`, batch value is `['a','b']` | Treated as matching (order-independent set equality) | N/A |
| Divergent member select shape | The `odp.03` cluster's 18 raw entries include `sc-1`, whose `select.choice` differs from the other 17 | `sc-1`'s `odp.03` is excluded from the batch cluster (17 members, all byte-identical `select`); `sc-1`'s own individual `odp.03` row still renders normally below, using its own choice list | N/A |

</frozen-after-approval>

## Code Map

- `src/pages/odp-dataset.json.ts` (story 1, unchanged) — dataset source; already emits `controlId`, `familyCode`, `paramId` per entry, everything `odpCluster.ts` needs to group.
- `src/utils/odpStore.ts` (story 1, unchanged) — `getDecision`/`setDecision`; the batch action calls `setDecision` once per cluster member, reusing its existing override/rationale validation.
- `src/components/workspace/OdpWorkspace.astro:421` (`init()`) — story 1's entry point; extend to split the baseline's working set into dash-one vs. individual entries and render both.
- `src/components/workspace/OdpWorkspace.astro:215` (`buildValueField`) — existing free-text/select input builder; the batch row reuses this unchanged (same `select` shape as an individual param).
- `src/components/workspace/OdpWorkspace.astro:373` (`handleAction`) — existing single-decision save/validate flow; the batch row's save wraps a loop over members calling the same validation + `setDecision`, not a reimplementation.
- `src/content.config.ts` — `controls` schema (`id`, `kind`, `familyCode`, `params[].id`) — confirms the real shapes `odpCluster.ts` matches against; read-only.

## Tasks & Acceptance

**Execution:**
- [x] `src/utils/odpCluster.ts` -- new module: `isDashOneControl(id: string): boolean` (`kind==='control' && /^[a-z]{2}-1$/.test(id)`); `clusterKey(paramId: string, familyCode: string): string` (strips `^<fc>-1_`/`^<fc>-01_`, lowercase `familyCode`); `valuesMatch(a, b): boolean` (array-aware set equality, else string equality); `groupDashOneClusters(entries): Cluster[]` -- groups dash-one baseline entries by `clusterKey`, then within each `clusterKey` group, keeps only the members whose `select` is deep-equal to the first member's `select`; any member whose `select` diverges is dropped from that cluster's `members` array (it is not returned in any cluster -- the caller's existing per-control individual-row loop already covers it). Result: `{ clusterKey, label, guidelines, select, members: { controlSlug, controlId, paramId }[] }[]` -- AD-11's sole clustering implementation.
- [x] `src/components/workspace/OdpWorkspace.astro` -- in `init()`, split the baseline's entries into dash-one and individual sets; render a new "Batch entry" section above the existing rows from `groupDashOneClusters()`: one row per cluster (shared label/guidelines/input/rationale, Confirm/Override) whose save loops `setDecision` over every member with the same decision, then shows "`N`/`members.length` controls match this value" computed via `valuesMatch` against each member's current `getDecision`. Existing individual rows (all entries, dash-one included -- including any member excluded from a cluster for shape divergence) render unchanged below.

**Acceptance Criteria:**
- Given the Moderate baseline's `prm_1` cluster (18 members), when a user sets its value and confirms, then all 18 members have that value/`confirmed` status individually stored, verifiable via each member's own row.
- Given a cluster value was just batch-confirmed, when the user overrides one member's individual row with a different value, then the cluster row's match count drops to 17/18 without altering the other 17 members' stored decisions.
- Given the `odp.03` one-or-more cluster, when the batch value and a member's stored value contain the same choices in different order, then the match count counts that member as matching.
- Given a batch Override with an empty rationale, when the user attempts to save, then no member's decision is written and the same rationale-required error as an individual row is shown.
- Given the real Moderate `odp.03` cluster where `sc-1`'s `select.choice` diverges from the other 17 members, when the workspace renders its clusters, then the `odp.03` batch row has exactly 17 members and `sc-1`'s own individual `odp.03` row still renders with `sc-1`'s own choice list.

## Spec Change Log

- **Trigger:** verification-gap review of the first implementation attempt found, against the real built dataset, that `sc-1`'s `odp.03` `select.choice` list is spelled differently (`"mission/business-process-level"`) than the other 17 dash-one members (`"mission/business process-level"`) — the original spec had no rule for a cluster member whose `select` shape diverges, so the first implementation silently took one member's shape for the whole cluster.
- **Amended:** added an "Always" boundary and a new I/O matrix row requiring `groupDashOneClusters` to exclude any member whose `select` isn't deep-equal to the rest of its cluster (falls back to individual-only entry for that param) — mirroring AD-11's existing `pm-1` structural-outlier precedent. Added a matching acceptance criterion and updated the `odpCluster.ts` task description.
- **Avoids:** a batch write silently storing a value outside a diverging member's own valid choice set (would have made `sc-1`'s stored `odp.03` decision look "unselected" on its own row and would have produced an invalid value if exported to OSCAL in a later story).
- **KEEP:** `isDashOneControl`, `clusterKey`, and `valuesMatch` from the reverted first attempt were correct and real-data-verified — re-derive unchanged. Keep the overall `OdpWorkspace.astro` approach too: a "Batch entry" section above the unchanged individual rows, `ValueFieldSource` generalizing `buildValueField`/`readValue` for reuse, `computeClusterMatch`'s fresh-every-call majority-vote match count, and the per-member `setDecision` loop with a generic save-failure error message.

## Design Notes

Batching is additive, not a replacement: story 1's per-control rows keep rendering for dash-one entries exactly as before, so a member's individual row is always the mechanism for "independently overridable" (FR-5) — the batch row is a second, convenience entry point into the same `odpStore` keys, never a separate data path. The "N/18 match" count is computed fresh on each render from `getDecision` + `valuesMatch`, never cached or stored — consistent with AD-11's "computed at render time only."

## Verification

**Commands:**
- `npm run build` -- expected: succeeds (no route/schema changes, this story only adds a util module and extends an existing island).

**Manual checks (if no CLI):**
- `npm run dev`, open `/workspace/moderate`, set the `prm_1` cluster's value and confirm — scroll to AC-1's, AU-1's, and PE-1's individual `prm_1` rows and confirm all three now show that value/status.
- Set the `odp.03` cluster (multi-select) with 2 choices, confirm — verify all 18 members' individual rows show the same 2 selections.
- Override PE-1's `odp.03` row individually with a different selection + rationale — verify the `odp.03` cluster row's match count reads 17/18 on reload.
- Attempt a cluster Override with empty rationale — verify it's blocked and no member's `localStorage` entry changes.

## Suggested Review Order

**Clustering correctness (AD-11, the story's core risk)**

- Groups dash-one entries by `clusterKey`, then drops any member whose `select` diverges from the first member's — the fix for the real `sc-1`/`odp.03` bug found in review; start here.
  [`odpCluster.ts:107`](../../../../src/utils/odpCluster.ts#L107)

- `selectDeepEqual`: the shape-equality check that drives the exclusion above.
  [`odpCluster.ts:84`](../../../../src/utils/odpCluster.ts#L84)

- `clusterKey`: strips the family/dash-one prefix to produce the shared grouping key.
  [`odpCluster.ts:57`](../../../../src/utils/odpCluster.ts#L57)

- Order-independent match check for `one-or-more` array values — a naive `===` would falsely flag an untouched member as diverged.
  [`odpCluster.ts:78`](../../../../src/utils/odpCluster.ts#L78)

**Batch save flow**

- `handleBatchAction`: one independent `setDecision` per member; on any failure, still resyncs the display for members that did succeed — the fix for the partial-write display gap found in review.
  [`OdpWorkspace.astro:592`](../../../../src/components/workspace/OdpWorkspace.astro#L592)

- `refreshClusterMatch`/`computeClusterMatch`: fresh-every-call majority-vote match count, never cached.
  [`OdpWorkspace.astro:486`](../../../../src/components/workspace/OdpWorkspace.astro#L486)

- `buildBatchRow`: the cluster row itself, reusing `buildValueField`/`readValue` for the same input shape as an individual row.
  [`OdpWorkspace.astro:498`](../../../../src/components/workspace/OdpWorkspace.astro#L498)

**Integration with story 1's individual rows**

- `init()`: individual rows still render for every entry first (unchanged from story 1), then clusters render above them — batching is additive, never a replacement.
  [`OdpWorkspace.astro:652`](../../../../src/components/workspace/OdpWorkspace.astro#L652)

- `rowRegistry`/`setFieldValue`: lets a batch save live-refresh an already-rendered individual row in place, without a reload.
  [`OdpWorkspace.astro:317`](../../../../src/components/workspace/OdpWorkspace.astro#L317)
