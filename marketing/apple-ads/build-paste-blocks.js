#!/usr/bin/env node
/**
 * Generates `PASTE-BLOCKS.md` — every keyword and negative-keyword list as a
 * plain comma-separated block you can paste straight into Apple Ads, each
 * labelled with exactly which campaign / ad group / field it belongs in.
 *
 * Generated from the CSVs so the two can never disagree. After editing any
 * keyword file, run this and `build-negatives.js` together.
 *
 *   node marketing/apple-ads/build-paste-blocks.js
 *   node marketing/apple-ads/build-paste-blocks.js --check
 */

const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const OUT = path.join(DIR, 'PASTE-BLOCKS.md');

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

function rows(rel) {
  const all = fs.readFileSync(path.join(DIR, rel), 'utf8').split('\n');
  const head = splitRow(all[0]).map((c) => c.trim());
  return all.slice(1).filter((l) => l.trim()).map((l) => {
    const cols = splitRow(l).map((c) => c.trim());
    return Object.fromEntries(head.map((h, i) => [h, cols[i]]));
  });
}

/** Apple Ads accepts a comma-separated paste; wrap for readability at ~76 cols. */
function commaBlock(list) {
  const lines = [];
  let cur = '';
  list.forEach((kw, i) => {
    const piece = kw + (i < list.length - 1 ? ', ' : '');
    if (cur.length + piece.length > 76) { lines.push(cur.trimEnd()); cur = ''; }
    cur += piece;
  });
  if (cur.trim()) lines.push(cur.trimEnd());
  return lines.join('\n');
}

const brand = rows('keywords/brand-exact.csv');
const category = rows('keywords/category-exact.csv');
const competitor = rows('keywords/competitor-exact.csv');
const discovery = rows('keywords/discovery-broad.csv').filter((r) => r.keyword);
const globalNeg = rows('negatives/global-negatives.csv');
const gradNeg = rows('negatives/discovery-graduated.csv');
const crosslocks = rows('negatives/adgroup-crosslocks.csv');

const byGroup = (list) => list.reduce((acc, r) => {
  (acc[r.ad_group] ||= []).push(r);
  return acc;
}, {});

/** Bid to show for an ad group: the highest max CPT among its keywords. */
const groupBid = (rs) => Math.max(...rs.map((r) => parseFloat(r.max_cpt_usd) || 0)).toFixed(2);

let md = '';
const w = (s = '') => { md += s + '\n'; };

w('# Copy-paste blocks for Apple Ads');
w();
w('Every list below is **comma-separated and ready to paste**. Apple Ads accepts');
w('a comma-separated paste in the keyword box — it splits them into individual');
w('keywords automatically. Each block says exactly where it goes.');
w();
w('> ⚠️ **Generated file — do not edit by hand.** It is built from the CSVs in');
w('> `keywords/` and `negatives/`. Edit those, then run:');
w('>');
w('> ```bash');
w('> node marketing/apple-ads/build-paste-blocks.js');
w('> node marketing/apple-ads/build-negatives.js');
w('> ```');
w();
w('Set **match type = Exact** for every keyword block except Discovery, which is');
w('Broad. Set **every negative keyword to Exact**, always.');
w();
w('---');
w();
w('## Where each block goes — quick reference');
w();
w('| # | Block | Paste into | Match |');
w('|---|---|---|---|');
w('| 1 | Brand keywords | `DLS-US-Brand-Exact` → ad group `Brand` → Keywords | Exact |');
let n = 2;
const catGroups = byGroup(category);
for (const g of Object.keys(catGroups)) {
  w(`| ${n++} | Category — ${g} | \`DLS-US-Category-Exact\` → ad group \`${g}\` → Keywords | Exact |`);
}
const compGroups = byGroup(competitor);
for (const g of Object.keys(compGroups)) {
  w(`| ${n++} | Competitor — ${g} | \`DLS-US-Competitor-Exact\` → ad group \`${g}\` → Keywords | Exact |`);
}
w(`| ${n++} | Discovery seeds | \`DLS-US-Discovery-Broad\` → ad group \`Discovery-Broad\` → Keywords | **Broad** |`);
w(`| ${n++} | Global negatives | \`DLS-US-Category-Exact\`, \`DLS-US-Competitor-Exact\`, \`DLS-US-Discovery-Broad\` → **Campaign**-level Negative keywords | Exact |`);
w(`| ${n++} | Discovery graduated negatives | \`DLS-US-Discovery-Broad\` → **Campaign**-level Negative keywords | Exact |`);
w(`| ${n++} | Ad-group crosslocks | each Category ad group → **Ad group**-level Negative keywords | Exact |`);
w();
w('**Brand gets no negative keywords.** Every search reaching it is someone typing');
w('your app name — there is nothing to filter, and a negative there can only cost');
w('you a cheap branded install.');
w();
w('**Negative keywords only exist on Search Results campaigns.** If you later add');
w('Today tab / Search tab / Product Pages campaigns, they have no keyword or');
w('negative-keyword fields at all.');
w();
w('---');
w();

// ── 1. Brand ────────────────────────────────────────────────────────────────
w('## 1 · Brand keywords');
w();
w('**Campaign:** `DLS-US-Brand-Exact` → **Ad group:** `Brand`');
w(`**Match type:** Exact · **Default max CPT bid:** $${groupBid(brand)} · **Search Match:** OFF`);
w(`**${brand.length} keywords** — includes deliberate misspellings; people typo your name and those taps are cheap.`);
w();
w('```text');
w(commaBlock(brand.map((r) => r.keyword)));
w('```');
w();
w('---');
w();

// ── Category ────────────────────────────────────────────────────────────────
w('## 2 · Category keywords — 8 ad groups');
w();
w('**Campaign:** `DLS-US-Category-Exact` · **Match type:** Exact · **Search Match:** OFF');
w();
w('Create the eight ad groups below and paste one block into each. Do **not**');
w('merge them — one bid and one set of screenshots per theme is the whole point.');
w();
let i = 1;
for (const [group, rs] of Object.entries(catGroups)) {
  w(`### 2.${i++} Ad group \`${group}\``);
  w();
  w(`**Default max CPT bid:** $${groupBid(rs)} · **${rs.length} keywords**`);
  w();
  w('```text');
  w(commaBlock(rs.map((r) => r.keyword)));
  w('```');
  w();
}
w('---');
w();

// ── Competitor ──────────────────────────────────────────────────────────────
w('## 3 · Competitor keywords — 3 ad groups');
w();
w('**Campaign:** `DLS-US-Competitor-Exact` · **Match type:** Exact · **Search Match:** OFF');
w('**Daily budget: $6 — hard cap.** This is the most expensive, worst-converting');
w('inventory in the account. Do not raise it until it clears target CPA over $150+');
w('of spend.');
w();
i = 1;
for (const [group, rs] of Object.entries(compGroups)) {
  w(`### 3.${i++} Ad group \`${group}\``);
  w();
  w(`**Default max CPT bid:** $${groupBid(rs)} · **${rs.length} keywords**`);
  w();
  w('```text');
  w(commaBlock(rs.map((r) => r.keyword)));
  w('```');
  w();
}
w('---');
w();

// ── Discovery ───────────────────────────────────────────────────────────────
w('## 4 · Discovery seeds');
w();
w('**Campaign:** `DLS-US-Discovery-Broad` → **Ad group:** `Discovery-Broad`');
w(`**Match type: BROAD** (the only broad block) · **Max CPT bid:** $${groupBid(discovery)} · **Search Match: ON**`);
w(`**${discovery.length} seed keywords**`);
w();
w('```text');
w(commaBlock(discovery.map((r) => r.keyword)));
w('```');
w();
w('Then create a **second ad group** in the same campaign called');
w('`Discovery-SearchMatch` with **no keywords at all** and **Search Match ON**.');
w('That is deliberate — it matches against your product page metadata and finds');
w('the long tail your seeds miss.');
w();
w('---');
w();

// ── Negatives ───────────────────────────────────────────────────────────────
w('## 5 · Global negative keywords');
w();
w('**Paste into the CAMPAIGN-level Negative keywords box of all three:**');
w('`DLS-US-Category-Exact` · `DLS-US-Competitor-Exact` · `DLS-US-Discovery-Broad`');
w();
w('**Not Brand.** **Match type: Exact** — a broad negative here would silently');
w('mute whole ad groups.');
w();
w(`**${globalNeg.length} negatives.** These are the traps your own three core words`);
w('create: "life" pulls insurance and Life360, "simulator" pulls the truck/farming/');
w('animal-sim genre, and money/stocks/career/dating each sit on a real-utility app.');
w();
w('```text');
w(commaBlock(globalNeg.map((r) => r.keyword)));
w('```');
w();
w('---');
w();

w('## 6 · Discovery graduated negatives');
w();
w('**Paste into the CAMPAIGN-level Negative keywords box of `DLS-US-Discovery-Broad` only.**');
w('**Match type: Exact.**');
w();
w(`**${gradNeg.length} negatives** — every keyword you bid on in Brand, Category and`);
w('Competitor. Without this, Discovery bids against your own optimized campaigns');
w('and pushes their CPT up for reasons that look like market competition.');
w();
w('**Re-generate this every time a keyword graduates out of Discovery:**');
w();
w('```bash');
w('node marketing/apple-ads/build-negatives.js');
w('node marketing/apple-ads/build-paste-blocks.js');
w('```');
w();
w('```text');
w(commaBlock(gradNeg.map((r) => r.keyword)));
w('```');
w();
w('---');
w();

w('## 7 · Ad-group crosslocks');
w();
w('**Paste into the AD GROUP-level Negative keywords box of the named Category ad');
w('group.** **Match type: Exact.**');
w();
w('These stop two Category ad groups fighting over the same ambiguous term, so each');
w('term has exactly one owner and its performance data stays in one place.');
w();
const byLockGroup = crosslocks.reduce((acc, r) => {
  (acc[r.ad_group] ||= []).push(r);
  return acc;
}, {});
for (const [group, rs] of Object.entries(byLockGroup)) {
  w(`### Ad group \`${group}\` — ${rs.length} negatives`);
  w();
  w('```text');
  w(commaBlock(rs.map((r) => r.negative_keyword)));
  w('```');
  w();
}
w('---');
w();
w('## Final check before you enable anything');
w();
w('- [ ] Match type is **Exact** everywhere except the Discovery seeds (Broad)');
w('- [ ] **Search Match OFF** on Brand, Category, Competitor · **ON** on Discovery');
w('- [ ] Every negative keyword is **Exact**');
w('- [ ] Brand has **no** negative keywords');
w('- [ ] Global negatives applied at **campaign** level on the three campaigns');
w('- [ ] Crosslocks applied at **ad group** level, not campaign level');
w('- [ ] Daily budgets: Brand $3 · Category $12 · Competitor $6 · Discovery $9');
w('- [ ] Countries = **United States** only');
w('- [ ] Placement = **Search results** only');
w('- [ ] No audience refinements set');
w();
w('Then do not touch bids for 14 days (`01-SETUP.md` Part 6).');

const generated = md;

if (process.argv.includes('--check')) {
  const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (current !== generated) {
    console.error('✗ PASTE-BLOCKS.md is stale — run: node marketing/apple-ads/build-paste-blocks.js');
    process.exit(1);
  }
  console.log('✓ PASTE-BLOCKS.md is up to date');
} else {
  fs.writeFileSync(OUT, generated);
  const totals = brand.length + category.length + competitor.length + discovery.length;
  console.log(
    `✓ wrote ${OUT}\n  ${totals} keywords · ` +
    `${globalNeg.length + gradNeg.length + crosslocks.length} negatives`
  );
}
