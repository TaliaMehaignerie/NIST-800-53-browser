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

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { slugify } from '../src/utils/slugify.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = join(ROOT, 'data', 'raw');
const CONTENT_DIR = join(ROOT, 'src', 'content');

const MASTER_FILE = join(RAW_DIR, 'NIST_SP-800-53_rev5_catalog-min.json');

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
  return href.replace(/^#/, '').split('_')[0];
}

function linkTargets(node, predicate) {
  return (node.links ?? []).filter((l) => predicate(l.rel)).map((l) => hrefTarget(l.href));
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
function buildEntry(node, { kind, familyCode, parentSlug, enhancementSlugs }, baselineSets, warn) {
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
  };
}

// ---------------------------------------------------------------------------
// Input loading
// ---------------------------------------------------------------------------

function readJson(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
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

  const catalog = readJson(MASTER_FILE).catalog;

  // Id sets only: the resolved profiles are a byte-identical copy of the
  // master's content, so ingesting prose from them would be a second, silently
  // diverging source (AD-2).
  const baselineSets = new Map(
    BASELINES.map((b) => [b.key, baselineIds(readJson(join(RAW_DIR, b.file)).catalog)]),
  );

  const controls = [];
  const enhancements = [];
  const families = [];

  for (const group of catalog.groups ?? []) {
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
            warn,
          ),
        );
        familyEnhancementCount += 1;
      }
    }

    controls.push(...familyControls);
    families.push({
      slug: group.id,
      code: familyCode,
      name: group.title,
      controlSlugs: familyControls.map((c) => c.slug),
      controlCount: familyControls.length,
      enhancementCount: familyEnhancementCount,
    });
  }

  const meta = {
    catalogTitle: catalog.metadata.title,
    catalogVersion: catalog.metadata.version,
    oscalVersion: catalog.metadata['oscal-version'],
    lastModified: catalog.metadata['last-modified'],
    // CAP-4 is not built yet; AD-5 wants the field present so BaseLayout has
    // one shape to render against once the crosswalk is transcribed.
    crosswalkTranscribedAt: null,
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

/** Every file this run would write, as `absolute path -> contents`. */
function plannedFiles({ controls, enhancements, families, meta }) {
  const files = new Map();
  for (const entry of [...controls, ...enhancements]) {
    files.set(join(OUT_DIRS.controls, `${entry.slug}.json`), serialize(entry));
  }
  for (const family of families) {
    files.set(join(OUT_DIRS.families, `${family.slug}.json`), serialize(family));
  }
  files.set(join(OUT_DIRS.meta, 'provenance.json'), serialize(meta));
  return files;
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
 */
function writeOutput(files) {
  for (const dir of Object.values(OUT_DIRS)) {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
  }
  for (const [path, contents] of files) writeFileSync(path, contents, 'utf8');
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

  console.log('Baseline membership (AD-2: computed at both granularities)');
  for (const { key, expected } of BASELINES) {
    eq(`${key} baseline holds ${expected} ids`, baselineSets.get(key).size, expected);
  }
  for (const { key } of BASELINES) {
    const orphans = [...baselineSets.get(key)].filter((id) => !byId.has(id));
    eq(`every ${key} baseline id exists in the master catalog`, orphans, []);
  }
  eq('ac-2 baselines', byId.get('ac-2').baselines, ['low', 'moderate', 'high']);
  eq('ac-2 kind', byId.get('ac-2').kind, 'control');
  eq('ac-2 carries 13 enhancement slugs', byId.get('ac-2').enhancementSlugs.length, 13);
  eq('ac-2.1 has its own baselines, not the inherited ones', byId.get('ac-2.1').baselines, [
    'moderate',
    'high',
  ]);
  check(
    'enhancements do not inherit: some sit in no baseline while their parent does',
    enhancements.some(
      (e) => e.baselines.length === 0 && bySlug.get(e.parentSlug).baselines.length > 0,
    ),
  );

  console.log('Withdrawn handling');
  eq('ac-2.10 withdrawn', byId.get('ac-2.10').withdrawn, true);
  eq('ac-2.10 part-level target stripped to a control id', byId.get('ac-2.10').incorporatedInto, [
    'ac-2',
  ]);
  eq('ac-3.6 keeps both targets in order', byId.get('ac-3.6').incorporatedInto, ['mp-4', 'sc-28']);
  eq('cp-10.3 withdrawn', byId.get('cp-10.3').withdrawn, true);
  eq('cp-10.3 has no successor', byId.get('cp-10.3').incorporatedInto, []);
  check('cp-10.3 keeps its statement', byId.get('cp-10.3').statement.length === 1);
  eq('sc-19 withdrawn', byId.get('sc-19').withdrawn, true);
  eq('sc-19 has no successor', byId.get('sc-19').incorporatedInto, []);
  check('sc-19 keeps its statement', byId.get('sc-19').statement.length === 1);
  eq('at-3.4 moved-to is treated as withdrawn', byId.get('at-3.4').withdrawn, true);
  eq('at-3.4 successor', byId.get('at-3.4').incorporatedInto, ['at-2.4']);
  eq('182 withdrawn entries in total', entries.filter((e) => e.withdrawn).length, 182);
  check(
    'every withdrawn entry either names a successor or keeps a statement',
    entries
      .filter((e) => e.withdrawn)
      .every((e) => e.incorporatedInto.length > 0 || e.statement.length > 0),
  );

  console.log('Slugs and structure (AD-4)');
  eq('slugs are unique', entries.length - bySlug.size, 0);
  eq('ac-2.1 slug', byId.get('ac-2.1').slug, 'ac-2-1');
  eq('ac-2.1 parentSlug', byId.get('ac-2.1').parentSlug, 'ac-2');
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
    byId.get('ac-2.1').statement[0].prose.includes('{{ insert: param, ac-02.01_odp }}'),
  );
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
    readJson(MASTER_FILE).catalog.metadata['last-modified'],
  );
  eq('crosswalkTranscribedAt is null until CAP-4', meta.crosswalkTranscribedAt, null);

  console.log('Committed output (AD-2: the repo is the source of truth)');
  const planned = plannedFiles(result);
  const onDisk = existingFiles();
  if (onDisk.size === 0) {
    console.log('  skip  no committed output yet -- run `npm run ingest` first');
  } else {
    eq('committed file count', onDisk.size, planned.size);
    const drifted = [...planned]
      .filter(([path, contents]) => onDisk.get(path) !== contents)
      .map(([path]) => path);
    eq('committed output is byte-identical to a fresh ingest', drifted.slice(0, 5), []);
  }

  return failures;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main() {
  const verifyOnly = process.argv.includes('--verify');

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
