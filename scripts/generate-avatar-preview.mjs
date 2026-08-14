/**
 * Renders the avatar system through its REAL code path:
 *   node scripts/generate-avatar-preview.mjs
 *
 * `lib/avatar/*.ts` is transpiled and imported directly, so `buildStyleOptions`,
 * `ageEffects`, `avatarFromSeed` and `inheritAvatar` here are the same functions
 * the app runs. Only the plate is re-expressed in CSS — in the app it is SVG in
 * `components/avatar/VectorAvatar.tsx`.
 *
 * The previous version of this script MIRRORED the renderer instead, which meant
 * the preview could drift from what shipped. It cannot now.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { createAvatar } from '@dicebear/core';
import { avataaars } from '@dicebear/collection';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'screenshots');
const TMP = resolve(ROOT, 'node_modules/.cache/avatar-preview');

mkdirSync(TMP, { recursive: true });
for (const f of readdirSync(resolve(ROOT, 'lib/avatar')).filter((x) => x.endsWith('.ts'))) {
  const js = ts.transpileModule(readFileSync(resolve(ROOT, 'lib/avatar', f), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText.replace(/from '\.\/([a-zA-Z]+)'/g, "from './$1.mjs'");
  writeFileSync(resolve(TMP, f.replace(/\.ts$/, '.mjs')), js);
}
const load = (n) => import(pathToFileURL(resolve(TMP, n)).href);

const { buildStyleOptions } = await load('style.mjs');
const { ageEffects } = await load('aging.mjs');
const { avatarFromSeed, randomAvatar, normalizeAvatar } = await load('random.mjs');
const { inheritAvatar } = await load('inherit.mjs');
const { encodeAvatar, decodeAvatar } = await load('encode.mjs');
const { SKIN_TONES } = await load('palette.mjs');

/** The production path, end to end. */
function art(config, sex, age, px) {
  const safe = normalizeAvatar(config);
  return createAvatar(avataaars, { size: px, ...buildStyleOptions(safe, sex, ageEffects(age, sex)) }).toString();
}

/** The 2.5D plate — CSS here, SVG in the component. */
function avatar(config, sex, age, px) {
  const g = Math.round(px * 0.13);
  return `<div style="position:relative;width:${px}px;height:${px}px;flex:0 0 auto">
    <div style="position:absolute;left:9%;right:9%;bottom:-4%;height:15%;border-radius:50%;background:rgba(0,0,0,0.45);filter:blur(${Math.max(4, g)}px)"></div>
    <div style="position:absolute;inset:0;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 33% 25%, #465875, #1A2334);box-shadow:0 14px 26px -10px rgba(0,0,0,0.6), inset 0 -${g}px ${g * 2}px -${g}px rgba(0,0,0,0.5), inset 0 ${g}px ${Math.round(g * 1.4)}px -${g}px rgba(255,255,255,0.45)">
      ${art(config, sex, age, px)}
      <div style="position:absolute;inset:0;border-radius:50%;background:linear-gradient(148deg,rgba(255,255,255,0.22) 0%,rgba(255,255,255,0) 44%)"></div>
      <div style="position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.16)"></div>
    </div></div>`;
}

const cap = (i, t) => `<div style="display:flex;flex-direction:column;align-items:center;gap:7px">${i}<span style="color:#94A3B8;font:600 10px system-ui">${t}</span></div>`;
const sec = (t, n, b) => `<div style="margin-top:34px"><div style="color:#fff;font:800 20px system-ui">${t}</div>${n ? `<div style="color:#94A3B8;font:400 13px system-ui;margin:4px 0 14px;max-width:900px">${n}</div>` : '<div style="height:14px"></div>'}<div style="display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end">${b}</div></div>`;

const cast = Array.from({ length: 12 }, (_, i) => {
  const sex = i % 2 ? 'male' : 'female';
  return cap(avatar(avatarFromSeed(`cast-${i}`, sex), sex, 22 + i * 4, 104), `seed ${i}`);
}).join('');

const skins = SKIN_TONES.map((_, i) =>
  cap(avatar({ ...avatarFromSeed('tone', 'female'), skinTone: i }, 'female', 26, 92), `tone ${i + 1}`)).join('');

const AGES = [6, 14, 22, 32, 45, 58, 70, 85];
const heroM = avatarFromSeed('life-m', 'male');
const heroF = avatarFromSeed('life-f', 'female');
const agedM = AGES.map((a) => cap(avatar(heroM, 'male', a, 92), `${a}y`)).join('');
const agedF = AGES.map((a) => cap(avatar(heroF, 'female', a, 92), `${a}y`)).join('');

const mum = avatarFromSeed('mum', 'female');
const dad = avatarFromSeed('dad', 'male');
const family =
  cap(avatar(mum, 'female', 38, 92), 'mother') + cap(avatar(dad, 'male', 41, 92), 'father') +
  Array.from({ length: 6 }, (_, i) => {
    const s = i % 2 ? 'male' : 'female';
    return cap(avatar(inheritAvatar(mum, dad, `kid-${i}`, s), s, 12, 92), `child ${i}`);
  }).join('');

const tiny = Array.from({ length: 10 }, (_, i) => {
  const sex = i % 2 ? 'male' : 'female';
  return avatar(avatarFromSeed(`row-${i}`, sex), sex, 30, 44);
}).join('');

// Round-trip through the save codec — what actually gets persisted.
const rt = Array.from({ length: 4 }, (_, i) => {
  const sex = i % 2 ? 'male' : 'female';
  const c = randomAvatar(sex);
  const back = decodeAvatar(encodeAvatar(c));
  return cap(avatar(back, sex, 28, 92), encodeAvatar(c));
}).join('');

const html = `<html><body style="margin:0;padding:40px;background:#0B1220;font-family:system-ui">
  <div style="color:#fff;font:800 30px system-ui">Avatars — illustrator-drawn art, 2.5D plate</div>
  <div style="color:#94A3B8;font:400 14px system-ui;margin-top:8px;max-width:940px">Rendered through the real code path: <code style="color:#60A5FA">buildStyleOptions</code> → <code style="color:#60A5FA">createAvatar</code>. Art: avataaars by Pablo Stanley, curated.</div>
  ${sec('The cast', 'Twelve seeded characters at different ages.', cast)}
  ${sec('Skin range', '', skins)}
  ${sec('One man, 6 → 85', 'Same config throughout. Hair greys, then thins; glasses become likelier.', agedM)}
  ${sec('One woman, 6 → 85', 'Greys, but never thins — thinning on a feminine face reads as an art bug.', agedF)}
  ${sec('Inheritance', 'Two parents, six children. Skin blends; brows, eyes and mouth come whole from one parent.', family)}
  ${sec('44px — the contacts row', '', `<div style="display:flex;gap:10px">${tiny}</div>`)}
  ${sec('Save codec round-trip', 'Each face decoded back from the string under it — this is what persists.', rt)}
</body></html>`;

mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
await p.setContent(html);
await p.screenshot({ path: resolve(OUT, 'avatar-vector-preview.png'), fullPage: true });
await b.close();
console.log('wrote screenshots/avatar-vector-preview.png');
