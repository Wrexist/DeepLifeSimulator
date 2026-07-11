/**
 * generate-computer-suite-preview.mjs
 *
 * One gallery: all 10 computer apps in their Slate Glass after-state —
 * same recipes, ten identity accents. Faithful to flat-fill fallback.
 *
 *   node scripts/generate-computer-suite-preview.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, renderToPng } from './lib/phoneFrame.mjs';

const tnum = 'font-variant-numeric:tabular-nums;';
const L1 = `background:${T.surface};border:1px solid ${T.border};border-radius:14px;box-shadow:0 3px 14px rgba(0,0,0,0.28);`;
const L2 = `background:${T.surface};border:1px solid rgba(255,255,255,0.15);border-radius:18px;box-shadow:0 6px 14px rgba(0,0,0,0.30);`;
const icon = (stroke, path, size = 16, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${sw}">${path}</svg>`;

const APPS = [
  { name: 'YouVideo', accent: '#8B5CF6', rgb: '139,92,246', eyebrow: 'CHANNEL', value: '48.2K', sub: 'subscribers · 1.2M views',
    glyph: '<polygon points="10,8 16,12 10,16"/><rect x="3" y="5" width="18" height="14" rx="3"/>', row: 'Unboxing my new rig · 12K views', row2: 'Monetization: $86/wk' },
  { name: 'Streamly', accent: '#D946EF', rgb: '217,70,239', eyebrow: 'CHANNEL', value: '3,940', sub: 'followers · 212 subs',
    glyph: '<path d="M4 5h16v10H9l-3 3v-3H4z"/>', row: 'Best stream: 1.4K viewers', row2: 'Go live · Just Chatting' },
  { name: 'Travel', accent: '#14B8A6', rgb: '20,184,166', eyebrow: 'NEXT TRIP', value: 'Tokyo', sub: 'departs week 214 · $2,400',
    glyph: '<path d="M17.8 19.2L16 11l3.5-3.5c.8-.8.8-2 0-2.8s-2-.8-2.8 0L13.2 8 5 6.2l-1.5 1.5 7 3.5-3.5 3.5-2.5-.5L3 15.7l3 1.5 1.5 3 1.5-1.5-.5-2.5 3.5-3.5 3.5 7z"/>', row: 'Paris · visited w180', row2: 'Business: Harbor Hostel $210/wk' },
  { name: 'Real Estate', accent: '#10B981', rgb: '16,185,129', eyebrow: 'PORTFOLIO', value: '$412,000', sub: '+$1,850/wk rental income',
    glyph: '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>', row: '12 Oak Lane · rented · $950/wk', row2: 'Downtown Loft · listed $210k' },
  { name: 'CryptoMine', accent: '#F59E0B', rgb: '245,158,11', eyebrow: 'WALLET', value: '0.842 BTC', sub: '≈ $36,180 · 3 rigs hashing',
    glyph: '<path d="M9 6h5a3 3 0 0 1 0 6H9zM9 12h6a3 3 0 0 1 0 6H9zM9 4v16M12 2v2M12 20v2"/>', row: 'Rig A · 62 MH/s · OK', row2: 'BTC +2.4% this week' },
  { name: 'Politics', accent: '#60A5FA', rgb: '96,165,250', eyebrow: 'INFLUENCE', value: '61', sub: 'approval 54% · 2 lobbyists',
    glyph: '<path d="M9 12l2 2 4-5"/><rect x="4" y="4" width="16" height="16" rx="2"/>', row: 'City Council · seat held', row2: 'Bill: Transit Levy · vote w206' },
  { name: 'Statistics', accent: '#3B82F6', rgb: '59,130,246', eyebrow: 'NET WORTH', value: '$186,400', sub: 'age 34 · week 204',
    glyph: '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>', row: 'Happiness trend ↑ 4 wks', row2: 'Career: Senior Dev · $1.9k/wk' },
  { name: 'AutoTrader', accent: '#F97316', rgb: '249,115,22', eyebrow: 'GARAGE', value: 'Model S', sub: 'condition 82 · insured',
    glyph: '<path d="M5 16l1.5-5h11L19 16"/><rect x="3" y="16" width="18" height="4" rx="1"/><circle cx="7" cy="20" r="1.6"/><circle cx="17" cy="20" r="1.6"/>', row: 'Dealership: 3 offers', row2: 'Insurance renews w210 · $45' },
  { name: 'Onion', accent: '#A855F7', rgb: '168,85,247', eyebrow: 'MARKET', value: 'Hidden', sub: 'anonymity 74 · heat low',
    glyph: '<path d="M12 2l8 3v6c0 5-3.5 8-8 11-4.5-3-8-6-8-11V5z"/>', row: 'Vendor Silkroad_Vex · 4.7★', row2: 'Job board: 2 gigs open' },
  { name: 'Bank Pro', accent: '#3B82F6', rgb: '59,130,246', eyebrow: 'OVERVIEW', value: '$3,270', sub: 'net position · score 650',
    glyph: '<path d="M3 10h18M5 10V8l7-5 7 5v2M6 10v8M12 10v8M18 10v8M4 18h16v3H4z"/>', row: 'Everyday Checking · $1,200', row2: 'CD 12wk · locked · $800' },
];

function miniApp(a) {
  const bub = (size, glyph) => `<div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:rgba(${a.rgb},0.15);border:1px solid rgba(${a.rgb},0.30);display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${glyph}</div>`;
  return `
  <div style="display:flex;align-items:center;padding:6px 12px;flex:0 0 auto;">
    <div style="width:30px;color:${T.text};font-size:18px;">‹</div>
    <div style="flex:1;color:${T.text};font-size:13px;font-weight:700;">${a.name}</div>
    <div style="background:rgba(${a.rgb},0.14);border:1px solid rgba(${a.rgb},0.30);border-radius:999px;padding:3px 7px;color:${T.text};font-size:9px;font-weight:700;${tnum}">$12.3k</div>
  </div>
  <div style="flex:1;overflow:hidden;padding:10px 12px;display:flex;flex-direction:column;gap:9px;">
    <div style="${L2}position:relative;">
      <div style="position:relative;border-radius:18px;overflow:hidden;padding:13px;">
        <div style="position:absolute;inset:0;background:rgba(${a.rgb},0.14);"></div>
        <div style="position:absolute;top:-40px;right:-30px;width:110px;height:110px;border-radius:55px;background:rgba(${a.rgb},0.10);"></div>
        <div style="position:absolute;top:0;left:0;right:0;height:1px;background:rgba(255,255,255,0.08);"></div>
        <div style="position:relative;">
          <div style="color:${T.muted};font-size:8px;font-weight:700;letter-spacing:1.1px;">${a.eyebrow}</div>
          <div style="display:flex;align-items:center;gap:9px;margin-top:6px;">
            ${bub(34, icon(a.accent, a.glyph, 16))}
            <div><div style="color:${T.text};font-size:17px;font-weight:800;${tnum}">${a.value}</div>
            <div style="color:${T.text2};font-size:8.5px;margin-top:1px;">${a.sub}</div></div>
          </div>
        </div>
      </div>
    </div>
    <div style="${L1}padding:10px 12px;display:flex;align-items:center;gap:9px;">
      ${bub(28, icon(a.accent, a.glyph, 13))}
      <div style="color:${T.text};font-size:10px;font-weight:600;flex:1;">${a.row}</div>
      <span style="color:${T.muted};font-size:12px;">›</span>
    </div>
    <div style="${L1}padding:10px 12px;display:flex;align-items:center;gap:9px;">
      ${bub(28, icon(a.accent, a.glyph, 13))}
      <div style="color:${T.text};font-size:10px;font-weight:600;flex:1;">${a.row2}</div>
      <span style="color:${T.muted};font-size:12px;">›</span>
    </div>
  </div>`;
}

const chipRow = APPS.map((a) => `<span style="display:inline-flex;align-items:center;gap:6px;background:rgba(${a.rgb},0.14);border:1px solid rgba(${a.rgb},0.30);border-radius:999px;padding:5px 12px;color:${T.text};font-size:12px;font-weight:600;"><span style="width:8px;height:8px;border-radius:4px;background:${a.accent};"></span>${a.name}</span>`).join('');

const row = (apps) => `<div style="display:flex;justify-content:center;gap:34px;margin-top:30px;">
  ${apps.map((a) => phone(miniApp(a), { w: 240, h: 470 })).join('')}
</div>`;

const html = pageShell({
  title: 'The computer suite — one system, ten identities',
  subtitle: 'Every desktop app rebuilt on the same Slate Glass recipes: one hero, glass cards, tinted chrome, an always-there back button.',
  body: `
    ${row(APPS.slice(0, 5))}
    ${row(APPS.slice(5))}
    <div style="display:flex;justify-content:center;flex-wrap:wrap;gap:10px;margin-top:44px;max-width:1100px;margin-left:auto;margin-right:auto;">${chipRow}</div>
  `,
});

await renderToPng(chromium, html, resolve(ROOT, 'screenshots/slate-glass-computer-suite.png'), 1560);
console.log('done');
