/**
 * Deep-dive on the shortlisted avatar styles:
 *   node scripts/evaluate-avatar-finalists.mjs
 *
 * The first pass (evaluate-avatar-styles.mjs) rendered defaults, which is not
 * how the game would ship them. This one drives the three things that actually
 * decide it for a birth-to-death life sim:
 *
 *   1. SKIN RANGE   — the loudest complaint about the pool being replaced.
 *   2. AGEING       — can one character grey and age without becoming someone
 *                     else? Driven here through hairColor, which is the only
 *                     age lever these styles expose.
 *   3. SMALL SIZES  — a style that dies at 44px is unusable in a contacts list.
 */
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAvatar } from '@dicebear/core';
import * as collection from '@dicebear/collection';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'screenshots');

const FINALISTS = ['adventurer', 'lorelei', 'avataaars', 'openPeeps', 'micah', 'bigEars'];

// A real span, light → deep, in the hex-without-hash form DiceBear expects.
const SKIN = ['f2d3b1', 'ecad80', 'd08b5b', 'ae5d29', '8d5524', '613915'];
// Young → greying → white. This is the ageing lever.
const HAIR_BY_AGE = ['2c1b18', '4a312c', '724133', 'a55728', 'b7b7b7', 'e8e1e1'];

function one(style, options, size) {
  return createAvatar(collection[style], {
    size,
    backgroundColor: ['transparent'],
    ...options,
  }).toString();
}

const chip = (inner, px) =>
  `<div style="width:${px}px;height:${px}px;border-radius:${px / 2}px;overflow:hidden;background:#1E293B;flex:0 0 auto">${inner}</div>`;

const label = (t) => `<div style="color:#64748B;font:700 10px system-ui;width:74px;flex:0 0 auto">${t}</div>`;

const block = (style) => {
  const supportsSkin = !!collection[style].schema?.properties?.skinColor;
  const supportsHair = !!collection[style].schema?.properties?.hairColor;

  const skinRow = SKIN.map((s, i) =>
    chip(one(style, { seed: 'Skin', ...(supportsSkin ? { skinColor: [s] } : {}) }, 88), 88)
  ).join('');

  // One character, aged: same seed throughout, only hair colour moves.
  const ageRow = HAIR_BY_AGE.map((h) =>
    chip(one(style, { seed: 'Aged', ...(supportsHair ? { hairColor: [h] } : {}) }, 88), 88)
  ).join('');

  const castRow = ['Maya', 'Andre', 'Priya', 'Tom', 'Zara', 'Kenji']
    .map((s, i) => chip(one(style, { seed: s, ...(supportsSkin ? { skinColor: [SKIN[i]] } : {}) }, 88), 88))
    .join('');

  const tinyRow = ['Maya', 'Andre', 'Priya', 'Tom', 'Zara', 'Kenji']
    .map((s, i) => chip(one(style, { seed: s, ...(supportsSkin ? { skinColor: [SKIN[i]] } : {}) }, 44), 44))
    .join('');

  return `<div style="padding:24px 0;border-bottom:1px solid #1e293b">
    <div style="display:flex;align-items:baseline;gap:12px;margin-bottom:12px">
      <div style="color:#fff;font:800 22px system-ui">${style}</div>
      <div style="color:${supportsSkin ? '#34D399' : '#F87171'};font:700 11px system-ui">skinColor ${supportsSkin ? 'YES' : 'NO'}</div>
      <div style="color:${supportsHair ? '#34D399' : '#F87171'};font:700 11px system-ui">hairColor ${supportsHair ? 'YES' : 'NO'}</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">${label('SKIN RANGE')}${skinRow}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">${label('AGEING')}${ageRow}</div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">${label('CAST')}${castRow}</div>
    <div style="display:flex;align-items:center;gap:10px">${label('44px LIST')}${tinyRow}</div>
  </div>`;
};

const html = `<html><body style="margin:0;padding:36px;background:#0B1220;font-family:system-ui">
  <div style="color:#fff;font:800 30px system-ui">Finalists — driven the way the game would drive them</div>
  <div style="color:#94A3B8;font:400 14px system-ui;margin:8px 0">Skin forced across a real range; ageing simulated through hair colour on ONE seed; the same cast at 88px and at 44px.</div>
  ${FINALISTS.map(block).join('')}
</body></html>`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.screenshot({ path: resolve(OUT, 'avatar-finalists.png'), fullPage: true });
await browser.close();
console.log('wrote screenshots/avatar-finalists.png');
