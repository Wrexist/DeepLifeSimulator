/**
 * The three finalists side by side on the MUTED SLATE plate:
 *   node scripts/compare-avatar-finalists-3.mjs
 *
 * lorelei is line art: a plate shows straight through its transparent face, so
 * it is shown on a flat slate disc. That difference is the point, not an
 * oversight — it is what the style costs you.
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
const SKIN = ['f2d3b1', 'ecad80', 'd08b5b', 'ae5d29', '8d5524', '613915'];

const raw = (style, o, px) =>
  createAvatar(STYLES[style], { size: px, backgroundColor: ['transparent'], ...o }).toString();

/** Muted slate plate — soft upper-left key, gloss, rim, contact shadow. */
function lit(style, o, px) {
  const g = Math.round(px * 0.13);
  return `<div style="position:relative;width:${px}px;height:${px}px;flex:0 0 auto">
    <div style="position:absolute;left:9%;right:9%;bottom:-4%;height:15%;border-radius:50%;background:rgba(0,0,0,0.5);filter:blur(${Math.max(4, g)}px)"></div>
    <div style="position:absolute;inset:0;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 33% 25%, #465875, #1A2334);box-shadow:0 14px 26px -10px rgba(0,0,0,0.62), inset 0 -${g}px ${g * 2}px -${g}px rgba(0,0,0,0.5), inset 0 ${g}px ${Math.round(g * 1.4)}px -${g}px rgba(255,255,255,0.45)">
      ${raw(style, o, px)}
      <div style="position:absolute;inset:0;border-radius:50%;background:linear-gradient(148deg,rgba(255,255,255,0.22) 0%,rgba(255,255,255,0) 44%)"></div>
      <div style="position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.16)"></div>
    </div></div>`;
}
const flat = (style, o, px) =>
  `<div style="width:${px}px;height:${px}px;border-radius:50%;overflow:hidden;background:#243049;flex:0 0 auto">${raw(style, o, px)}</div>`;

const age = (a) => ({
  hairColor: [a < 35 ? '2c1b18' : a < 50 ? '85705d' : a < 68 ? 'b7b7b7' : 'e8e1e1'],
  hairProbability: a > 72 ? 55 : 100,
  glassesProbability: a < 45 ? 10 : 65,
});

const COLS = [
  ['adventurer', 'CC BY 4.0 · one credit line', true],
  ['lorelei', 'CC0 · nothing owed', false],
  ['avataaars', 'Free commercial · no credit', true],
];

const col = ([style, lic, filled]) => {
  const r = (o, px) => (filled ? lit(style, o, px) : flat(style, o, px));
  const cast = ['Maya', 'Andre', 'Priya', 'Tom', 'Zara']
    .map((s, i) => r({ seed: s, skinColor: [SKIN[i]] }, 84)).join('');
  const ages = [10, 30, 55, 80]
    .map((a) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">${r({ seed: 'Aged', skinColor: [SKIN[3]], ...age(a) }, 84)}<span style="color:#64748B;font:600 10px system-ui">${a}y</span></div>`).join('');
  const tiny = ['Maya', 'Andre', 'Priya', 'Tom', 'Zara', 'Kenji']
    .map((s, i) => r({ seed: s, skinColor: [SKIN[i]] }, 44)).join('');
  return `<div style="flex:1;min-width:400px">
    <div style="color:#fff;font:800 24px system-ui">${style}</div>
    <div style="color:#64748B;font:600 11px system-ui;margin:3px 0 18px">${lic}${filled ? '' : ' · line art, NO lit plate possible'}</div>
    <div style="margin-bottom:22px">${r({ seed: 'Maya', skinColor: [SKIN[2]] }, 168)}</div>
    <div style="color:#94A3B8;font:700 10px system-ui;letter-spacing:.4px;margin-bottom:8px">CAST · SKIN RANGE</div>
    <div style="display:flex;gap:10px;margin-bottom:20px">${cast}</div>
    <div style="color:#94A3B8;font:700 10px system-ui;letter-spacing:.4px;margin-bottom:8px">ONE PERSON, AGED</div>
    <div style="display:flex;gap:10px;margin-bottom:20px">${ages}</div>
    <div style="color:#94A3B8;font:700 10px system-ui;letter-spacing:.4px;margin-bottom:8px">44px · CONTACTS ROW</div>
    <div style="display:flex;gap:9px">${tiny}</div>
  </div>`;
};

const html = `<html><body style="margin:0;padding:40px;background:#0B1220;font-family:system-ui">
  <div style="color:#fff;font:800 30px system-ui">The three finalists · muted slate plate</div>
  <div style="color:#94A3B8;font:400 14px system-ui;margin:8px 0 26px">Same seeds, same forced skin palette, same ageing levers across all three.</div>
  <div style="display:flex;gap:40px;align-items:flex-start">${COLS.map(col).join('')}</div>
</body></html>`;

mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 1100 }, deviceScaleFactor: 2 });
await p.setContent(html);
await p.screenshot({ path: resolve(OUT, 'avatar-three-way.png'), fullPage: true });
await b.close();
console.log('wrote screenshots/avatar-three-way.png');
