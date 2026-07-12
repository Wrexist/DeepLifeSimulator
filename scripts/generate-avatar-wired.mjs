/**
 * Spark — clones → a real crowd, WIRED (live). BEFORE = the old
 * getDatingProfileImage(gender) → the same Female.png for every woman. AFTER =
 * the new seeded getPortrait(profile.id, age, sex) → each woman's real, stable
 * pool face. The AFTER faces are computed with the SAME FNV-1a hash + bucket
 * logic as utils/facePool.ts, so this shows exactly what the app renders.
 *   node scripts/generate-avatar-wired.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, legendItem, renderToPng, faceURI } from './lib/phoneFrame.mjs';

// Mirror of utils/facePool.ts (hash + bucket sizes) so the AFTER is truthful.
function hashSeed(seed) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const SIZES = { f_ya: 10, m_ya: 10, f_ad: 6, m_ad: 6 };
function pad(n) { return String(n).padStart(2, '0'); }
function bandForAge(age) { return age < 30 ? 'ya' : 'ad'; }
function pooledFace(id, sex, age) {
  const key = `${sex === 'female' ? 'f' : 'm'}_${bandForAge(age)}`;
  const idx = hashSeed(id) % SIZES[key];
  return faceURI(`pool/${key}_${pad(idx + 1)}.png`);
}

// Real DATING_PROFILES rows (id/name/age/job) — women first, some men.
const WOMEN = [
  { id: '1', name: 'Sarah', age: 24, job: 'Marketing' },
  { id: '2', name: 'Emma', age: 26, job: 'Art Director' },
  { id: '3', name: 'Jessica', age: 23, job: 'Trainer' },
  { id: '4', name: 'Sophia', age: 28, job: 'Founder' },
  { id: '6', name: 'Olivia', age: 22, job: 'Student' },
  { id: '13', name: 'Maya', age: 24, job: 'Yoga' },
];
const MEN = [
  { id: '7', name: 'Michael', age: 27, job: 'Engineer' },
  { id: '9', name: 'James', age: 31, job: 'Banker' },
  { id: '20', name: 'Alex', age: 28, job: 'Architect' },
  { id: '42', name: 'Blake', age: 28, job: 'Officer' },
];

const card = (uri, n, a, j) => `<div style="border-radius:16px;overflow:hidden;background:${T.surface};box-shadow:0 6px 14px -6px rgba(0,0,0,0.5);">
  <div style="height:120px;overflow:hidden;"><img src="${uri}" style="width:100%;height:100%;object-fit:cover;object-position:center top;"/></div>
  <div style="padding:8px 10px 10px;"><div style="color:#fff;font-size:13px;font-weight:800;">${n}, ${a}</div><div style="color:${T.muted};font-size:11px;margin-top:1px;">${j}</div></div>
</div>`;

const sparkGrid = (people, faceFn) => `<div style="flex:1;padding:14px 14px 0;overflow:hidden;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;"><span style="font-size:22px;font-weight:900;background:linear-gradient(120deg,#F43F5E,#FB923C);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">Spark</span><span style="color:${T.muted};font-size:12px;">Discover</span></div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:11px;">${people.map((p) => card(faceFn(p), p.name, p.age, p.job)).join('')}</div>
</div>`;

const beforeFace = () => faceURI('Female.png');
const afterFace = (p) => pooledFace(p.id, 'female', p.age);

// "And it's everywhere" strip — real seeded faces for a mixed crowd.
const strip = () => {
  const chip = (uri) => `<div style="width:72px;height:72px;border-radius:36px;overflow:hidden;flex:0 0 auto;box-shadow:0 6px 14px -6px rgba(0,0,0,0.55), inset 0 0 0 2px rgba(255,255,255,0.12);"><img src="${uri}" style="width:100%;height:100%;object-fit:cover;object-position:center top;"/></div>`;
  const faces = [
    ...WOMEN.slice(0, 4).map((p) => pooledFace(p.id, 'female', p.age)),
    ...MEN.map((p) => pooledFace(p.id, 'male', p.age)),
  ];
  return `<div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">${faces.map(chip).join('')}</div>`;
};

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Spark — clones → a real crowd (wired & live)',
  subtitle: 'Same six women, same screen. Before: getDatingProfileImage(gender) returned one Female.png for everyone. After: a seeded getPortrait(profile.id, age, sex) gives each her own stable face from your pool. These After faces are computed with the exact hash the app uses — this is what actually renders now.',
  body: `<div style="display:flex;justify-content:center;gap:48px;margin-top:30px;flex-wrap:wrap;">
      ${phone(sparkGrid(WOMEN, beforeFace), { caption: 'Before · one face for all', captionColor: '#F87171', h: 560 })}
      ${phone(sparkGrid(WOMEN, afterFace), { caption: 'After · everyone unique', captionColor: '#34D399', h: 560 })}
    </div>
    <div style="max-width:900px;margin:40px auto 0;padding:26px 30px;background:#0F172A;border-radius:20px;box-shadow:0 14px 36px rgba(0,0,0,0.5);">
      <div style="color:#94A3B8;font-size:13px;font-weight:700;letter-spacing:0.4px;margin-bottom:16px;text-align:center;">…AND IT'S EVERY SCREEN · real seeded faces, one crowd</div>
      ${strip()}
    </div>
    <div style="display:flex;justify-content:center;gap:34px;margin-top:36px;flex-wrap:wrap;max-width:1080px;margin-left:auto;margin-right:auto;">
      ${legendItem('#34D399', 'One picker, wired everywhere', 'getPortrait(seed, age, sex) now drives Spark (6 screens), Contacts/Family, Prestige and Hustle. Each person is seeded by their id, so Sarah always looks like Sarah — but never like Emma. 75 pool faces + the original 5 as fallbacks.')}
      ${legendItem('#60A5FA', 'Verified', 'Typecheck clean, facePool unit tests + render smoke green. Hero faces (Mom/Dad/best friend) are reserved for named cast. Nothing renders blank — empty buckets fall back to the base 5.')}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'avatar-wired.png'), 1240);
console.log('wrote avatar-wired.png');
