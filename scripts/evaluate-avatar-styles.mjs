/**
 * Renders every candidate DiceBear style on the app's dark palette so the
 * choice can be made by eye rather than from documentation:
 *   node scripts/evaluate-avatar-styles.mjs
 *
 * These are real generator outputs at the sizes the game actually uses — a
 * 110px identity card and a 44px list row — because a style that looks good in
 * a marketing grid can turn to mush in a contacts list.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAvatar } from '@dicebear/core';
import {
  adventurer, avataaars, bigEars, bigSmile, croodles, dylan, lorelei, micah,
  miniavs, notionists, openPeeps, personas, pixelArt,
} from '@dicebear/collection';

/**
 * Explicit map rather than `collection[name]`. A computed reference into a
 * namespace import cannot be statically validated (the `import/namespace` lint
 * rule), and a typo would then fail at render time instead of at import.
 */
const STYLES = {
  adventurer, avataaars, bigEars, bigSmile, croodles, dylan, lorelei, micah,
  miniavs, notionists, openPeeps, personas, pixelArt,
};

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'screenshots');

/** Human-face styles only — bottts/shapes/rings/identicon are not people. */
const CANDIDATES = [
  ['lorelei', 'CC0 · Lisa Wischofsky', 26],
  ['adventurer', 'CC BY 4.0 · Lisa Wischofsky', 14],
  ['bigEars', 'CC BY 4.0 · The Visual Team', 12],
  ['openPeeps', 'CC0 · Pablo Stanley', 11],
  ['notionists', 'CC0 · Zoish', 15],
  ['avataaars', 'Free personal + commercial · Pablo Stanley', 20],
  ['micah', 'CC BY 4.0 · Micah Lanier', 25],
  ['personas', 'CC BY 4.0 · Draftbit', 10],
  ['bigSmile', 'CC BY 4.0 · Ashley Seo', 8],
  ['miniavs', 'CC BY 4.0 · Webpixels', 14],
  ['croodles', 'CC BY 4.0 · vijay verma', 11],
  ['dylan', 'CC BY 4.0 · Natalia Spivak', 6],
  ['pixelArt', 'CC0 · DiceBear', 20],
];

const SEEDS = ['Maya', 'Andre', 'Priya', 'Tom', 'Zara', 'Kenji', 'Nia', 'Lars'];

function svg(styleName, seed, size) {
  return createAvatar(STYLES[styleName], {
    seed,
    size,
    backgroundColor: ['transparent'],
  }).toString();
}

const chip = (styleName, seed, px) =>
  `<div style="width:${px}px;height:${px}px;border-radius:${px / 2}px;overflow:hidden;background:#1E293B;flex:0 0 auto">${svg(styleName, seed, px)}</div>`;

const rows = CANDIDATES.map(([name, license, options]) => {
  const big = chip(name, SEEDS[0], 150);
  const chips = SEEDS.slice(1).map((s) => chip(name, s, 96)).join('');
  const tiny = SEEDS.slice(0, 6).map((s) => chip(name, s, 44)).join('');
  return `<div style="border-bottom:1px solid #1e293b;padding:22px 0">
    <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:14px">
      <div style="color:#fff;font:800 21px system-ui">${name}</div>
      <div style="color:#60A5FA;font:700 12px system-ui">${options} customizable options</div>
      <div style="color:#64748B;font:500 12px system-ui">${license}</div>
    </div>
    <div style="display:flex;gap:14px;align-items:center">
      ${big}${chips}
      <div style="display:flex;gap:8px;margin-left:14px;padding-left:18px;border-left:1px solid #1e293b">${tiny}</div>
    </div>
  </div>`;
}).join('');

const html = `<html><body style="margin:0;padding:36px;background:#0B1220;font-family:system-ui">
  <div style="color:#fff;font:800 30px system-ui">DiceBear style evaluation</div>
  <div style="color:#94A3B8;font:400 14px system-ui;margin:8px 0 4px;max-width:900px">
    Real generator output on the app's card background. Left: 150px (identity card). Middle: 96px. Right of the rule: 44px (contacts row).
  </div>
  ${rows}
</body></html>`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1420, height: 1000 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.screenshot({ path: resolve(OUT, 'avatar-style-evaluation.png'), fullPage: true });
await browser.close();
console.log('wrote screenshots/avatar-style-evaluation.png');
