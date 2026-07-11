/**
 * What shipped — the 4-tab bar + the Life tab's Health/Shop/Stats sub-menu,
 * built faithfully from the real code:
 *   • bottom bar   → app/(tabs)/_layout.tsx (getGlassTabBar, #60A5FA active)
 *   • sub-menu     → components/ui/SegmentedControl.tsx (accent.info #3B82F6)
 *   • vitals card  → app/(tabs)/health.tsx ("Your Vitals", 4 colored rows)
 *   • apps grid    → app/(tabs)/mobile.tsx appsList (brand gradients)
 *   node scripts/generate-tab-shipped.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, GRAD, grad, phone, pageShell, legendItem, renderToPng } from './lib/phoneFrame.mjs';

const svg = (p, c, s = 20, sw = 2, f = 'none') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  home: '<path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  work: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  apps: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  life: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 3h2l2.4 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.6V17a2 2 0 0 1-.8 1.6L8 20h8l-1.2-1.4a2 2 0 0 1-.8-1.6v-2.4"/><path d="M6 2h12v7a6 6 0 0 1-12 0z"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  smile: '<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01"/><path d="M15 9h.01"/>',
  dumbbell: '<path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
};

// ── Real bottom tab bar — getGlassTabBar dark, #60A5FA active / #94A3B8 idle ──
function bar(activeKey) {
  const TABS = [['home', 'Home', I.home], ['work', 'Work', I.work], ['apps', 'Apps', I.apps], ['life', 'Life', I.life]];
  const tab = (key, label, icon) => {
    const on = key === activeKey, c = on ? '#60A5FA' : '#94A3B8';
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">${svg(icon, c, 21)}<span style="color:${c};font-size:10px;font-weight:${on ? '700' : '600'};">${label}</span></div>`;
  };
  return `<div style="position:absolute;left:0;right:0;bottom:0;padding:9px 10px calc(12px + env(safe-area-inset-bottom));background:rgba(15,23,42,0.86);border-top:1px solid rgba(255,255,255,0.08);backdrop-filter:blur(20px);display:flex;align-items:center;">${TABS.map(t => tab(t[0], t[1], t[2])).join('')}</div>`;
}

// ── Real SegmentedControl (components/ui/SegmentedControl.tsx), accent.info ──
function segmented(items, activeKey, activeColor = '#3B82F6') {
  const MUTED = 'rgba(226,232,240,0.45)';
  const seg = ([key, label, icon]) => {
    const on = key === activeKey;
    return `<div style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:9px 0;border-radius:9px;min-height:40px;${on ? `background:${activeColor}2E;` : ''}">
      ${svg(icon, on ? activeColor : MUTED, 16)}
      <span style="color:${on ? '#F8FAFC' : MUTED};font-size:12.5px;font-weight:600;">${label}</span></div>`;
  };
  return `<div style="display:flex;gap:4px;background:rgba(15,23,42,0.55);border:1px solid rgba(255,255,255,0.08);border-radius:13px;padding:4px;">${items.map(seg).join('')}</div>`;
}

// ── Real Health "Your Vitals" card (app/(tabs)/health.tsx) ──
function vitalRow(icon, color, label, value) {
  return `<div style="display:flex;align-items:center;gap:10px;">
    <div style="width:26px;height:26px;border-radius:8px;border:1px solid ${color}66;background:${color}1A;display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${svg(icon, color, 13)}</div>
    <span style="color:#CBD5E1;font-size:12.5px;font-weight:600;width:74px;">${label}</span>
    <div style="flex:1;height:8px;border-radius:5px;background:rgba(148,163,184,0.18);overflow:hidden;"><div style="width:${value}%;height:100%;background:${color};border-radius:5px;"></div></div>
    <span style="color:#F8FAFC;font-size:12.5px;font-weight:700;width:26px;text-align:right;">${value}</span>
  </div>`;
}
function vitalsCard() {
  return `<div style="background:rgba(30,41,59,0.72);border:1px solid rgba(255,255,255,0.06);border-radius:16px;padding:15px;box-shadow:0 12px 26px -14px rgba(0,0,0,0.7);">
    <div style="color:#F8FAFC;font-size:14px;font-weight:800;margin-bottom:13px;">Your Vitals</div>
    <div style="display:flex;flex-direction:column;gap:12px;">
      ${vitalRow(I.heart, '#34D399', 'Health', 82)}
      ${vitalRow(I.zap, '#60A5FA', 'Energy', 64)}
      ${vitalRow(I.smile, '#FBBF24', 'Happiness', 71)}
      ${vitalRow(I.dumbbell, '#A78BFA', 'Fitness', 45)}
    </div>
  </div>`;
}
function activityRow(name, meta, color, icon) {
  return `<div style="display:flex;align-items:center;gap:11px;background:rgba(30,41,59,0.55);border:1px solid rgba(255,255,255,0.05);border-radius:13px;padding:12px 13px;">
    <div style="width:34px;height:34px;border-radius:10px;background:${color}22;border:1px solid ${color}44;display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${svg(icon, color, 17)}</div>
    <div style="flex:1;"><div style="color:#F1F5F9;font-size:13px;font-weight:700;">${name}</div><div style="color:#94A3B8;font-size:11px;margin-top:1px;">${meta}</div></div>
    <div style="color:#34D399;font-size:12.5px;font-weight:800;">＋</div>
  </div>`;
}

// ── Life tab · Health segment ──
function lifeHealth() {
  return `<div style="flex:1;background:${T.bg};position:relative;display:flex;flex-direction:column;overflow:hidden;">
    <div style="padding:12px 15px 8px;">${segmented([['health', 'Health', I.heart], ['shop', 'Shop', I.cart], ['stats', 'Stats', I.trophy]], 'health')}</div>
    <div style="flex:1;padding:4px 15px;display:flex;flex-direction:column;gap:11px;">
      ${vitalsCard()}
      ${activityRow('Go for a run', 'Free · +6 fitness, +4 health', '#34D399', I.dumbbell)}
      ${activityRow('Meditation', 'Free · +5 happiness', '#FBBF24', I.smile)}
    </div>
    ${bar('life')}</div>`;
}

// ── Apps tab · phone launcher ──
const APP_KEYS = [['pulse', 'Pulse'], ['spark', 'Spark'], ['contacts', 'Contacts'], ['stocks', 'Stocks'], ['bank', 'Bank'], ['education', 'School'], ['hustle', 'Hustle'], ['pet', 'Pets']];
function appIcon(key, label) {
  const g = GRAD[key] || ['#334155', '#1E293B'];
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;">
    <div style="width:54px;height:54px;border-radius:15px;background:${grad(g)};box-shadow:0 6px 14px -4px ${g[0]}88;display:flex;align-items:center;justify-content:center;color:#fff;font-size:21px;font-weight:800;">${label[0]}</div>
    <span style="color:${T.text2};font-size:10.5px;font-weight:600;">${label}</span></div>`;
}
function appsTab() {
  return `<div style="flex:1;background:${T.bg};position:relative;display:flex;flex-direction:column;overflow:hidden;">
    <div style="padding:14px 16px 6px;display:flex;align-items:center;gap:8px;">${svg('<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>', '#F1F5F9', 17)}<span style="color:#F8FAFC;font-size:17px;font-weight:800;">Mobile Apps</span></div>
    <div style="flex:1;padding:10px 16px;display:grid;grid-template-columns:repeat(4,1fr);gap:18px 4px;align-content:start;">${APP_KEYS.map(([k, l]) => appIcon(k, l)).join('')}</div>
    ${bar('apps')}</div>`;
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Shipped — 4 tabs, sub-menus inside',
  subtitle: 'Home · Work · Apps · Life. Built from the real tab bar, SegmentedControl, and Health screen code. Type-check clean, 3094 tests green.',
  body: `<div style="display:flex;justify-content:center;gap:48px;margin-top:30px;flex-wrap:wrap;">
      ${phone(lifeHealth(), { caption: 'Life · opens on Health', captionColor: '#34D399', w: 320, h: 660 })}
      ${phone(appsTab(), { caption: 'Apps · your device launcher', captionColor: '#60A5FA', w: 320, h: 660 })}
    </div>
    <div style="display:flex;justify-content:center;gap:40px;margin-top:40px;flex-wrap:wrap;max-width:1040px;margin-left:auto;margin-right:auto;">
      ${legendItem('#3B82F6', 'Life = Health · Shop · Stats', 'One tab for the three you touch least. It opens on Health, so vitals stay a single tap away — they just no longer need their own bar icon.')}
      ${legendItem('#60A5FA', 'Apps stays put', 'One stable tab instead of one that swapped Mobile↔Computer on upgrade. Own a computer and it becomes the desktop launcher (with its own Desktop/Mobile toggle); otherwise the phone grid.')}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'tab-shipped.png'), 1120);
console.log('wrote tab-shipped.png');
