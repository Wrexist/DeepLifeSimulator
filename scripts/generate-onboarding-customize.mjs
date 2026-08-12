/**
 * Mock of the rebuilt Create Your Character screen:
 *   node scripts/generate-onboarding-customize.mjs
 *
 * Layout mirrors app/(onboarding)/Customize.tsx; the face and the picker
 * categories come from the real modules, so the swatches shown are the
 * swatches the player gets.
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
const { avatarFromSeed, normalizeAvatar } = await load('random.mjs');
const { pickersFor } = await load('pickers.mjs');

const art = (c, sex, age, px) =>
  createAvatar(avataaars, { size: px, ...buildStyleOptions(normalizeAvatar(c), sex, ageEffects(age, sex)) }).toString();

function avatar(c, sex, age, px) {
  const g = Math.round(px * 0.13);
  return `<div style="position:relative;width:${px}px;height:${px}px">
    <div style="position:absolute;left:9%;right:9%;bottom:-4%;height:15%;border-radius:50%;background:rgba(0,0,0,0.45);filter:blur(${g}px)"></div>
    <div style="position:absolute;inset:0;border-radius:50%;overflow:hidden;background:radial-gradient(circle at 33% 25%, #465875, #1A2334);box-shadow:0 14px 26px -10px rgba(0,0,0,0.6), inset 0 -${g}px ${g * 2}px -${g}px rgba(0,0,0,0.5), inset 0 ${g}px ${Math.round(g * 1.4)}px -${g}px rgba(255,255,255,0.45)">
      ${art(c, sex, age, px)}
      <div style="position:absolute;inset:0;border-radius:50%;background:linear-gradient(148deg,rgba(255,255,255,0.22) 0%,rgba(255,255,255,0) 44%)"></div>
      <div style="position:absolute;inset:0;border-radius:50%;box-shadow:inset 0 0 0 1.5px rgba(255,255,255,0.16)"></div>
    </div></div>`;
}

const cfg = { ...avatarFromSeed('screen-hero', 'female'), skinTone: 4, hairStyle: 19, hairColor: 2, clothing: 4, clothingColor: 1 };
const cats = pickersFor('female');
const active = cats[0];

const chips = cats.map((c, i) => {
  const on = i === 0;
  return `<div style="flex:0 0 auto;padding:8px 14px;border-radius:999px;border:1px solid ${on ? 'rgba(96,165,250,0.85)' : 'rgba(255,255,255,0.1)'};background:${on ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)'};color:${on ? '#fff' : '#CBD5E1'};font:700 12px system-ui">${c.label}</div>`;
}).join('');

const swatches = active.options.map((o, i) => {
  const on = i === cfg[active.field];
  return `<div style="width:42px;height:42px;border-radius:21px;border:${on ? '2px solid #60A5FA' : '1px solid rgba(255,255,255,0.18)'};padding:3px;box-sizing:border-box"><div style="width:100%;height:100%;border-radius:18px;background:${o.color}"></div></div>`;
}).join('');

const card = (i) => `<div style="border-radius:16px;border:1px solid rgba(255,255,255,0.08);background:linear-gradient(135deg,rgba(30,41,59,0.9),rgba(15,23,42,0.8));padding:20px;box-shadow:0 8px 16px rgba(0,0,0,0.3)">${i}</div>`;

const screen = `<div style="width:390px;background:#0B1220;border-radius:38px;padding:14px;font-family:system-ui;border:1px solid #1e293b">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 4px 14px">
    <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1)"></div>
    <div style="color:#fff;font:800 19px system-ui">Create Your Character</div>
    <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1)"></div>
  </div>
  <div style="display:flex;gap:6px;padding:0 4px 16px">
    ${[1,1,0,0].map((f)=>`<div style="flex:1;height:4px;border-radius:2px;background:${f?'#3B82F6':'rgba(255,255,255,0.12)'}"></div>`).join('')}
  </div>
  <div style="display:flex;flex-direction:column;gap:16px">
    ${card(`<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
      <div style="border-radius:96px;border:1px solid rgba(96,165,250,0.35);padding:5px;background:rgba(15,23,42,0.55)">${avatar(cfg, 'female', 18, 168)}</div>
      <div style="color:#fff;font:800 20px system-ui;margin-top:10px">Maya Okonkwo</div>
      <div style="color:#94A3B8;font:600 11px system-ui">Ages with you · passed to your children</div>
      <div style="display:flex;gap:10px;margin-top:10px">
        <div style="padding:9px 16px;border-radius:999px;background:rgba(59,130,246,0.28);border:1px solid rgba(96,165,250,0.85);color:#fff;font:800 12px system-ui">⚄ Randomize</div>
        <div style="padding:9px 16px;border-radius:999px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:#60A5FA;font:700 12px system-ui">⤫ New name</div>
      </div></div>`)}
    ${card(`<div style="color:#fff;font:800 19px system-ui;margin-bottom:12px">Appearance</div>
      <div style="display:flex;gap:6px;overflow:hidden;margin-bottom:14px">${chips}</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px">${swatches}</div>`)}
    ${card(`<div style="color:#fff;font:800 19px system-ui;margin-bottom:12px">Identity</div>
      <div style="color:#94A3B8;font:600 11px system-ui;margin-bottom:6px">First Name</div>
      <div style="border-radius:10px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.06);padding:12px;color:#fff;font:600 14px system-ui;margin-bottom:12px">Maya</div>
      <div style="color:#94A3B8;font:700 11px system-ui;letter-spacing:0.4px;margin-bottom:8px">SEX</div>
      <div style="display:flex;gap:10px">
        <div style="flex:1;text-align:center;padding:11px;border-radius:999px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#CBD5E1;font:700 12px system-ui">Male</div>
        <div style="flex:1;text-align:center;padding:11px;border-radius:999px;background:rgba(59,130,246,0.18);border:1px solid rgba(96,165,250,0.85);color:#fff;font:700 12px system-ui">Female</div>
      </div>`)}
    <div style="padding:16px;border-radius:999px;background:linear-gradient(90deg,#3B82F6,#2563EB);color:#fff;font:800 15px system-ui;text-align:center">▶  Continue To Ambitions</div>
  </div></div>`;

mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 480, height: 1250 }, deviceScaleFactor: 2 });
await p.setContent(`<html><body style="margin:0;padding:24px;background:#070C15">${screen}</body></html>`);
await p.screenshot({ path: resolve(OUT, 'onboarding-customize-v2.png'), fullPage: true });
await b.close();
console.log('wrote screenshots/onboarding-customize-v2.png');
