/**
 * "You already have the 3D look" — the real avatar situation, from real art.
 * Left: the current Spark discovery grid, where every young woman is the SAME
 * Female.png (the clone problem). Right: a Family screen where the 5 real faces
 * differ — proving the style + system already deliver variety when the art
 * exists. Then the fix: expand the library + seed the picker.
 *   node scripts/generate-avatar-reality.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, legendItem, renderToPng, faceURI } from './lib/phoneFrame.mjs';

const F = {
  baby: faceURI('Baby.png'), male: faceURI('Male.png'), female: faceURI('Female.png'),
  oldM: faceURI('Old_Male.png'), oldF: faceURI('Old_Female.png'),
};

const roundFace = (uri, size, ring = 'rgba(255,255,255,0.14)') =>
  `<div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;overflow:hidden;flex:0 0 auto;box-shadow:0 8px 18px -6px rgba(0,0,0,0.6), inset 0 0 0 2px ${ring};"><img src="${uri}" style="width:100%;height:100%;object-fit:cover;object-position:center top;"/></div>`;

// ── The 5 faces you already ship ────────────────────────────────────────────
const setRow = () => {
  const chip = (uri, label) => `<div style="display:flex;flex-direction:column;align-items:center;gap:10px;">${roundFace(uri, 108)}<span style="color:${T.text2};font-size:13px;font-weight:600;">${label}</span></div>`;
  return `<div style="display:flex;gap:30px;justify-content:center;flex-wrap:wrap;">
    ${chip(F.baby, 'Baby')}${chip(F.male, 'Young ♂')}${chip(F.female, 'Young ♀')}${chip(F.oldM, 'Senior ♂')}${chip(F.oldF, 'Senior ♀')}
  </div>`;
};

// ── Spark discovery grid — the clone problem (all young women = Female.png) ──
const sparkToday = () => {
  const people = [['Sarah', 24, 'Marketing'], ['Emma', 26, 'Art Director'], ['Jessica', 23, 'Trainer'], ['Sophia', 28, 'Founder'], ['Olivia', 22, 'Student'], ['Maya', 24, 'Yoga']];
  const card = (n, a, j) => `<div style="border-radius:16px;overflow:hidden;background:${T.surface};box-shadow:0 6px 14px -6px rgba(0,0,0,0.5);">
    <div style="height:118px;overflow:hidden;"><img src="${F.female}" style="width:100%;height:100%;object-fit:cover;object-position:center top;"/></div>
    <div style="padding:8px 10px 10px;"><div style="color:#fff;font-size:13px;font-weight:800;">${n}, ${a}</div><div style="color:${T.muted};font-size:11px;margin-top:1px;">${j}</div></div>
  </div>`;
  return `<div style="flex:1;padding:14px 14px 0;overflow:hidden;">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;"><span style="font-size:22px;font-weight:900;background:linear-gradient(120deg,#F43F5E,#FB923C);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Spark</span><span style="color:${T.muted};font-size:12px;">Discover</span></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;">${people.map((p) => card(...p)).join('')}</div>
  </div>`;
};

// ── Family screen — 5 real DIFFERENT faces, same style ──────────────────────
const familyReal = () => {
  const row = (uri, n, rel) => `<div style="display:flex;align-items:center;gap:13px;padding:11px 14px;background:${T.surface};border-radius:16px;margin-bottom:11px;box-shadow:0 5px 12px -6px rgba(0,0,0,0.45);">
    ${roundFace(uri, 54)}<div><div style="color:#fff;font-size:15px;font-weight:800;">${n}</div><div style="color:${T.muted};font-size:12px;margin-top:1px;">${rel}</div></div></div>`;
  return `<div style="flex:1;padding:16px 14px 0;overflow:hidden;">
    <div style="color:#fff;font-size:22px;font-weight:900;margin-bottom:14px;">Family</div>
    ${row(F.oldF, 'Linda', 'Mother · 58')}${row(F.oldM, 'Robert', 'Father · 61')}${row(F.male, 'You', 'Age 27')}${row(F.female, 'Chloe', 'Sister · 24')}${row(F.baby, 'Noah', 'Son · 1')}
  </div>`;
};

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'You already have the 3D look — the gap is variety',
  subtitle: 'The repo already ships 5 rendered 3D/Pixar faces in assets/images/Face, wired via getCharacterImage(age, sex). They\'re exactly the immersive look you asked for and match your app-icon art. The problem isn\'t the style — it\'s that there are only 5, so everyone of the same age+sex is the identical face.',
  body: `<div style="max-width:1180px;margin:26px auto 0;padding:30px 34px;background:#0F172A;border-radius:22px;box-shadow:0 16px 40px rgba(0,0,0,0.55);">
      <div style="color:#94A3B8;font-size:13px;font-weight:700;letter-spacing:0.4px;margin-bottom:18px;">YOUR EXISTING SET · already in the repo, already wired</div>
      ${setRow()}
    </div>
    <div style="display:flex;justify-content:center;gap:48px;margin-top:40px;flex-wrap:wrap;">
      ${phone(sparkToday(), { caption: 'Spark today · everyone\'s a clone', captionColor: '#F87171', h: 560 })}
      ${phone(familyReal(), { caption: 'Family · 5 real faces already differ', captionColor: '#34D399', h: 560 })}
    </div>
    <div style="display:flex;justify-content:center;gap:34px;margin-top:40px;flex-wrap:wrap;max-width:1080px;margin-left:auto;margin-right:auto;">
      ${legendItem('#F87171', 'The clone problem', 'getDatingProfileImage(gender) returns 1 of 2 faces — so all 25 women in Spark share one face, all 26 men share another. Every parent is one of two seniors, every child is the same baby. The art is great; the repetition is what breaks immersion.')}
      ${legendItem('#34D399', 'The fix is "more of the same"', 'Generate ~25–30 more faces in THIS exact style (your AI workflow — updated prompt sheet), then swap the pickers for a seeded getPortrait(seed, age, sex) that spreads people across the pool. Sarah always looks like Sarah, but different from Emma. The Hustle employee screen already does this with a 4-face pool — we just generalize it.')}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'avatar-reality.png'), 1240);
console.log('wrote avatar-reality.png');
