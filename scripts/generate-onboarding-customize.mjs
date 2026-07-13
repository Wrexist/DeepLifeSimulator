/**
 * Character creation with the new avatar picker (real pool faces). Shows the
 * Customize screen: pick the face you start life with, then name/sex.
 *   node scripts/generate-onboarding-customize.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, legendItem, renderToPng, faceURI } from './lib/phoneFrame.mjs';

const svg = (p, c = '#F8FAFC', s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  back: '<path d="M15 18l-6-6 6-6"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', play: '<path d="M6 3l14 9-14 9V3z"/>',
};

const card = (inner) => `<div style="border-radius:16px;overflow:hidden;background:linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9));border:1px solid rgba(255,255,255,0.1);padding:15px;box-shadow:0 8px 18px -6px rgba(0,0,0,0.5);margin:0 14px 12px;">${inner}</div>`;

const SELECTED = 'pool/f_ya_02.png';
const STRIP = ['pool/f_ya_02.png', 'pool/m_ya_04.png', 'pool/f_ya_05.png', 'pool/m_ya_01.png', 'pool/f_ya_09.png', 'pool/m_ya_07.png'];
const faceChip = (name, sel) => `<div style="width:52px;height:52px;border-radius:26px;overflow:hidden;flex:0 0 auto;border:2px solid ${sel ? '#60A5FA' : 'rgba(255,255,255,0.14)'};"><img src="${faceURI(name)}" style="width:100%;height:100%;object-fit:cover;object-position:center top;"/></div>`;

const input = (label, val) => `<div style="color:#94A3B8;font-size:11px;font-weight:600;margin-bottom:5px;">${label}</div><div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:11px 12px;color:#fff;font-size:14px;font-weight:600;margin-bottom:10px;">${val}</div>`;

const sexCard = (label, sel) => `<div style="flex:1;background:${sel ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)'};border:${sel ? '2px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.1)'};border-radius:14px;padding:12px 6px;display:flex;flex-direction:column;align-items:center;gap:6px;">
  <div style="width:30px;height:30px;border-radius:8px;background:rgba(255,255,255,0.12);"></div>
  <span style="color:#fff;font-size:12px;font-weight:700;">${label}</span></div>`;

const screen = () => `<div style="flex:1;background:${T.bg};display:flex;flex-direction:column;overflow:hidden;">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 15px 8px;">
    <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;">${svg(I.back)}</div>
    <span style="color:#fff;font-size:18px;font-weight:900;">Create Identity</span>
    <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;">${svg(I.info, '#94A3B8')}</div>
  </div>
  <div style="display:flex;gap:6px;padding:4px 15px 8px;">
    <div style="flex:1;height:4px;border-radius:2px;background:rgba(59,130,246,0.9);"></div>
    <div style="flex:1;height:4px;border-radius:2px;background:rgba(59,130,246,0.9);"></div>
    <div style="flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,0.14);"></div>
  </div>
  <div style="color:#94A3B8;font-size:12px;text-align:center;padding:0 20px 10px;">Name, sex, and sexuality only shape your story — not difficulty.</div>
  ${card(`
    <div style="color:#fff;font-size:16px;font-weight:800;margin-bottom:12px;">Appearance</div>
    <div style="display:flex;align-items:center;gap:14px;margin-bottom:13px;">
      <div style="width:78px;height:78px;border-radius:39px;overflow:hidden;border:2px solid #60A5FA;flex:0 0 auto;box-shadow:0 6px 16px -4px rgba(96,165,250,0.5);"><img src="${faceURI(SELECTED)}" style="width:100%;height:100%;object-fit:cover;object-position:center top;"/></div>
      <div style="flex:1;color:#94A3B8;font-size:12px;line-height:1.5;">Choose the face you'll start life with. It ages with you as the years pass.</div>
    </div>
    <div style="display:flex;gap:10px;">${STRIP.map((n, i) => faceChip(n, i === 0)).join('')}</div>
  `)}
  ${card(`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><span style="color:#fff;font-size:16px;font-weight:800;">Name</span>
      <span style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:999px;padding:6px 11px;">${svg(I.shuffle, '#60A5FA', 14)}<span style="color:#60A5FA;font-size:11px;font-weight:700;">Shuffle</span></span></div>
    ${input('First Name', 'Ada')}${input('Last Name', 'Lovelace')}
  `)}
  ${card(`
    <div style="color:#fff;font-size:16px;font-weight:800;margin-bottom:12px;">Sex</div>
    <div style="display:flex;gap:10px;">${sexCard('Male', false)}${sexCard('Female', true)}${sexCard('Random', false)}</div>
  `)}
  <div style="margin:6px 14px 14px;background:linear-gradient(120deg,#60A5FA,#3B82F6,#2563EB);border-radius:16px;padding:15px;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 10px 22px -6px rgba(59,130,246,0.55);">
    ${svg(I.play, '#fff', 18)}<span style="color:#fff;font-size:15px;font-weight:800;">Continue To Perks</span></div>
</div>`;

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Character creation — now with avatar selection',
  subtitle: 'The New Game flow now lets the player pick the face they start life with, from the real 3D portrait pool. The pick is stored on the profile and ages with the character (kid → adult → senior), and drives their face everywhere — Identity card, Spark, Prestige.',
  body: `<div style="display:flex;justify-content:center;margin-top:26px;">
      ${phone(screen(), { caption: 'New Game · Create Identity', captionColor: '#60A5FA', h: 720 })}
    </div>
    <div style="display:flex;justify-content:center;gap:34px;margin-top:34px;flex-wrap:wrap;max-width:1000px;margin-left:auto;margin-right:auto;">
      ${legendItem('#60A5FA', 'Pick your starting face', 'A new Appearance section shows a scrollable strip of young-adult faces for the chosen sex (a mix for "random"). Tap to select; a picking a face also settles a "random" sex so appearance and gameplay agree.')}
      ${legendItem('#34D399', 'It ages with you', 'The choice is saved as a compact id on the profile and resolves age-aware through utils/facePool, so your character keeps a consistent look as the years pass — and shows up as your face across the whole game.')}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'onboarding-customize.png'), 1080);
console.log('wrote onboarding-customize.png');
