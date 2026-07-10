/**
 * generate-slate-glass-previews.mjs
 *
 * Before/after previews for the "Slate Glass" modernization (Bank, Stocks,
 * Contacts, Spark). BEFORE = the flat 1px-border tile look; AFTER = the new
 * layered glass-on-slate system. Faithful to the runtime: LinearGradient
 * fallback renders colors[0] FLAT, so all tint washes here are flat rgba
 * overlays + glow blobs, exactly as the app draws them.
 *
 *   node scripts/generate-slate-glass-previews.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import {
  ROOT, T, GRAD, grad, faceURI, phone, pageShell, legendItem, renderToPng,
} from './lib/phoneFrame.mjs';

const FEMALE = faceURI('Female.png');
const MALE = faceURI('Male.png');
const OLDF = faceURI('Old_Female.png');

// Identity accents per app (Slate Glass system)
const ID = {
  bank: { hex: '#3B82F6', rgb: '59,130,246' },
  stocks: { hex: '#A855F7', rgb: '168,85,247' },
  contacts: { hex: '#F97316', rgb: '249,115,22' },
  spark: { hex: '#F43F5E', rgb: '244,63,94' },
};

// ── Slate Glass CSS recipes (faithful to getGlassCard/getGlassIconContainer) ─
const L1 = `background:${T.surface};border:1px solid ${T.border};border-radius:16px;box-shadow:0 3px 16px rgba(0,0,0,0.28);`;
const L2 = `background:${T.surface};border:1px solid rgba(255,255,255,0.15);border-radius:20px;box-shadow:0 6px 16px rgba(0,0,0,0.30);`;
const FLAT = `background:${T.surface2};border:1px solid ${T.border};border-radius:12px;`; // BEFORE card
const bubble = (rgb, hex, size = 40, inner) =>
  `<div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:rgba(${rgb},0.15);border:1px solid rgba(${rgb},0.30);display:flex;align-items:center;justify-content:center;color:${hex};flex:0 0 auto;">${inner}</div>`;
const solidBubble = (color, size = 40, inner) =>
  `<div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;flex:0 0 auto;">${inner}</div>`;
// Hero shell: flat tint wash + glow blob + top hairline + eyebrow (dark mode)
const hero = (rgb, eyebrow, content) => `
  <div style="${L2}position:relative;">
    <div style="position:relative;border-radius:20px;overflow:hidden;padding:20px;">
      <div style="position:absolute;inset:0;background:rgba(${rgb},0.14);"></div>
      <div style="position:absolute;top:-48px;right:-36px;width:150px;height:150px;border-radius:75px;background:rgba(${rgb},0.10);"></div>
      <div style="position:absolute;top:0;left:0;right:0;height:1px;background:rgba(255,255,255,0.08);"></div>
      <div style="position:relative;">
        <div style="color:${T.muted};font-size:10px;font-weight:700;letter-spacing:1.2px;">${eyebrow}</div>
        ${content}
      </div>
    </div>
  </div>`;

const tabRow = (tabs, activeIdx, accent = T.info) => `<div style="display:flex;border-bottom:1px solid ${T.border};flex:0 0 auto;">
  ${tabs.map((t, i) => `<div style="flex:1;text-align:center;padding:8px 0;font-size:12px;font-weight:${i === activeIdx ? 700 : 600};color:${i === activeIdx ? accent : T.text2};border-bottom:2px solid ${i === activeIdx ? accent : 'transparent'};">${t}</div>`).join('')}
</div>`;
const scroll = (inner, gap = 12) => `<div style="flex:1;overflow:hidden;padding:16px;display:flex;flex-direction:column;gap:${gap}px;">${inner}</div>`;
const icon = (stroke, path, size = 18, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${sw}">${path}</svg>`;
const WALLET = '<rect x="2" y="6" width="20" height="13" rx="2"/><path d="M16 12h3"/>';
const PIGGY = '<path d="M19 10c1 0 2 1 2 2s-1 2-2 2M4 12a6 5 0 0 1 6-5h3a6 5 0 0 1 6 5 6 5 0 0 1-6 5H10a6 5 0 0 1-6-5z"/>';
const CHART = '<path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/>';
const TREND = '<path d="M4 14l6-6 4 4 6-7"/><path d="M17 5h4v4"/>';
const CASE = '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
const SHIELD = '<path d="M12 2l8 3v6c0 5-3.5 8-8 11-4.5-3-8-6-8-11V5z"/>';
const VOTE = '<path d="M9 12l2 2 4-5"/><rect x="4" y="4" width="16" height="16" rx="2"/>';
const ALERT_SHIELD = '<path d="M12 2l8 3v6c0 5-3.5 8-8 11-4.5-3-8-6-8-11V5z"/><path d="M12 8v4M12 15h.01"/>';

// ═══════════════════════════ BANK ═══════════════════════════
function bankHeader(modern) {
  const chipStyle = modern
    ? `background:rgba(${ID.bank.rgb},0.14);border:1px solid rgba(${ID.bank.rgb},0.30);`
    : `background:${T.surface2};border:1px solid ${T.border};`;
  return `<div style="display:flex;align-items:center;padding:8px 16px;border-bottom:1px solid ${T.border};flex:0 0 auto;">
    <div style="width:40px;color:${T.text};font-size:22px;">‹</div>
    <div style="flex:1;color:${T.text};font-size:16px;font-weight:700;">Bank</div>
    <div style="${chipStyle}border-radius:999px;padding:4px 8px;color:${T.text};font-size:12px;font-weight:700;">650</div>
  </div>`;
}
function bankScreen(modern) {
  const tnum = 'font-variant-numeric:tabular-nums;';
  const statCellNew = (glyph, label, val, danger) => `<div style="flex-basis:47%;flex-grow:1;display:flex;flex-direction:column;gap:3px;padding:6px 0;">
    <div style="display:flex;align-items:center;gap:6px;">${icon(ID.bank.hex, glyph, 13)}<span style="color:${T.muted};font-size:10px;font-weight:600;">${label}</span></div>
    <span style="color:${danger ? T.danger : T.text};font-size:17px;font-weight:800;${tnum}">${val}</span></div>`;
  const statCardOld = (label, val, danger) => `<div style="flex-basis:47%;flex-grow:1;${FLAT}padding:8px;display:flex;flex-direction:column;gap:2px;">
    <span style="color:${T.muted};font-size:10px;font-weight:600;">${label}</span>
    <span style="color:${danger ? T.danger : T.text};font-size:16px;font-weight:800;${tnum}">${val}</span></div>`;

  const gauge = (card) => `<div style="${card}padding:10px 12px;">
    <div style="display:flex;align-items:center;gap:6px;">${icon(T.warning, SHIELD, 14)}<span style="color:${T.text2};font-size:12px;font-weight:600;">Credit Score</span></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:2px;">
      <span style="color:${T.text};font-size:20px;font-weight:800;${tnum}">650</span><span style="color:${T.warning};font-size:15px;font-weight:700;">Fair</span></div>
    <div style="height:6px;background:${modern ? T.surface2 : T.border};border-radius:3px;margin-top:6px;overflow:hidden;"><div style="width:63.6%;height:100%;background:${T.warning};"></div></div>
    <div style="display:flex;justify-content:space-between;margin-top:4px;"><span style="color:${T.muted};font-size:10px;">300</span><span style="color:${T.muted};font-size:10px;">850</span></div>
  </div>`;

  const secHeader = (title, add) => `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:${modern ? 10 : 4}px;">
    <span style="color:${T.text};font-size:15px;font-weight:700;">${title}</span>
    <div style="display:flex;align-items:center;gap:4px;background:${ID.bank.hex};padding:4px 9px;border-radius:999px;box-shadow:${modern ? '0 2px 8px rgba(59,130,246,0.35)' : 'none'};"><span style="color:#fff;font-size:12px;">+</span><span style="color:#fff;font-size:10px;font-weight:700;">${add}</span></div></div>`;

  const acct = (glyph, name, sub, bal, green, chipHtml = '') => {
    const bub = modern
      ? bubble(green ? '16,185,129' : ID.bank.rgb, green ? T.success : ID.bank.hex, 40, icon(green ? T.success : ID.bank.hex, glyph, 19))
      : solidBubble('#0F172A', 40, icon(T.text2, glyph, 19));
    return `<div style="${modern ? L1 : FLAT}padding:14px 16px;display:flex;align-items:center;gap:14px;">
      ${bub}
      <div style="flex:1;"><div style="display:flex;align-items:center;gap:6px;"><span style="color:${T.text};font-size:15px;font-weight:700;">${name}</span>${chipHtml}</div>
      <div style="color:${T.muted};font-size:12px;margin-top:2px;">${sub}</div></div>
      <span style="color:${T.text};font-size:16px;font-weight:800;${tnum}">${bal}</span>
      <span style="color:${T.muted};font-size:16px;">›</span></div>`;
  };
  const aprChip = `<span style="background:rgba(16,185,129,0.15);color:${T.success};font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;">2.00% APR</span>`;
  const empty = modern
    ? `<div style="${L1}padding:22px;text-align:center;color:${T.muted};font-size:12px;opacity:0.85;">No active loans.</div>`
    : `<div style="${FLAT}padding:22px;text-align:center;color:${T.muted};font-size:12px;">No active loans.</div>`;

  const summary = modern
    ? hero(ID.bank.rgb, 'OVERVIEW', `<div style="display:flex;flex-wrap:wrap;gap:0 12px;margin-top:6px;">
        ${statCellNew(WALLET, 'Cash', '$1,234')}${statCellNew(PIGGY, 'Bank', '$2,036')}
        ${statCellNew(CHART, 'Invested', '$0')}${statCellNew(TREND, 'Debt', '$0')}
      </div>`)
    : `<div style="display:flex;flex-wrap:wrap;gap:8px;">${statCardOld('Cash', '$1,234')}${statCardOld('Bank', '$2,036')}${statCardOld('Invested', '$0')}${statCardOld('Debt', '$0')}</div>`;

  return bankHeader(modern) + scroll(`
    ${summary}
    ${gauge(modern ? L1 + 'position:relative;' : FLAT)}
    ${secHeader('Accounts', 'Open')}
    ${acct(WALLET, 'Everyday Checking', 'Checking', '$1,200', false)}
    ${acct(PIGGY, 'Savings', 'Savings', '$836', true, aprChip)}
    ${secHeader('Loans', 'Apply')}
    ${empty}
  `, modern ? 10 : 8);
}

// ═══════════════════════════ STOCKS (Portfolio tab) ═══════════════════════════
function stocksScreen(modern) {
  const tnum = 'font-variant-numeric:tabular-nums;';
  const id = ID.stocks;
  const heroNew = hero(id.rgb, 'PORTFOLIO VALUE', `
    <div style="display:flex;align-items:center;gap:12px;margin-top:8px;">
      ${bubble(id.rgb, id.hex, 44, icon(id.hex, CASE, 21))}
      <div>
        <div style="color:${T.text};font-size:24px;font-weight:800;${tnum}">$4,518</div>
        <div style="color:${T.success};font-size:11px;font-weight:600;${tnum}margin-top:2px;">+$318 · +7.6% unrealized</div>
      </div>
    </div>`);
  const heroOld = `<div style="${FLAT}padding:16px;display:flex;align-items:center;gap:8px;">
    ${solidBubble(T.info, 40, icon('#fff', CASE, 20))}
    <div><div style="color:${T.muted};font-size:10px;font-weight:600;">Portfolio value</div>
    <div style="color:${T.text};font-size:20px;font-weight:800;${tnum}">$4,518</div>
    <div style="color:${T.success};font-size:10px;${tnum}margin-top:2px;">+$318 · +7.6% unrealized</div></div></div>`;

  const statNew = (label, val) => `<div style="flex:1;${L1}padding:10px 12px;display:flex;flex-direction:column;gap:2px;">
    <span style="color:${T.muted};font-size:10px;font-weight:600;">${label}</span>
    <span style="color:${T.text};font-size:15px;font-weight:800;${tnum}">${val}</span></div>`;
  const statOld = (label, val) => `<div style="flex:1;${FLAT}padding:8px;display:flex;flex-direction:column;gap:2px;">
    <span style="color:${T.muted};font-size:10px;font-weight:600;">${label}</span>
    <span style="color:${T.text};font-size:15px;font-weight:800;${tnum}">${val}</span></div>`;
  const stat = modern ? statNew : statOld;

  const SEC = { Tech: T.info, Finance: T.success };
  const row = (sym, sector, price, pct, sub) => {
    const col = pct > 0 ? T.success : T.danger;
    const arrow = pct > 0 ? '<path d="M4 14l6-6 4 4 6-7"/><path d="M17 5h4v4"/>' : '<path d="M4 10l6 6 4-4 6 7"/><path d="M17 19h4v-4"/>';
    const secColor = SEC[sector];
    const bub = modern
      ? `<div style="width:40px;height:40px;border-radius:20px;background:${secColor}26;border:1px solid ${secColor}4D;display:flex;align-items:center;justify-content:center;color:${secColor};font-size:10px;font-weight:800;flex:0 0 auto;">${sym.slice(0, 4)}</div>`
      : `<div style="width:40px;height:40px;border-radius:20px;background:${secColor};display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;flex:0 0 auto;">${sym.slice(0, 4)}</div>`;
    const chipS = modern
      ? `background:${secColor}26;color:${secColor};border:none;`
      : `border:1px solid ${secColor};color:${secColor};background:transparent;`;
    return `<div style="${modern ? L1 : FLAT}padding:8px 16px;display:flex;align-items:center;gap:8px;">
      ${bub}
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:4px;"><span style="color:${T.text};font-size:15px;font-weight:700;">${sym}</span>
          <span style="${chipS}font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;">${sector}</span></div>
        <div style="color:${T.muted};font-size:10px;margin-top:2px;">${sub}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;">
        <span style="color:${T.text};font-size:15px;font-weight:800;${tnum}">${price}</span>
        <div style="display:flex;align-items:center;gap:2px;margin-top:2px;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2.4">${arrow}</svg>
          <span style="color:${col};font-size:10px;font-weight:700;${tnum}">${pct > 0 ? '+' : ''}${pct.toFixed(2)}%</span></div>
        <div style="display:flex;align-items:center;gap:3px;margin-top:2px;color:${modern ? id.hex : T.info};">${icon(modern ? id.hex : T.info, CASE, 10)}<span style="font-size:10px;font-weight:700;">Owned</span></div>
      </div></div>`;
  };

  return tabRow(['Market', 'Portfolio', 'Orders'], 1, modern ? id.hex : T.info) + scroll(`
    ${modern ? heroNew : heroOld}
    <div style="display:flex;gap:8px;">${stat('Cost basis', '$4,200')}${stat('Realized', '$122')}${stat('Dividends', '$38')}</div>
    <span style="color:${T.text};font-size:15px;font-weight:700;margin-top:4px;">Holdings</span>
    ${row('AAPL', 'Tech', '$150.25', 1.20, '12.00 sh · avg $138 · 0.60% yield')}
    ${row('NVDA', 'Tech', '$432.50', 3.40, '4.00 sh · avg $401')}
    ${row('JPM', 'Finance', '$142.85', -0.30, '8.00 sh · avg $145 · 2.50% yield')}
  `, 10);
}

// ═══════════════════════════ CONTACTS (Network tab) ═══════════════════════════
function contactsScreen(modern) {
  const id = ID.contacts;
  const statVal = (label, val, color) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
    <span style="color:${color};font-size:16px;font-weight:800;">${val}</span>
    <span style="color:${T.text2};font-size:10px;">${label}</span></div>`;
  const statsNew = hero(id.rgb, 'YOUR NETWORK', `<div style="display:flex;margin-top:10px;">
    ${statVal('Lobbyists', '2', '#A855F7')}${statVal('Allies', '1', '#A855F7')}${statVal('Vendors', '1', T.warning)}${statVal('Business', '3', T.success)}</div>`);
  const statsOld = `<div style="background:${T.surface};border:1px solid ${T.border};border-radius:12px;padding:16px;">
    <div style="color:${T.text};font-size:12px;font-weight:800;">Your network</div>
    <div style="display:flex;margin-top:8px;">
    ${statVal('Lobbyists', '2', '#A855F7')}${statVal('Allies', '1', T.info)}${statVal('Vendors', '1', T.warning)}${statVal('Business', '3', T.success)}</div></div>`;

  const netRow = (glyph, rgb, hex, name, sub, strength, tags) => {
    const tile = modern
      ? bubble(rgb, hex, 40, icon(hex, glyph, 18))
      : `<div style="width:40px;height:40px;border-radius:20px;background:${hex};display:flex;align-items:center;justify-content:center;">${icon('#fff', glyph, 18)}</div>`;
    const card = modern ? L1 : `background:${T.surface};border:1px solid ${T.border};border-radius:12px;`;
    return `<div style="${card}padding:14px 16px;display:flex;align-items:center;gap:14px;">
      ${tile}
      <div style="flex:1;">
        <div style="color:${T.text};font-size:15px;font-weight:800;">${name}</div>
        <div style="color:${T.text2};font-size:${modern ? 12 : 10}px;margin-top:2px;">${sub}</div>
        <div style="height:6px;background:${T.surface2};border-radius:3px;margin-top:5px;overflow:hidden;"><div style="width:${strength}%;height:100%;background:${hex};"></div></div>
        <div style="display:flex;gap:4px;margin-top:6px;">${tags.map((t) => `<span style="border:1px solid ${hex};color:${hex};font-size:10px;font-weight:700;padding:1px 7px;border-radius:999px;">${t}</span>`).join('')}</div>
      </div>
    </div>`;
  };

  return tabRow(['Personal', 'Network', 'Favors', 'Attention'], 1, modern ? id.hex : T.info) + scroll(`
    ${modern ? statsNew : statsOld}
    ${netRow(VOTE, '168,85,247', '#A855F7', 'Marcus Webb', 'Lobbyist · 34 influence', 68, ['Politics', 'Influence'])}
    ${netRow(ALERT_SHIELD, '245,158,11', T.warning, 'Silkroad_Vex', 'Vendor · 4.7 rep · 128 reviews', 47, ['Dark web', '$120/wk'])}
    ${netRow(CASE, '16,185,129', T.success, 'Harbor Cafe', 'Partner · $340/wk', 82, ['Business'])}
  `, 12);
}

// ═══════════════════════════ SPARK (swipe deck) ═══════════════════════════
function sparkScreen(modern) {
  const id = ID.spark;
  const wicon = (path) => `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2" style="vertical-align:middle;">${path}</svg>`;
  const PIN = '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>';
  const pill = (t) => `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.18);color:#fff;font-size:11px;font-weight:500;padding:3px 9px;border-radius:999px;">${t}</span>`;
  const faceImg = (src) => `<img src="${src}" style="width:100%;height:100%;object-fit:cover;object-position:center top;transform:scale(1.34);transform-origin:center top;"/>`;

  // BEFORE (faithful): the old scrim gradient's colors[0] was 'transparent' →
  // the fallback rendered NOTHING. Text sat on the bare photo.
  // Faithful to ProfileCard's SCRIM_STEPS: gentle alpha steps up top, heavier
  // near the text, flat 0.30 base band at the very bottom (fallback quirk).
  const STEPS = [[64, 0.10], [50, 0.12], [38, 0.16], [28, 0.20], [19, 0.26], [11, 0.30]];
  const scrim = modern
    ? STEPS.map(([h, a]) => `<div style="position:absolute;left:0;right:0;bottom:0;height:${h}%;background:rgba(0,0,0,${a});"></div>`).join('')
    : '';
  const cardShell = modern
    ? `border-radius:20px;background:${T.surface};border:1px solid rgba(255,255,255,0.15);box-shadow:0 6px 16px rgba(0,0,0,0.35);`
    : `border-radius:20px;background:${T.surface};`;
  const hairline = modern ? `<div style="position:absolute;top:0;left:0;right:0;height:1px;background:rgba(255,255,255,0.08);"></div>` : '';

  const topCard = `<div style="position:absolute;inset:0;${cardShell}">
    <div style="position:absolute;inset:0;border-radius:20px;overflow:hidden;">
      ${faceImg(FEMALE)}
      ${scrim}
      ${hairline}
      <div style="position:absolute;left:0;right:0;bottom:0;padding:20px;display:flex;flex-direction:column;gap:6px;">
        <div style="display:flex;align-items:baseline;gap:8px;"><span style="color:#fff;font-size:26px;font-weight:800;${modern ? '' : 'text-shadow:none;'}">Sarah</span><span style="color:rgba(255,255,255,0.85);font-size:20px;font-weight:300;">24</span></div>
        <div style="display:flex;align-items:center;gap:12px;color:rgba(255,255,255,0.9);font-size:11px;">
          <span style="display:inline-flex;align-items:center;gap:4px;">${wicon(PIN)}2 mi</span>
          <span style="display:inline-flex;align-items:center;gap:4px;">${wicon(CASE)}Marketing Manager</span></div>
        <div style="color:rgba(255,255,255,0.92);font-size:12px;line-height:17px;">Love hiking and coffee. Looking for someone who shares my passion for adventure and good conversation.</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">${pill('Hiking')}${pill('Coffee')}${pill('Travel')}${pill('Photography')}</div>
      </div>
    </div>
  </div>`;
  const behind = `<div style="position:absolute;inset:0;transform:scale(0.94) translateY(${modern ? 12 : 0}px);opacity:0.85;"><div style="width:100%;height:100%;${cardShell}overflow:hidden;border-radius:20px;">${faceImg(MALE)}</div></div>`;

  const actionBtn = (border, glyph, big, fill) => {
    const d = big ? 52 : 42;
    return `<div style="width:${d}px;height:${d}px;border-radius:${d / 2}px;background:${fill || 'rgba(15,23,42,0.6)'};border:${fill ? 'none' : `2px solid ${border}`};display:flex;align-items:center;justify-content:center;${fill && modern ? 'box-shadow:0 4px 14px rgba(244,63,94,0.4);' : ''}">${glyph}</div>`;
  };

  return `<div style="display:flex;align-items:center;padding:8px 16px;border-bottom:1px solid ${T.border};flex:0 0 auto;">
    <div style="width:40px;color:${T.text};font-size:20px;">‹</div>
    <div style="flex:1;display:flex;justify-content:center;"><div style="background:${id.hex};padding:4px 12px;border-radius:8px;display:flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="1"><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 .5-2S6 10 6 14a6 6 0 0 0 12 0c0-6-6-12-6-12z"/></svg><span style="color:#fff;font-size:14px;font-weight:700;letter-spacing:0.4px;">spark</span></div></div>
    <div style="width:40px;text-align:right;">${icon(T.text2, '<path d="M3 7l4 5 5-7 5 7 4-5v11H3z"/>', 20)}</div></div>
  <div style="flex:1;display:flex;flex-direction:column;padding:8px 16px 16px;">
    <div style="flex:1;position:relative;margin-bottom:6px;">${behind}${topCard}</div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:${modern ? 14 : 8}px 8px;">
      <span style="color:${T.text2};font-size:12px;font-weight:500;">12 swipes left · 1 super</span></div>
    <div style="display:flex;justify-content:space-around;align-items:center;">
      ${actionBtn('#FBBF24', icon('#FBBF24', '<path d="M3 2v6h6"/><path d="M3 8a9 9 0 1 0 3-5"/>', 16, 2.4))}
      ${actionBtn(T.danger, icon(T.danger, '<path d="M18 6L6 18M6 6l12 12"/>', 22, 2.4), true)}
      ${actionBtn(T.info, icon(T.info, '<path d="M12 2l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9z"/>', 16, 2.4))}
      ${actionBtn('', `<svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="1.5"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/></svg>`, true, id.hex)}
      ${actionBtn(T.reputation, icon(T.reputation, '<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>', 16, 2.4))}
    </div>
  </div>`;
}

// ── compose pages ────────────────────────────────────────────────────────────
function pair(title, subtitle, bodyFn, legend) {
  const before = phone(bodyFn(false), { caption: 'Before', captionColor: T.muted });
  const after = phone(bodyFn(true), { caption: 'After — Slate Glass', captionColor: T.success });
  return pageShell({
    title, subtitle,
    body: `<div style="display:flex;justify-content:center;gap:64px;margin-top:34px;">${before}${after}</div>
      <div style="display:flex;justify-content:center;gap:44px;margin-top:48px;flex-wrap:wrap;max-width:1050px;margin-left:auto;margin-right:auto;">${legend}</div>`,
  });
}

const OUT = resolve(ROOT, 'screenshots');
const jobs = [
  {
    file: 'slate-glass-bank.png',
    title: 'Bank — layered, lit, alive',
    subtitle: 'Blue identity. One hero, real depth, zero extra noise.',
    body: bankScreen,
    legend: [
      legendItem(ID.bank.hex, 'One focal hero', 'Cash / Bank / Invested / Debt live in a single "Overview" glass hero — blue tint wash, soft glow, lit top edge — instead of four flat gray tiles.'),
      legendItem(T.success, 'Real depth', 'Every card sits on a soft shadow with a solid slate surface and friendlier 16pt radius — layered, not painted-on.'),
      legendItem(T.text2, 'Tinted, not shouted', 'Icons live in translucent identity-tinted bubbles; the score chip matches. Solid color only on the CTA pills.'),
    ].join(''),
  },
  {
    file: 'slate-glass-stocks.png',
    title: 'Stocks — a purple-glass terminal',
    subtitle: 'Purple identity; green and red stay reserved for your P/L.',
    body: stocksScreen,
    legend: [
      legendItem(ID.stocks.hex, 'Portfolio hero', 'Your value headlines a purple glass hero with a tinted briefcase bubble — the one focal surface on the screen.'),
      legendItem(T.success, 'Data keeps the color', 'Green/red now mean only gains and losses — the chrome stopped competing with your numbers.'),
      legendItem(T.text2, 'Tinted tickers', 'Sector bubbles went from solid paint to translucent tints with the ticker in the sector color — calmer, still scannable.'),
    ].join(''),
  },
  {
    file: 'slate-glass-contacts.png',
    title: 'Contacts — your network, warmly lit',
    subtitle: 'Amber identity. The Network tab, before and after.',
    body: contactsScreen,
    legend: [
      legendItem(ID.contacts.hex, 'Amber network hero', '"Your network" became a warm glass hero with tint wash + glow — the tab\'s single focal point.'),
      legendItem(T.success, 'Rows with depth', 'Contact cards float on soft shadows with tinted icon tiles instead of solid-painted squares.'),
      legendItem(T.text2, 'Readable meta', 'Subtitles bumped a step; every color now signals meaning (kind, strength) instead of decoration.'),
    ].join(''),
  },
  {
    file: 'slate-glass-spark.png',
    title: 'Spark — the scrim that finally renders',
    subtitle: 'The old scrim was invisible at runtime (fallback quirk). Now it\'s real.',
    body: sparkScreen,
    legend: [
      legendItem(ID.spark.hex, 'Legible identity block', 'The old scrim\'s first color was "transparent" — the gradient fallback rendered nothing, leaving text on bare photo. Stacked translucent layers now actually darken the bottom.'),
      legendItem(T.success, 'A card with presence', 'Glass border + shadow + lit top edge lift the deck off the background; the next card peeks below.'),
      legendItem(T.text2, 'Calmer chrome', 'One rose accent (wordmark, Like, active states); everything else stays slate.'),
    ].join(''),
  },
];

for (const j of jobs) {
  await renderToPng(chromium, pair(j.title, j.subtitle, j.body, j.legend), resolve(OUT, j.file), 1160);
  console.log('wrote', j.file);
}
console.log('done');
