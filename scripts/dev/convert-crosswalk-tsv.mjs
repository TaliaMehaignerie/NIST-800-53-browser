// One-off conversion: crosswalk TSV export -> data/crosswalk.json.
//
// Not part of the committed pipeline (scripts/ingest.mjs) and never run by
// CI -- the docx remains the canonical source per AD-2. This script exists
// only so the manual transcription is reproducible/auditable: it turns a
// hand-verified spreadsheet copy of NIST's SP800-53r5-to-ISO27001 mapping
// table into the target JSON shape without hand-typing 300+ array literals.
//
// Input: data/raw/crosswalk spreadsheet - Sheet1.tsv (Google Sheets export,
// 3 tab-separated columns: control_id, control_title, iso_clauses).
// Output: data/crosswalk.json, keyed by OSCAL-native id ("ac-1"), each value
// an array of ISO/IEC 27001:2022 clause codes as literal strings (asterisks
// preserved verbatim where NIST's doc marks a partial-intent match, e.g.
// "9.2.2*"). "None" and "---" (NIST's own withdrawn-control marker) both
// convert to an empty array.
//
// Re-run only if the source spreadsheet is corrected; regenerating
// overwrites data/crosswalk.json in place.
import { readFileSync, writeFileSync } from 'node:fs';

const TSV_PATH = 'data/raw/crosswalk spreadsheet - Sheet1.tsv';
const OUT_PATH = 'data/crosswalk.json';

const raw = readFileSync(TSV_PATH, 'utf-8').replace(/^﻿/, '');
const lines = raw.split(/\r\n|\n/).filter((l) => l.length > 0);

const [header, ...dataLines] = lines;
const headerCols = header.split('\t');
if (headerCols.length !== 3) {
  throw new Error(`Expected 3 header columns, got ${headerCols.length}: ${JSON.stringify(headerCols)}`);
}

/** Display control id ("AC-1", "AC-2(1)") -> OSCAL-native id ("ac-1", "ac-2.1"). */
function toOscalId(displayId) {
  return displayId
    .trim()
    .toLowerCase()
    .replace('(', '.')
    .replace(')', '');
}

function parseClauses(cell) {
  const trimmed = cell.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'none' || trimmed === '---') {
    return [];
  }
  return trimmed
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

const result = {};
const seen = new Set();
let rowNum = 1; // header is row 1

for (const line of dataLines) {
  rowNum += 1;
  const cols = line.split('\t');
  if (cols.length !== 3) {
    throw new Error(`Row ${rowNum}: expected 3 columns, got ${cols.length}: ${JSON.stringify(line)}`);
  }
  const [displayId, , clauseCell] = cols;
  const oscalId = toOscalId(displayId);

  if (seen.has(oscalId)) {
    throw new Error(`Row ${rowNum}: duplicate id "${oscalId}" (from "${displayId}")`);
  }
  seen.add(oscalId);

  result[oscalId] = parseClauses(clauseCell);
}

const sortedResult = Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));

writeFileSync(OUT_PATH, JSON.stringify(sortedResult, null, 2) + '\n', 'utf-8');

const totalClauses = Object.values(sortedResult).reduce((n, arr) => n + arr.length, 0);
const emptyCount = Object.values(sortedResult).filter((arr) => arr.length === 0).length;
console.log(`Wrote ${OUT_PATH}`);
console.log(`  entries: ${Object.keys(sortedResult).length}`);
console.log(`  entries with no mapping: ${emptyCount}`);
console.log(`  total clause references: ${totalClauses}`);
