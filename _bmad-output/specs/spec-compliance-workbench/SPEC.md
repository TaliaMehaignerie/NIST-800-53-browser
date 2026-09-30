---
id: SPEC-compliance-workbench
companions: ['../../planning-artifacts/architecture/architecture-BMad-2026-09-21/ARCHITECTURE-SPINE.md', './PLAN-browser-workspace-integration.md', './PLAN-compliance-dashboard.md']
sources: ['../../planning-artifacts/prds/prd-BMad-2026-09-21/prd.md']
---

> **Canonical contract.** This SPEC and the files in `companions:` are the complete, preservation-validated contract for what to build, test, and validate. Source documents listed in frontmatter are for traceability — consult them only if you need narrative rationale or prose color this contract intentionally omits.

# SPEC: Compliance Workbench

## Why

FedRAMP Notice 0013 (2026) removed FedRAMP's centralized default values for organization-defined parameters (ODPs), stating that a shared default had become an unexamined ceiling nobody actually reviewed. A CSP pursuing Moderate now has to choose and document roughly 643 ODP values itself — including 18 structurally identical "dash-one" policy/procedure controls whose repeated parameters are currently answered one control at a time. This is a mandate to meet (Notice 0013 already took effect) layered on a pain to solve (repetitive, undefended parameter decisions) for whoever is doing that work. It is a portfolio extension of the NIST 800-53 Browser, demonstrating compliance-domain depth rather than targeting production adoption.

## Capabilities

- **CAP-1**
  - **intent:** A user working through a baseline sets a shared organization-defined parameter once for an entire cluster of dash-one policy/procedure controls, instead of once per control.
  - **success:** Setting one clustered value writes an independent, individually overridable decision for every matching control in the baseline. Verified against real data: 18 of 20 dash-one controls share an identical 9-parameter shape in the Moderate baseline.

- **CAP-2**
  - **intent:** A user sets a value for any single parameter (batched or not), records its review status, and — when overriding a default — a written rationale.
  - **success:** A parameter's status is one of `unreviewed-default` / `confirmed` / `overridden`; setting `overridden` requires a non-empty rationale before the change is accepted.

- **CAP-3**
  - **intent:** A user sees what fraction of the baseline's parameters are still unreviewed, jumps directly to any outstanding one, and cannot mark the baseline ready while any remain unreviewed.
  - **success:** The "ready" action is blocked while any parameter is `unreviewed-default`; the dashboard's counts match the underlying decision data exactly.

- **CAP-4**
  - **intent:** A user exports all current decisions as a valid OSCAL Profile document.
  - **success:** The exported document validates against the OSCAL 1.2.2 schema via `oscal-cli`, with one `set-parameter` per decision (fanned out from any batched cluster, never combined) and each override's rationale preserved in `remarks`.

- **CAP-5**
  - **intent:** A user's decisions survive a page reload or a later return visit on the same browser.
  - **success:** Reopening the workspace after closing the tab shows the same decisions as before, with no account or server round-trip involved.

- **CAP-6**
  - **intent:** A user reading a control sees the parameter values their own organization chose, not NIST's template text, and can revise one without leaving the statement that made it answerable.
  - **success:** A control page renders decided values inline for the working baseline and offers editing in place — through the same validation and fan-out path the workspace uses, never a second implementation. Verified against real data: 591 of 1,014 non-withdrawn items belong to no baseline at all, and their parameter slots are correctly inert rather than offering an edit that would be invisible to the workspace and absent from the export.

- **CAP-7**
  - **intent:** A user records whether each control is actually implemented, who owns it, and what proof exists.
  - **success:** Every control **and enhancement** carries one of `incomplete` / `in-progress` / `compliant` / `not-applicable`, an owner, and zero or more evidence references; `not-applicable` requires a non-empty justification before the change is accepted. Verified against real data: the Moderate baseline is 177 controls **plus 110 enhancements** — statusing controls alone would cover 62% of the obligation while reporting 100%.

- **CAP-8**
  - **intent:** A user sees at a glance what fraction of a baseline is complete, and cannot be misled by the number.
  - **success:** The dashboard's counts match the underlying status data exactly; `not-applicable` items are excluded from the denominator rather than counted as complete; withdrawn items never appear; every percentage is displayed beside its raw fraction.

- **CAP-9**
  - **intent:** A user who has completed one baseline does not redo identical work when moving to a stricter one.
  - **success:** A parameter already decided in another baseline is **proposed** with its provenance and stays `unreviewed-default` until explicitly confirmed — never auto-copied. Verified against real data: Low ⊂ Moderate ⊂ High strictly, so all 643 Moderate parameters recur in High.

- **CAP-10**
  - **intent:** A user can move their work off this browser, and recover it if the browser loses it.
  - **success:** A full export and re-import reproduces every decision, status, evidence reference and owner exactly. OSCAL export does not satisfy this — it is lossy about status, owner and evidence, and cannot be re-imported.

## Constraints

- Static-site only, no backend or accounts — decisions live entirely client-side.
- One module owns decision *state* (`odpStore.ts`) and one owns decision *mutation* — field construction, validation, dash-one fan-out. Any surface may read decisions and offer editing, but only through that mutation module; never a second `localStorage` path, a second validation implementation, or a second fan-out loop. *(Amended 2026-09-29, superseding: "One dedicated workspace page/island owns all decision state; no other page reads or writes it. Control detail pages may link in, never edit." The invariant worth protecting was a contract, not a location — see AD-9.)*
- Storage shape: one JSON object per baseline in `localStorage` (key `odp-decisions:<baseline>`), one `schemaVersion`, one shared read/write module. Decision key = `controlSlug:paramId`. A corrupt or missing blob is treated as empty state — never a crash, never a fabricated value.
- A decision's `value` is `string | string[]` — an array whenever the source parameter's `select.howMany` is `'one-or-more'` (97 real parameters corpus-wide, including one present in every dash-one control). Treating it as always-a-string silently drops selections on export and breaks cluster-match comparison.
- Dash-one cluster matching: `paramId` after stripping the `^<familyCode>-1_` / `^<familyCode>-01_` prefix, computed at read time only — never stored as a cluster reference. A batched write still lands as N fully independent decisions.
- Batching is dash-one only — do not extend it to other same-labeled parameters (e.g. the "frequency" label recurs across 15 unrelated controls). Investigated and rejected: unlike dash-one, those recurrences have no external grounding for treating them as one decision, and their empty guideline text can't disambiguate whether they actually mean the same thing. Batching them risks a wrong default silently propagating to an unrelated control.
- The client-facing ODP dataset is generated at build time from the already-committed Content Collection — never by re-parsing raw OSCAL or extending the ingestion script's scope.
- OSCAL export targets `oscal-version` 1.2.2 (the corpus's own ingested version) — one `set-parameter` per decision, `values` as an array, rationale in `remarks`. Validity is checked manually via `oscal-cli` during development; no client-side schema validator ships.
- V1 scope is the Moderate baseline only — the route/dataset are parameterized for other baselines but they are not built or tested.
- Batch-entry controls, per-parameter status toggles, and the readiness dashboard must be keyboard-operable and screen-reader-navigable, following the same `role`/`aria-expanded`/`focus-visible` patterns already used elsewhere in the Browser.
- Modern evergreen browsers only (current Chrome/Firefox/Safari/Edge) — no polyfills.
- Since there is no auto-backup, the export action is the durable copy of a user's work and must be presented as such in the UI, not as an optional extra.

Added 2026-09-29, for CAP-6 through CAP-10:

- Control implementation status, evidence and owner live in **one** `localStorage` blob (`control-status`), **not one per baseline** — unlike ODP decisions, which are per-baseline because their values genuinely differ between Moderate and High. Implementation status does not: you pursue one authorization. Baseline is a view filter over that single dataset. The asymmetry is deliberate.
- Status attaches to **every item, control and enhancement alike**, keyed by item slug. Enhancements get no route of their own; the affordance is a per-fragment control.
- Evidence is a structured reference — `{ note, url, collectedAt }` — never an uploaded file. Base64 in `localStorage` shares a ~5MB origin quota with the decision blobs, so an attachment could make decision writes fail from an unrelated page. `collectedAt` is captured automatically, because evidence staleness is a real finding and the field cannot be retrofitted onto records that never recorded it.
- Completion is counted in exactly one place under one rule set: withdrawn never counted, enhancements counted, `not-applicable` excluded from the denominator entirely, baseline-less PM controls always included and reported separately. Every percentage ships beside its raw fraction.
- A control cannot be marked `compliant` while any of its own ODPs is still `unreviewed-default`. A hard block, matching the readiness gate — a control declared compliant with unspecified parameters is the same unexamined-ceiling failure this feature exists to prevent, one layer up.
- A decision from another baseline may be **proposed** with its provenance and must be explicitly confirmed; never auto-copied. High legitimately demands stricter values than Moderate for parameters such as scan frequency and log retention, so a blanket copy is substantively wrong, not merely procedurally lazy.
- The working baseline (*whose decisions am I making*) and the per-page display filter (*what do I want to see*) are separate controls. Only the filter has an "All" option.

## Non-goals

- Not multi-user — no accounts, no sync, no cross-device access.
- Not an assessment-workflow tool — no SAP/SAR authoring, no POA&M tracking.
- Not a replacement for a real GRC platform or a 3PAO's own tooling.
- Not an SSP narrative generator — FedRAMP 20x deprecates that artifact (mandatory Jan 1 2027). **Restated 2026-09-29, now that CAP-7 records status and evidence:** what this tool produces is *structured status and evidence references, never generated prose*. Control-by-control status with supporting evidence is substance an SSP also carries, so the distinction has to be stated rather than inferred — the line is between machine-readable, continuously-verifiable records and an authored narrative document, and only the former is in scope. (The claim that this direction aligns with where FedRAMP 20x is heading should be verified against current guidance before it appears in any external write-up; that guidance is moving quickly.)
- Not an OSCAL-native editor — OSCAL is an export target, not the primary working format (real-world OSCAL adoption is still near zero per FedRAMP RFC-0024).

## Success signal

The readiness gate actually blocks: attempting to mark a baseline ready with one remaining `unreviewed-default` parameter is refused. And the artifact it produces is real: an exported OSCAL profile passes `oscal-cli validate`, with one `set-parameter` per decision and a rationale present in `remarks` for every overridden value.

**Extended 2026-09-29.** The gates compose rather than merely coexisting: a control cannot be marked compliant while its own parameters are unreviewed, and a parameter decided under Moderate does not silently become a High decision. Both refusals are the same argument the feature is built on — that a value nobody examined is not an answer — applied at the two places where it is easiest to skip. And the dashboard is honest about its own denominator: marking twelve controls not-applicable moves the figure from `176/287` to `176/275`, never to twelve free completions.
