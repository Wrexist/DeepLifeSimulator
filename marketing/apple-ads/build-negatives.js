#!/usr/bin/env node
/**
 * Regenerates `negatives/discovery-graduated.csv` from the three exact-match
 * keyword files.
 *
 * The Discovery campaign exists to mine new search terms. Every keyword you
 * already bid on in Brand/Category/Competitor must be an EXACT negative there,
 * or Discovery bids against your own exact campaigns and inflates their CPT.
 *
 * Run this every time a keyword graduates out of Discovery (see
 * `06-optimization-playbook.md`), then paste the output column into
 * Apple Ads → DLS-US-Discovery-Broad → Negative keywords.
 *
 *   node marketing/apple-ads/build-negatives.js          # write the file
 *   node marketing/apple-ads/build-negatives.js --check  # CI-style diff check
 */

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
/**
 * Each source file and the campaign + kind its rows must declare. Classifying by
 * the file it came from — and rejecting anything that disagrees — means a typo'd
 * campaign name is an error rather than silently becoming a "competitor" row.
 */
const SOURCES = [
  { file: 'brand-exact.csv', campaign: 'DLS-US-Brand-Exact', kind: 'brand' },
  { file: 'category-exact.csv', campaign: 'DLS-US-Category-Exact', kind: 'category' },
  { file: 'competitor-exact.csv', campaign: 'DLS-US-Competitor-Exact', kind: 'competitor' },
];
const OUT = path.join(DIR, 'negatives', 'discovery-graduated.csv');
const HEADER = 'keyword,match_type,source_campaign,block_reason';

/** Split a CSV line on commas that are not inside double quotes. */
function splitRow(line) {
  const out = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * Every row must have the same field count as its header.
 * A stray comma inside a rationale silently shifts every later column, which
 * breaks any importer reading the file positionally — and it is invisible until
 * something downstream reads the wrong column. Catch it here instead.
 */
function assertWellFormed(file, lines, header) {
  const want = splitRow(header).length;
  lines.forEach((line, i) => {
    if (!line.trim()) return;
    const got = splitRow(line).length;
    if (got !== want) {
      console.error(
        `✗ ${file}:${i + 2} has ${got} fields, expected ${want} — ` +
        'a rationale probably contains an unquoted comma:\n  ' + line
      );
      process.exit(1);
    }
  });
}

function fail(file, lineNo, message, line) {
  console.error(`✗ ${file}:${lineNo} ${message}\n  ${line}`);
  process.exit(1);
}

function collect() {
  const rows = [];
  const seen = new Set();
  for (const { file, campaign: expected, kind } of SOURCES) {
    const full = path.join(DIR, 'keywords', file);
    const all = fs.readFileSync(full, 'utf8').split('\n');
    const lines = all.slice(1);
    assertWellFormed(file, lines, all[0]);
    lines.forEach((line, i) => {
      if (!line.trim()) return;
      const lineNo = i + 2;
      const cols = splitRow(line).map((c) => c.trim());
      const [campaign, adGroup, keyword, matchType] = cols;

      // A row that names the wrong campaign is a copy-paste error, not a new
      // campaign — classifying it by filename and then verifying is what turns
      // it into a build failure instead of a silently mislabelled negative.
      if (campaign !== expected) {
        fail(file, lineNo, `campaign is "${campaign}", expected "${expected}"`, line);
      }
      if (!adGroup) fail(file, lineNo, 'ad_group is empty', line);
      if (!keyword) fail(file, lineNo, 'keyword is empty', line);
      if (matchType !== 'EXACT') {
        fail(file, lineNo, `match_type is "${matchType}", expected EXACT`, line);
      }

      if (seen.has(keyword)) return;
      seen.add(keyword);
      rows.push(
        `${keyword},EXACT,${campaign},Bid on in ${kind} campaign — must not re-match in Discovery`
      );
    });
  }
  return `${HEADER}\n${rows.join('\n')}\n`;
}

/**
 * The hand-maintained lists are not inputs here, but they share the traps: a
 * stray comma, a blank keyword, or a non-EXACT match type. A broad negative
 * pasted into Apple Ads blocks far more than intended and the symptom
 * (impressions quietly stop) looks nothing like the cause — so reject it here.
 */
function validateHandMaintainedLists() {
  for (const file of ['global-negatives.csv', 'adgroup-crosslocks.csv']) {
    const all = fs.readFileSync(path.join(DIR, 'negatives', file), 'utf8').split('\n');
    const header = splitRow(all[0]).map((c) => c.trim());
    assertWellFormed(file, all.slice(1), all[0]);
    const kwCol = header.indexOf(file === 'global-negatives.csv' ? 'keyword' : 'negative_keyword');
    const mtCol = header.indexOf('match_type');
    all.slice(1).forEach((line, i) => {
      if (!line.trim()) return;
      const cols = splitRow(line).map((c) => c.trim());
      if (!cols[kwCol]) fail(file, i + 2, 'negative keyword is empty', line);
      if (cols[mtCol] !== 'EXACT') {
        fail(file, i + 2, `match_type is "${cols[mtCol]}", expected EXACT`, line);
      }
    });
  }
}

validateHandMaintainedLists();
const generated = collect();
const count = generated.trim().split('\n').length - 1;

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== generated) {
    console.error('✗ discovery-graduated.csv is stale — run: node marketing/apple-ads/build-negatives.js');
    process.exit(1);
  }
  console.log(`✓ discovery-graduated.csv is up to date (${count} negatives)`);
} else {
  fs.writeFileSync(OUT, generated);
  console.log(`✓ wrote ${OUT} — ${count} exact negatives`);
}
