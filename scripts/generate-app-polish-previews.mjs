/**
 * generate-app-polish-previews.mjs
 *
 * Before/after previews for Batch-1 app polish (Bank, Stocks, Contacts, Spark).
 * Faithful mocks from each app's real tokens/layout (see per-app UI audit).
 * Renders one representative screen per app, before vs after, with a legend.
 *
 *   node scripts/generate-app-polish-previews.mjs
 */
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import {
  ROOT, T, GRAD, grad, esc, faceURI, avatarFace, avatarInitial,
  phone, pageShell, legendItem, renderToPng,
} from './lib/phoneFrame.mjs';

const FEMALE = faceURI('Female.png');
const MALE = faceURI('Male.png');
const OLDF = faceURI('Old_Female.png');

// ── shared bits ──────────────────────────────────────────────────────────────
const appHeader = (title, right = '') => `
  <div style="display:flex;align-items:center;padding:8px 16px;border-bottom:1px solid ${T.border};flex:0 0 auto;">
    <div style="width:40px;color:${T.text};font-size:22px;">‹</div>
    <div style="flex:1;color:${T.text};font-size:16px;font-weight:700;">${title}</div>
    ${right}
  </div>`;
const chip = (txt) => `<div style="background:${T.surface2};border:1px solid ${T.border};border-radius:999px;padding:4px 8px;color:${T.text};font-size:12px;font-weight:700;">${txt}</div>`;
const tabRow = (tabs, activeIdx) => `<div style="display:flex;border-bottom:1px solid ${T.border};flex:0 0 auto;">
  ${tabs.map((t, i) => `<div style="flex:1;text-align:center;padding:8px 0;font-size:12px;font-weight:${i === activeIdx ? 700 : 600};color:${i === activeIdx ? T.info : T.text2};border-bottom:2px solid ${i === activeIdx ? T.info : 'transparent'};">${t}</div>`).join('')}
</div>`;
const scroll = (inner, gap = 16) => `<div style="flex:1;overflow:hidden;padding:16px;display:flex;flex-direction:column;gap:${gap}px;">${inner}</div>`;

// ═══════════════════════════ BANK ═══════════════════════════
function bankScreen(polished) {
  const cardRadius = polished ? 12 : 16;
  const statSize = polished ? 16 : 15;
  const sectionGap = polished ? 16 : 8;
  const tnum = polished ? 'font-variant-numeric:tabular-nums;' : '';

  const gauge = `<div style="background:${T.surface2};border:1px solid ${T.border};border-radius:${cardRadius}px;padding:8px;">
    <div style="display:flex;align-items:center;gap:6px;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${T.warning}" stroke-width="2"><path d="M12 2l8 3v6c0 5-3.5 8-8 11-4.5-3-8-6-8-11V5z"/></svg>
      <span style="color:${T.text2};font-size:12px;font-weight:600;">Credit Score</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-top:2px;">
      <span style="color:${T.text};font-size:20px;font-weight:800;${tnum}">650</span>
      <span style="color:${T.warning};font-size:15px;font-weight:700;">Fair</span>
    </div>
    <div style="height:6px;background:${T.border};border-radius:3px;margin-top:6px;overflow:hidden;"><div style="width:63.6%;height:100%;background:${T.warning};"></div></div>
    <div style="display:flex;justify-content:space-between;margin-top:4px;"><span style="color:${T.muted};font-size:10px;">300</span><span style="color:${T.muted};font-size:10px;">850</span></div>
  </div>`;

  const stat = (label, val, danger) => `<div style="flex-basis:48%;flex-grow:1;background:${T.surface2};border:1px solid ${T.border};border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:2px;">
    <span style="color:${T.muted};font-size:10px;font-weight:600;">${label}</span>
    <span style="color:${danger ? T.danger : T.text};font-size:${statSize}px;font-weight:800;${tnum}">${val}</span></div>`;
  const stats = `<div style="display:flex;flex-wrap:wrap;gap:8px;">${stat('Cash', '$1,234')}${stat('Bank', '$2,036')}${stat('Invested', '$0')}${stat('Debt', '$0')}</div>`;

  const sectionHeader = (title, add) => `<div style="display:flex;align-items:center;justify-content:space-between;margin-top:${sectionGap}px;">
    <span style="color:${T.text};font-size:15px;font-weight:700;">${title}</span>
    <div style="display:flex;align-items:center;gap:4px;background:${T.info};padding:4px 8px;border-radius:999px;"><span style="color:#fff;font-size:12px;">+</span><span style="color:#fff;font-size:10px;font-weight:700;">${add}</span></div></div>`;

  const acctRow = (icon, name, sub, bal, chipHtml = '') => `<div style="background:${T.surface2};border:1px solid ${T.border};border-radius:12px;padding:16px;display:flex;align-items:center;gap:16px;">
    <div style="width:40px;height:40px;border-radius:20px;background:${T.surface};display:flex;align-items:center;justify-content:center;color:${T.text2};">${icon}</div>
    <div style="flex:1;"><div style="display:flex;align-items:center;gap:6px;"><span style="color:${T.text};font-size:15px;font-weight:700;">${name}</span>${chipHtml}</div><div style="color:${T.muted};font-size:12px;margin-top:2px;">${sub}</div></div>
    <span style="color:${T.text};font-size:16px;font-weight:800;${tnum}">${bal}</span>
    <span style="color:${T.muted};font-size:16px;">›</span></div>`;
  const wallet = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M16 12h3"/></svg>`;
  const piggy = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 10c1 0 2 1 2 2s-1 2-2 2M4 12a6 5 0 0 1 6-5h3a6 5 0 0 1 6 5 6 5 0 0 1-6 5H10a6 5 0 0 1-6-5z"/><circle cx="15" cy="11" r="1" fill="currentColor"/></svg>`;
  const aprChip = `<span style="background:rgba(16,185,129,0.15);color:${T.success};font-size:10px;font-weight:700;padding:1px 5px;border-radius:4px;">2.00% APR</span>`;

  const emptyBefore = (txt) => `<div style="text-align:center;color:${T.muted};font-size:12px;padding:16px 0;">${txt}</div>`;
  const emptyAfter = (txt) => `<div style="background:${T.surface2};border:1px solid ${T.border};border-radius:12px;padding:24px;text-align:center;color:${T.muted};font-size:12px;">${txt}</div>`;
  const empty = polished ? emptyAfter : emptyBefore;

  return scroll(`
    ${gauge}
    ${stats}
    ${sectionHeader('Accounts', 'Open')}
    ${acctRow(wallet, 'Everyday Checking', 'Checking', '$1,200')}
    ${acctRow(piggy, 'Savings', 'Savings', '$836', aprChip)}
    ${sectionHeader('Loans', 'Apply')}
    ${empty('No active loans.')}
    ${sectionHeader('Credit Cards', 'Apply')}
    ${empty('No cards yet.')}
  `, 0);
}

// ═══════════════════════════ STOCKS ═══════════════════════════
function stocksScreen(polished) {
  const rowPadV = polished ? 8 : 16;
  const tnum = polished ? 'font-variant-numeric:tabular-nums;' : '';
  const sign = (pct) => polished ? (pct > 0 ? '+' : '') + pct.toFixed(2) : Math.abs(pct).toFixed(2);

  const SECTOR = { Tech: T.info, Finance: T.success, Consumer: T.warning };
  const row = (sym, sector, price, pct, sub) => {
    const up = pct > 0, flat = pct === 0;
    const col = up ? T.success : (flat ? T.muted : T.danger);
    const arrow = up ? '<path d="M4 14l6-6 4 4 6-7"/><path d="M17 5h4v4"/>' : '<path d="M4 10l6 6 4-4 6 7"/><path d="M17 19h4v-4"/>';
    return `<div style="background:${T.surface2};border:1px solid ${T.border};border-radius:12px;padding:${rowPadV}px 16px;display:flex;align-items:center;gap:8px;">
      <div style="width:40px;height:40px;border-radius:20px;background:${SECTOR[sector]};display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;">${sym.slice(0, 4)}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:4px;"><span style="color:${T.text};font-size:15px;font-weight:700;">${sym}</span>
          <span style="border:1px solid ${SECTOR[sector]};color:${SECTOR[sector]};font-size:10px;font-weight:700;padding:1px 4px;border-radius:4px;">${sector}</span></div>
        ${sub ? `<div style="color:${T.muted};font-size:10px;margin-top:2px;">${sub}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;">
        <span style="color:${T.text};font-size:15px;font-weight:800;${tnum}">${price}</span>
        <div style="display:flex;align-items:center;gap:2px;margin-top:2px;">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="${col}" stroke-width="2.4">${arrow}</svg>
          <span style="color:${col};font-size:10px;font-weight:700;${tnum}">${sign(pct)}%</span></div>
      </div></div>`;
  };

  return `
    ${tabRow(['Market', 'Portfolio', 'Orders'], 0)}
    ${scroll(`
      <span style="color:${T.text};font-size:15px;font-weight:700;">All Stocks</span>
      ${row('AAPL', 'Tech', '$150.25', 1.20, '0.60% annual dividend')}
      ${row('GOOGL', 'Tech', '$2,751', -0.80, '')}
      ${row('MSFT', 'Tech', '$310.45', 0.50, '0.80% annual dividend')}
      ${row('TSLA', 'Tech', '$245.67', -2.10, '')}
      ${row('NVDA', 'Tech', '$432.50', 3.40, '')}
      ${row('JPM', 'Finance', '$142.85', 0.30, '2.50% annual dividend')}
      ${row('KO', 'Consumer', '$58.75', -0.40, '3.10% annual dividend')}
    `, 12)}`;
}

// ═══════════════════════════ CONTACTS ═══════════════════════════
function contactsScreen(polished) {
  const subSize = polished ? 12 : 10;
  // strengthColor ramp — before: >=60 warning, >=40 amber (two oranges); after: >=60 gold, >=40 warning
  const strengthColor = (s) => {
    if (s >= 80) return T.success;
    if (s >= 60) return polished ? '#FACC15' : T.warning;
    if (s >= 40) return polished ? T.warning : '#F97316';
    return T.danger;
  };
  const card = (photo, name, sub, mood, strength) => {
    const full = polished ? `${sub} · ${mood}` : `${sub} ·  ${mood}`; // before: dead emoji → double space
    return `<div style="background:${T.surface};border:1px solid ${T.border};border-radius:12px;padding:16px;display:flex;align-items:center;gap:16px;">
      <img src="${photo}" style="width:48px;height:48px;border-radius:24px;object-fit:cover;object-position:center top;"/>
      <div style="flex:1;">
        <div style="color:${T.text};font-size:15px;font-weight:800;">${name}</div>
        <div style="color:${T.text2};font-size:${subSize}px;margin-top:2px;">${full}</div>
        <div style="height:6px;background:${T.surface2};border-radius:3px;margin-top:4px;overflow:hidden;"><div style="width:${strength}%;height:100%;background:${strengthColor(strength)};"></div></div>
      </div>
      ${polished ? `<span style="color:${strengthColor(strength)};font-size:15px;font-weight:800;font-variant-numeric:tabular-nums;">${strength}</span>` : ''}
      <span style="color:${T.text2};font-size:18px;">⌄</span>
    </div>`;
  };
  return `
    ${tabRow(['Personal', 'Network', 'Favors', 'Attention'], 0)}
    ${scroll(`
      ${card(OLDF, 'Sarah', 'Partner · romantic', 'Happy', 78)}
      ${card(FEMALE, 'Mom', 'Parent · friendly', 'Happy', 92)}
      ${card(MALE, 'Jake', 'Friend · ambitious', 'Neutral', 54)}
      ${card(MALE, 'Chris', 'Friend · introverted', 'Stressed', 33)}
    `)}`;
}

// ═══════════════════════════ SPARK ═══════════════════════════
function sparkScreen(polished) {
  const scrimMid = polished ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.0)';
  const cardEdge = polished
    ? `border:1px solid rgba(255,255,255,0.12);box-shadow:0 8px 22px rgba(0,0,0,0.45);`
    : '';
  const statusPadV = polished ? 16 : 8;
  const wicon = (path) => `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2" style="vertical-align:middle;">${path}</svg>`;
  const PIN = '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>';
  const BAG = '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
  const CAP = '<path d="M2 9l10-4 10 4-10 4z"/><path d="M6 11v4c0 1 2.5 2.5 6 2.5s6-1.5 6-2.5v-4"/>';
  const pill = (t) => `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.18);color:#fff;font-size:11px;font-weight:500;padding:3px 9px;border-radius:999px;">${t}</span>`;
  const pillIcon = (path, t) => `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(255,255,255,0.18);color:#fff;font-size:11px;font-weight:500;padding:3px 9px;border-radius:999px;">${wicon(path)}${t}</span>`;
  const meta = (path, t) => `<span style="display:inline-flex;align-items:center;gap:4px;">${wicon(path)}${t}</span>`;

  // The Face art assets carry decorative flourishes (a heart / sparkles) at the
  // bottom of the square; a real dating card frames tight on the face, so zoom
  // into the portrait to crop those out and fill the frame with the face.
  const faceImg = (src) => `<img src="${src}" style="width:100%;height:100%;object-fit:cover;object-position:center top;transform:scale(1.34);transform-origin:center top;"/>`;
  const behind = polished
    ? `<div style="position:absolute;inset:0;transform:scale(0.94) translateY(12px);opacity:0.85;"><div style="width:100%;height:100%;border-radius:20px;overflow:hidden;background:${T.surface};${cardEdge}">${faceImg(MALE)}</div></div>`
    : `<div style="position:absolute;inset:0;transform:scale(0.94);opacity:0.85;"><div style="width:100%;height:100%;border-radius:20px;overflow:hidden;background:${T.surface};">${faceImg(MALE)}</div></div>`;

  const topCard = `<div style="position:absolute;inset:0;border-radius:20px;overflow:hidden;background:${T.surface};${cardEdge}">
    ${faceImg(FEMALE)}
    <div style="position:absolute;inset:0;background:linear-gradient(to bottom, transparent 0%, ${scrimMid} 55%, rgba(0,0,0,0.85) 100%);"></div>
    <div style="position:absolute;left:0;right:0;bottom:0;padding:20px;display:flex;flex-direction:column;gap:6px;">
      <div style="display:flex;align-items:baseline;gap:8px;"><span style="color:#fff;font-size:26px;font-weight:800;">Sarah</span><span style="color:rgba(255,255,255,0.85);font-size:20px;font-weight:300;">24</span></div>
      <div style="display:flex;align-items:center;gap:12px;color:rgba(255,255,255,0.9);font-size:11px;">
        ${meta(PIN, '2 mi')}${meta(BAG, 'Marketing Manager')}</div>
      <div style="display:flex;align-items:center;gap:8px;">${pillIcon(CAP, 'Bachelor\'s')}${pill('Comfortable')}</div>
      <div style="color:rgba(255,255,255,0.92);font-size:12px;line-height:17px;">Love hiking and coffee. Looking for someone who shares my passion for adventure and good conversation.</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">${pill('Hiking')}${pill('Coffee')}${pill('Travel')}${pill('Photography')}</div>
    </div>
  </div>`;

  const actionBtn = (bg, border, glyph, big) => {
    const d = big ? 52 : 42;
    return `<div style="width:${d}px;height:${d}px;border-radius:${d / 2}px;background:${bg};border:${border};display:flex;align-items:center;justify-content:center;">${glyph}</div>`;
  };
  const outline = 'rgba(15,23,42,0.6)';
  const icon = (stroke, path, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2.4">${path}</svg>`;

  return `
    <div style="flex:1;display:flex;flex-direction:column;padding:8px 16px 16px;">
      <div style="flex:1;position:relative;margin-bottom:${polished ? 6 : 0}px;">
        ${behind}
        ${topCard}
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;padding:${statusPadV}px 8px;">
        <span style="color:${T.text2};font-size:12px;font-weight:500;">12 swipes left · 1 super</span>
      </div>
      <div style="display:flex;justify-content:space-around;align-items:center;">
        ${actionBtn(outline, `2px solid #FBBF24`, icon('#FBBF24', '<path d="M3 2v6h6"/><path d="M3 8a9 9 0 1 0 3-5"/>', 16))}
        ${actionBtn(outline, `2px solid ${T.danger}`, icon(T.danger, '<path d="M18 6L6 18M6 6l12 12"/>', 22), true)}
        ${actionBtn(outline, `2px solid ${T.info}`, icon(T.info, '<path d="M12 2l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9z"/>', 16))}
        ${actionBtn(grad(GRAD.spark), 'none', icon('#fff', '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>', 24), true)}
        ${actionBtn(outline, `2px solid ${T.reputation}`, icon(T.reputation, '<path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>', 16))}
      </div>
    </div>`;
}

const sparkHeaderRight = `<div style="width:40px;text-align:right;"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="${T.text2}" stroke-width="2"><path d="M3 7l4 5 5-7 5 7 4-5v11H3z"/></svg></div>`;
const sparkHeader = `<div style="display:flex;align-items:center;padding:8px 16px;border-bottom:1px solid ${T.border};flex:0 0 auto;">
  <div style="width:40px;color:${T.text};font-size:20px;">‹</div>
  <div style="flex:1;display:flex;justify-content:center;"><div style="background:${grad(GRAD.spark)};padding:4px 12px;border-radius:8px;display:flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" stroke="#fff" stroke-width="1"><path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1 .5-2 .5-2S6 10 6 14a6 6 0 0 0 12 0c0-6-6-12-6-12z"/></svg><span style="color:#fff;font-size:14px;font-weight:700;letter-spacing:0.4px;">spark</span></div></div>
  ${sparkHeaderRight}</div>`;

// ── compose one before/after page per app ────────────────────────────────────
function pair(appTitle, headerHtml, bodyFn, legend, subtitle) {
  const before = phone(headerHtml(false) + bodyFn(false), { caption: 'Before', captionColor: T.muted });
  const after = phone(headerHtml(true) + bodyFn(true), { caption: 'After', captionColor: T.success });
  return pageShell({
    title: appTitle,
    subtitle,
    body: `
      <div style="display:flex;justify-content:center;gap:64px;margin-top:34px;">${before}${after}</div>
      <div style="display:flex;justify-content:center;gap:44px;margin-top:48px;flex-wrap:wrap;max-width:1000px;margin-left:auto;margin-right:auto;">${legend}</div>`,
  });
}

const OUT = resolve(ROOT, 'screenshots');
const jobs = [
  {
    file: 'app-polish-bank.png',
    title: 'Bank — cleaner hierarchy & empty states',
    subtitle: 'Same data, tighter structure now that the app runs full-screen.',
    header: () => appHeader('Bank', chip('650')),
    body: bankScreen,
    legend: [
      legendItem(GRAD.pulse[0], 'Empty sections are cards', 'Loans / Cards / Goals no longer float as bare text between bordered rows — they share the same card rhythm.'),
      legendItem(T.success, 'Stronger summary', 'Cash / Bank / Invested / Debt are larger with tabular figures, so the headline numbers outrank line items.'),
      legendItem(T.info, 'One radius, clearer sections', 'The credit gauge matches every other card, and sections sit further apart than the rows inside them.'),
    ].join(''),
  },
  {
    file: 'app-polish-stocks.png',
    title: 'Stocks — reads like a trading terminal',
    subtitle: 'The Market list, before and after.',
    header: () => appHeader('Stocks', chip('$1,234')),
    body: stocksScreen,
    legend: [
      legendItem(T.success, 'Signed % changes', 'Was a bare "2.50%" relying only on color. Now +2.50% / -0.80% state direction explicitly.'),
      legendItem(T.info, 'Tabular figures', 'Digits line up column-to-column so prices and changes scan cleanly down the list.'),
      legendItem(GRAD.pulse[0], 'Tighter rows', 'Reduced vertical padding fits more of the market on screen without crowding.'),
    ].join(''),
  },
  {
    file: 'app-polish-contacts.png',
    title: 'Contacts — the number the meter implied',
    subtitle: 'The Personal list, before and after.',
    header: () => appHeader('Contacts'),
    body: contactsScreen,
    legend: [
      legendItem(T.success, 'Strength score surfaced', 'Each contact now shows its 0–100 score, colored by tier, beside the meter — not hidden in another tab.'),
      legendItem('#FACC15', 'Separated meter colors', 'The two near-identical oranges became a clean red → orange → gold → green ramp.'),
      legendItem(T.info, 'Readable subtitle', 'Bumped up a step and dropped a dead mood-emoji that left a stray double space.'),
    ].join(''),
  },
  {
    file: 'app-polish-spark.png',
    title: 'Spark — the card reads as a card',
    subtitle: 'The swipe deck, before and after.',
    header: () => sparkHeader,
    body: sparkScreen,
    legend: [
      legendItem(GRAD.spark[0], 'The card has an edge', 'A hairline border + shadow lift the photo card off the dark background instead of bleeding into it.'),
      legendItem(T.success, 'Legible text scrim', 'A stronger gradient under the name/bio so they read cleanly over any photo.'),
      legendItem(T.info, 'The deck reads as a stack', 'The next card peeks below, and the swipe counter gets breathing room above the buttons.'),
    ].join(''),
  },
];

const browser = await chromium.launch();
await browser.close(); // warm check
for (const j of jobs) {
  await renderToPng(chromium, pair(j.title, j.header, j.body, j.legend, j.subtitle), resolve(OUT, j.file), 1160);
  console.log('wrote', j.file);
}
console.log('done');
