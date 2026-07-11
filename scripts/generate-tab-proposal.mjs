/**
 * Tab-menu proposal — 7 noisy tabs → 4 minimalist tabs with segmented sub-menus.
 * Shows the current bar vs the proposed bar + an example merged tab ("Apps").
 *   node scripts/generate-tab-proposal.mjs
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
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.6V17a2 2 0 0 1-.8 1.6L8 20h8l-1.2-1.4a2 2 0 0 1-.8-1.6v-2.4"/><path d="M6 2h12v7a6 6 0 0 1-12 0z"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 3h2l2.4 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
};
function bar(tabs) {
  const tab = (icon, label, active) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;">${svg(icon, active ? '#60A5FA' : '#94A3B8', 20)}<span style="color:${active ? '#60A5FA' : '#94A3B8'};font-size:9px;font-weight:${active ? '700' : '600'};">${label}</span></div>`;
  return `<div style="position:absolute;left:6px;right:6px;bottom:7px;height:56px;background:rgba(15,23,42,0.9);border:1px solid rgba(255,255,255,0.1);border-radius:22px;display:flex;align-items:center;padding:0 4px;box-shadow:0 -3px 18px rgba(0,0,0,0.45);">${tabs.map(t => tab(t[0], t[1], t[2])).join('')}</div>`;
}
const CUR = [[I.home, 'Home', true], [I.work, 'Work', false], [I.phone, 'Mobile', false], [I.cart, 'Market', false], [I.heart, 'Health', false]];
const NEW = [[I.home, 'Home', false], [I.work, 'Work', false], [I.apps, 'Apps', true], [I.life, 'Life', false]];

const APP_KEYS = [['pulse', 'Pulse'], ['spark', 'Spark'], ['contacts', 'Contacts'], ['stocks', 'Stocks'], ['bank', 'Bank'], ['education', 'School'], ['hustle', 'Hustle'], ['pet', 'Pets']];
function appIcon(key, label) {
  const g = GRAD[key] || ['#334155', '#1E293B'];
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:5px;">
    <div style="width:52px;height:52px;border-radius:14px;background:${grad(g)};box-shadow:0 6px 14px -4px ${g[0]}88;display:flex;align-items:center;justify-content:center;color:#fff;font-size:20px;font-weight:800;">${label[0]}</div>
    <span style="color:${T.text2};font-size:10px;font-weight:600;">${label}</span></div>`;
}
function seg(a, b, active) {
  const item = (label, on) => `<div style="flex:1;text-align:center;padding:7px 0;border-radius:9px;background:${on ? 'rgba(96,165,250,0.9)' : 'transparent'};color:${on ? '#fff' : T.muted};font-size:12px;font-weight:700;">${label}</div>`;
  return `<div style="display:flex;gap:3px;background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:3px;">${item(a, active === a)}${item(b, active === b)}</div>`;
}
function current() {
  return `<div style="flex:1;background:${T.bg};position:relative;display:flex;align-items:center;justify-content:center;padding:20px;">
    <div style="text-align:center;color:${T.muted};font-size:13px;line-height:1.6;">Up to 5 tabs — Home, Work,<br>Mobile (or Computer),<br>Market, Health<br><br><span style="color:${T.danger};font-weight:700;">The device tab morphs<br>Mobile ↔ Computer</span></div>
    ${bar(CUR)}</div>`;
}
function proposed() {
  return `<div style="flex:1;background:${T.bg};position:relative;display:flex;flex-direction:column;overflow:hidden;">
    <div style="padding:14px 15px 8px;"><div style="color:${T.text};font-size:20px;font-weight:800;">Apps</div><div style="color:${T.muted};font-size:11px;margin-top:1px;">Your phone &amp; computer</div></div>
    <div style="padding:0 15px 12px;">${seg('Phone', 'Computer', 'Phone')}</div>
    <div style="flex:1;padding:4px 15px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px 4px;align-content:start;">${APP_KEYS.map(([k, l]) => appIcon(k, l)).join('')}</div>
    ${bar(NEW)}</div>`;
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'A calmer tab bar — 5 → 4',
  subtitle: 'The device tab (Mobile/Computer) and the personal tabs get merged, each with a segmented sub-menu. Progress already lives on Home. Proposal — confirm the grouping and I\'ll build it.',
  body: `<div style="display:flex;justify-content:center;gap:46px;margin-top:30px;flex-wrap:wrap;">
      ${phone(current(), { caption: 'Now · up to 5 tabs', captionColor: '#94A3B8', w: 300, h: 600 })}
      ${phone(proposed(), { caption: 'Proposed · 4 tabs + sub-menu', captionColor: '#34D399', w: 300, h: 600 })}
    </div>
    <div style="display:flex;justify-content:center;gap:40px;margin-top:40px;flex-wrap:wrap;max-width:1020px;margin-left:auto;margin-right:auto;">
      ${legendItem('#60A5FA', 'Apps = Mobile + Computer', 'One steady tab for your device, with a Phone / Computer toggle. Today the tab morphs Mobile↔Computer as you upgrade — this keeps it stable.')}
      ${legendItem('#34D399', 'Life = Health + Market + Stats', 'Your person in one place — a Health / Shop / Stats sub-menu. Home and Work stay their own tabs since you touch them most.')}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'tab-proposal.png'), 1080);
console.log('wrote tab-proposal.png');
