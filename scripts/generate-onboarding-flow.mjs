/**
 * The complete New Game / onboarding flow — every screen, current state.
 * Main Menu → Scenarios → Create Identity → Perks → Save Slots.
 *   node scripts/generate-onboarding-flow.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { ROOT, T, phone, pageShell, renderToPng, faceURI } from './lib/phoneFrame.mjs';

const imgURI = (rel) => `data:image/png;base64,${readFileSync(resolve(ROOT, 'assets/images', rel)).toString('base64')}`;
const s = (p, c = '#F8FAFC', sz = 18, sw = 2, f = 'none') => `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  play: '<path d="M6 3l14 9-14 9V3z"/>', plus: '<path d="M12 5v14M5 12h14"/>', save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>', chev: '<path d="M9 18l6-6-6-6"/>',
  shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', star: '<path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/>',
  brain: '<path d="M9 3a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8V15a3 3 0 0 0 4 3M15 3a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8V15a3 3 0 0 1-4 3"/>', lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', check: '<path d="M20 6L9 17l-5-5"/>',
};
const card = (inner, m = '0 14px 12px') => `<div style="border-radius:16px;overflow:hidden;background:linear-gradient(135deg, rgba(30,41,59,0.9), rgba(15,23,42,0.9));border:1px solid rgba(255,255,255,0.1);padding:14px;box-shadow:0 8px 18px -6px rgba(0,0,0,0.5);margin:${m};">${inner}</div>`;
const label = (t) => `<div style="color:#94A3B8;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:7px;">${t}</div>`;
const header = (t, info = true) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:9px 14px 7px;">
  <div style="width:36px;height:36px;border-radius:11px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;">${s(I.back)}</div>
  <span style="color:#fff;font-size:17px;font-weight:900;">${t}</span>
  ${info ? `<div style="width:36px;height:36px;border-radius:11px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;">${s(I.info, '#94A3B8')}</div>` : '<div style="width:36px;"></div>'}</div>`;
const steps = (cur) => `<div style="display:flex;gap:6px;padding:2px 14px 8px;">${[1, 2, 3].map((n) => `<div style="flex:1;height:4px;border-radius:2px;background:${n <= cur ? 'rgba(59,130,246,0.9)' : 'rgba(255,255,255,0.14)'};"></div>`).join('')}</div>`;
const cta = (txt) => `<div style="margin:auto 14px 14px;background:linear-gradient(120deg,#60A5FA,#3B82F6,#2563EB);border-radius:16px;padding:14px;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 10px 22px -6px rgba(59,130,246,0.55);">${s(I.play, '#fff', 17)}<span style="color:#fff;font-size:15px;font-weight:800;">${txt}</span></div>`;
const tabs = (a, b, active) => `<div style="display:flex;gap:8px;padding:0 14px 12px;">
  ${[a, b].map((t) => `<div style="flex:1;text-align:center;padding:9px;border-radius:12px;font-size:13px;font-weight:800;color:${t === active ? '#fff' : '#94A3B8'};background:${t === active ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.04)'};border:1px solid ${t === active ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.08)'};">${t}</div>`).join('')}</div>`;

// ── 1 · Main Menu (bg image kept) ────────────────────────────────────────────
const menuBtn = (icon, title, sub, hi) => `<div style="display:flex;align-items:center;gap:12px;background:rgba(15,23,42,${hi ? 0.6 : 0.42});border:1px solid rgba(255,255,255,${hi ? 0.24 : 0.12});border-radius:16px;padding:12px 13px;">
  <div style="width:44px;height:44px;border-radius:22px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.14);display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${icon}</div>
  <div style="flex:1;"><div style="color:#fff;font-size:15px;font-weight:800;">${title}</div><div style="color:#CBD5E1;font-size:11px;margin-top:1px;">${sub}</div></div>${s(I.chev, '#CBD5E1', 18)}</div>`;
const mainMenu = () => `<div style="position:relative;flex:1;overflow:hidden;">
  <img src="${imgURI('Main_Menu.png')}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"/>
  <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(15,23,42,0.05) 40%, rgba(15,23,42,0.6));"></div>
  <div style="position:relative;display:flex;flex-direction:column;justify-content:flex-end;height:100%;padding:0 13px 14px;gap:10px;">
    ${menuBtn(s(I.play), 'Continue', 'Resume your last game', true)}
    ${menuBtn(s(I.plus), 'New Game', 'Start a new life', false)}
    ${menuBtn(s(I.save), 'Save Slots', 'Manage your saved games', false)}
    ${menuBtn(s(I.gear), 'Settings', 'Configure game options', false)}
    <div style="align-self:center;border:1px solid rgba(255,255,255,0.14);border-radius:999px;background:rgba(15,23,42,0.4);padding:6px 16px;color:#CBD5E1;font-size:11px;font-weight:600;margin-top:2px;">Saved progress detected</div>
  </div></div>`;

// ── 2 · Scenarios ────────────────────────────────────────────────────────────
const scenarioCard = (title, diff, diffC, age, cash, desc, sel) => card(`
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:7px;"><span style="color:#fff;font-size:15px;font-weight:800;">${title}</span>
    <span style="background:${diffC};color:#fff;font-size:9px;font-weight:800;border-radius:6px;padding:3px 7px;text-transform:uppercase;">${diff}</span></div>
  <div style="color:#94A3B8;font-size:11px;line-height:1.4;margin-bottom:9px;">${desc}</div>
  <div style="display:flex;gap:8px;"><span style="background:rgba(255,255,255,0.06);border-radius:8px;padding:4px 9px;color:#CBD5E1;font-size:10px;font-weight:700;">Age ${age}</span><span style="background:rgba(255,255,255,0.06);border-radius:8px;padding:4px 9px;color:#CBD5E1;font-size:10px;font-weight:700;">$${cash}</span></div>`,
  sel ? '0 14px 12px' : '0 14px 12px') .replace('rgba(255,255,255,0.1)', sel ? 'rgba(96,165,250,0.7)' : 'rgba(255,255,255,0.1)');
const scenarios = () => `<div style="flex:1;background:${T.bg};display:flex;flex-direction:column;overflow:hidden;">
  ${header('Choose Scenario')}${steps(1)}
  <div style="margin:0 14px 10px;background:rgba(59,130,246,0.16);border:1px solid rgba(59,130,246,0.4);border-radius:12px;padding:9px 12px;color:#60A5FA;font-size:11px;font-weight:700;">★ Recommended — a balanced start</div>
  ${tabs('Life Paths', 'Challenges', 'Life Paths')}
  ${scenarioCard('Highschool Dropout', 'Easy', '#10B981', 18, '500', 'Start with little and claw your way up from the bottom.', true)}
  ${scenarioCard('Corporate Intern', 'Moderate', '#F59E0B', 21, '500', 'A degree, a suit, and a foot in the corporate door.', false)}
  ${cta('Continue To Identity')}</div>`;

// ── 3 · Create Identity (restructured: sex first → face row) ──────────────────
const FACES = ['pool/f_ya_02.png', 'pool/f_ya_05.png', 'pool/f_ya_09.png', 'pool/f_ya_01.png'];
const faceChip = (n, sel) => `<div style="width:52px;height:52px;border-radius:26px;overflow:hidden;flex:0 0 auto;border:${sel ? '3px solid #60A5FA' : '2px solid rgba(255,255,255,0.14)'};"><img src="${faceURI(n)}" style="width:100%;height:100%;object-fit:cover;object-position:center top;"/></div>`;
const sexChip = (l, sel) => `<div style="flex:1;background:${sel ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.06)'};border:${sel ? '2px solid rgba(255,255,255,0.6)' : '1px solid rgba(255,255,255,0.1)'};border-radius:12px;padding:10px 4px;display:flex;flex-direction:column;align-items:center;gap:5px;"><div style="width:24px;height:24px;border-radius:7px;background:rgba(255,255,255,0.12);"></div><span style="color:#fff;font-size:11px;font-weight:700;">${l}</span></div>`;
const customize = () => `<div style="flex:1;background:${T.bg};display:flex;flex-direction:column;overflow:hidden;">
  ${header('Create Identity')}${steps(2)}
  ${card(`<div style="color:#fff;font-size:15px;font-weight:800;margin-bottom:11px;">Appearance</div>
    ${label('Sex')}<div style="display:flex;gap:8px;margin-bottom:13px;">${sexChip('Male', false)}${sexChip('Female', true)}${sexChip('Random', false)}</div>
    ${label('Choose your face — it ages with you')}<div style="display:flex;gap:9px;">${FACES.map((n, i) => faceChip(n, i === 0)).join('')}</div>`)}
  ${card(`<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;"><span style="color:#fff;font-size:15px;font-weight:800;">Name</span><span style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:999px;padding:5px 10px;">${s(I.shuffle, '#60A5FA', 13)}<span style="color:#60A5FA;font-size:10px;font-weight:700;">Shuffle</span></span></div>
    ${label('First Name')}<div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:10px;padding:10px 12px;color:#fff;font-size:13px;font-weight:600;">Ada Lovelace</div>`)}
  ${cta('Continue To Perks')}</div>`;

// ── 4 · Perks (shared header + floating button) ──────────────────────────────
const perkCard = (title, rarity, rc, desc, sel) => card(`
  <div style="display:flex;align-items:center;gap:11px;">
    <div style="width:42px;height:42px;border-radius:11px;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${s(I.star, '#60A5FA', 20)}</div>
    <div style="flex:1;"><div style="display:flex;align-items:center;gap:7px;"><span style="color:#fff;font-size:14px;font-weight:800;">${title}</span><span style="color:${rc};font-size:9px;font-weight:800;background:rgba(255,255,255,0.06);border-radius:5px;padding:2px 6px;">${rarity}</span></div>
      <div style="color:#94A3B8;font-size:10px;line-height:1.4;margin-top:3px;">${desc}</div></div>
    ${sel ? s(I.check, '#3B82F6', 22) : ''}</div>`).replace('rgba(255,255,255,0.1)', sel ? 'rgba(96,165,250,0.7)' : 'rgba(255,255,255,0.1)');
const perks = () => `<div style="flex:1;background:${T.bg};display:flex;flex-direction:column;overflow:hidden;">
  ${header('Choose Perks')}${steps(3)}
  ${tabs('Perks', 'Mindset', 'Perks')}
  ${perkCard('Fast Learner', 'Rare', '#3B82F6', 'Skills level up 25% faster across your life.', true)}
  ${perkCard('Iron Will', 'Rare', '#3B82F6', 'Stress and setbacks hit you softer.', false)}
  ${perkCard('Astute Planner', 'Epic', '#8B5CF6', 'Smarter money — better returns on investments.', false)}
  ${cta('Start Your Life')}</div>`;

// ── 5 · Save Slots ───────────────────────────────────────────────────────────
const slot = (n, filled, name, money, age, weeks) => card(filled
  ? `<div style="display:flex;align-items:center;gap:12px;"><div style="width:44px;height:44px;border-radius:12px;background:rgba(59,130,246,0.18);display:flex;align-items:center;justify-content:center;color:#60A5FA;font-size:17px;font-weight:900;flex:0 0 auto;">${n}</div>
      <div style="flex:1;"><div style="color:#fff;font-size:15px;font-weight:800;">${name}</div><div style="display:flex;gap:10px;margin-top:3px;"><span style="color:#94A3B8;font-size:10px;font-weight:700;">$${money}</span><span style="color:#94A3B8;font-size:10px;font-weight:700;">Age ${age}</span><span style="color:#94A3B8;font-size:10px;font-weight:700;">${weeks}w</span></div></div>${s(I.chev, '#CBD5E1', 18)}</div>`
  : `<div style="display:flex;align-items:center;gap:12px;"><div style="width:44px;height:44px;border-radius:12px;background:rgba(255,255,255,0.05);border:1px dashed rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;color:#64748B;font-size:17px;font-weight:900;flex:0 0 auto;">${n}</div><div style="flex:1;"><div style="color:#64748B;font-size:14px;font-weight:700;">Empty Slot</div><div style="color:#475569;font-size:10px;margin-top:2px;">Tap to start a new life here</div></div>${s(I.plus, '#64748B', 18)}</div>`);
const saveSlots = () => `<div style="flex:1;background:${T.bg};display:flex;flex-direction:column;overflow:hidden;">
  ${header('Save Slots', false)}
  <div style="color:#94A3B8;font-size:12px;text-align:center;padding:4px 20px 12px;">Pick a slot to continue, or start a fresh life.</div>
  ${slot(1, true, 'Ada Lovelace', '12,480', 24, 312)}
  ${slot(2, false)}
  ${slot(3, false)}
  ${cta('Continue Game')}</div>`;

const cap = (t) => ({ caption: t, captionColor: '#60A5FA', w: 300, h: 636 });
const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'The New Game flow — every screen',
  subtitle: 'Main Menu → Scenarios → Create Identity → Perks → Save Slots. Unified slate-glass, blue accent, shared header/step-bar/CTA components, and the new sex-first avatar picker wired to the scenario\'s starting age. The Main Menu keeps its background art; only its buttons were polished.',
  body: `<div style="display:flex;justify-content:center;gap:24px;flex-wrap:wrap;max-width:1240px;margin:30px auto 0;">
      ${phone(mainMenu(), cap('1 · Main Menu'))}
      ${phone(scenarios(), cap('2 · Scenarios'))}
      ${phone(customize(), cap('3 · Create Identity'))}
      ${phone(perks(), cap('4 · Perks'))}
      ${phone(saveSlots(), cap('5 · Save Slots'))}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'onboarding-flow.png'), 1320);
console.log('wrote onboarding-flow.png');
