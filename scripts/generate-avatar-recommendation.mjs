/**
 * The recommended direction, prototyped:
 *   node scripts/generate-avatar-recommendation.mjs
 *
 * Professionally-illustrated generator art (DiceBear) under a 2.5D LIT FRAME —
 * contact shadow, radial key light, gloss sweep, hairline rim. The frame is the
 * same idea that `generate-avatar-styles.mjs` prototyped earlier in this repo;
 * what changes is that it now sits under art drawn by an illustrator rather
 * than geometry typed by hand.
 *
 * Note (carried from that earlier script, and re-verified): the lit frame only
 * works on FILLED styles. Line-art styles — lorelei, notionists, openPeeps —
 * have transparent faces, so a coloured plate shows straight through them.
 * They are shown flat here for that reason.
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

/** Age → the options that express it. Hair colour is the main lever. */
function ageOptions(age) {
  const hair =
    age < 35 ? '2c1b18' : age < 45 ? '4a312c' : age < 55 ? '85705d' : age < 68 ? 'b7b7b7' : 'e8e1e1';
  return {
    hairColor: [hair],
    // Thinning is expressed by dropping the hair layer's probability, which is
    // a real option on this style rather than something drawn on top.
    hairProbability: age > 72 ? 55 : 100,
    // Reading glasses become likelier with age — a cheap, honest age cue.
    glassesProbability: age < 45 ? 10 : age < 60 ? 40 : 70,
  };
}

function raw(style, options, px) {
  return createAvatar(STYLES[style], {
    size: px,
    backgroundColor: ['transparent'],
    ...options,
  }).toString();
}

/** The 2.5D frame: contact shadow → lit plate → art → gloss → rim. */
function lit(style, options, px, light = '#93c5fd', deep = '#1d4ed8') {
  const glow = Math.round(px * 0.13);
  return `<div style="position:relative;width:${px}px;height:${px}px;flex:0 0 auto">
    <div style="position:absolute;left:9%;right:9%;bottom:-4%;height:15%;border-radius:50%;background:rgba(0,0,0,0.5);filter:blur(${Math.max(5, glow)}px)"></div>
    <div style="position:absolute;inset:0;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 33% 25%, ${light}, ${deep});box-shadow:0 14px 26px -10px rgba(0,0,0,0.62), inset 0 -${glow}px ${glow * 2}px -${glow}px rgba(0,0,0,0.55), inset 0 ${glow}px ${Math.round(glow * 1.4)}px -${glow}px rgba(255,255,255,0.7)">
      ${raw(style, options, px)}
      <div style="position:absolute;inset:0;border-radius:50%;background:linear-gradient(148deg, rgba(255,255,255,0.32) 0%, rgba(255,255,255,0) 44%);pointer-events:none"></div>
      <div style="position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.2);pointer-events:none"></div>
    </div>
  </div>`;
}

const flat = (style, options, px) =>
  `<div style="width:${px}px;height:${px}px;border-radius:50%;overflow:hidden;background:#1E293B;flex:0 0 auto">${raw(style, options, px)}</div>`;

const cap = (inner, text) =>
  `<div style="display:flex;flex-direction:column;align-items:center;gap:9px">${inner}<span style="color:#94A3B8;font:600 11px system-ui">${text}</span></div>`;

const section = (title, note, body) =>
  `<div style="margin:34px 0 0">
    <div style="color:#fff;font:800 19px system-ui">${title}</div>
    ${note ? `<div style="color:#94A3B8;font:400 13px system-ui;margin:4px 0 14px;max-width:900px">${note}</div>` : '<div style="height:14px"></div>'}
    <div style="display:flex;gap:22px;align-items:flex-end;flex-wrap:wrap">${body}</div>
  </div>`;

const S = 'adventurer';

// ── Hero: flat as the generator ships it, vs the lit frame ─────────────────
const hero = `<div style="display:flex;gap:44px;align-items:center;flex-wrap:wrap;padding:28px 0 6px">
  ${cap(flat(S, { seed: 'Maya', skinColor: [SKIN[2]] }, 156), 'Art as it ships — flat')}
  <div style="color:#475569;font:300 34px system-ui">&rarr;</div>
  ${cap(lit(S, { seed: 'Maya', skinColor: [SKIN[2]] }, 156), '2.5D lit frame')}
  <div style="flex:1;min-width:260px;color:#CBD5E1;font:400 14px/1.65 system-ui">
    Same art, no new drawing. The frame adds a contact shadow so the face sits <em>on</em> the surface,
    a radial key light from the upper left, a gloss sweep and a hairline rim.
    The depth comes from the frame; the <strong>quality comes from the art being professionally illustrated</strong> —
    which is precisely what my hand-authored geometry was not.
  </div>
</div>`;

const ages = [8, 25, 40, 55, 70, 85];
const ageRow = ages
  .map((a) => cap(lit(S, { seed: 'Aged', skinColor: [SKIN[3]], ...ageOptions(a) }, 96), `${a}y`))
  .join('');

const skinRow = SKIN.map((s, i) => cap(lit(S, { seed: 'Skin', skinColor: [s] }, 96), `tone ${i + 1}`)).join('');

const castRow = ['Maya', 'Andre', 'Priya', 'Tom', 'Zara', 'Kenji']
  .map((s, i) => cap(lit(S, { seed: s, skinColor: [SKIN[i]] }, 96), s))
  .join('');

const listRow = ['Maya', 'Andre', 'Priya', 'Tom', 'Zara', 'Kenji']
  .map((s, i) => lit(S, { seed: s, skinColor: [SKIN[i]] }, 44))
  .join('');

const alt = [
  ['adventurer', 'CC BY 4.0 · credit line', true],
  ['avataaars', 'Free commercial · no credit', true],
  ['micah', 'CC BY 4.0 · credit line', true],
  ['lorelei', 'CC0 · no credit (shown flat — line art)', false],
]
  .map(([style, license, filled]) =>
    cap(
      filled ? lit(style, { seed: 'Maya' }, 120) : flat(style, { seed: 'Maya' }, 120),
      `${style}<br><span style="color:#64748B;font-size:10px">${license}</span>`
    )
  )
  .join('');

const html = `<html><body style="margin:0;padding:40px;background:#0B1220;font-family:system-ui">
  <div style="color:#fff;font:800 32px system-ui">Recommended direction</div>
  <div style="color:#94A3B8;font:400 15px system-ui;margin-top:8px;max-width:940px">
    Illustrator-drawn avatar art (DiceBear <strong>adventurer</strong>, by Lisa Wischofsky) under a 2.5D lit frame.
    45 hairstyles · 26 eye sets · 30 mouths · 15 brow sets · glasses · earrings · full skin and hair colour control.
  </div>
  ${hero}
  ${section('One character, aged 8 → 85', 'Same seed throughout — only hair colour, hair probability and glasses probability move. The person stays the same person.', ageRow)}
  ${section('Skin range', 'Driven from an explicit palette rather than the style default.', skinRow)}
  ${section('A cast', '', castRow)}
  ${section('At 44px, the contacts-list size', 'Where a style either survives or turns to mush.', `<div style="display:flex;gap:14px">${listRow}</div>`)}
  ${section('The other credible options', 'Any of these is a drop-in swap — the decision is taste plus how much you care about a credit line.', alt)}
</body></html>`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 1000 }, deviceScaleFactor: 2 });
await page.setContent(html);
await page.screenshot({ path: resolve(OUT, 'avatar-recommendation.png'), fullPage: true });
await browser.close();
console.log('wrote screenshots/avatar-recommendation.png');
