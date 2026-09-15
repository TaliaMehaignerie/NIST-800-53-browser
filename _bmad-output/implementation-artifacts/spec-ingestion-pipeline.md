---
title: 'Canonical OSCAL ingestion pipeline'
type: 'feature'
created: '2026-09-15'
status: 'in-progress'
baseline_commit: 'c48b9de9dc2be69cacdecf2d174e56edc8e2fd89'
review_loop_iteration: 0
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-08-20/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/specs/spec-nist-800-53-browser/SPEC.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Five raw OSCAL files sit in `data/raw/` and nothing reads them. Every capability (CAP-1…CAP-6) needs one canonical, queryable representation of the catalog, and AD-2 forbids pages or islands parsing raw OSCAL themselves.

**Approach:** A local, human-run script parses the master catalog for content and the four resolved baseline profiles for membership, then writes committed Astro Content Collection entries — one per Control, one per Enhancement, one per Family, plus a singleton provenance entry. No UI in this scope.

## Boundaries & Constraints

**Always:**
- `src/utils/slugify.ts` is the only id→slug path; `scripts/ingest.mjs` imports it rather than reimplementing (AD-4). Input is always the OSCAL-native id (`ac-2.1`), never the display label (`AC-2(1)`).
- Prose is copied verbatim, including `{{ insert: param, … }}` placeholders — no substitution, no paraphrase (AD-5).
- Baseline membership computed independently at **both** Control and Enhancement granularity, by id presence in each resolved profile (AD-2).
- Output is committed to the repo as source of truth (AD-2).
- Idempotent: re-running with unchanged inputs produces byte-identical output.

**Ask First:**
- Any change to AD-2's pinned entry shape.
- Resolving or rewriting param placeholders — that is a rendering decision belonging to the browse UI, not ingestion.

**Never:**
- Never emit `assessment-objective` / `assessment-method` parts. The master catalog bundles SP 800-53A procedures; the PRD lists them as a non-goal.
- Never run in CI, and never make a network call — read only from `data/raw/` (AD-2, AD-6, AD-1).
- Never give an Enhancement its own route or page (AD-4 makes them fragments).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Base control | `ac-2` | `ac-2.json`, `kind:"control"`, `baselines:["low","moderate","high"]`, 13 enhancement slugs | N/A |
| Enhancement baseline differs from parent | `ac-2.1` (moderate/high) vs parent (low too) | Own `baselines`, not inherited | N/A |
| Withdrawn, link targets a *part* | `ac-2.10`, href `#ac-2_smt.k` | `withdrawn:true`, `incorporatedInto:["ac-2"]` (stripped to control id) | N/A |
| Withdrawn, multiple targets | `ac-3.6` → `mp-4`, `sc-28` | Both retained in order | N/A |
| Withdrawn, no links but has statement | `cp-10.3`, `sc-19` | `withdrawn:true`, `incorporatedInto:[]`, statement kept | N/A |
| Renamed control | `at-3.4`, rel `moved-to` | Treated as withdrawn; target in `incorporatedInto` | N/A |
| Part with both prose and children | 66 controls | Prose emitted before child parts | N/A |
| Unresolvable param ref | `ia-13.3`, `sc-42.2`, `si-10.1` | Placeholder left raw in prose | Warn to stderr; never throw |
| Missing input file | `data/raw/` incomplete | Non-zero exit, names the file | Fail loudly before writing anything |

</frozen-after-approval>

## Code Map

- `data/raw/NIST_SP-800-53_rev5_catalog-min.json` -- read-only. Content source. `catalog.groups[]` (20, one level, `props[label]`→code, `title`→name) → `.controls[]` (324) → `.controls[]` (872 enhancements, depth stops here).
- `data/raw/NIST_SP-800-53_rev5_{LOW,MODERATE,HIGH,PRIVACY}-baseline-resolved-profile_catalog-min.json` -- read-only. **Id sets only** — content is a byte-identical copy of master, so never ingest prose from these. Expected sizes 149 / 287 / 370 / 96.
- `src/utils/slugify.ts` -- CREATE. Sole id→slug function (AD-4).
- `src/content/config.ts` -- CREATE. Zod schemas + collection definitions.
- `scripts/ingest.mjs` -- CREATE. The pipeline. Wired to existing `npm run ingest`.
- `src/content/controls/`, `src/content/families/`, `src/content/meta/` -- CREATE (output, committed).
- `astro.config.mjs`, `package.json` -- existing; `ingest` script already present, no change expected.

Key OSCAL field notes: display label = the `label` prop **without** a `class` (three exist: `zero-padded`, unclassed, `sp800-53a`). Sort key = `sort-id` prop. Withdrawn = `props` contains `{name:"status",value:"withdrawn"}`. Related = `links[rel="related"]`. Placeholder regex: `/\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g`.

## Tasks & Acceptance

**Execution:**
- [x] `src/utils/slugify.ts` -- export `slugify(oscalId)` returning lowercase dotted→hyphenated (`ac-2.1`→`ac-2-1`); throw on an id not matching `/^[a-z]{2}-\d+(\.\d+)?$/` -- one contract, no silent variants (AD-4).
- [x] `src/content/config.ts` (shipped at `src/content.config.ts` — Astro 7 hard-errors on the legacy path) -- define `controls`, `families`, `meta` collections with Zod schemas -- schema is the contract the browse UI is written against.
- [x] `scripts/ingest.mjs` -- parse master + 4 baselines, emit entries, print a summary -- the AD-2 pipeline.
- [x] `scripts/ingest.mjs` -- unit-test the I/O matrix rows via a `--verify` flag that asserts counts and the named edge-case ids -- makes "none silently dropped" checkable rather than asserted.
- [x] Run ingestion and commit the generated entries -- AD-2 requires output be committed.

**Acceptance Criteria:**
- Given a clean checkout, when `npm run ingest` runs, then `src/content/controls/` holds exactly 1196 entries (324 `kind:"control"` + 872 `kind:"enhancement"`), `src/content/families/` holds 20, and `src/content/meta/` holds 1.
- Given the meta entry, when read, then it carries `catalogVersion:"5.2.0"`, `oscalVersion:"1.2.2"`, the catalog `lastModified`, and `crosswalkTranscribedAt:null` (CAP-4 not yet built).
- Given any generated entry, when inspected, then it contains no `assessment-objective` or `assessment-method` content.
- Given ingestion runs twice with unchanged inputs, when outputs are diffed, then there is no change.
- Given `npm run build`, when it completes, then Astro resolves all three collections against the schema with zero errors.

## Design Notes

Entry shape (AD-2 pinned; `families` is an addition — see checkpoint note):

```jsonc
// src/content/controls/ac-2-1.json
{ "id": "ac-2.1", "slug": "ac-2-1", "label": "AC-2(1)", "kind": "enhancement",
  "parentSlug": "ac-2", "title": "Automated System Account Management",
  "familyCode": "AC", "sortId": "ac-02.01", "withdrawn": false,
  "incorporatedInto": [], "baselines": ["moderate","high"],
  "statement": [ { "label": null, "prose": "…", "children": [] } ],
  "guidance": "…", "params": [ … ], "related": ["ac-2"] }
```

`statement` is a recursive `{label, prose, children}` tree because 66 controls carry prose *and* sub-parts; flattening would reorder text. `guidance` (NIST "Discussion") is ingested although no capability renders it yet — it is free to capture now and expensive to re-ingest later.

## Verification

**Commands:**
- `npm run ingest` -- expected: exits 0, prints `324 controls, 872 enhancements, 20 families`.
- `node scripts/ingest.mjs --verify` -- expected: all assertions pass (counts, baseline sizes 149/287/370/96, `ac-2.10` withdrawn→`["ac-2"]`, `ac-3.6`→`["mp-4","sc-28"]`, `cp-10.3` withdrawn with statement, no assessment parts present).
- `npm run build` -- expected: Astro validates all collections, build succeeds.
- `npm run ingest && git diff --exit-code src/content` -- expected: exit 0 (idempotent).
