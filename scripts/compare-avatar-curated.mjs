/**
 * The decisive comparison: adventurer vs avataaars, both CURATED.
 *   node scripts/compare-avatar-curated.mjs
 *
 * Generator defaults include expressions no life sim wants — grimaces, bared
 * teeth, vomit. Constraining the option sets is the single biggest lever on
 * perceived quality, and it is what the earlier repo research meant by
 * "friendly-expression constrained".
 *
 * The other axis is COVERAGE. adventurer has no facial hair and no clothing;
 * avataaars has both, and clothing can be driven by wealth/career.
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

// Curated: calm, human expressions only. No grimace, no bared teeth, no tongue.
const CURATED = {
  avataaars: {
    mouth: ['default', 'smile', 'serious', 'twinkle'],
    eyes: ['default', 'happy', 'squint', 'wink'],
    eyebrows: ['default', 'defaultNatural', 'flatNatural', 'raisedExcited'],
    style: ['circle'],
  },
  adventurer: {
    mouth: ['variant01', 'variant02', 'variant03', 'variant04', 'variant05', 'variant12', 'variant15', 'variant20'],
  },
};

const raw = (style, o, px) =>
  createAvatar(STYLES[style], {
    size: px, backgroundColor: ['transparent'], ...(CURATED[style] || {}), ...o,
  }).toString();

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

const cap = (i, t) => `<div style="display:flex;flex-direction:column;align-items:center;gap:6px">${i}<span style="color:#64748B;font:600 10px system-ui">${t}</span></div>`;
const h = (t) => `<div style="color:#94A3B8;font:700 10px system-ui;letter-spacing:.4px;margin:18px 0 8px">${t}</div>`;

const age = (a, style) => {
  const hairColor = [a < 35 ? '2c1b18' : a < 50 ? '85705d' : a < 68 ? 'b7b7b7' : 'e8e1e1'];
  const o = { hairColor, hairProbability: a > 74 ? 40 : 100, glassesProbability: a < 45 ? 10 : 60 };
  if (style === 'avataaars') {
    o.facialHairColor = hairColor;
    o.facialHairProbability = a >= 25 ? 70 : 0;
    o.topProbability = a > 74 ? 40 : 100;
  }
  return o;
};

const col = (style, lic, note) => {
  const cast = ['Maya', 'Andre', 'Priya', 'Tom', 'Zara'].map((s, i) => lit(style, { seed: s, skinColor: [SKIN[i]] }, 84)).join('');
  const men = ['Tom', 'Kenji', 'Lars', 'Andre'].map((s, i) =>
    lit(style, { seed: s + 'M', skinColor: [SKIN[i + 1]], ...(style === 'avataaars' ? { facialHairProbability: 100 } : {}) }, 84)).join('');
  const ages = [10, 30, 55, 80].map((a) => cap(lit(style, { seed: 'AgedM', skinColor: [SKIN[3]], ...age(a, style) }, 84), `${a}y`)).join('');
  const tiny = ['Maya', 'Andre', 'Priya', 'Tom', 'Zara', 'Kenji'].map((s, i) => lit(style, { seed: s, skinColor: [SKIN[i]] }, 44)).join('');
  return `<div style="flex:1;min-width:420px">
    <div style="color:#fff;font:800 24px system-ui">${style} <span style="font:600 12px system-ui;color:#60A5FA">curated</span></div>
    <div style="color:#64748B;font:600 11px system-ui;margin:3px 0 16px">${lic}</div>
    <div style="color:#CBD5E1;font:400 12px/1.5 system-ui;margin-bottom:16px;max-width:400px">${note}</div>
    <div>${lit(style, { seed: 'Maya', skinColor: [SKIN[2]] }, 160)}</div>
    ${h('CAST · SKIN RANGE')}<div style="display:flex;gap:10px">${cast}</div>
    ${h('MEN — CAN THEY HAVE BEARDS?')}<div style="display:flex;gap:10px">${men}</div>
    ${h('ONE MAN, AGED')}<div style="display:flex;gap:10px">${ages}</div>
    ${h('44px')}<div style="display:flex;gap:9px">${tiny}</div>
  </div>`;
};

const html = `<html><body style="margin:0;padding:40px;background:#0B1220;font-family:system-ui">
  <div style="color:#fff;font:800 30px system-ui">Curated option sets · the real decision</div>
  <div style="color:#94A3B8;font:400 14px system-ui;margin:8px 0 26px">Both constrained to calm expressions. The third row is the one that matters: facial hair.</div>
  <div style="display:flex;gap:44px;align-items:flex-start">
    ${col('adventurer', 'CC BY 4.0 · one credit line', 'Prettiest art, 45 hairstyles, 26 eye sets. <strong style="color:#F87171">No facial hair. No clothing.</strong>')}
    ${col('avataaars', 'Free commercial · no credit', 'Beards, 34 hair/hat tops, 9 clothing sets + graphics. <strong style="color:#34D399">Clothing can be driven by wealth and career.</strong>')}
  </div>
</body></html>`;

mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1200 }, deviceScaleFactor: 2 });
await p.setContent(html);
await p.screenshot({ path: resolve(OUT, 'avatar-curated-decision.png'), fullPage: true });
await b.close();
console.log('wrote screenshots/avatar-curated-decision.png');
