/**
 * generate-phone-batch2-previews.mjs
 *
 * Slate Glass before/after previews for the phone batch: Education (cyan),
 * Pets (gold), Hustle (indigo). Faithful to the fallback's flat-fill rendering
 * (tint washes are flat rgba + glow blob, no real gradients).
 *
 *   node scripts/generate-phone-batch2-previews.mjs
 */
import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, legendItem, renderToPng } from './lib/phoneFrame.mjs';

const CYAN = { hex: '#06B6D4', rgb: '6,182,212' };
const GOLD = { hex: '#EAB308', rgb: '234,179,8' };
const INDIGO = { hex: '#6366F1', rgb: '99,102,241' };

const L1 = `background:${T.surface};border:1px solid ${T.border};border-radius:16px;box-shadow:0 3px 16px rgba(0,0,0,0.28);`;
const L2 = `background:${T.surface};border:1px solid rgba(255,255,255,0.15);border-radius:20px;box-shadow:0 6px 16px rgba(0,0,0,0.30);`;
const FLAT = `background:${T.surface2};border:1px solid ${T.border};border-radius:12px;`;
const tnum = 'font-variant-numeric:tabular-nums;';

const icon = (stroke, path, size = 18, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${sw}">${path}</svg>`;
const CASE = '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>';
const CAP = '<path d="M2 9l10-4 10 4-10 4z"/><path d="M6 11v4c0 1 2.5 2.5 6 2.5s6-1.5 6-2.5v-4"/>';
const PAW = '<circle cx="8" cy="7" r="2"/><circle cx="16" cy="7" r="2"/><circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M12 11c-2.5 0-5 2.2-5 4.5C7 17.4 8 19 9.6 19c1 0 1.6-.5 2.4-.5s1.4.5 2.4.5c1.6 0 2.6-1.6 2.6-3.5 0-2.3-2.5-4.5-5-4.5z"/>';
const BUILD = '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M9 16h2M13 16h2"/>';

const bubble = (id, size, inner) =>
  `<div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:rgba(${id.rgb},0.15);border:1px solid rgba(${id.rgb},0.30);display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${inner}</div>`;
const hero = (id, eyebrow, content) => `
  <div style="${L2}position:relative;">
    <div style="position:relative;border-radius:20px;overflow:hidden;padding:18px;">
      <div style="position:absolute;inset:0;background:rgba(${id.rgb},0.14);"></div>
      <div style="position:absolute;top:-48px;right:-36px;width:150px;height:150px;border-radius:75px;background:rgba(${id.rgb},0.10);"></div>
      <div style="position:absolute;top:0;left:0;right:0;height:1px;background:rgba(255,255,255,0.08);"></div>
      <div style="position:relative;">
        <div style="color:${T.muted};font-size:10px;font-weight:700;letter-spacing:1.2px;">${eyebrow}</div>
        ${content}
      </div>
    </div>
  </div>`;

const topBar = (title, chipTxt, id, modern) => {
  const chip = modern
    ? `background:rgba(${id.rgb},0.14);border:1px solid rgba(${id.rgb},0.30);`
    : `background:${T.surface2};border:1px solid ${T.border};`;
  return `<div style="display:flex;align-items:center;padding:8px 16px;${modern ? '' : `border-bottom:1px solid ${T.border};`}flex:0 0 auto;">
    <div style="width:40px;height:40px;display:flex;align-items:center;color:${T.text};font-size:22px;">‹</div>
    <div style="flex:1;color:${T.text};font-size:16px;font-weight:700;">${title}</div>
    <div style="${chip}border-radius:999px;padding:4px 9px;color:${T.text};font-size:12px;font-weight:700;${tnum}">${chipTxt}</div>
  </div>`;
};

// old underline tabs vs new segmented pills
const tabsOld = (tabs, act) => `<div style="display:flex;border-bottom:1px solid ${T.border};flex:0 0 auto;">
  ${tabs.map((t, i) => `<div style="flex:1;text-align:center;padding:8px 0;font-size:12px;font-weight:600;color:${i === act ? T.info : T.text2};border-bottom:2px solid ${i === act ? T.info : 'transparent'};">${t}</div>`).join('')}</div>`;
const tabsNew = (tabs, act, id) => `<div style="margin:8px 16px 0;padding:4px;border-radius:14px;background:${T.surface};border:1px solid ${T.border};display:flex;gap:4px;flex:0 0 auto;">
  ${tabs.map((t, i) => `<div style="flex:1;text-align:center;padding:7px 0;font-size:12px;font-weight:${i === act ? 700 : 600};color:${i === act ? id.hex : T.muted};background:${i === act ? `rgba(${id.rgb},0.16)` : 'transparent'};border-radius:10px;">${t}</div>`).join('')}</div>`;

const scroll = (inner, gap = 12) => `<div style="flex:1;overflow:hidden;padding:16px;display:flex;flex-direction:column;gap:${gap}px;">${inner}</div>`;
const meter = (pct, color) => `<div style="height:6px;background:${T.surface2};border-radius:3px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:${color};"></div></div>`;

// ═════════════ EDUCATION (Enrolled tab) ═════════════
function educationScreen(modern) {
  const id = CYAN;
  const gpaHero = modern
    ? hero(id, 'BEST GPA', `<div style="display:flex;align-items:center;gap:12px;margin-top:8px;">
        ${bubble(id, 44, icon(id.hex, CAP, 21))}
        <div><div style="color:${T.text};font-size:26px;font-weight:800;${tnum}">3.8</div>
        <div style="color:${T.text2};font-size:11px;margin-top:2px;">across 2 completed programs</div></div>
      </div>`)
    : `<div style="${FLAT}padding:14px;display:flex;align-items:center;gap:10px;">
        <div style="width:40px;height:40px;border-radius:20px;background:${T.info};display:flex;align-items:center;justify-content:center;">${icon('#fff', CAP, 20)}</div>
        <div><div style="color:${T.muted};font-size:10px;font-weight:600;">Best GPA</div>
        <div style="color:${T.text};font-size:20px;font-weight:800;${tnum}">3.8</div></div></div>`;

  const course = (name, sub, pct) => {
    const study = modern
      ? `<div style="background:rgba(${id.rgb},0.16);border-radius:10px;padding:6px 14px;color:${id.hex};font-size:11px;font-weight:700;">Study</div>`
      : `<div style="background:${T.info};border-radius:8px;padding:6px 14px;color:#fff;font-size:11px;font-weight:700;">Study</div>`;
    const withdraw = modern
      ? `<div style="background:rgba(239,68,68,0.10);border:1px solid rgba(239,68,68,0.30);border-radius:10px;padding:6px 12px;color:${T.danger};font-size:11px;font-weight:700;">Withdraw</div>`
      : `<div style="background:${T.danger};border-radius:8px;padding:6px 12px;color:#fff;font-size:11px;font-weight:700;">Withdraw</div>`;
    return `<div style="${modern ? L1 : FLAT}padding:14px 16px;">
      <div style="display:flex;align-items:center;gap:12px;">
        ${modern ? bubble(id, 40, icon(id.hex, CAP, 18)) : `<div style="width:40px;height:40px;border-radius:20px;background:${T.info};display:flex;align-items:center;justify-content:center;">${icon('#fff', CAP, 18)}</div>`}
        <div style="flex:1;"><div style="color:${T.text};font-size:15px;font-weight:700;">${name}</div>
        <div style="color:${T.muted};font-size:11px;margin-top:2px;">${sub}</div></div>
      </div>
      <div style="margin-top:10px;">${meter(pct, T.success)}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
        <span style="color:${T.muted};font-size:10px;${tnum}">${pct}% complete</span>
        <div style="display:flex;gap:6px;">${study}${withdraw}</div>
      </div></div>`;
  };

  return topBar('Education', '$1,234', id, modern)
    + (modern ? tabsNew(['Catalog', 'Enrolled', 'Completed'], 1, id) : tabsOld(['Catalog', 'Enrolled', 'Completed'], 1))
    + scroll(`${gpaHero}${course('Computer Science BSc', 'University · 3 yrs · GPA 3.6', 64)}${course('Real Estate License', 'Certification · 12 wks', 25)}`);
}

// ═════════════ PETS (Pets tab) ═════════════
function petsScreen(modern) {
  const id = GOLD;
  const petHero = modern
    ? hero(id, 'ACTIVE COMPANION', `<div style="display:flex;align-items:center;gap:12px;margin-top:8px;">
        ${bubble(id, 48, `<span style="font-size:24px;">🐕</span>`)}
        <div style="flex:1;">
          <div style="color:${T.text};font-size:20px;font-weight:800;">Biscuit</div>
          <div style="color:${T.text2};font-size:11px;">Golden Retriever · 2 yrs</div>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px;">
        <div><div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:${T.muted};font-size:10px;">Health</span><span style="color:${T.success};font-size:10px;font-weight:700;${tnum}">86</span></div>${meter(86, T.success)}</div>
        <div><div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span style="color:${T.muted};font-size:10px;">Happiness</span><span style="color:${T.reputation};font-size:10px;font-weight:700;${tnum}">72</span></div>${meter(72, T.reputation)}</div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <div style="flex:1;text-align:center;background:rgba(${id.rgb},0.16);border-radius:10px;padding:7px 0;color:${T.text};font-size:11px;font-weight:700;">Feed</div>
        <div style="flex:1;text-align:center;background:rgba(${id.rgb},0.16);border-radius:10px;padding:7px 0;color:${T.text};font-size:11px;font-weight:700;">Play</div>
        <div style="flex:1;text-align:center;background:rgba(${id.rgb},0.16);border-radius:10px;padding:7px 0;color:${T.text};font-size:11px;font-weight:700;">Train</div>
      </div>`)
    : `<div style="${FLAT}padding:14px;">
        <div style="display:flex;align-items:center;gap:10px;">
          <span style="font-size:28px;">🐕</span>
          <div style="flex:1;"><div style="color:${T.text};font-size:16px;font-weight:800;">Biscuit</div>
          <div style="color:${T.muted};font-size:10px;">Golden Retriever · 2 yrs</div></div>
        </div>
        <div style="margin-top:10px;">${meter(86, T.success)}</div>
        <div style="margin-top:6px;">${meter(72, T.reputation)}</div>
        <div style="display:flex;gap:6px;margin-top:10px;">
          <div style="flex:1;text-align:center;background:${T.info};border-radius:8px;padding:6px 0;color:#fff;font-size:11px;font-weight:700;">Feed</div>
          <div style="flex:1;text-align:center;background:${T.success};border-radius:8px;padding:6px 0;color:#fff;font-size:11px;font-weight:700;">Play</div>
          <div style="flex:1;text-align:center;background:${T.warning};border-radius:8px;padding:6px 0;color:#fff;font-size:11px;font-weight:700;">Train</div>
        </div></div>`;

  const otherPet = (emoji, name, sub) => `<div style="${modern ? L1 : FLAT}padding:12px 16px;display:flex;align-items:center;gap:12px;">
    ${modern ? bubble(id, 40, `<span style="font-size:19px;">${emoji}</span>`) : `<span style="font-size:26px;">${emoji}</span>`}
    <div style="flex:1;"><div style="color:${T.text};font-size:14px;font-weight:700;">${name}</div>
    <div style="color:${T.muted};font-size:11px;margin-top:1px;">${sub}</div></div>
    <span style="color:${T.muted};font-size:16px;">›</span></div>`;

  return topBar('Pets', '$1,234', id, modern)
    + (modern ? tabsNew(['Pets', 'Shop', 'Vet', 'Compete'], 0, id) : tabsOld(['Pets', 'Shop', 'Vet', 'Compete'], 0))
    + scroll(`${petHero}
      <span style="color:${T.text};font-size:14px;font-weight:700;margin-top:2px;">Your other pets</span>
      ${otherPet('🐈', 'Mochi', 'Tabby cat · 1 yr · content')}
      ${otherPet('🦜', 'Kiwi', 'Parrot · 4 yrs · chatty')}`);
}

// ═════════════ HUSTLE (Dashboard) ═════════════
function hustleScreen(modern) {
  const id = INDIGO;
  const snapHero = modern
    ? hero(id, 'EMPIRE SNAPSHOT', `<div style="display:flex;align-items:center;gap:12px;margin-top:8px;">
        ${bubble(id, 44, icon(id.hex, BUILD, 20))}
        <div><div style="color:${T.text};font-size:24px;font-weight:800;${tnum}">$128,400</div>
        <div style="color:${T.success};font-size:11px;font-weight:600;${tnum}margin-top:2px;">+$2,150/wk across 2 companies</div></div>
      </div>`)
    : `<div style="${FLAT}padding:14px;display:flex;align-items:center;gap:10px;">
        <div style="width:40px;height:40px;border-radius:20px;background:${T.info};display:flex;align-items:center;justify-content:center;">${icon('#fff', BUILD, 20)}</div>
        <div><div style="color:${T.muted};font-size:10px;font-weight:600;">Empire value</div>
        <div style="color:${T.text};font-size:20px;font-weight:800;${tnum}">$128,400</div>
        <div style="color:${T.success};font-size:10px;${tnum}">+$2,150/wk</div></div></div>`;

  const kpi = (label, val) => `<div style="flex:1;${modern ? L1 : FLAT}padding:10px 12px;display:flex;flex-direction:column;gap:2px;">
    <span style="color:${T.muted};font-size:10px;font-weight:600;">${label}</span>
    <span style="color:${T.text};font-size:15px;font-weight:800;${tnum}">${val}</span></div>`;

  const company = (emoji, name, sub, pct, col) => `<div style="${modern ? L1 : FLAT}padding:14px 16px;display:flex;align-items:center;gap:12px;">
    ${modern ? bubble(id, 40, `<span style="font-size:18px;">${emoji}</span>`) : `<div style="width:40px;height:40px;border-radius:8px;background:${col};display:flex;align-items:center;justify-content:center;"><span style="font-size:18px;">${emoji}</span></div>`}
    <div style="flex:1;">
      <div style="color:${T.text};font-size:15px;font-weight:700;">${name}</div>
      <div style="color:${T.muted};font-size:11px;margin-top:2px;">${sub}</div>
      <div style="margin-top:6px;">${meter(pct, modern ? id.hex : col)}</div>
    </div>
    <span style="color:${T.muted};font-size:16px;">›</span></div>`;

  return topBar('Hustle', '$12.3k', id, modern)
    + scroll(`${snapHero}
      <div style="display:flex;gap:8px;">${kpi('Weekly profit', '+$2,150')}${kpi('Employees', '14')}${kpi('Brand', '61')}</div>
      <span style="color:${T.text};font-size:14px;font-weight:700;margin-top:2px;">Your companies</span>
      ${company('☕', 'Harbor Coffee Co.', 'Food & Beverage · Lv 3 · $1,400/wk', 74, '#B45309')}
      ${company('🧢', 'Northside Apparel', 'Retail · Lv 2 · $750/wk', 41, '#0E7490')}`);
}

// ── compose ──────────────────────────────────────────────────────────────────
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
    file: 'slate-glass-education.png',
    title: 'Education — a cyan campus',
    subtitle: 'The Enrolled tab, before and after.',
    body: educationScreen,
    legend: [
      legendItem(CYAN.hex, 'Best-GPA hero', 'The one focal surface: cyan wash, glow, lit edge, tinted cap bubble. Progress bars keep green — that\'s data.'),
      legendItem(T.success, 'Segmented pill tabs', 'The underline tab strip became a glass segmented control with a cyan active pill.'),
      legendItem(T.text2, 'Calm actions + safe back', 'Study/Withdraw are quiet tinted chips instead of solid paint; the back button now meets the 40pt + accessibility spec.'),
    ].join(''),
  },
  {
    file: 'slate-glass-pets.png',
    title: 'Pets — your companion, center stage',
    subtitle: 'The Pets tab, before and after.',
    body: petsScreen,
    legend: [
      legendItem(GOLD.hex, 'Active-companion hero', 'Your selected pet is promoted to a gold identity hero with its meters and quick actions in one place.'),
      legendItem(T.success, 'Meters stay semantic', 'Health/happiness keep their meaning colors; gold is chrome only. One solid-gold CTA in the whole app (Adopt).'),
      legendItem(T.text2, 'Rows with depth', 'Other pets sit on glass cards with tinted emoji bubbles instead of flat tiles.'),
    ].join(''),
  },
  {
    file: 'slate-glass-hustle.png',
    title: 'Hustle — an indigo boardroom',
    subtitle: 'The company dashboard, before and after.',
    body: hustleScreen,
    legend: [
      legendItem(INDIGO.hex, 'Empire snapshot hero', 'Company value headlines an indigo glass hero; weekly profit stays green as data.'),
      legendItem(T.success, 'KPI + company cards', 'KPI tiles and company rows become Recipe A glass cards with tinted bubbles; per-company progress uses the identity accent.'),
      legendItem(T.text2, 'Back everywhere', 'Dashboard, company detail, and create-company each keep an always-visible top-left back.'),
    ].join(''),
  },
];

for (const j of jobs) {
  await renderToPng(chromium, pair(j.title, j.subtitle, j.body, j.legend), resolve(OUT, j.file), 1160);
  console.log('wrote', j.file);
}
console.log('done');
