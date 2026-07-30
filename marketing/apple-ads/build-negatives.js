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
const SOURCES = ['brand-exact.csv', 'category-exact.csv', 'competitor-exact.csv'];
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

function collect() {
  const rows = [];
  const seen = new Set();
  for (const file of SOURCES) {
    const full = path.join(DIR, 'keywords', file);
    const lines = fs.readFileSync(full, 'utf8').split('\n').slice(1);
    for (const line of lines) {
      if (!line.trim()) continue;
      const cols = splitRow(line);
      const campaign = cols[0]?.trim();
      const keyword = cols[2]?.trim();
      if (!keyword || seen.has(keyword)) continue;
      seen.add(keyword);
      const kind = campaign.includes('Brand') ? 'brand'
        : campaign.includes('Category') ? 'category'
          : 'competitor';
      rows.push(
        `${keyword},EXACT,${campaign},Bid on in ${kind} campaign — must not re-match in Discovery`
      );
    }
  }
  return `${HEADER}\n${rows.join('\n')}\n`;
}

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
