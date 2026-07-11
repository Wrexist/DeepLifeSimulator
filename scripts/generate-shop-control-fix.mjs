/**
 * Shop sub-menu — before/after the "two stacked bars" fix.
 * Before: Life's Health/Shop/Stats and Market's Items/Food/Gym rendered as two
 * identical full-weight SegmentedControls. After: the inner Market control uses
 * the new `compact` variant so it reads as subordinate.
 *   node scripts/generate-shop-control-fix.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, legendItem, renderToPng } from './lib/phoneFrame.mjs';

const svg = (p, c, s = 16, sw = 2, f = 'none') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 3h2l2.4 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.6V17a2 2 0 0 1-.8 1.6L8 20h8l-1.2-1.4a2 2 0 0 1-.8-1.6v-2.4"/><path d="M6 2h12v7a6 6 0 0 1-12 0z"/>',
  bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  apple: '<path d="M12 20.9c1.5 0 2.5-1 4-1 .8 0 2.5.4 3-1.5-3-1-3-6 0-7-1.2-1.6-3-1.5-4-1-1 .5-2 .5-3 0-1-.5-2.8-.6-4 1-1.5 2-1.5 6.5 0 8.5 1 1.4 2.5 2 4 1.5z"/>',
  dumbbell: '<path d="m6.5 6.5 11 11"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/>',
};
const MUTED = 'rgba(226,232,240,0.45)';

// activeColor: Life = #3B82F6 (accent.info). Full vs compact match the RN styles.
function segmented(items, active, { compact = false, activeColor = '#3B82F6' } = {}) {
  const seg = ([key, label, icon]) => {
    const on = key === active;
    const pad = compact ? '6px 0' : '8px 0';
    const minH = compact ? 32 : 40;
    const fs = compact ? 11.5 : 12.5;
    const isz = compact ? 14 : 16;
    return `<div style="flex:1;display:flex;align-items:center;justify-content:center;gap:${compact ? 5 : 6}px;padding:${pad};min-height:${minH}px;border-radius:9px;${on ? `background:${activeColor}2E;` : ''}">
      ${svg(icon, on ? activeColor : MUTED, isz)}<span style="color:${on ? '#F8FAFC' : MUTED};font-size:${fs}px;font-weight:600;">${label}</span></div>`;
  };
  const cbg = compact ? 'rgba(15,23,42,0.32)' : 'rgba(15,23,42,0.55)';
  const cborder = compact ? 'transparent' : 'rgba(255,255,255,0.08)';
  const cpad = compact ? 3 : 4, cgap = compact ? 3 : 4;
  return `<div style="display:flex;gap:${cgap}px;background:${cbg};border:1px solid ${cborder};border-radius:${compact ? 11 : 13}px;padding:${cpad}px;">${items.map(seg).join('')}</div>`;
}

const LIFE = [['health', 'Health', I.heart], ['shop', 'Shop', I.cart], ['stats', 'Stats', I.trophy]];
const MARKET = [['items', 'Items', I.bag], ['food', 'Food', I.apple], ['gym', 'Gym', I.dumbbell]];

function itemHint() {
  return `<div style="margin-top:14px;display:flex;flex-direction:column;gap:9px;opacity:0.62;">
    ${['Smartphone', 'Laptop', 'Watch'].map((n, i) => `<div style="display:flex;align-items:center;gap:11px;background:rgba(30,41,59,0.5);border:1px solid rgba(255,255,255,0.05);border-radius:13px;padding:11px 12px;">
      <div style="width:34px;height:34px;border-radius:9px;background:rgba(96,165,250,0.18);border:1px solid rgba(96,165,250,0.3);"></div>
      <div style="flex:1;"><div style="color:#E2E8F0;font-size:12.5px;font-weight:700;">${n}</div><div style="color:#94A3B8;font-size:10.5px;margin-top:2px;">$${[499, 1299, 399][i]}</div></div>
      <div style="color:#60A5FA;font-size:11px;font-weight:800;">Buy</div></div>`).join('')}
  </div>`;
}

function screen(compact) {
  return `<div style="flex:1;background:${T.bg};display:flex;flex-direction:column;padding:14px 15px;">
    <div>${segmented(LIFE, 'shop')}</div>
    <div style="margin-top:${compact ? 6 : 12}px;">${segmented(MARKET, 'items', { compact })}</div>
    ${itemHint()}
  </div>`;
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Life · Shop — one less stacked bar',
  subtitle: 'The Shop segment nests Market’s Items/Food/Gym under Life’s Health/Shop/Stats. The inner control now uses a compact, subordinate weight so the two levels read as a hierarchy — not two identical bars.',
  body: `<div style="display:flex;justify-content:center;gap:48px;margin-top:30px;flex-wrap:wrap;">
      ${phone(screen(false), { caption: 'Before · two equal bars', captionColor: '#F87171', w: 300, h: 560 })}
      ${phone(screen(true), { caption: 'After · primary + subordinate', captionColor: '#34D399', w: 300, h: 560 })}
    </div>
    <div style="display:flex;justify-content:center;margin-top:38px;max-width:640px;margin-left:auto;margin-right:auto;">
      ${legendItem('#34D399', 'Compact variant', 'Flatter fill, no rim, shorter tabs, smaller text — a new `compact` prop on the shared SegmentedControl. Only the nested Market control uses it; every other segmented control is unchanged.')}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'shop-control-fix.png'), 940);
console.log('wrote shop-control-fix.png');
