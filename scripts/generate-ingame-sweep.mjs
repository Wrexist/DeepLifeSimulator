/**
 * In-game slate-glass cleanup — before/after of two representative surfaces:
 * the CareerPathCard (Work screen) and the Settings switches. BEFORE = gray-600
 * elements / flat cards / bright light track; AFTER = slate + real elevation +
 * slate track. Faithful to the committed changes.
 *   node scripts/generate-ingame-sweep.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, legendItem, renderToPng } from './lib/phoneFrame.mjs';

const svg = (p, c, s = 16, sw = 2, f = 'none') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  check: '<path d="M20 6L9 17l-5-5"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  brief: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>', vol: '<path d="M11 5 6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
};

// ── CareerPathCard ──
function careerCard(t) {
  // t: { name, dotDefault, dotLocked, track, connector, labelText, lockedText, cardShadow }
  const levels = [
    ['1', 'Junior', 'done'], ['2', 'Assoc.', 'done'], ['3', 'Mid', 'current'], ['4', 'Senior', 'locked'], ['5', 'Lead', 'locked'],
  ];
  const node = ([n, name, state]) => {
    const bg = state === 'done' ? '#10B981' : state === 'current' ? '#3B82F6' : t.dotLocked;
    const border = state === 'current' ? 'border:2px solid #60A5FA;' : state === 'locked' ? `border:1px solid ${t.dotLocked};` : '';
    const nameCol = state === 'current' ? '#60A5FA' : state === 'locked' ? t.lockedText : t.labelText;
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;position:relative;">
      <div style="width:26px;height:26px;border-radius:13px;background:${bg};${border}display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;">${state === 'done' ? svg(I.check, '#fff', 13, 3) : n}</div>
      <span style="color:${nameCol};font-size:9px;font-weight:${state === 'current' ? 700 : 500};">${name}</span></div>`;
  };
  const connectors = levels.slice(1).map(() => `<div style="flex:1;height:2px;background:${t.connector};margin:0 -6px;margin-top:13px;"></div>`);
  const row = levels.map((l, i) => `${node(l)}${i < connectors.length ? connectors[i] : ''}`).join('');
  return `<div style="border-radius:16px;background:#1E293B;padding:15px;${t.cardShadow}">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
      <div style="width:36px;height:36px;border-radius:10px;background:rgba(96,165,250,0.15);border:1px solid rgba(96,165,250,0.3);display:flex;align-items:center;justify-content:center;">${svg(I.brief, '#60A5FA', 18)}</div>
      <div style="flex:1;"><div style="color:#F8FAFC;font-size:15px;font-weight:800;">Software Engineer</div><div style="color:${t.labelText};font-size:11px;margin-top:1px;">Mid Level · Tech</div></div>
    </div>
    <div style="margin-bottom:14px;">
      <div style="color:${t.labelText};font-size:11px;margin-bottom:5px;">Level 3 of 5</div>
      <div style="display:flex;align-items:center;gap:8px;"><div style="flex:1;height:6px;border-radius:3px;background:${t.track};overflow:hidden;"><div style="width:60%;height:100%;background:#3B82F6;border-radius:3px;"></div></div><span style="color:${t.labelText};font-size:11px;font-weight:600;">60%</span></div>
    </div>
    <div style="color:#94A3B8;font-size:10px;font-weight:700;letter-spacing:0.5px;margin-bottom:8px;">CAREER PATH</div>
    <div style="display:flex;align-items:flex-start;padding:0 4px;">${row}</div>
  </div>`;
}

// ── Settings switches ──
function settingsRows(t) {
  // t: { trackOff, iconOffA, iconOffB, cardShadow }
  const knob = (on) => `<div style="width:44px;height:26px;border-radius:13px;background:${on ? '#3B82F6' : t.trackOff};position:relative;"><div style="position:absolute;top:2px;${on ? 'right:2px' : 'left:2px'};width:22px;height:22px;border-radius:11px;background:#fff;"></div></div>`;
  const row = (icon, label, on, first) => `<div style="display:flex;align-items:center;gap:12px;padding:13px 14px;${first ? '' : 'border-top:1px solid rgba(255,255,255,0.06);'}">
    <div style="width:34px;height:34px;border-radius:10px;background:${on ? 'linear-gradient(135deg,#10B981,#059669)' : `linear-gradient(135deg,${t.iconOffA},${t.iconOffB})`};display:flex;align-items:center;justify-content:center;">${svg(icon, '#fff', 17)}</div>
    <span style="flex:1;color:#F1F5F9;font-size:13.5px;font-weight:600;">${label}</span>${knob(on)}</div>`;
  return `<div style="border-radius:16px;background:#1E293B;overflow:hidden;${t.cardShadow}">
    ${row(I.bell, 'Notifications', true, true)}${row(I.moon, 'Dark Mode', true)}${row(I.vol, 'Sound Effects', false)}${row(I.zap, 'Haptics', false)}</div>`;
}

const BEFORE = {
  dotLocked: '#4B5563', track: '#4B5563', connector: '#4B5563', labelText: '#D1D5DB', lockedText: '#6B7280',
  cardShadow: 'box-shadow:0 2px 4px rgba(0,0,0,0.25);',
  trackOff: '#E5E7EB', iconOffA: '#6B7280', iconOffB: '#4B5563',
};
const AFTER = {
  dotLocked: '#475569', track: '#475569', connector: '#475569', labelText: '#CBD5E1', lockedText: '#94A3B8',
  cardShadow: 'box-shadow:0 14px 30px -14px rgba(0,0,0,0.7);',
  trackOff: '#475569', iconOffA: '#94A3B8', iconOffB: '#475569',
};

function screen(t, title, body) {
  return `<div style="flex:1;background:${T.bg};position:relative;display:flex;flex-direction:column;padding:16px 15px;">
    <div style="color:#F8FAFC;font-size:18px;font-weight:800;margin-bottom:14px;">${title}</div>${body(t)}</div>`;
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'In-game sweep — off old grays, onto slate',
  subtitle: 'The cleanup pass in two representative surfaces. Left = before (gray-600 elements, flat cards, a bright light switch track). Right = after (slate, real elevation, slate track). Success-green, current-blue, and the light switch knob stay as they should.',
  body: `<div style="display:flex;flex-direction:column;gap:34px;margin-top:26px;align-items:center;">
      <div style="display:flex;justify-content:center;gap:40px;flex-wrap:wrap;">
        ${phone(screen(BEFORE, 'Career', careerCard), { caption: 'Career card · before', captionColor: '#94A3B8', w: 300, h: 400 })}
        ${phone(screen(AFTER, 'Career', careerCard), { caption: 'Career card · after', captionColor: '#60A5FA', w: 300, h: 400 })}
      </div>
      <div style="display:flex;justify-content:center;gap:40px;flex-wrap:wrap;">
        ${phone(screen(BEFORE, 'Settings', settingsRows), { caption: 'Settings · before', captionColor: '#94A3B8', w: 300, h: 400 })}
        ${phone(screen(AFTER, 'Settings', settingsRows), { caption: 'Settings · after', captionColor: '#60A5FA', w: 300, h: 400 })}
      </div>
    </div>
    <div style="display:flex;justify-content:center;gap:36px;margin-top:38px;flex-wrap:wrap;max-width:980px;margin-left:auto;margin-right:auto;">
      ${legendItem('#475569', 'Gray-600 → slate', 'Level dots, progress tracks, connectors, borders and the switch off-track move off Tailwind gray onto slate so nothing reads warm-gray against the slate app.')}
      ${legendItem('#3B82F6', 'Cards that float', 'Flat career/detail cards get the app\'s standard elevation; muted text moves to slate. Success-green (done), current-blue, and the light switch knob are kept intentionally.')}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'ingame-sweep.png'), 1040);
console.log('wrote ingame-sweep.png');
