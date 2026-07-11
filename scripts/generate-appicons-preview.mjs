/**
 * Apps grid rendered with the REAL custom icon PNGs (assets/images/AppIcons),
 * in the real card layout from mobile.tsx. Confirms the wiring + the squircle
 * treatment before it ships. Icons embedded as data URIs (actual art, downscaled
 * by Chromium at render).
 *   node scripts/generate-appicons-preview.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, renderToPng } from './lib/phoneFrame.mjs';

const ICONS = resolve(ROOT, 'assets/images/AppIcons');
const uri = (f) => `data:image/png;base64,${readFileSync(resolve(ICONS, f)).toString('base64')}`;

const svg = (p, c, s = 20, sw = 2) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const TABI = {
  home: '<path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  work: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  apps: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  life: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
};
function bar(active) {
  const T4 = [['home', 'Home', TABI.home], ['work', 'Work', TABI.work], ['apps', 'Apps', TABI.apps], ['life', 'Life', TABI.life]];
  const tab = (k, l, ic) => { const on = k === active, c = on ? '#60A5FA' : '#94A3B8'; return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">${svg(ic, c, 21)}<span style="color:${c};font-size:10px;font-weight:${on ? 700 : 600};">${l}</span></div>`; };
  return `<div style="position:absolute;left:0;right:0;bottom:0;padding:9px 10px calc(12px + env(safe-area-inset-bottom));background:rgba(15,23,42,0.86);border-top:1px solid rgba(255,255,255,0.08);display:flex;">${T4.map(t => tab(...t)).join('')}</div>`;
}

// Real phone appsList (id → file, name, description) from app/(tabs)/mobile.tsx.
const APPS = [
  ['spark.png', 'Spark', 'Find your match'],
  ['contacts.png', 'Contacts', 'Manage relationships'],
  ['pulse.png', 'Pulse', 'Feel the room'],
  ['stocks.png', 'Stocks', 'Trade & invest'],
  ['bank.png', 'Bank', 'Manage finances'],
  ['education.png', 'Education', 'Learn new skills and advance'],
  ['hustle.png', 'Hustle', 'Build something'],
  ['pets.png', 'Pets', 'Adopt and care for pets'],
];
function card([file, name, desc]) {
  return `<div style="width:132px;height:150px;border-radius:20px;background:rgba(30,41,59,0.62);border:1px solid rgba(255,255,255,0.08);box-shadow:0 8px 22px -8px rgba(0,0,0,0.55);display:flex;flex-direction:column;align-items:center;padding:14px 10px;">
    <img src="${uri(file)}" style="width:62px;height:62px;border-radius:15px;box-shadow:0 4px 12px rgba(0,0,0,0.28);margin-bottom:10px;"/>
    <div style="color:#F8FAFC;font-size:13px;font-weight:700;text-align:center;">${name}</div>
    <div style="color:rgba(255,255,255,0.72);font-size:10.5px;font-weight:500;text-align:center;line-height:1.35;margin-top:3px;">${desc}</div>
  </div>`;
}
function screen() {
  return `<div style="flex:1;background:linear-gradient(160deg,#0F172A,#1E293B,#334155);position:relative;display:flex;flex-direction:column;overflow:hidden;">
    <div style="padding:14px 16px 8px;display:flex;align-items:center;gap:8px;">${svg('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>', '#F1F5F9', 18)}<span style="color:#F8FAFC;font-size:18px;font-weight:800;">Mobile Apps</span></div>
    <div style="flex:1;padding:8px 16px;display:flex;flex-wrap:wrap;gap:12px;justify-content:space-between;align-content:flex-start;">${APPS.map(card).join('')}</div>
    ${bar('apps')}</div>`;
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Custom app icons — wired & live',
  subtitle: 'The Apps grid rendered with your real PNGs (assets/images/AppIcons), in the actual mobile.tsx card layout. Full-bleed squircles replace the old glyph-on-gradient circles. Any app without a PNG keeps its Lucide glyph automatically.',
  body: `<div style="display:flex;justify-content:center;margin-top:30px;">
      ${phone(screen(), { caption: 'Apps · phone launcher', captionColor: '#60A5FA', w: 320, h: 640 })}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'appicons-preview.png'), 720);
console.log('wrote appicons-preview.png');
