/**
 * generate-app-dna-previews.mjs
 *
 * App-DNA wave 1 before/afters: Bank (Wallet deck), Stocks (watchlist +
 * sparklines + sector board), Real Estate (real photos), Vehicles (real car
 * art), plus Education + Pets (rings/stage). BEFORE = the uniform Slate Glass
 * template; AFTER = the distinct per-app skeleton now in the code.
 *
 *   node scripts/generate-app-dna-previews.mjs
 */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, legendItem, renderToPng } from './lib/phoneFrame.mjs';

const tnum = 'font-variant-numeric:tabular-nums;';
const L1 = `background:${T.surface};border:1px solid ${T.border};border-radius:16px;box-shadow:0 3px 16px rgba(0,0,0,0.28);`;
const L2 = `background:${T.surface};border:1px solid rgba(255,255,255,0.15);border-radius:20px;box-shadow:0 6px 16px rgba(0,0,0,0.30);`;

const asset = (rel) => `data:image/png;base64,${readFileSync(resolve(ROOT, 'assets/images', rel)).toString('base64')}`;
const IMG = {
  villa: asset('Real Estate/Beach Villa.png'),
  apartment: asset('Real Estate/City Apartment.png'),
  mansion: asset('Real Estate/Modern Mansion.png'),
  coupe: asset('Vehicles/sports_coupe_final.png'),
  sedan: asset('Vehicles/luxury_sedan_final.png'),
  super: asset('Vehicles/exotic_supercar_final.png'),
};

const icon = (stroke, path, size = 16, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${sw}">${path}</svg>`;
const bubble = (rgb, hex, size, inner) => `<div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:rgba(${rgb},0.15);border:1px solid rgba(${rgb},0.30);display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${inner}</div>`;
const heroShell = (rgb, eyebrow, content) => `<div style="${L2}position:relative;"><div style="position:relative;border-radius:20px;overflow:hidden;padding:16px;">
  <div style="position:absolute;inset:0;background:rgba(${rgb},0.14);"></div>
  <div style="position:absolute;top:-48px;right:-36px;width:140px;height:140px;border-radius:70px;background:rgba(${rgb},0.10);"></div>
  <div style="position:absolute;top:0;left:0;right:0;height:1px;background:rgba(255,255,255,0.08);"></div>
  <div style="position:relative;"><div style="color:${T.muted};font-size:9px;font-weight:700;letter-spacing:1.2px;">${eyebrow}</div>${content}</div>
</div></div>`;
const topBar = (title, chipTxt, rgb) => `<div style="display:flex;align-items:center;padding:8px 16px;flex:0 0 auto;">
  <div style="width:40px;height:40px;display:flex;align-items:center;color:${T.text};font-size:22px;">‹</div>
  <div style="flex:1;color:${T.text};font-size:16px;font-weight:700;">${title}</div>
  <div style="background:rgba(${rgb},0.14);border:1px solid rgba(${rgb},0.30);border-radius:999px;padding:4px 9px;color:${T.text};font-size:12px;font-weight:700;${tnum}">${chipTxt}</div></div>`;
const scroll = (inner, gap = 12) => `<div style="flex:1;overflow:hidden;padding:14px 16px;display:flex;flex-direction:column;gap:${gap}px;">${inner}</div>`;
const spark = (pts, color, w = 46, h = 18) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
const ring = (pct, color, size = 46, label) => {
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${T.surface2}" stroke-width="5" fill="none"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round"
      stroke-dasharray="${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    ${label ? `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="${T.text}" font-size="${size * 0.26}" font-weight="800" font-family="-apple-system,system-ui">${label}</text>` : ''}
  </svg>`;
};
const WALLET_I = '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M16 12h3"/>';
const PIGGY_I = '<path d="M19 10c1 0 2 1 2 2s-1 2-2 2M4 12a6 5 0 0 1 6-5h3a6 5 0 0 1 6 5 6 5 0 0 1-6 5H10a6 5 0 0 1-6-5z"/>';
const CAP_I = '<path d="M2 9l10-4 10 4-10 4z"/><path d="M6 11v4c0 1 2.5 2.5 6 2.5s6-1.5 6-2.5v-4"/>';
const HOME_I = '<path d="M3 10.5L12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>';
const CAR_I = '<path d="M5 16l1.5-5h11L19 16"/><rect x="3" y="16" width="18" height="4" rx="1"/><circle cx="7" cy="20" r="1.6"/><circle cx="17" cy="20" r="1.6"/>';
const btn = (label, style) => `<div style="display:inline-flex;align-items:center;justify-content:center;min-height:32px;padding:0 14px;border-radius:10px;font-size:11px;font-weight:700;${style}">${label}</div>`;
const solidBtn = (label, color, txt = '#fff') => btn(label, `background:${color};color:${txt};`);
const tintBtn = (label, rgb, hex) => btn(label, `background:rgba(${rgb},0.16);color:${hex};`);
const rimBtn = (label, hex) => btn(label, `background:transparent;border:1px solid ${hex};color:${hex};`);

// ═════════ BANK — before: slate template · after: Wallet deck ═════════
const B = { rgb: '59,130,246', hex: '#3B82F6' };
function bankBefore() {
  const row = (glyph, name, sub, bal, green) => `<div style="${L1}padding:13px 16px;display:flex;align-items:center;gap:12px;">
    ${bubble(green ? '16,185,129' : B.rgb, green ? T.success : B.hex, 38, icon(green ? T.success : B.hex, glyph, 18))}
    <div style="flex:1;"><div style="color:${T.text};font-size:14px;font-weight:700;">${name}</div><div style="color:${T.muted};font-size:11px;">${sub}</div></div>
    <span style="color:${T.text};font-size:15px;font-weight:800;${tnum}">${bal}</span><span style="color:${T.muted};">›</span></div>`;
  return topBar('Bank', '650', B.rgb) + scroll(`
    ${heroShell(B.rgb, 'OVERVIEW', `<div style="display:flex;gap:22px;margin-top:8px;">
      <div><div style="color:${T.muted};font-size:9px;">Cash</div><div style="color:${T.text};font-size:16px;font-weight:800;${tnum}">$1,234</div></div>
      <div><div style="color:${T.muted};font-size:9px;">Bank</div><div style="color:${T.text};font-size:16px;font-weight:800;${tnum}">$2,036</div></div>
      <div><div style="color:${T.muted};font-size:9px;">Invested</div><div style="color:${T.text};font-size:16px;font-weight:800;${tnum}">$4,518</div></div>
      <div><div style="color:${T.muted};font-size:9px;">Debt</div><div style="color:${T.text};font-size:16px;font-weight:800;${tnum}">$0</div></div></div>`)}
    ${row(WALLET_I, 'Everyday Checking', 'Checking', '$1,200')}
    ${row(PIGGY_I, 'Savings', 'Savings · 2.00% APR', '$836', true)}
    ${row(PIGGY_I, 'Rainy-Day CD', 'CD · locked 8w', '$800', true)}
  `);
}
function bankAfter() {
  const face = (tint, name, type, bal, apr, meta, actions) => `<div style="position:relative;border-radius:18px;overflow:hidden;background:${T.surface};border:1px solid rgba(255,255,255,0.14);box-shadow:0 5px 15px rgba(0,0,0,0.32);">
    <div style="position:absolute;inset:0;background:rgba(${tint},0.16);"></div>
    <div style="position:absolute;top:0;left:0;right:0;height:1px;background:rgba(255,255,255,0.09);"></div>
    <div style="position:relative;padding:13px 14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="color:${T.text};font-size:13px;font-weight:700;">${name}</span>
        ${apr ? `<span style="background:rgba(16,185,129,0.18);color:${T.success};font-size:9px;font-weight:700;padding:2px 6px;border-radius:5px;">${apr}</span>` : `<span style="color:${T.text2};font-size:9px;">${type}</span>`}
      </div>
      <div style="color:${T.text};font-size:24px;font-weight:800;${tnum}margin-top:6px;">${bal}</div>
      <div style="color:${T.text2};font-size:9px;margin-top:2px;">${meta}</div>
      ${actions ? `<div style="display:flex;gap:6px;margin-top:9px;">${actions}</div>` : ''}
    </div></div>`;
  return topBar('Bank', '650 ›', B.rgb) + scroll(`
    <div style="display:flex;gap:6px;overflow:hidden;">
      ${['Interest earned $84', 'Late fees $0', 'Tax due $312', 'Income $1.9k/wk'].map((s) => `<span style="flex:0 0 auto;background:${T.surface};border:1px solid ${T.border};border-radius:999px;padding:4px 9px;color:${T.text2};font-size:9px;font-weight:600;${tnum}">${s}</span>`).join('')}
    </div>
    ${face(B.rgb, 'Everyday Checking', 'Checking', '$1,200.00', '', 'opened w12 · age 192w · no minimum', solidBtn('Deposit', B.hex) + tintBtn('Withdraw', B.rgb, B.hex))}
    ${face('16,185,129', 'Savings', 'Savings', '$836.00', '2.00% APR', 'opened w30 · min $100', solidBtn('Deposit', T.success) + tintBtn('Withdraw', '16,185,129', T.success))}
    ${face('139,92,246', 'Rainy-Day CD', 'CD', '$800.00', '4.10% APR', 'locked until w212 · 8 more weeks', tintBtn('Locked', '139,92,246', '#8B5CF6'))}
    <div style="${L1}padding:11px 14px;display:flex;align-items:center;gap:10px;">
      ${icon(B.hex, '<path d="M3 3v18h18"/><path d="M7 14l3-3 3 2 4-6"/>', 15)}
      <div style="flex:1;"><div style="color:${T.text};font-size:12px;font-weight:700;">Credit report</div>
      <div style="color:${T.muted};font-size:9px;">650 Fair · trend ${'+'}12 · 5-factor breakdown</div></div>
      ${spark('0,14 9,12 18,13 27,9 36,8 46,5', T.warning)}
      <span style="color:${T.muted};">›</span></div>
  `, 10);
}

// ═════════ STOCKS — after: watchlist + sector board ═════════
const S = { rgb: '168,85,247', hex: '#A855F7' };
function stocksBefore() {
  const row = (sym, sec, secColor, price, pct, sub) => {
    const col = pct >= 0 ? T.success : T.danger;
    return `<div style="${L1}padding:9px 14px;display:flex;align-items:center;gap:9px;">
      <div style="width:36px;height:36px;border-radius:18px;background:${secColor}26;border:1px solid ${secColor}4D;display:flex;align-items:center;justify-content:center;color:${secColor};font-size:9px;font-weight:800;">${sym.slice(0, 4)}</div>
      <div style="flex:1;"><div style="display:flex;gap:4px;align-items:center;"><span style="color:${T.text};font-size:14px;font-weight:700;">${sym}</span><span style="background:${secColor}26;color:${secColor};font-size:9px;font-weight:700;padding:1px 5px;border-radius:4px;">${sec}</span></div>
      <div style="color:${T.muted};font-size:9px;margin-top:1px;">${sub}</div></div>
      <div style="text-align:right;"><div style="color:${T.text};font-size:14px;font-weight:800;${tnum}">${price}</div>
      <div style="color:${col};font-size:10px;font-weight:700;${tnum}">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</div></div></div>`;
  };
  return topBar('Stocks', '$1,234', S.rgb) + scroll(`
    <span style="color:${T.text};font-size:14px;font-weight:700;">All Stocks</span>
    ${row('AAPL', 'Tech', T.info, '$150.25', 1.2, '0.60% annual dividend')}
    ${row('GOOGL', 'Tech', T.info, '$2,751', -0.8, '')}
    ${row('NVDA', 'Tech', T.info, '$432.50', 3.4, '')}
    ${row('JPM', 'Finance', T.success, '$142.85', 0.3, '2.50% annual dividend')}
    ${row('KO', 'Consumer', T.warning, '$58.75', -0.4, '3.10% annual dividend')}
  `, 9);
}
function stocksAfter() {
  const pill = (pct) => `<span style="background:${pct >= 0 ? T.success : T.danger};color:#fff;font-size:10px;font-weight:800;padding:3px 8px;border-radius:7px;${tnum}min-width:52px;text-align:center;display:inline-block;">${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%</span>`;
  const wrow = (sym, name, price, pct, pts, last) => `<div style="display:flex;align-items:center;gap:9px;padding:9px 13px;${last ? '' : `border-bottom:1px solid ${T.border};`}">
    <div style="width:3px;align-self:stretch;border-radius:2px;background:${T.info};"></div>
    <div style="flex:1;"><div style="color:${T.text};font-size:14px;font-weight:800;">${sym}</div><div style="color:${T.muted};font-size:9px;">${name}</div></div>
    ${spark(pts, pct >= 0 ? T.success : T.danger)}
    <div style="text-align:right;min-width:56px;"><div style="color:${T.text};font-size:13px;font-weight:800;${tnum}">${price}</div></div>
    ${pill(pct)}</div>`;
  const sector = (name, col, state, wks) => `<div style="flex:1;min-width:30%;background:${T.surface};border:1px solid ${T.border};border-radius:12px;padding:8px;">
    <div style="display:flex;align-items:center;gap:5px;"><span style="width:7px;height:7px;border-radius:4px;background:${col};"></span><span style="color:${T.text};font-size:10px;font-weight:700;">${name}</span></div>
    <div style="color:${state === '↑' ? T.success : state === '↓' ? T.danger : T.muted};font-size:9px;font-weight:700;margin-top:3px;">${state === '↑' ? '↑ Strong' : state === '↓' ? '↓ Weak' : '– Neutral'} · ${wks}w left</div></div>`;
  return topBar('Stocks', '$1,234', S.rgb) + scroll(`
    <div style="display:flex;gap:6px;">
      ${['12 advancing', '8 declining', '3 owned'].map((s, i) => `<span style="background:${T.surface};border:1px solid ${T.border};border-radius:999px;padding:4px 9px;color:${[T.success, T.danger, S.hex][i]};font-size:9px;font-weight:700;">${s}</span>`).join('')}
    </div>
    <span style="color:${T.text};font-size:13px;font-weight:700;">Sector rotation</span>
    <div style="display:flex;flex-wrap:wrap;gap:6px;">
      ${sector('Tech', T.info, '↑', 3)}${sector('Finance', T.success, '–', 5)}${sector('Consumer', T.warning, '↓', 2)}
    </div>
    <div style="display:flex;gap:6px;">
      ${['A–Z', 'Movers', 'Price'].map((s, i) => `<span style="background:${i === 1 ? `rgba(${S.rgb},0.16)` : T.surface};border:1px solid ${i === 1 ? `rgba(${S.rgb},0.3)` : T.border};border-radius:999px;padding:4px 11px;color:${i === 1 ? S.hex : T.text2};font-size:10px;font-weight:700;">${s}</span>`).join('')}
    </div>
    <div style="${L1}padding:0;overflow:hidden;">
      ${wrow('NVDA', 'Tech · owned', '$432.50', 3.4, '0,15 9,13 18,14 27,10 36,6 46,3')}
      ${wrow('AAPL', 'Tech · 0.60% yield', '$150.25', 1.2, '0,12 9,13 18,10 27,11 36,8 46,7')}
      ${wrow('JPM', 'Finance · 2.50% yield', '$142.85', 0.3, '0,10 9,11 18,9 27,10 36,9 46,9')}
      ${wrow('KO', 'Consumer · 3.10% yield', '$58.75', -0.4, '0,8 9,9 18,10 27,9 36,11 46,12', true)}
    </div>
  `, 9);
}

// ═════════ REAL ESTATE — after: Zillow photo cards ═════════
const R = { rgb: '16,185,129', hex: '#10B981' };
function reBefore() {
  const row = (name, sub, val) => `<div style="${L1}padding:13px 16px;display:flex;align-items:center;gap:12px;">
    ${bubble(R.rgb, R.hex, 38, icon(R.hex, HOME_I, 18))}
    <div style="flex:1;"><div style="color:${T.text};font-size:14px;font-weight:700;">${name}</div><div style="color:${T.muted};font-size:11px;">${sub}</div></div>
    <span style="color:${T.text};font-size:14px;font-weight:800;${tnum}">${val}</span><span style="color:${T.muted};">›</span></div>`;
  return topBar('Real Estate', '$12.3k', R.rgb) + scroll(`
    ${heroShell(R.rgb, 'PORTFOLIO', `<div style="display:flex;align-items:center;gap:12px;margin-top:8px;">
      ${bubble(R.rgb, R.hex, 42, icon(R.hex, HOME_I, 20))}
      <div><div style="color:${T.text};font-size:22px;font-weight:800;${tnum}">$412,000</div>
      <div style="color:${T.success};font-size:10px;${tnum}">+$1,850/wk rental income</div></div></div>`)}
    ${row('12 Oak Lane', 'Rented · $950/wk', '$180k')}
    ${row('Downtown Studio', 'Vacant · listed', '$98k')}
    ${row('Beach Villa', 'For sale', '$820k')}
  `);
}
function reAfter() {
  const card = (img, name, price, status, statusCol, chips, action) => `<div style="${L1}padding:0;overflow:hidden;">
    <div style="position:relative;height:104px;">
      <img src="${img}" style="width:100%;height:100%;object-fit:cover;"/>
      <span style="position:absolute;top:8px;left:8px;background:${statusCol};color:#fff;font-size:9px;font-weight:800;padding:3px 8px;border-radius:6px;letter-spacing:0.4px;">${status}</span>
    </div>
    <div style="padding:10px 13px;">
      <div style="display:flex;justify-content:space-between;align-items:baseline;">
        <span style="color:${T.text};font-size:16px;font-weight:800;${tnum}">${price}</span>${action}
      </div>
      <div style="color:${T.text};font-size:12px;font-weight:600;margin-top:2px;">${name}</div>
      <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;">${chips.map((c) => `<span style="background:${T.surface2};color:${T.text2};font-size:9px;font-weight:600;padding:2px 7px;border-radius:5px;${tnum}">${c}</span>`).join('')}</div>
    </div></div>`;
  return topBar('Real Estate', '$12.3k', R.rgb) + scroll(`
    ${card(IMG.apartment, 'City Apartment · 12 Oak Lane', '$180,400', 'RENTED', R.hex, ['+$950/wk', '+$28.4k · +18.7% ▲', 'owned 42w'], spark('0,14 9,12 18,11 27,9 36,7 46,4', T.success))}
    ${card(IMG.villa, 'Beach Villa', '$820,000', 'FOR SALE', T.info, ['beachfront', 'est. $2.1k/wk if rented'], solidBtn('Buy', R.hex))}
    ${card(IMG.mansion, 'Modern Mansion', '$1.45M', 'FOR SALE', T.info, ['8 rooms', 'prestige +12'], solidBtn('Buy', R.hex))}
  `, 10);
}

// ═════════ VEHICLES — after: car-art marketplace ═════════
const V = { rgb: '249,115,22', hex: '#F97316' };
function vehBefore() {
  const row = (name, sub, val) => `<div style="${L1}padding:13px 16px;display:flex;align-items:center;gap:12px;">
    ${bubble(V.rgb, V.hex, 38, icon(V.hex, CAR_I, 18))}
    <div style="flex:1;"><div style="color:${T.text};font-size:14px;font-weight:700;">${name}</div><div style="color:${T.muted};font-size:11px;">${sub}</div></div>
    <span style="color:${T.text};font-size:14px;font-weight:800;${tnum}">${val}</span><span style="color:${T.muted};">›</span></div>`;
  return topBar('AutoTrader', '$12.3k', V.rgb) + scroll(`
    ${heroShell(V.rgb, 'GARAGE', `<div style="display:flex;align-items:center;gap:12px;margin-top:8px;">
      ${bubble(V.rgb, V.hex, 42, icon(V.hex, CAR_I, 20))}
      <div><div style="color:${T.text};font-size:20px;font-weight:800;">Sports Coupe</div>
      <div style="color:${T.text2};font-size:10px;">condition 82 · insured</div></div></div>`)}
    ${row('Luxury Sedan', 'Dealership · new', '$48k')}
    ${row('Exotic Supercar', 'Dealership · new', '$310k')}
  `);
}
function vehAfter() {
  const listing = (img, name, price, chips, action) => `<div style="${L1}padding:0;overflow:hidden;">
    <div style="height:88px;background:radial-gradient(120px 60px at 50% 65%, rgba(${V.rgb},0.12), transparent);display:flex;align-items:center;justify-content:center;">
      <img src="${img}" style="max-width:82%;max-height:84px;object-fit:contain;"/>
    </div>
    <div style="padding:9px 13px;display:flex;align-items:center;justify-content:space-between;">
      <div><div style="color:${T.text};font-size:13px;font-weight:800;">${name}</div>
      <div style="display:flex;gap:5px;margin-top:4px;">${chips.map((c) => `<span style="background:${T.surface2};color:${T.text2};font-size:9px;font-weight:600;padding:2px 7px;border-radius:5px;${tnum}">${c}</span>`).join('')}</div></div>
      <div style="text-align:right;"><div style="color:${T.text};font-size:14px;font-weight:800;${tnum}">${price}</div>${action}</div>
    </div></div>`;
  return topBar('AutoTrader', '$12.3k', V.rgb) + scroll(`
    <div style="${L2}position:relative;overflow:hidden;">
      <div style="position:absolute;inset:0;background:rgba(${V.rgb},0.10);"></div>
      <div style="position:relative;padding:12px 14px 0;display:flex;justify-content:space-between;align-items:center;">
        <div><div style="color:${T.muted};font-size:9px;font-weight:700;letter-spacing:1.2px;">YOUR RIDE</div>
        <div style="color:${T.text};font-size:17px;font-weight:800;margin-top:2px;">Sports Coupe</div>
        <div style="display:flex;gap:5px;margin-top:5px;">${['insured ✓', '28 mpg', '155 mph'].map((c) => `<span style="background:rgba(255,255,255,0.08);color:${T.text2};font-size:9px;font-weight:600;padding:2px 7px;border-radius:5px;${tnum}">${c}</span>`).join('')}</div></div>
        <div style="text-align:center;">${ring(82, V.hex, 50, '82')}<div style="color:${T.muted};font-size:8px;margin-top:2px;">CONDITION</div></div>
      </div>
      <img src="${IMG.coupe}" style="position:relative;width:88%;margin:2px auto 0;display:block;object-fit:contain;max-height:104px;"/>
    </div>
    <span style="color:${T.text};font-size:13px;font-weight:700;">Dealership</span>
    ${listing(IMG.sedan, 'Luxury Sedan', '$48,000', ['new', '24 mpg'], solidBtn('Buy', V.hex))}
    ${listing(IMG.super, 'Exotic Supercar', '$310,000', ['new', '211 mph'], solidBtn('Buy', V.hex))}
  `, 10);
}

// ═════════ EDUCATION + PETS combined (4 phones) ═════════
const E = { rgb: '6,182,212', hex: '#06B6D4' };
const P = { rgb: '234,179,8', hex: '#EAB308' };
function eduBefore() {
  return topBar('Education', '$1,234', E.rgb) + scroll(`
    ${heroShell(E.rgb, 'BEST GPA', `<div style="display:flex;align-items:center;gap:10px;margin-top:6px;">${bubble(E.rgb, E.hex, 38, icon(E.hex, CAP_I, 18))}<div style="color:${T.text};font-size:22px;font-weight:800;${tnum}">3.8</div></div>`)}
    <div style="${L1}padding:12px 14px;"><div style="color:${T.text};font-size:13px;font-weight:700;">Computer Science BSc</div>
      <div style="color:${T.muted};font-size:10px;margin-top:2px;">University · 3 yrs · GPA 3.6</div>
      <div style="height:5px;background:${T.surface2};border-radius:3px;margin-top:8px;overflow:hidden;"><div style="width:64%;height:100%;background:${T.success};"></div></div></div>
    <div style="${L1}padding:12px 14px;"><div style="color:${T.text};font-size:13px;font-weight:700;">Real Estate License</div>
      <div style="color:${T.muted};font-size:10px;margin-top:2px;">Certification · 12 wks</div>
      <div style="height:5px;background:${T.surface2};border-radius:3px;margin-top:8px;overflow:hidden;"><div style="width:25%;height:100%;background:${T.success};"></div></div></div>
  `, 9);
}
function eduAfter() {
  const course = (pct, glyphColor, name, sub, gpa, chips) => `<div style="${L1}padding:11px 13px;display:flex;align-items:center;gap:11px;">
    <div style="position:relative;">${ring(pct, E.hex, 46, pct + '%')}</div>
    <div style="flex:1;"><div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="color:${T.text};font-size:13px;font-weight:800;">${name}</span>
      <span style="background:rgba(16,185,129,0.16);color:${T.success};font-size:9px;font-weight:800;padding:2px 6px;border-radius:5px;${tnum}">${gpa}</span></div>
    <div style="color:${T.muted};font-size:9px;margin-top:2px;">${sub}</div>
    <div style="display:flex;gap:4px;margin-top:5px;flex-wrap:wrap;">${chips.map((c) => `<span style="background:${T.surface2};color:${T.text2};font-size:8px;font-weight:600;padding:2px 6px;border-radius:4px;">${c}</span>`).join('')}</div></div></div>`;
  return topBar('Education', '$1,234', E.rgb) + scroll(`
    ${course(64, E.hex, 'Computer Science BSc', 'University · semester 4 · 2 exams left', 'GPA 3.6', ['study group ✓', '18w left', 'loan $220/wk'])}
    ${course(25, E.hex, 'Real Estate License', 'Certification · self-paced', 'GPA 3.9', ['9w left'])}
    <div style="display:flex;gap:6px;">${tintBtn('Study now', E.rgb, E.hex)}${rimBtn('Catalog →', E.hex)}</div>
  `, 9);
}
function petsBefore() {
  return topBar('Pets', '$1,234', P.rgb) + scroll(`
    ${heroShell(P.rgb, 'ACTIVE COMPANION', `<div style="display:flex;align-items:center;gap:10px;margin-top:6px;">
      ${bubble(P.rgb, P.hex, 42, '<span style="font-size:20px;">🐕</span>')}
      <div><div style="color:${T.text};font-size:17px;font-weight:800;">Biscuit</div><div style="color:${T.text2};font-size:9px;">Golden Retriever · 2 yrs</div></div></div>
      <div style="height:5px;background:${T.surface2};border-radius:3px;margin-top:10px;overflow:hidden;"><div style="width:86%;height:100%;background:${T.success};"></div></div>
      <div style="height:5px;background:${T.surface2};border-radius:3px;margin-top:5px;overflow:hidden;"><div style="width:72%;height:100%;background:${T.reputation};"></div></div>`)}
    <div style="${L1}padding:11px 14px;display:flex;align-items:center;gap:10px;">${bubble(P.rgb, P.hex, 34, '<span style="font-size:16px;">🐈</span>')}<div style="flex:1;color:${T.text};font-size:12px;font-weight:700;">Mochi</div><span style="color:${T.muted};">›</span></div>
  `, 9);
}
function petsAfter() {
  return topBar('Pets', '$1,234', P.rgb) + scroll(`
    <div style="${L2}position:relative;overflow:hidden;">
      <div style="position:absolute;inset:0;background:rgba(${P.rgb},0.10);"></div>
      <div style="position:relative;padding:14px;display:flex;align-items:center;justify-content:space-between;">
        <div style="text-align:center;">${ring(86, T.success, 52, '86')}<div style="color:${T.muted};font-size:8px;margin-top:2px;">HEALTH</div></div>
        <div style="text-align:center;">
          <div style="width:78px;height:78px;border-radius:39px;background:radial-gradient(circle, rgba(${P.rgb},0.25), rgba(${P.rgb},0.05));display:flex;align-items:center;justify-content:center;"><span style="font-size:44px;">🐕</span></div>
          <div style="color:${T.text};font-size:15px;font-weight:800;margin-top:4px;">Biscuit</div>
          <div style="color:${P.hex};font-size:9px;font-weight:700;">★★★☆ bond</div>
        </div>
        <div style="text-align:center;">${ring(72, T.reputation, 52, '72')}<div style="color:${T.muted};font-size:8px;margin-top:2px;">HAPPY</div></div>
      </div>
      <div style="position:relative;display:flex;gap:6px;padding:0 14px 13px;">
        ${['Feed', 'Play', 'Train', 'Vet'].map((a) => `<div style="flex:1;text-align:center;background:rgba(${P.rgb},0.16);border:1px solid rgba(${P.rgb},0.3);border-radius:11px;padding:8px 0;color:${T.text};font-size:11px;font-weight:800;">${a}</div>`).join('')}
      </div>
    </div>
    <span style="color:${T.text};font-size:12px;font-weight:700;">Your other pets</span>
    <div style="display:flex;gap:12px;">
      ${[['🐈', 'Mochi'], ['🦜', 'Kiwi'], ['🐹', 'Nugget'], ['＋', 'Adopt']].map(([e, n], i) => `<div style="text-align:center;">
        <div style="width:52px;height:52px;border-radius:26px;background:${i === 3 ? `rgba(${P.rgb},0.16)` : T.surface};border:2px solid ${i === 3 ? P.hex : `rgba(${P.rgb},0.35)`};display:flex;align-items:center;justify-content:center;"><span style="font-size:${i === 3 ? 20 : 24}px;color:${P.hex};">${e}</span></div>
        <div style="color:${T.text2};font-size:9px;font-weight:600;margin-top:3px;">${n}</div></div>`).join('')}
    </div>
  `, 10);
}

// ── compose ──────────────────────────────────────────────────────────────────
function pair(title, subtitle, before, after, legend) {
  return pageShell({
    title, subtitle,
    body: `<div style="display:flex;justify-content:center;gap:64px;margin-top:34px;">
      ${phone(before, { caption: 'Before — same template as every app', captionColor: T.muted })}
      ${phone(after, { caption: 'After — its own DNA', captionColor: T.success })}
    </div>
    <div style="display:flex;justify-content:center;gap:44px;margin-top:48px;flex-wrap:wrap;max-width:1050px;margin-left:auto;margin-right:auto;">${legend}</div>`,
  });
}

const OUT = resolve(ROOT, 'screenshots');
const jobs = [
  { file: 'dna-bank.png', html: pair('Bank — Apple Wallet DNA', 'Accounts became a card deck; two new pages (account detail, credit report).', bankBefore(), bankAfter(), [
    legendItem(B.hex, 'A deck, not a list', 'Each account is a full card face with a big balance and its own Deposit/Withdraw buttons — visibly tappable.'),
    legendItem(T.success, 'More of your money story', 'Interest earned, late fees, tax due, weekly income — state the old UI never showed.'),
    legendItem(T.text2, 'Credit report page', 'Score trend sparkline, FICO-weighted 5-factor breakdown, recent inquiries — one tap from the header.'),
  ].join('')) },
  { file: 'dna-stocks.png', html: pair('Stocks — Apple Stocks DNA', 'A real terminal: sector rotation, sparklines, signed pills, per-symbol pages.', stocksBefore(), stocksAfter(), [
    legendItem(S.hex, 'Sector rotation board', 'Momentum and weeks-remaining per sector — data that existed but was buried in a row suffix.'),
    legendItem(T.success, 'Watchlist density', 'Grouped rows with real SVG sparklines and filled green/red pills; sort by A–Z / Movers / Price.'),
    legendItem(T.text2, 'Symbol detail page', 'Quote hero, your position P/L, est. dividends, and the Trade CTA — tap any row.'),
  ].join('')) },
  { file: 'dna-realestate.png', html: pair('Real Estate — Zillow DNA', '18 real property photos were sitting unused in assets. Now they sell the game.', reBefore(), reAfter(), [
    legendItem(R.hex, 'Photo-led listings', 'Every property renders its real art with a status badge and price-forward layout.'),
    legendItem(T.success, 'Appreciation surfaced', 'Signed $ and % gains with a value-trend line, weekly rent, and owned-duration per property.'),
    legendItem(T.text2, 'Property pages', 'Tap any card for the full detail view. Buy/Sell are real buttons again.'),
  ].join('')) },
  { file: 'dna-vehicles.png', html: pair('Vehicles — marketplace DNA', 'The car art was already in the codebase — now it IS the app.', vehBefore(), vehAfter(), [
    legendItem(V.hex, 'Art-led garage', 'Your ride renders full-width with spec chips and a condition ring.'),
    legendItem(T.success, 'Dealership that sells', 'Listings lead with the vehicle render and a real Buy button; specs as chips.'),
    legendItem(T.text2, 'Vehicle pages', 'mpg, top speed, weekly costs, resale estimate — a full spec sheet per car.'),
  ].join('')) },
  { file: 'dna-education-pets.png', html: pageShell({
    title: 'Education & Pets — rings, stages, and life',
    subtitle: 'Course-app DNA for Education; Tamagotchi DNA for Pets.',
    body: `<div style="display:flex;justify-content:center;gap:40px;margin-top:34px;">
      ${phone(eduBefore(), { caption: 'Education · before', captionColor: T.muted, w: 270, h: 560 })}
      ${phone(eduAfter(), { caption: 'after', captionColor: T.success, w: 270, h: 560 })}
      ${phone(petsBefore(), { caption: 'Pets · before', captionColor: T.muted, w: 270, h: 560 })}
      ${phone(petsAfter(), { caption: 'after', captionColor: T.success, w: 270, h: 560 })}
    </div>
    <div style="display:flex;justify-content:center;gap:44px;margin-top:44px;flex-wrap:wrap;">
      ${legendItem(E.hex, 'Progress rings everywhere', 'Courses carry an SVG ring + GPA band chip + semester/exam/study-group chips the old UI ignored.')}
      ${legendItem(P.hex, 'A pet stage, not a list', 'Health and Happiness rings flank the portrait; chunky Feed/Play/Train/Vet buttons; other pets in a story rail.')}
    </div>`,
  }) },
];

for (const j of jobs) {
  await renderToPng(chromium, j.html, resolve(OUT, j.file), j.file === 'dna-education-pets.png' ? 1400 : 1160);
  console.log('wrote', j.file);
}
console.log('done');
