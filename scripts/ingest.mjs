#!/usr/bin/env node
/**
 * The single canonical OSCAL ingestion pipeline (architecture spine AD-2).
 *
 * Reads the master NIST SP 800-53 Rev 5 OSCAL catalog for *content* and the
 * four resolved baseline profiles for *membership*, and writes committed Astro
 * Content Collection entries: one per Control, one sibling entry per
 * Enhancement, one per Family, plus a singleton provenance entry.
 *
 * Rules this file exists to enforce:
 *  - AD-2  the only code path allowed to read `data/raw/`. Run locally by
 *          hand, never by CI. Output is committed as the source of truth.
 *  - AD-4  id to slug goes through `src/utils/slugify.ts`, never a local
 *          reimplementation, and always on the OSCAL-native id.
 *  - AD-5  prose is copied verbatim, `{{ insert: param, ... }}` placeholders
 *          intact. Resolving them is a rendering decision, not an ingestion
 *          one.
 *  - AD-1/AD-6  no network calls, ever. Reads only from `data/raw/`.
 *  - PRD non-goal  `assessment-objective` / `assessment-method` parts (the
 *          SP 800-53A procedures the catalog bundles) are never emitted.
 *
 * Usage:
 *   node scripts/ingest.mjs            # ingest and write
 *   node scripts/ingest.mjs --verify   # assert the I/O matrix; writes nothing
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isOscalControlId, slugify } from '../src/utils/slugify.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// `INGEST_RAW_DIR` exists solely so --verify can exercise the missing-input
// guard in a child process against a throwaway directory. Production runs
// never set it and always read data/raw/.
const RAW_DIR = process.env.INGEST_RAW_DIR
  ? resolve(process.env.INGEST_RAW_DIR)
  : join(ROOT, 'data', 'raw');
// `INGEST_CONTENT_DIR` exists for the same reason as `INGEST_RAW_DIR`: so the
// missing-input child process below is physically unable to touch the real
// committed collection, even if its logic changes later.
const CONTENT_DIR = process.env.INGEST_CONTENT_DIR
  ? resolve(process.env.INGEST_CONTENT_DIR)
  : join(ROOT, 'src', 'content');

const MASTER_FILE = join(RAW_DIR, 'NIST_SP-800-53_rev5_catalog-min.json');
// `INGEST_CROSSWALK_FILE` exists for the same reason as `INGEST_RAW_DIR`: so
// --verify can exercise the orphan-key guard (CAP-4) against a throwaway
// file, never the real committed data/crosswalk.json.
const CROSSWALK_FILE = process.env.INGEST_CROSSWALK_FILE
  ? resolve(process.env.INGEST_CROSSWALK_FILE)
  : join(ROOT, 'data', 'crosswalk.json');

// The date this ISO 27001 crosswalk transcription was verified (CAP-4) -- an
// explicit committed value, not derived from file mtime or git history,
// matching how every other provenance fact in this pipeline is authored, not
// inferred (see meta.crosswalkTranscribedAt below).
const CROSSWALK_TRANSCRIBED_AT = '2026-09-17';

/** Baseline key, its resolved profile file, and the entry count it should carry. */
const BASELINES = [
  {
    key: 'low',
    file: 'NIST_SP-800-53_rev5_LOW-baseline-resolved-profile_catalog-min.json',
    expected: 149,
  },
  {
    key: 'moderate',
    file: 'NIST_SP-800-53_rev5_MODERATE-baseline-resolved-profile_catalog-min.json',
    expected: 287,
  },
  {
    key: 'high',
    file: 'NIST_SP-800-53_rev5_HIGH-baseline-resolved-profile_catalog-min.json',
    expected: 370,
  },
  {
    key: 'privacy',
    file: 'NIST_SP-800-53_rev5_PRIVACY-baseline-resolved-profile_catalog-min.json',
    expected: 96,
  },
];

const OUT_DIRS = {
  controls: join(CONTENT_DIR, 'controls'),
  families: join(CONTENT_DIR, 'families'),
  meta: join(CONTENT_DIR, 'meta'),
};

/** Matches `{{ insert: param, ac-02_odp.01 }}` in verbatim prose. */
const PARAM_PLACEHOLDER = /\{\{\s*insert:\s*param,\s*([^\s}]+)\s*\}\}/g;

/** Link rels that mean "this entry was withdrawn into something else". */
const SUCCESSOR_RELS = new Set(['incorporated-into', 'moved-to']);

// ---------------------------------------------------------------------------
// OSCAL accessors
// ---------------------------------------------------------------------------

/**
 * The display label is the `label` prop with NO `class`. Three label props
 * exist per control: `zero-padded` (`AC-02(01)`), unclassed (`AC-2(1)`), and
 * `sp800-53a` (`AC-02(01)`). Only the unclassed one is the canonical display
 * form AD-4 pins for UI text.
 */
function displayLabel(node) {
  const found = (node.props ?? []).find((p) => p.name === 'label' && p.class === undefined);
  if (!found) throw new Error(`No unclassed label prop on "${node.id}"`);
  return found.value;
}

function propValue(node, name) {
  return (node.props ?? []).find((p) => p.name === name)?.value ?? null;
}

function isWithdrawn(node) {
  return (node.props ?? []).some((p) => p.name === 'status' && p.value === 'withdrawn');
}

/**
 * Strip an OSCAL fragment href down to the entity it points at.
 * `#ac-2_smt.k` gives `ac-2` (a part is not an addressable entity here),
 * `#at-2.4` gives `at-2.4`, `#sr` gives `sr` (SA-12 points at a whole family).
 */
function hrefTarget(href) {
  if (typeof href !== 'string') {
    throw new Error(`OSCAL link has no string href: ${JSON.stringify(href)}`);
  }
  return href.replace(/^#/, '').split('_')[0];
}

function linkTargets(node, predicate) {
  return (node.links ?? [])
    .filter((l) => predicate(l.rel))
    .map((l) => {
      const target = hrefTarget(l.href);
      // Cross-references are stored as SLUGS, never raw OSCAL ids (AD-4).
      // Base-control targets look identical either way (`ac-2`), which is why
      // an unslugified enhancement target (`at-2.4` instead of `at-2-4`) hides
      // so easily -- it silently fails to resolve against any entry.
      // `sa-12` is the one catalog entry whose successor is a whole family
      // (`sr`), which has no control slug; it stays raw by design.
      return isOscalControlId(target) ? slugify(target) : target;
    });
}

/**
 * Map an OSCAL part to a statement node, recursing into sub-parts.
 * Prose is emitted before children so text order survives the transform (AD-5).
 */
function statementNode(part) {
  return {
    label: propValue(part, 'label'),
    prose: part.prose ?? null,
    children: (part.parts ?? []).map(statementNode),
  };
}

/**
 * Select parts by name. Only `statement` and `guidance` are ever requested:
 * the catalog also bundles `assessment-objective` / `assessment-method`
 * (SP 800-53A), which the PRD lists as a non-goal and this pipeline must
 * never emit.
 */
function partsNamed(node, name) {
  return (node.parts ?? []).filter((p) => p.name === name);
}

function ingestParams(node) {
  return (node.params ?? []).map((p) => ({
    id: p.id,
    label: p.label ?? null,
    select: p.select
      ? { howMany: p.select['how-many'] ?? null, choice: p.select.choice ?? [] }
      : null,
    guidelines: (p.guidelines ?? []).map((g) => g.prose ?? ''),
  }));
}

/** Every `{{ insert: param, ... }}` id referenced by this entry's own prose. */
function referencedParamIds(statement, guidance) {
  const ids = [];
  const scan = (text) => {
    if (!text) return;
    for (const match of text.matchAll(PARAM_PLACEHOLDER)) ids.push(match[1]);
  };
  const walk = (node) => {
    scan(node.prose);
    node.children.forEach(walk);
  };
  statement.forEach(walk);
  scan(guidance);
  return ids;
}

// ---------------------------------------------------------------------------
// Entry construction
// ---------------------------------------------------------------------------

/**
 * Build one Content Collection entry. `kind` decides only the parent/child
 * fields: baseline membership is looked up per-entry either way, so an
 * Enhancement never implicitly inherits its Control's baselines (AD-2).
 */
function buildEntry(
  node,
  { kind, familyCode, parentSlug, enhancementSlugs },
  baselineSets,
  crosswalkData,
  warn,
) {
  const statement = partsNamed(node, 'statement').map(statementNode);
  const guidance = partsNamed(node, 'guidance')[0]?.prose ?? null;

  const sortId = propValue(node, 'sort-id');
  if (!sortId) throw new Error(`No sort-id prop on "${node.id}"`);

  const params = ingestParams(node);
  const ownParamIds = new Set(params.map((p) => p.id));
  for (const referenced of referencedParamIds(statement, guidance)) {
    if (!ownParamIds.has(referenced)) {
      // AD-5: leave it raw. The browse UI decides what to render for an
      // unresolvable placeholder; ingestion must not silently rewrite prose,
      // and must not throw over a source-data quirk.
      warn(`unresolvable param ref: ${node.id} -> ${referenced}`);
    }
  }

  const withdrawn = isWithdrawn(node);
  const incorporatedInto = linkTargets(node, (rel) => SUCCESSOR_RELS.has(rel));
  if (!withdrawn && incorporatedInto.length > 0) {
    warn(`"${node.id}" has a successor link but is not marked withdrawn`);
  }

  return {
    id: node.id,
    slug: slugify(node.id),
    label: displayLabel(node),
    kind,
    parentSlug,
    enhancementSlugs,
    title: node.title,
    familyCode,
    sortId,
    withdrawn,
    incorporatedInto,
    baselines: BASELINES.filter(({ key }) => baselineSets.get(key).has(node.id)).map((b) => b.key),
    statement,
    guidance,
    params,
    related: linkTargets(node, (rel) => rel === 'related'),
    // data/crosswalk.json is keyed by the OSCAL-native id, already in its
    // final shape -- read as-is, no reshaping (CAP-4). Empty array when this
    // id has no published mapping, or genuinely isn't in the file (ia-13,
    // sa-24 postdate NIST's crosswalk doc).
    crosswalk: crosswalkData[node.id] ?? [],
  };
}

// ---------------------------------------------------------------------------
// Input loading
// ---------------------------------------------------------------------------

function readJson(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch (e) {
    throw new Error(`Could not read ${file}: ${e.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON in ${file}: ${e.message}`);
  }
}

/** Read an OSCAL file and confirm it actually has the shape ingestion assumes. */
function readCatalog(file) {
  const catalog = readJson(file).catalog;
  if (!catalog || typeof catalog !== 'object') {
    throw new Error(`${file} has no top-level "catalog" -- is this an OSCAL catalog file?`);
  }
  if (!catalog.metadata) {
    throw new Error(`${file}'s catalog has no "metadata" -- is this a valid OSCAL catalog?`);
  }
  return catalog;
}

/** Read data/crosswalk.json and confirm it actually has the shape ingestion assumes (CAP-4). */
function readCrosswalk(file) {
  const data = readJson(file);
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${file} must be a JSON object keyed by OSCAL-native id`);
  }
  for (const [key, value] of Object.entries(data)) {
    if (!Array.isArray(value) || !value.every((c) => typeof c === 'string')) {
      throw new Error(`${file} entry "${key}" must be an array of strings`);
    }
  }
  return data;
}

/**
 * Fail loudly, naming the file, before anything is written. A partial ingest
 * would leave the committed collection (AD-2's source of truth) inconsistent.
 */
function assertInputsPresent() {
  const missing = [MASTER_FILE, ...BASELINES.map((b) => join(RAW_DIR, b.file))].filter(
    (file) => !existsSync(file),
  );
  if (missing.length > 0) {
    for (const file of missing) console.error(`Missing required input: ${file}`);
    console.error(
      'Aborting before writing anything. Re-download data/raw/ from usnistgov/oscal-content.',
    );
    process.exit(1);
  }
}

/** Collect every control + enhancement id in a resolved baseline profile. */
function baselineIds(catalog) {
  const ids = new Set();
  for (const group of catalog.groups ?? []) {
    for (const control of group.controls ?? []) {
      ids.add(control.id);
      for (const enhancement of control.controls ?? []) ids.add(enhancement.id);
    }
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

/** Parse all inputs and build every entry in memory. Writes nothing. */
function ingest({ warn }) {
  assertInputsPresent();

  const catalog = readCatalog(MASTER_FILE);

  // Id sets only: the resolved profiles are a byte-identical copy of the
  // master's content, so ingesting prose from them would be a second, silently
  // diverging source (AD-2).
  const baselineSets = new Map(
    BASELINES.map((b) => [b.key, baselineIds(readCatalog(join(RAW_DIR, b.file)))]),
  );

  // data/crosswalk.json is already in its final, verified shape (CAP-4) --
  // ingestion reads its clause codes as-is, no reshaping.
  const crosswalkData = readCrosswalk(CROSSWALK_FILE);

  const controls = [];
  const enhancements = [];
  const families = [];

  for (const [groupIndex, group] of (catalog.groups ?? []).entries()) {
    const familyCode = propValue(group, 'label');
    if (!familyCode) throw new Error(`No label prop on group "${group.id}"`);
    if (!/^[a-z]{2}$/.test(group.id)) {
      throw new Error(`Family id "${group.id}" is not slug-shaped; AD-4 routing assumes it is`);
    }

    const familyControls = [];
    let familyEnhancementCount = 0;

    for (const control of group.controls ?? []) {
      const controlSlug = slugify(control.id);
      const childNodes = control.controls ?? [];

      familyControls.push(
        buildEntry(
          control,
          {
            kind: 'control',
            familyCode,
            parentSlug: null,
            enhancementSlugs: childNodes.map((e) => slugify(e.id)),
          },
          baselineSets,
          crosswalkData,
          warn,
        ),
      );

      for (const enhancement of childNodes) {
        if (enhancement.controls) {
          throw new Error(
            `Enhancement "${enhancement.id}" has nested controls; the model stops at depth 2`,
          );
        }
        enhancements.push(
          buildEntry(
            enhancement,
            { kind: 'enhancement', familyCode, parentSlug: controlSlug, enhancementSlugs: [] },
            baselineSets,
            crosswalkData,
            warn,
          ),
        );
        familyEnhancementCount += 1;
      }
    }

    controls.push(...familyControls);
    families.push({
      slug: group.id,
      catalogOrder: groupIndex,
      code: familyCode,
      name: group.title,
      controlSlugs: familyControls.map((c) => c.slug),
      controlCount: familyControls.length,
      enhancementCount: familyEnhancementCount,
    });
  }

  // A key with no matching real catalog id is a typo or a stale
  // re-transcription -- fail loudly before writing anything rather than let
  // it silently vanish (CAP-4).
  const realIds = new Set([...controls, ...enhancements].map((e) => e.id));
  for (const key of Object.keys(crosswalkData)) {
    if (!realIds.has(key)) {
      throw new Error(`data/crosswalk.json has entry "${key}" with no matching catalog id`);
    }
  }

  const meta = {
    catalogTitle: catalog.metadata.title,
    catalogVersion: catalog.metadata.version,
    oscalVersion: catalog.metadata['oscal-version'],
    lastModified: catalog.metadata['last-modified'],
    // The date this ISO 27001 crosswalk transcription was verified (CAP-4).
    crosswalkTranscribedAt: CROSSWALK_TRANSCRIBED_AT,
    counts: {
      families: families.length,
      controls: controls.length,
      enhancements: enhancements.length,
    },
    baselineCounts: Object.fromEntries(BASELINES.map((b) => [b.key, baselineSets.get(b.key).size])),
  };

  return { controls, enhancements, families, meta, baselineSets };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/**
 * Serialize deterministically: same inputs give byte-identical bytes. No
 * timestamps, no run ids, stable key and array order, trailing newline.
 */
function serialize(entry) {
  return `${JSON.stringify(entry, null, 2)}\n`;
}

/**
 * Every file this run would write, as `absolute path -> contents`.
 *
 * Throws on a slug collision rather than letting `Map.set` silently collapse
 * two entries into one file -- uniqueness must hold on every run, not only
 * when `--verify` happens to be the command someone typed.
 */
function plannedFiles({ controls, enhancements, families, meta }) {
  const byPath = new Map();
  const byDir = new Map(Object.keys(OUT_DIRS).map((key) => [key, []]));
  const add = (dirKey, filename, contents, sourceId) => {
    const path = join(OUT_DIRS[dirKey], filename);
    if (byPath.has(path)) {
      throw new Error(`Duplicate output path ${path} (from "${sourceId}") -- slug collision`);
    }
    byPath.set(path, contents);
    byDir.get(dirKey).push([filename, contents]);
  };
  for (const entry of [...controls, ...enhancements]) {
    add('controls', `${entry.slug}.json`, serialize(entry), entry.id);
  }
  for (const family of families) {
    add('families', `${family.slug}.json`, serialize(family), family.slug);
  }
  add('meta', 'provenance.json', serialize(meta), 'provenance');
  return { byPath, byDir };
}

/** Existing on-disk output, as `absolute path -> contents`. */
function existingFiles() {
  const files = new Map();
  for (const dir of Object.values(OUT_DIRS)) {
    if (!existsSync(dir)) continue;
    for (const name of readdirSync(dir)) {
      if (name.endsWith('.json')) files.set(join(dir, name), readFileSync(join(dir, name), 'utf8'));
    }
  }
  return files;
}

/**
 * Replace the output directories wholesale rather than merging, so an id that
 * disappears from a future catalog release cannot leave a stale entry behind
 * in the committed collection.
 *
 * Atomic per directory: write into a fresh sibling `.tmp-<dir>` first, and
 * only `rmSync` + `renameSync` over the real directory once every file in it
 * has been written successfully. A mid-write failure (disk full, a lock,
 * permissions) then leaves the previously-committed collection untouched
 * instead of half-deleted -- the exact inconsistency `assertInputsPresent`'s
 * own doc comment says this pipeline must never produce.
 */
function writeOutput({ byDir }) {
  // Sweep any `<dir>.tmp-<pid>` directory a previous run left behind after a
  // mid-write crash -- harmless litter, but nothing else will ever clean it
  // up, since each run names its temp dir after its own process id.
  for (const dir of Object.values(OUT_DIRS)) {
    const parent = dirname(dir);
    const base = dir.slice(parent.length + 1);
    for (const name of readdirSync(parent)) {
      if (name.startsWith(`${base}.tmp-`)) {
        rmSync(join(parent, name), { recursive: true, force: true });
      }
    }
  }

  for (const [key, dir] of Object.entries(OUT_DIRS)) {
    const tmpDir = `${dir}.tmp-${process.pid}`;
    rmSync(tmpDir, { recursive: true, force: true });
    mkdirSync(tmpDir, { recursive: true });
    for (const [filename, contents] of byDir.get(key)) {
      writeFileSync(join(tmpDir, filename), contents, 'utf8');
    }
    rmSync(dir, { recursive: true, force: true });
    renameSync(tmpDir, dir);
  }
}

// ---------------------------------------------------------------------------
// --verify: the I/O matrix, checkable rather than asserted
// ---------------------------------------------------------------------------

function verify(result, warnings) {
  const { controls, enhancements, families, meta, baselineSets } = result;
  const entries = [...controls, ...enhancements];
  const byId = new Map(entries.map((e) => [e.id, e]));
  const bySlug = new Map(entries.map((e) => [e.slug, e]));

  const failures = [];
  const check = (label, condition, detail = '') => {
    if (condition) {
      console.log(`  ok    ${label}`);
    } else {
      console.log(`  FAIL  ${label}${detail ? ` -- ${detail}` : ''}`);
      failures.push(label);
    }
  };
  const eq = (label, actual, expected) =>
    check(
      label,
      JSON.stringify(actual) === JSON.stringify(expected),
      `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );

  console.log('Counts');
  eq('324 controls', controls.length, 324);
  eq('872 enhancements', enhancements.length, 872);
  eq('1196 entries in the controls collection', entries.length, 1196);
  eq('20 families', families.length, 20);
  eq(
    'family counts sum to the catalog totals',
    [
      families.reduce((n, f) => n + f.controlCount, 0),
      families.reduce((n, f) => n + f.enhancementCount, 0),
    ],
    [324, 872],
  );

  /**
   * Fixture lookup for the hardcoded example ids below. On a miss, records a
   * FAIL and returns a stand-in with every field null/empty rather than
   * throwing -- so one renamed id in a future catalog release produces one
   * readable failure line instead of aborting the entire verify run before
   * later, unrelated assertions get a chance to report anything.
   */
  const STUB = {
    slug: null, baselines: [], kind: null, enhancementSlugs: [], parentSlug: null,
    incorporatedInto: [], withdrawn: null, statement: [{ label: null, prose: '', children: [] }], related: [],
    crosswalk: [],
  };
  const fixture = (id) => {
    const entry = byId.get(id);
    check(`fixture "${id}" exists in this catalog release`, entry !== undefined);
    return entry ?? STUB;
  };

  console.log('Baseline membership (AD-2: computed at both granularities)');
  for (const { key, expected } of BASELINES) {
    eq(`${key} baseline holds ${expected} ids`, baselineSets.get(key).size, expected);
  }
  for (const { key } of BASELINES) {
    const orphans = [...baselineSets.get(key)].filter((id) => !byId.has(id));
    eq(`every ${key} baseline id exists in the master catalog`, orphans, []);
  }
  eq('ac-2 baselines', fixture('ac-2').baselines, ['low', 'moderate', 'high']);
  eq('ac-2 kind', fixture('ac-2').kind, 'control');
  eq('ac-2 carries 13 enhancement slugs', fixture('ac-2').enhancementSlugs.length, 13);
  eq('ac-2.1 has its own baselines, not the inherited ones', fixture('ac-2.1').baselines, [
    'moderate',
    'high',
  ]);
  check(
    'enhancements do not inherit: some sit in no baseline while their parent does',
    enhancements.some(
      (e) => e.baselines.length === 0 && (bySlug.get(e.parentSlug)?.baselines.length ?? 0) > 0,
    ),
  );

  console.log('Withdrawn handling');
  eq('ac-2.10 withdrawn', fixture('ac-2.10').withdrawn, true);
  eq('ac-2.10 part-level target stripped to a control id', fixture('ac-2.10').incorporatedInto, [
    'ac-2',
  ]);
  eq('ac-3.6 keeps both targets in order', fixture('ac-3.6').incorporatedInto, ['mp-4', 'sc-28']);
  eq('cp-10.3 withdrawn', fixture('cp-10.3').withdrawn, true);
  eq('cp-10.3 has no successor', fixture('cp-10.3').incorporatedInto, []);
  check('cp-10.3 keeps its statement', fixture('cp-10.3').statement.length === 1);
  eq('sc-19 withdrawn', fixture('sc-19').withdrawn, true);
  eq('sc-19 has no successor', fixture('sc-19').incorporatedInto, []);
  check('sc-19 keeps its statement', fixture('sc-19').statement.length === 1);
  eq('at-3.4 moved-to is treated as withdrawn', fixture('at-3.4').withdrawn, true);
  eq('at-3.4 successor is a slug, not a raw id', fixture('at-3.4').incorporatedInto, ['at-2-4']);
  eq('182 withdrawn entries in total', entries.filter((e) => e.withdrawn).length, 182);
  const familySlugs = new Set(families.map((f) => f.slug));
  const unresolved = entries
    .flatMap((e) => e.incorporatedInto.map((t) => `${e.slug} -> ${t}`))
    .filter((x) => {
      const to = x.split(' -> ')[1];
      return !bySlug.has(to) && !familySlugs.has(to);
    });
  eq('every successor resolves to a Control slug or a Family slug', unresolved, []);
  // `related` goes through the identical linkTargets()/slugify() transform as
  // incorporatedInto above -- the same slug-vs-raw-id bug could recur here
  // undetected without this check, since related targets are always control
  // slugs (never a family, unlike incorporatedInto's sa-12 exception).
  const unresolvedRelated = entries
    .flatMap((e) => e.related.map((t) => `${e.slug} -> ${t}`))
    .filter((x) => !bySlug.has(x.split(' -> ')[1]));
  eq('every related target resolves to a Control slug', unresolvedRelated, []);
  check(
    'ac-2.1 related targets are slugs, not raw OSCAL ids',
    fixture('ac-2.1').related.every((t) => !t.includes('.')),
  );
  check(
    'every withdrawn entry either names a successor or keeps a statement',
    entries
      .filter((e) => e.withdrawn)
      .every((e) => e.incorporatedInto.length > 0 || e.statement.length > 0),
  );

  console.log('Slugs and structure (AD-4)');
  eq('slugs are unique', entries.length - bySlug.size, 0);
  eq('ac-2.1 slug', fixture('ac-2.1').slug, 'ac-2-1');
  eq('ac-2.1 parentSlug', fixture('ac-2.1').parentSlug, 'ac-2');
  check(
    'every enhancement points at a real parent Control',
    enhancements.every((e) => bySlug.get(e.parentSlug)?.kind === 'control'),
  );
  check(
    'enhancements claim no children of their own (AD-4: they are fragments)',
    enhancements.every((e) => e.enhancementSlugs.length === 0),
  );
  check(
    'every Control has a null parentSlug',
    controls.every((c) => c.parentSlug === null),
  );
  check(
    'every enhancement slug listed by a Control resolves',
    controls.every((c) => c.enhancementSlugs.every((s) => bySlug.get(s)?.kind === 'enhancement')),
  );
  check(
    'every family control slug resolves, and none is dropped',
    families.every((f) => f.controlSlugs.every((s) => bySlug.get(s)?.familyCode === f.code)),
  );

  console.log('Content fidelity (AD-5)');
  let proseWithChildren = 0;
  let badKeyOrder = 0;
  const walk = (node) => {
    if (node.prose !== null && node.children.length > 0) proseWithChildren += 1;
    if (JSON.stringify(Object.keys(node)) !== JSON.stringify(['label', 'prose', 'children'])) {
      badKeyOrder += 1;
    }
    node.children.forEach(walk);
  };
  for (const entry of entries) entry.statement.forEach(walk);
  check(
    'nodes carrying both prose and children are preserved, not flattened',
    proseWithChildren > 0,
    `found ${proseWithChildren}`,
  );
  eq('prose is always serialized before children', badKeyOrder, 0);
  check(
    'param placeholders are left raw',
    fixture('ac-2.1').statement[0].prose.includes('{{ insert: param, ac-02.01_odp }}'),
  );
  // Value spot-checks, not just shape checks: the byte-drift check further
  // below regenerates the committed collection from this same code, so it
  // cannot catch a logic regression that changes what ingestParams()/the
  // guidance extractor produce -- it would just as happily re-commit the
  // wrong value. Only a hardcoded pin against real content catches that.
  check(
    'ac-2 guidance prose is ingested (NIST Discussion text)',
    (fixture('ac-2').guidance ?? '').startsWith('Examples of system account types'),
  );
  const ac1Select = fixture('ac-1').params.find((p) => p.id === 'ac-01_odp.03');
  check('ac-1 has the expected select param', ac1Select !== undefined);
  if (ac1Select) {
    eq('ac-1 select param howMany', ac1Select.select?.howMany, 'one-or-more');
    eq('ac-1 select param choice count', ac1Select.select?.choice.length, 3);
  }
  eq(
    'unresolvable param refs warn rather than throw',
    [
      ...new Set(
        warnings
          .filter((w) => w.startsWith('unresolvable param ref'))
          .map((w) => w.split(' ')[3]),
      ),
    ].sort(),
    ['ia-13.3', 'sc-42.2', 'si-10.1'],
  );

  console.log('slugify() / isOscalControlId() contract (AD-4)');
  eq('slugify: base control', slugify('ac-2'), 'ac-2');
  eq('slugify: enhancement dot becomes hyphen', slugify('ac-2.1'), 'ac-2-1');
  eq('slugify: multi-digit enhancement', slugify('si-10.1'), 'si-10-1');
  check(
    'slugify: throws on a display label, not just accepts it wrongly',
    (() => {
      try {
        slugify('AC-2(1)');
        return false;
      } catch (e) {
        return e instanceof TypeError;
      }
    })(),
  );
  check('isOscalControlId: accepts a base control id', isOscalControlId('ac-2') === true);
  check('isOscalControlId: accepts an enhancement id', isOscalControlId('ac-2.1') === true);
  check('isOscalControlId: rejects a display label', isOscalControlId('AC-2(1)') === false);
  check('isOscalControlId: rejects a bare family id', isOscalControlId('sr') === false);
  check('isOscalControlId: rejects a non-string', isOscalControlId(undefined) === false);

  console.log('SP 800-53A exclusion (PRD non-goal)');
  const serialized = JSON.stringify([...entries, ...families, meta]);
  check('no assessment-objective content', !serialized.includes('assessment-objective'));
  check('no assessment-method content', !serialized.includes('assessment-method'));
  check('no sp800-53a labels leaked through', !serialized.includes('sp800-53a'));

  console.log('Provenance singleton (AD-2, AD-5)');
  eq('catalogVersion', meta.catalogVersion, '5.2.0');
  eq('oscalVersion', meta.oscalVersion, '1.2.2');
  eq(
    'lastModified is the catalog value, verbatim',
    meta.lastModified,
    readCatalog(MASTER_FILE).metadata['last-modified'],
  );
  eq('crosswalkTranscribedAt is the real transcription date (CAP-4)', meta.crosswalkTranscribedAt, CROSSWALK_TRANSCRIBED_AT);

  console.log('ISO 27001 crosswalk (CAP-4)');
  eq('ac-1 crosswalk', fixture('ac-1').crosswalk, [
    '5.2', '5.3', '7.5.1', '7.5.2', '7.5.3', 'A.5.1', 'A.5.2', 'A.5.4', 'A.5.15', 'A.5.31',
    'A.5.36', 'A.5.37',
  ]);
  eq('ca-1 crosswalk, asterisks preserved verbatim', fixture('ca-1').crosswalk, [
    '5.2', '5.3', '7.5.1', '7.5.2', '7.5.3', '9.2.2*', '9.3.1*', 'A.5.1', 'A.5.2', 'A.5.4',
    'A.5.31', 'A.5.36', 'A.5.37',
  ]);
  eq('ia-13 has no crosswalk entry (postdates NIST\'s mapping doc)', fixture('ia-13').crosswalk, []);
  eq('sa-24 has no crosswalk entry (postdates NIST\'s mapping doc)', fixture('sa-24').crosswalk, []);
  eq('ac-13 (withdrawn, NIST\'s own "---") has an empty crosswalk', fixture('ac-13').crosswalk, []);
  eq('ac-10 (an ordinary "None" row) has an empty crosswalk', fixture('ac-10').crosswalk, []);
  // NIST's mapping doc has no Table 2 (enhancement-specific) rows in this
  // transcription, so every Enhancement's crosswalk is empty today -- this
  // pins that current reality rather than asserting inheritance, since
  // AD-2's per-entry rule means there is nothing to inherit from either way.
  eq('an Enhancement has its own (currently empty) crosswalk, not its parent\'s', fixture('ac-2.1').crosswalk, []);

  console.log('Committed output (AD-2: the repo is the source of truth)');
  const planned = plannedFiles(result).byPath;
  const onDisk = existingFiles();
  // No committed output is a FAIL, not a skip: the byte-reproducibility check
  // below is the entire point of AD-2, and a green "All assertions passed"
  // that never actually ran it would be worse than no check at all.
  check('committed output exists to verify against', onDisk.size > 0, 'run `npm run ingest` first');
  if (onDisk.size > 0) {
    eq('committed file count', onDisk.size, planned.size);
    const drifted = [...planned]
      .filter(([path, contents]) => onDisk.get(path) !== contents)
      .map(([path]) => path);
    eq('committed output is byte-identical to a fresh ingest', drifted.slice(0, 5), []);
  }

  // Matrix row: a missing input must abort loudly, name the file, and write
  // nothing. Exercised in a child process against an empty directory, because
  // exit code and "wrote nothing" are only observable from outside.
  console.log('Missing input guard');
  const emptyRawDir = mkdtempSync(join(tmpdir(), 'ingest-missing-raw-'));
  // The child also gets its OWN throwaway CONTENT_DIR: this is a read-only
  // verify, and it must be physically unable to touch the real committed
  // collection, not merely rely on assertInputsPresent() exiting first.
  const childContentDir = mkdtempSync(join(tmpdir(), 'ingest-missing-content-'));
  const beforeContents = new Map(existingFiles());
  const child = spawnSync(
    process.execPath,
    [...process.execArgv, fileURLToPath(import.meta.url)],
    {
      env: {
        ...process.env,
        INGEST_RAW_DIR: emptyRawDir,
        INGEST_CONTENT_DIR: childContentDir,
      },
      encoding: 'utf8',
    },
  );
  rmSync(emptyRawDir, { recursive: true, force: true });
  rmSync(childContentDir, { recursive: true, force: true });
  eq('missing input exits non-zero', child.status, 1);
  check(
    'missing input names the file it could not find',
    /Missing required input: .*NIST_SP-800-53_rev5_catalog-min\.json/.test(child.stderr ?? ''),
    JSON.stringify((child.stderr ?? '').slice(0, 120)),
  );
  // Compare full contents, not just a count -- a count-only check would pass
  // even if the (real, non-sandboxed) collection had been silently rewritten
  // with different bytes rather than left untouched.
  const afterContents = existingFiles();
  eq(
    'missing input left the real committed collection byte-for-byte untouched',
    [...afterContents].filter(([path, contents]) => beforeContents.get(path) !== contents),
    [],
  );

  // Matrix row (CAP-4): a data/crosswalk.json key with no matching real id
  // must abort loudly and write nothing -- "must not silently vanish" has no
  // automated regression protection unless a real orphan key is actually
  // driven through ingest() once. Sandboxed the same way as the missing-input
  // guard above: real raw OSCAL, a throwaway CONTENT_DIR, and here also a
  // throwaway crosswalk file so the real data/crosswalk.json is never touched.
  console.log('Crosswalk orphan-key guard (CAP-4)');
  const orphanCrosswalkFile = join(mkdtempSync(join(tmpdir(), 'ingest-orphan-crosswalk-')), 'crosswalk.json');
  writeFileSync(orphanCrosswalkFile, JSON.stringify({ 'xx-999': ['A.0.0'] }), 'utf8');
  const orphanContentDir = mkdtempSync(join(tmpdir(), 'ingest-orphan-content-'));
  const beforeOrphanContents = new Map(existingFiles());
  const orphanChild = spawnSync(
    process.execPath,
    [...process.execArgv, fileURLToPath(import.meta.url)],
    {
      env: {
        ...process.env,
        INGEST_CROSSWALK_FILE: orphanCrosswalkFile,
        INGEST_CONTENT_DIR: orphanContentDir,
      },
      encoding: 'utf8',
    },
  );
  rmSync(dirname(orphanCrosswalkFile), { recursive: true, force: true });
  rmSync(orphanContentDir, { recursive: true, force: true });
  eq('orphan crosswalk key exits non-zero', orphanChild.status, 1);
  check(
    'orphan crosswalk key names the bad key',
    /data\/crosswalk\.json has entry "xx-999" with no matching catalog id/.test(orphanChild.stderr ?? ''),
    JSON.stringify((orphanChild.stderr ?? '').slice(0, 160)),
  );
  const afterOrphanContents = existingFiles();
  eq(
    'orphan crosswalk key left the real committed collection byte-for-byte untouched',
    [...afterOrphanContents].filter(([path, contents]) => beforeOrphanContents.get(path) !== contents),
    [],
  );

  return failures;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const KNOWN_FLAGS = new Set(['--verify']);

function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => !KNOWN_FLAGS.has(a));
  if (unknown.length > 0) {
    console.error(`Unrecognized argument(s): ${unknown.join(', ')}`);
    console.error(`Known flags: ${[...KNOWN_FLAGS].join(', ')} (or no flag, to ingest and write).`);
    process.exit(1);
  }
  const verifyOnly = args.includes('--verify');

  const warnings = [];
  const warn = (message) => {
    warnings.push(message);
    console.error(`warn: ${message}`);
  };

  const result = ingest({ warn });

  if (verifyOnly) {
    console.log('');
    const failures = verify(result, warnings);
    console.log('');
    if (failures.length > 0) {
      console.error(`${failures.length} assertion(s) failed.`);
      process.exit(1);
    }
    console.log('All assertions passed.');
    return;
  }

  writeOutput(plannedFiles(result));

  console.log(
    `${result.controls.length} controls, ${result.enhancements.length} enhancements, ` +
      `${result.families.length} families`,
  );
  console.log(
    `baselines: ${BASELINES.map(({ key }) => `${key} ${result.baselineSets.get(key).size}`).join(', ')}`,
  );
  console.log(
    `provenance: catalog ${result.meta.catalogVersion}, OSCAL ${result.meta.oscalVersion}`,
  );
  if (warnings.length > 0) console.log(`${warnings.length} warning(s) -- see stderr.`);
}

main();
