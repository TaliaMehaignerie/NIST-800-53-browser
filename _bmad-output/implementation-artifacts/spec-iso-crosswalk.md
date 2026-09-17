---
title: 'CAP-4: ISO 27001 crosswalk ingestion and rendering'
type: 'feature'
created: '2026-09-17'
status: 'done'
review_loop_iteration: 0
baseline_commit: '7dc40a5603cd3c90403631fa24a16fbcccff71bb'
context:
  - '{project-root}/_bmad-output/planning-artifacts/architecture/architecture-BMad-2026-08-20/ARCHITECTURE-SPINE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-BMad-2026-09-07/DESIGN.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-BMad-2026-09-07/EXPERIENCE.md'
  - '{project-root}/_bmad-output/specs/spec-nist-800-53-browser/SPEC.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-ingestion-pipeline.md'
  - '{project-root}/_bmad-output/implementation-artifacts/spec-browse-ui.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `data/crosswalk.json` now exists (322 hand-transcribed entries, verified against NIST's SP800-53r5-to-ISO27001 mapping doc), but nothing reads it — `ingest.mjs` still writes `crosswalkTranscribedAt: null` and every Control Detail page still shows the hardcoded "not yet published" empty state regardless of real data.

**Approach:** Extend `ingest.mjs` (AD-2's single ingestion pipeline) to read `data/crosswalk.json`, attach each entry's mapped clauses to the matching Control/Enhancement, and stamp the meta singleton's `crosswalkTranscribedAt`. Extend `controls/[slug].astro`'s ISO Crosswalk section to render real data per the just-amended DESIGN.md spec (code-only clause pills, no titles — ISO/IEC 27001 is licensed and NIST's own source doesn't include titles either).

## Boundaries & Constraints

**Always:**
- `data/crosswalk.json` is keyed by OSCAL-native id (`ac-1`), each value an array of literal clause-code strings (asterisk preserved verbatim, e.g. `"9.2.2*"`) — this shape already exists and is final; ingestion reads it as-is, no reshaping.
- Every Control **and** Enhancement Content Collection entry gets a `crosswalk: string[]` field (empty array when the id has no crosswalk.json entry, or the id genuinely isn't in the file — 2 confirmed real cases, `ia-13`/`sa-24`, postdate NIST's crosswalk doc and are expected to be absent). This mirrors `baselines`' existing per-entry-not-inherited pattern (AD-2).
- `ingest.mjs` must fail loudly (throw, not warn) if `data/crosswalk.json` contains a key that doesn't correspond to any real Control/Enhancement id in the catalog being ingested — a typo'd or stale key in a future re-transcription must not silently vanish. It must NOT fail if a real catalog id has no crosswalk.json entry (expected/valid — either genuinely unmapped or, like the 2 known cases, newer than NIST's doc).
- `meta.crosswalkTranscribedAt` changes from a hardcoded `null` to a real ISO 8601 date constant in `ingest.mjs` (the date this transcription was verified — not derived from file mtime or git history, matching how other provenance facts in this pipeline are explicit committed values, not inferred metadata).
- Rendering (`controls/[slug].astro`): a Control with a non-empty `crosswalk` array renders each code as a small `mono`-type pill per DESIGN.md's just-amended ISO Crosswalk entry spec — code only, no title. A partial-match code (trailing `*`) renders the asterisk literally within the pill; the legend line ("* does not fully satisfy the intent of this control...") appears once beneath the clause list only when at least one pill in that Control's list has a `*`. An empty `crosswalk` array keeps rendering Goal B's existing "No ISO 27001 mapping published for this control." empty state — unchanged behavior for that case.
- Enhancements: `EnhancementItem` does not need an ISO Crosswalk section added in this slice — DESIGN.md's ISO Crosswalk entry is specced as living "inside the Control Detail card," i.e. at the Control level only. Enhancement-level crosswalk data is ingested (per the schema above, for forward compatibility since NIST's Table 2 could map directly to an Enhancement) but not rendered yet — same "ingest ahead of render" precedent as `guidance` in Goal A.
- `ingest.mjs --verify`'s existing assertion `eq('crosswalkTranscribedAt is null until CAP-4', meta.crosswalkTranscribedAt, null)` must be updated to assert the new real date instead of `null` — this is expected, sanctioned test churn, not a regression.

**Ask First:**
- Nothing anticipated — the JSON shape, rendering treatment, and licensing approach were already resolved (DESIGN.md amendment, this session).

**Never:**
- No re-parsing or reshaping of `data/crosswalk.json` — it's already in its final, verified shape.
- No ISO clause titles added from any source (licensing decision, already made).
- No changes to `data/raw/sp800-53r5-to-iso-27001-mapping.docx`, the TSV, or `scripts/dev/convert-crosswalk-tsv.mjs` — those are upstream of this slice and already done.
- No new page routes, no changes to CAP-2/CAP-3's components (`BaselineFilter`, the Enhancement toggle) or `setUrlState()`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|---|---|---|---|
| Control with mappings | `ac-1` (12 clauses, no asterisks) | 12 mono pills render, no legend line | N/A |
| Control with a partial match | `ca-1` (13 clauses, 2 with `*`) | 13 pills, the 2 asterisked ones show `*` literally in their pill text, one legend line renders once | N/A |
| Control with no mapping | Any `crosswalk: []` entry (151 real cases) | Unchanged Goal B empty state: "No ISO 27001 mapping published for this control." | N/A |
| Withdrawn control | `ac-13` (`crosswalk: []`, NIST's `---`) | Same empty state as any other zero-mapping control — no special-casing needed | N/A |
| Id absent from crosswalk.json entirely | `ia-13`, `sa-24` (confirmed not in NIST's source doc) | Treated identically to an explicit empty array — empty state renders | N/A |
| crosswalk.json has a stale/typo'd key | A key with no matching real catalog id | `ingest.mjs` throws before writing any output | Fail loudly, name the bad key |
| `npm run ingest:verify` | Full verify suite | `crosswalkTranscribedAt` assertion checks the real date, not `null`; a new assertion spot-checks `ac-1`'s and `ca-1`'s exact `crosswalk` arrays against the known-correct values already verified by hand in this session | N/A |

</frozen-after-approval>

## Code Map

- `data/crosswalk.json` -- read-only, already final (322 entries, verified this session).
- `scripts/ingest.mjs` -- MODIFY: `ingest()` reads `data/crosswalk.json` near the top (alongside `baselineSets`); `buildEntry()` gains a `crosswalk` lookup parameter and returns a `crosswalk: string[]` field; after building all `controls`/`enhancements`, cross-check every `data/crosswalk.json` key against the real id set and throw on any orphan; `meta.crosswalkTranscribedAt` gets a real date constant instead of `null`.
- `src/content.config.ts` -- MODIFY: add `crosswalk: z.array(z.string())` to the `controls` collection schema (both Control and Enhancement kind share the schema already, per Goal A's AD-2 sibling-entry design).
- `src/pages/controls/[slug].astro` -- MODIFY: replace the hardcoded `<p class="control-detail-card__crosswalk-empty">` with a conditional render — non-empty `crosswalk` array renders the pill list + conditional legend; empty array keeps the existing empty-state paragraph unchanged.
- `scripts/ingest.mjs`'s `verify()` -- MODIFY: update the existing `crosswalkTranscribedAt` assertion to the real date; add spot-check assertions for `ac-1` and `ca-1`'s exact `crosswalk` contents (values already confirmed correct by hand this session, so these are regression-pins, not new discovery).

## Tasks & Acceptance

**Execution:**
- [x] `scripts/ingest.mjs` -- read `data/crosswalk.json`, thread it into `buildEntry()`, add the `crosswalk` field to every Control/Enhancement entry, throw on any crosswalk key with no matching real id, set `meta.crosswalkTranscribedAt` to a real date constant.
- [x] `scripts/ingest.mjs`'s `verify()` -- update the `crosswalkTranscribedAt` assertion; add `ac-1`/`ca-1` spot-check assertions.
- [x] `src/content.config.ts` -- add `crosswalk: z.array(z.string())` to the `controls` collection schema.
- [x] `npm run ingest` -- regenerate the committed Content Collection with the new field.
- [x] `npm run ingest:verify` -- confirms the updated/new assertions pass.
- [x] `src/pages/controls/[slug].astro` -- render real crosswalk data (pills + conditional legend) when `crosswalk.length > 0`, keep the existing empty state otherwise.
- [x] `npm run build` -- confirms all 346 pages still build with zero errors against the regenerated Content Collection.

**Acceptance Criteria:**
- Given `/controls/ac-1` after ingestion, when rendered, then 12 clause pills appear (`5.2`, `5.3`, ... `A.5.37`) and no legend line.
- Given `/controls/ca-1`, when rendered, then 13 pills appear including `9.2.2*` and `9.3.1*` literally, and exactly one legend line appears once beneath the list.
- Given any Control with `crosswalk: []` (including the 151 real `None`/`---` cases and `ia-13`/`sa-24`), when rendered, then the existing "No ISO 27001 mapping published for this control." text appears, unchanged from Goal B.
- Given `npm run ingest:verify`, when it runs, then it reports zero failures, including the updated `crosswalkTranscribedAt` assertion and the new `ac-1`/`ca-1` spot-checks.
- Given a hypothetical future `data/crosswalk.json` edit that introduces a key with no matching real id, when `npm run ingest` runs, then it throws before writing any output (verify this by testing with a temporary bad key, then reverting).

## Design Notes

`buildEntry()`'s new parameter mirrors how `baselineSets` already threads through:

```js
// In ingest():
const crosswalkData = readJson(CROSSWALK_FILE); // data/crosswalk.json

// In buildEntry(node, ctx, baselineSets, crosswalkData, warn):
crosswalk: crosswalkData[node.id] ?? [],
```

Orphan-key check, after both `controls` and `enhancements` arrays are fully built:

```js
const realIds = new Set([...controls, ...enhancements].map((e) => e.id));
for (const key of Object.keys(crosswalkData)) {
  if (!realIds.has(key)) {
    throw new Error(`data/crosswalk.json has entry "${key}" with no matching catalog id`);
  }
}
```

Rendering sketch for `controls/[slug].astro`'s crosswalk section:

```astro
<section class="control-detail-card__crosswalk">
  <h2>ISO/IEC 27001:2022 Crosswalk</h2>
  {crosswalk.length > 0 ? (
    <>
      <div class="crosswalk-pills">
        {crosswalk.map((code) => <span class="crosswalk-pill">{code}</span>)}
      </div>
      {crosswalk.some((c) => c.endsWith('*')) && (
        <p class="crosswalk-legend">* does not fully satisfy the intent of this control (per NIST's mapping notes).</p>
      )}
    </>
  ) : (
    <p class="control-detail-card__crosswalk-empty">No ISO 27001 mapping published for this control.</p>
  )}
</section>
```

## Verification

**Commands:**
- `npm run ingest` -- expected: regenerates `src/content/controls/*.json` with the new `crosswalk` field on all 1,196 entries, zero errors.
- `npm run ingest:verify` -- expected: zero failures, including the updated and new assertions.
- `npm run build` -- expected: zero errors, all 346 pages generated.

**Manual checks:**
- Open `dist/controls/ac-1/index.html` and `dist/controls/ca-1/index.html` -- confirm the pill lists match this session's verified spot-checks exactly, and `ca-1` shows exactly one legend line.
- Open any Control confirmed to have `crosswalk: []` (e.g. `dist/controls/ac-13/index.html`, withdrawn) -- confirm the unchanged empty-state text.

## Suggested Review Order

**Ingestion**

- Entry point: `buildEntry()` attaches the `crosswalk` field per-entry, reading straight from `data/crosswalk.json` -- no reshaping.
  [`ingest.mjs:257`](../../scripts/ingest.mjs#L257)

- `readCrosswalk()` -- added during review to validate the file is an object and every value is an array of strings, before any of it reaches `buildEntry()`. Matches `readCatalog()`'s existing "validate shape, fail loudly" pattern, which the first pass hadn't applied to this new input.
  [`ingest.mjs:303`](../../scripts/ingest.mjs#L303)

- Orphan-key guard: a `data/crosswalk.json` key with no matching real id throws before any output is written -- the one behavior CAP-4 explicitly exists to harden against.
  [`ingest.mjs:415`](../../scripts/ingest.mjs#L415) *(search "no matching catalog id")*

**Review-added test coverage**

- `INGEST_CROSSWALK_FILE` override, mirroring the existing `INGEST_RAW_DIR`/`INGEST_CONTENT_DIR` sandboxing pattern -- makes the orphan-key throw path testable without ever touching the real `data/crosswalk.json`.
  [`ingest.mjs:59`](../../scripts/ingest.mjs#L59)

- The orphan-key guard had zero automated regression protection before review (verification-gap finding) -- this sandboxed child-process test closes that gap the same way the pre-existing "Missing input guard" test does.
  [`ingest.mjs:860`](../../scripts/ingest.mjs#L860)

- Extra fixture spot-checks added for coverage breadth: a withdrawn control (`ac-13`), an ordinary no-mapping control (`ac-10`), and an Enhancement's independent (currently empty) crosswalk (`ac-2.1`).
  [`ingest.mjs:780`](../../scripts/ingest.mjs#L780)

**Rendering**

- Real crosswalk data replaces the hardcoded empty state: pills for each clause code, a conditional legend when any pill is asterisked.
  [`controls/[slug].astro:70`](../../src/pages/controls/%5Bslug%5D.astro#L70)

**Schema**

- `crosswalk: z.array(z.string())` added to the shared Control/Enhancement schema.
  [`content.config.ts:124`](../../src/content.config.ts#L124)
