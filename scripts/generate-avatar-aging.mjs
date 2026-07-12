/**
 * Faces track age — a kid growing up, and Mom & Dad ageing. Mirrors the exact
 * logic of utils/facePool.ts (hash, bands, folded hero pools, parent anchors)
 * so it shows what the app actually renders.
 *   node scripts/generate-avatar-aging.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, pageShell, legendItem, renderToPng, faceURI } from './lib/phoneFrame.mjs';

function hashSeed(seed) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function bandForAge(age) {
  if (age < 5) return 'baby'; if (age < 13) return 'kid'; if (age < 18) return 'tn';
  if (age < 30) return 'ya'; if (age < 40) return 'ad'; if (age <= 55) return 'mid'; return 'sr';
}
// Pool filename arrays, in the SAME order as utils/facePool.ts (hero faces folded in).
const P = {
  baby: ['baby_01', 'baby_02', 'baby_03'],
  f_kid: ['f_kid_01', 'f_kid_02', 'f_kid_03'],
  f_tn: ['f_tn_01', 'f_tn_02', 'f_tn_03'],
  f_ya: ['f_ya_01', 'f_ya_02', 'f_ya_03', 'f_ya_04', 'f_ya_05', 'f_ya_06', 'f_ya_07', 'f_ya_08', 'f_ya_09', 'f_ya_10', 'hero_bestfriend_f', 'hero_sibling_f'],
  f_ad: ['f_ad_01', 'f_ad_02', 'f_ad_03', 'f_ad_04', 'f_ad_05', 'f_ad_06'],
  f_sr: ['f_sr_01', 'f_sr_02', 'f_sr_03', 'f_sr_04', 'hero_grandparent'],
  m_sr: ['m_sr_01', 'm_sr_02', 'm_sr_03', 'm_sr_04', 'hero_mentor'],
};
function pooled(seed, age, sex) {
  const band = bandForAge(age);
  const key = band === 'baby' ? 'baby' : `${sex === 'female' ? 'f' : 'm'}_${band}`;
  const arr = P[key];
  return faceURI(`pool/${arr[hashSeed(seed) % arr.length]}.png`);
}
function parent(sex, seed, age) {
  if (bandForAge(age) === 'mid') return faceURI(`pool/${sex === 'female' ? 'hero_mom' : 'hero_dad'}.png`);
  return pooled(seed, age, sex);
}

const chip = (uri, age, stage) => `<div style="display:flex;flex-direction:column;align-items:center;gap:9px;">
  <div style="width:104px;height:104px;border-radius:52px;overflow:hidden;box-shadow:0 8px 18px -6px rgba(0,0,0,0.6), inset 0 0 0 2px rgba(255,255,255,0.12);"><img src="${uri}" style="width:100%;height:100%;object-fit:cover;object-position:center top;"/></div>
  <span style="color:#fff;font-size:13px;font-weight:800;">Age ${age}</span><span style="color:${T.muted};font-size:11px;margin-top:-4px;">${stage}</span></div>`;
const arrow = () => `<div style="align-self:center;color:#475569;font-size:26px;font-weight:300;margin-bottom:22px;">&rarr;</div>`;
const join = (chips) => chips.map((c, i) => (i ? arrow() + c : c)).join('');
const row = (label, chips) => `<div style="margin-bottom:30px;"><div style="color:#94A3B8;font-size:13px;font-weight:700;letter-spacing:0.4px;margin-bottom:16px;">${label}</div><div style="display:flex;gap:16px;align-items:flex-end;flex-wrap:wrap;">${join(chips)}</div></div>`;

const KID = 'child-emma-7';
const kidRow = [
  chip(pooled(KID, 3, 'female'), 3, 'Baby'),
  chip(pooled(KID, 9, 'female'), 9, 'Child'),
  chip(pooled(KID, 15, 'female'), 15, 'Teen'),
  chip(pooled(KID, 23, 'female'), 23, 'Young adult'),
];
const momRow = [chip(parent('female', 'mom-1', 48), 48, 'Mom'), chip(parent('female', 'mom-1', 72), 72, 'Elderly')];
const dadRow = [chip(parent('male', 'dad-1', 48), 48, 'Dad'), chip(parent('male', 'dad-1', 72), 72, 'Elderly')];

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Faces track age — kids grow up, Mom & Dad age',
  subtitle: 'The portrait always matches the character\'s current age band. As game years pass and a character ages, their face moves to the matching life stage — deterministically, so it\'s stable between birthdays. These are the real pool faces the app now renders.',
  body: `<div style="max-width:1040px;margin:28px auto 0;padding:32px 36px 16px;background:#0F172A;border-radius:22px;box-shadow:0 16px 40px rgba(0,0,0,0.55);">
      ${row('YOUR KID GROWS UP · same child, seeded by id', kidRow)}
      <div style="display:flex;gap:70px;flex-wrap:wrap;">
        <div>${row('MOM AGES', momRow)}</div>
        <div>${row('DAD AGES', dadRow)}</div>
      </div>
    </div>
    <div style="display:flex;justify-content:center;gap:34px;margin-top:34px;flex-wrap:wrap;max-width:1080px;margin-left:auto;margin-right:auto;">
      ${legendItem('#34D399', 'Age-correlated everywhere', 'getPortrait(seed, age, sex) picks from the age band, so anyone — kids, partners, NPCs — shows an age-appropriate face that updates as they age. Relationships already age each year (npcDepth), so faces follow along.')}
      ${legendItem('#60A5FA', 'Mom & Dad age too', 'Parents show their own Mom/Dad portrait through middle age, then move into the elderly pool as they get older — so they age instead of freezing. All 10 hero faces are in use; 75 faces compressed to 35MB.')}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'avatar-aging.png'), 1120);
console.log('wrote avatar-aging.png');
