/**
 * generate-depth-previews.mjs
 *
 * "Wave A — what's new" gallery: the marquee NEW surfaces the depth pass added
 * on top of each app's existing DNA. Faithful mocks from the agents' shipped
 * features + real tokens (flat-fill fallback rules).
 *
 *   node scripts/generate-depth-previews.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, legendItem, renderToPng, faceURI } from './lib/phoneFrame.mjs';

const carURI = (file) => `data:image/png;base64,${readFileSync(resolve(ROOT, 'assets/images/Vehicles', file)).toString('base64')}`;

const tnum = 'font-variant-numeric:tabular-nums;';
const L1 = `background:${T.surface};border:1px solid ${T.border};border-radius:14px;box-shadow:0 3px 14px rgba(0,0,0,0.28);`;
const L2 = `background:${T.surface};border:1px solid rgba(255,255,255,0.15);border-radius:18px;box-shadow:0 6px 16px rgba(0,0,0,0.3);`;
const FEMALE = faceURI('Female.png'), MALE = faceURI('Male.png'), OLDF = faceURI('Old_Female.png');
const PULSE = ['#EC4899', '#6366F1'];
const SPARK = '#F43F5E';
const TEAL = '#14B8A6';
const icon = (stroke, path, size = 16, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${sw}">${path}</svg>`;
const spark = (pts, color, w = 210, h = 40) => `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
const ring = (pct, color, size = 44, label) => {
  const r = (size - 6) / 2, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${T.surface2}" stroke-width="5" fill="none"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="${(c * pct / 100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/>${label ? `<text x="50%" y="55%" text-anchor="middle" dominant-baseline="middle" fill="${T.text}" font-size="${size * 0.26}" font-weight="800" font-family="system-ui">${label}</text>` : ''}</svg>`;
};
const barHeader = (title, rgb, sub) => `<div style="display:flex;align-items:center;padding:8px 15px;border-bottom:1px solid ${T.border};flex:0 0 auto;">
  <div style="width:34px;color:${T.text};font-size:20px;">‹</div>
  <div style="flex:1;"><div style="color:${T.text};font-size:15px;font-weight:700;">${title}</div>${sub ? `<div style="color:${T.muted};font-size:9px;">${sub}</div>` : ''}</div>
  ${rgb ? `<div style="background:rgba(${rgb},0.16);border:1px solid rgba(${rgb},0.3);border-radius:999px;padding:3px 9px;color:${T.text};font-size:10px;font-weight:700;">PRO</div>` : ''}</div>`;
const scroll = (inner, gap = 11, pad = '13px 14px') => `<div style="flex:1;overflow:hidden;padding:${pad};display:flex;flex-direction:column;gap:${gap}px;">${inner}</div>`;
const chip = (t, bg, fg, br = '') => `<span style="background:${bg};color:${fg};font-size:9px;font-weight:700;padding:2px 7px;border-radius:6px;${br}${tnum}">${t}</span>`;

// ═════════ PULSE — Creator Studio (Insights) — the paid perk, now real ═════════
function pulseInsights() {
  const grad = `linear-gradient(120deg, ${PULSE[0]}, ${PULSE[1]})`;
  const trophy = (glyph, label, val, col) => `<div style="flex:1;min-width:44%;${L1}padding:10px 11px;display:flex;flex-direction:column;gap:3px;">
    <div style="display:flex;align-items:center;gap:5px;">${icon(col, glyph, 13)}<span style="color:${T.muted};font-size:9px;font-weight:600;">${label}</span></div>
    <span style="color:${T.text};font-size:17px;font-weight:800;${tnum}">${val}</span></div>`;
  return barHeader('Creator Studio', '236,72,153', 'Verified Pro · Insights') + scroll(`
    <div style="${L2}position:relative;overflow:hidden;padding:14px;">
      <div style="position:absolute;inset:0;background:rgba(236,72,153,0.12);"></div>
      <div style="position:absolute;top:-40px;right:-30px;width:120px;height:120px;border-radius:60px;background:rgba(99,102,241,0.12);"></div>
      <div style="position:relative;">
        <div style="color:${T.muted};font-size:9px;font-weight:700;letter-spacing:1.1px;">FOLLOWER GROWTH · 12 WEEKS</div>
        <div style="color:${T.text};font-size:24px;font-weight:800;${tnum}margin-top:3px;">48,210 <span style="color:${T.success};font-size:12px;">▲ +6.2k</span></div>
        <div style="margin-top:6px;">${spark('0,36 18,34 36,30 54,31 72,26 90,24 108,20 126,17 144,15 162,10 180,7 210,3', PULSE[0], 220, 42)}</div>
      </div>
    </div>
    <div style="color:${T.text};font-size:12px;font-weight:700;">Trophy case</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${trophy('<path d="M12 2l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9z"/>', 'Peak followers', '52.4K', PULSE[0])}
      ${trophy('<path d="M12 2l8 3v6c0 5-3.5 8-8 11-4.5-3-8-6-8-11V5z"/>', 'Peak tier', 'Celebrity', PULSE[1])}
      ${trophy('<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>', 'Scandals survived', '3', T.warning)}
      ${trophy('<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M8 8V6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 'Brand deals', '11', T.success)}
    </div>
    <div style="color:${T.text};font-size:12px;font-weight:700;margin-top:2px;">Top post</div>
    <div style="${L1}padding:11px;">
      <div style="color:${T.text};font-size:11px;line-height:16px;">"finally hit 50k 🎉 thank you all"</div>
      <div style="display:flex;gap:6px;margin-top:8px;">${chip('12.4K ♥', T.surface2, T.text2)}${chip('2.1K ↻', T.surface2, T.text2)}${chip('VIRAL', PULSE[0], '#fff')}</div>
    </div>
  `, 10);
}

// ═════════ SPARK — Likes-You inbox + Jealousy modal ═════════
function sparkLikes() {
  const grad = `linear-gradient(120deg, ${SPARK}, #FB923C)`;
  const likeCard = (img, name, age, sub, sup) => `<div style="${L1}padding:0;overflow:hidden;position:relative;">
    <img src="${img}" style="width:100%;height:118px;object-fit:cover;object-position:center top;"/>
    <div style="position:absolute;inset:0;background:linear-gradient(to bottom, transparent 45%, rgba(0,0,0,0.82));"></div>
    ${sup ? `<span style="position:absolute;top:8px;left:8px;background:#3B82F6;color:#fff;font-size:8px;font-weight:800;padding:2px 6px;border-radius:5px;">SUPER LIKE</span>` : ''}
    <div style="position:absolute;left:9px;bottom:24px;color:#fff;font-size:14px;font-weight:800;">${name} ${age}</div>
    <div style="position:absolute;left:9px;bottom:9px;color:rgba(255,255,255,0.85);font-size:9px;">${sub}</div>
    <div style="position:absolute;right:8px;top:8px;width:30px;height:30px;border-radius:15px;background:${grad};display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,0.35);">${icon('#fff', '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>', 15, 0)}</div>
  </div>`;
  return barHeader('Likes You', null, 'Ultra · 4 people like you') + scroll(`
    <div style="display:flex;align-items:center;gap:8px;background:rgba(244,63,94,0.1);border:1px solid rgba(244,63,94,0.28);border-radius:12px;padding:9px 12px;">
      ${icon(SPARK, '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>', 16, 0)}
      <span style="color:${T.text};font-size:11px;font-weight:600;flex:1;">These people already swiped right — like back to match instantly.</span>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:9px;">
      <div style="flex:1;min-width:46%;">${likeCard(FEMALE, 'Sophia', 28, 'CEO · 1 mi', false)}</div>
      <div style="flex:1;min-width:46%;">${likeCard(OLDF, 'Emma', 26, 'Artist · 5 mi', true)}</div>
      <div style="flex:1;min-width:46%;">${likeCard(MALE, 'James', 31, 'Banker · 3 mi', false)}</div>
      <div style="flex:1;min-width:46%;background:${T.surface};border:1px solid ${T.border};border-radius:14px;display:flex;align-items:center;justify-content:center;color:${T.muted};font-size:11px;min-height:118px;">+1 more</div>
    </div>
  `, 11);
}
function sparkJealousy() {
  const grad = `linear-gradient(160deg, ${SPARK}, #FB923C)`;
  return `<div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:18px;background:rgba(0,0,0,0.35);">
    <div style="${L2}overflow:hidden;">
      <div style="height:78px;background:${grad};display:flex;align-items:center;justify-content:center;">${icon('#fff', '<path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>', 34, 2)}</div>
      <div style="padding:15px;">
        <div style="color:${T.text};font-size:16px;font-weight:800;text-align:center;">Maya saw your DMs</div>
        <div style="color:${T.text2};font-size:11px;line-height:16px;text-align:center;margin-top:6px;">She found late-night messages to someone else. She's hurt and wants an explanation — how do you respond?</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;">
          <div style="background:${grad};border-radius:11px;padding:11px;text-align:center;color:#fff;font-size:12px;font-weight:700;">Come clean and apologize</div>
          <div style="background:${T.surface2};border:1px solid ${T.border};border-radius:11px;padding:11px;text-align:center;color:${T.text};font-size:12px;font-weight:700;">Insist it was nothing</div>
          <div style="background:transparent;border:1px solid ${SPARK};border-radius:11px;padding:11px;text-align:center;color:${SPARK};font-size:12px;font-weight:700;">Confess everything</div>
        </div>
        <div style="color:${T.muted};font-size:9px;text-align:center;margin-top:10px;">Ignoring it damages the relationship every week.</div>
      </div>
    </div>
  </div>`;
}

// ═════════ BANK — funded savings goal + completion ═════════
function bankGoals() {
  const B = '59,130,246';
  const goal = (name, cat, cur, tgt, pct, cc, done) => `<div style="${L1}padding:13px 14px;">
    <div style="display:flex;align-items:center;gap:11px;">
      <div style="width:36px;height:36px;border-radius:10px;background:${cc};display:flex;align-items:center;justify-content:center;">${done ? icon('#fff', '<path d="M20 6L9 17l-5-5"/>', 18, 2.6) : icon('#fff', '<circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 2"/>', 18)}</div>
      <div style="flex:1;"><div style="display:flex;justify-content:space-between;"><span style="color:${T.text};font-size:13px;font-weight:700;">${name}</span>${done ? chip('REACHED 🎉', 'rgba(16,185,129,0.18)', T.success) : chip(`${pct}%`, T.surface2, T.text2)}</div>
      <div style="color:${T.muted};font-size:10px;margin-top:1px;${tnum}">$${cur} of $${tgt}</div></div>
    </div>
    <div style="height:7px;background:${T.surface2};border-radius:4px;margin-top:10px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:${cc};"></div></div>
    ${done ? `<div style="color:${T.success};font-size:10px;margin-top:7px;font-weight:600;">+$150 completion bonus credited</div>`
      : `<div style="display:flex;gap:6px;margin-top:9px;"><div style="flex:1;text-align:center;background:${cc};border-radius:9px;padding:7px 0;color:#fff;font-size:11px;font-weight:700;">Contribute $200</div><div style="text-align:center;background:rgba(${B},0.16);border-radius:9px;padding:7px 12px;color:#3B82F6;font-size:11px;font-weight:700;">Auto</div></div>`}
  </div>`;
  return barHeader('Savings Goals', null) + scroll(`
    <div style="display:flex;gap:7px;">${chip('Rate outlook · savings ↑', 'rgba(16,185,129,0.14)', T.success)}${chip('From: Everyday Checking', T.surface2, T.text2)}</div>
    ${goal('Emergency Fund', 'emergency', '15,000', '15,000', 100, '#10B981', true)}
    ${goal('House Down-payment', 'house', '28,400', '60,000', 47, '#3B82F6', false)}
    ${goal('Vacation', 'vacation', '1,850', '5,000', 37, '#06B6D4', false)}
    <div style="color:${T.muted};font-size:9px;text-align:center;">Contributions move real money from a linked account — capped at target.</div>
  `, 11);
}

// ═════════ EDUCATION — class picker ═════════
function eduClasses() {
  const E = '6,182,212';
  const cls = (name, diff, on) => `<div style="display:flex;align-items:center;gap:11px;background:${on ? `rgba(${E},0.12)` : T.surface};border:1px solid ${on ? `rgba(${E},0.4)` : T.border};border-radius:12px;padding:11px 13px;">
    <div style="width:22px;height:22px;border-radius:6px;border:2px solid ${on ? '#06B6D4' : T.muted};background:${on ? '#06B6D4' : 'transparent'};display:flex;align-items:center;justify-content:center;">${on ? icon('#fff', '<path d="M20 6L9 17l-5-5"/>', 13, 3) : ''}</div>
    <div style="flex:1;"><div style="color:${T.text};font-size:12px;font-weight:700;">${name}</div><div style="color:${T.muted};font-size:9px;">${diff}</div></div>
    ${on ? chip('+2 GPA boost', 'rgba(6,182,212,0.18)', '#06B6D4') : ''}</div>`;
  return barHeader('Enroll · Fall Semester', null, 'Computer Science BSc · pick 3 classes') + scroll(`
    <div style="color:${T.text};font-size:12px;font-weight:700;">Your schedule (2 / 3)</div>
    ${cls('Data Structures', 'Hard · exam wk 12', true)}
    ${cls('Linear Algebra', 'Medium · exam wk 10', true)}
    ${cls('Intro to AI', 'Hard · exam wk 14', false)}
    ${cls('Technical Writing', 'Easy · no exam', false)}
    ${cls('Discrete Math', 'Medium · exam wk 11', false)}
    <div style="display:flex;align-items:center;gap:8px;background:${T.surface};border:1px solid ${T.border};border-radius:12px;padding:10px 13px;margin-top:2px;">
      <div style="width:34px;height:20px;border-radius:10px;background:#06B6D4;position:relative;"><div style="position:absolute;right:2px;top:2px;width:16px;height:16px;border-radius:8px;background:#fff;"></div></div>
      <div style="flex:1;"><div style="color:${T.text};font-size:11px;font-weight:700;">Join a study group</div><div style="color:${T.muted};font-size:9px;">$120/semester · steadier GPA, +happiness</div></div>
    </div>
    <div style="background:#06B6D4;border-radius:11px;padding:12px;text-align:center;color:#fff;font-size:13px;font-weight:800;">Confirm schedule →</div>
  `, 9);
}

// ═════════ TRAVEL — destination-flavored preview + passport milestones ═════════
function travelPreview() {
  const grad = `linear-gradient(135deg, #0EA5E9, ${TEAL})`;
  const rgbFor = (cat) => cat === 'good' ? '16,185,129' : cat === 'bad' ? '239,68,68' : '59,130,246';
  const colFor = (cat) => cat === 'good' ? T.success : cat === 'bad' ? T.danger : T.info;
  const evRow = (glyph, head, effect, cat) => `<div style="display:flex;align-items:center;gap:10px;${L1}padding:9px 11px;">
    <div style="width:30px;height:30px;border-radius:8px;background:rgba(${rgbFor(cat)},0.15);border:1px solid rgba(${rgbFor(cat)},0.3);display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${icon(colFor(cat), glyph, 15)}</div>
    <div style="flex:1;color:${T.text};font-size:11px;font-weight:600;">${head}</div>
    ${chip(effect, `rgba(${rgbFor(cat)},0.16)`, colFor(cat))}</div>`;
  const benefitChip = (glyph, label, col, rgb) => `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(${rgb},0.15);border:1px solid rgba(${rgb},0.3);border-radius:8px;padding:4px 8px;color:${col};font-size:10px;font-weight:700;">${icon(col, glyph, 12)}${label}</span>`;
  return barHeader('Iceland · 1 week', '20,184,166', 'Aurora season · passport required') + scroll(`
    <div style="${L2}overflow:hidden;">
      <div style="height:72px;background:${grad};position:relative;display:flex;align-items:flex-end;padding:11px 12px;">
        <div style="position:absolute;top:-30px;right:-20px;width:104px;height:104px;border-radius:52px;background:rgba(255,255,255,0.12);"></div>
        <div style="position:absolute;top:10px;left:16px;width:52px;height:52px;border-radius:26px;background:rgba(255,255,255,0.10);"></div>
        <div style="position:relative;"><div style="color:#fff;font-size:18px;font-weight:800;">Iceland</div><div style="color:rgba(255,255,255,0.9);font-size:10px;">Northern lights · hot springs · $3,500</div></div>
      </div>
      <div style="padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;"><span style="color:${T.muted};font-size:9px;font-weight:700;letter-spacing:1px;">WHAT YOU GAIN</span><span style="color:${T.success};font-size:10px;font-weight:800;">Happiness +20</span></div>
        <div style="display:flex;gap:6px;margin-top:8px;">
          ${benefitChip('<path d="M12 3v3M12 18v3M3 12h3M18 12h3M6 6l2 2M16 16l2 2M18 6l-2 2M8 16l-2 2"/>', 'Stress −25 relief', TEAL, '20,184,166')}
          ${benefitChip('<path d="M12 2a7 7 0 0 0-4 12.7V17a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-2.3A7 7 0 0 0 12 2z"/>', 'Insight +5', T.info, '59,130,246')}
        </div>
      </div>
    </div>
    <div style="color:${T.text};font-size:12px;font-weight:700;">What could happen</div>
    ${evRow('<path d="M12 2l2.5 5.5 6 .5-4.5 4 1.4 5.9L12 20l-5.4 2.9L8 17l-4.5-4 6-.5z"/>', 'Northern lights blaze overhead', '+8 ♥', 'good')}
    ${evRow('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 'Jet lag on the flight home', '−10 energy', 'neutral')}
    ${evRow('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>', 'Street-food gamble backfires', '−8 health', 'bad')}
    <div style="${L1}padding:11px 12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;"><span style="color:${T.text};font-size:11px;font-weight:700;">Passport · 8 of 12 stamps</span>${chip('Globetrotter ▲', 'rgba(20,184,166,0.18)', TEAL)}</div>
      <div style="height:7px;background:${T.surface2};border-radius:4px;margin-top:9px;overflow:hidden;"><div style="width:67%;height:100%;background:${TEAL};"></div></div>
      <div style="color:${T.muted};font-size:9px;margin-top:6px;">4 more destinations unlock the World Citizen milestone.</div>
    </div>
  `, 9);
}

// ═════════ VEHICLE — real specs, accident risk, honest rep badge ═════════
function vehicleDetail() {
  const RED = '#EF4444';
  const specTile = (glyph, label, val, unit) => `<div style="flex:1;min-width:44%;${L1}padding:9px 11px;display:flex;flex-direction:column;gap:3px;">
    <div style="display:flex;align-items:center;gap:5px;">${icon(T.muted, glyph, 12)}<span style="color:${T.muted};font-size:8px;font-weight:700;letter-spacing:.5px;">${label}</span></div>
    <span style="color:${T.text};font-size:16px;font-weight:800;${tnum}">${val}<span style="color:${T.muted};font-size:9px;font-weight:600;"> ${unit}</span></span></div>`;
  return barHeader('Exotic Supercar', '239,68,68', 'Dealership · Hypercar tier') + scroll(`
    <div style="${L2}overflow:hidden;">
      <div style="height:118px;background:radial-gradient(circle at 50% 120%, #263449, #0b1220);position:relative;display:flex;align-items:center;justify-content:center;">
        <div style="position:absolute;bottom:6px;left:10%;right:10%;height:14px;border-radius:50%;background:rgba(0,0,0,0.45);filter:blur(3px);"></div>
        <img src="${carURI('exotic_supercar_final.png')}" style="width:90%;height:104px;object-fit:contain;position:relative;"/>
      </div>
      <div style="padding:12px;display:flex;justify-content:space-between;align-items:center;">
        <div><div style="color:${T.text};font-size:15px;font-weight:800;">Exotic Supercar</div><div style="color:${T.muted};font-size:10px;${tnum}">$250,000 · Hypercar</div></div>
        <span style="background:rgba(236,72,153,0.16);border:1px solid rgba(236,72,153,0.35);border-radius:999px;padding:4px 10px;color:${T.reputation};font-size:11px;font-weight:800;">+40 rep</span>
      </div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${specTile('<circle cx="12" cy="13" r="7"/><path d="M12 13l4-3M12 4V2"/>', 'TOP SPEED', '211', 'mph')}
      ${specTile('<path d="M5 22V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v17M3 22h12M13 9h3l3 3v5a2 2 0 0 1-4 0v-1"/>', 'FUEL ECONOMY', '13', 'mpg')}
      ${specTile('<rect x="5" y="3" width="9" height="18" rx="2"/><path d="M14 8h2a2 2 0 0 1 2 2v6"/>', 'FUEL TANK', '21', 'gal')}
      ${specTile('<circle cx="12" cy="12" r="9"/><path d="M12 12l5-3"/>', 'RANGE', '273', 'mi')}
    </div>
    <div style="${L1}padding:11px 12px;border-left:3px solid ${T.warning};">
      <div style="display:flex;align-items:center;gap:7px;">${icon(T.warning, '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>', 15)}<span style="color:${T.text};font-size:11px;font-weight:700;">This week: fender-bender</span></div>
      <div style="color:${T.text2};font-size:10px;line-height:15px;margin-top:6px;">Moderate collision. Comprehensive cover absorbed <b style="color:${T.success};">60% of your injury</b> and most of the $4,200 repair. A severe crash can total the car outright.</div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;${L1}padding:10px 12px;">
      <span style="color:${T.muted};font-size:10px;">Weekly premium <span style="color:${T.text2};">· amortized over 26 wks</span></span><span style="color:${T.text};font-size:13px;font-weight:800;${tnum}">$106<span style="color:${T.muted};font-size:9px;">/wk</span></span></div>
    <div style="display:flex;gap:8px;">
      <div style="flex:1;text-align:center;background:${RED};border-radius:11px;padding:11px;color:#fff;font-size:12px;font-weight:800;">Finance · $980/wk</div>
      <div style="text-align:center;background:${T.surface2};border-radius:11px;padding:11px 18px;color:${T.text};font-size:12px;font-weight:800;">Cash</div>
    </div>
  `, 9);
}

// ═════════ POLITICS — honest "One-time cash" policy readout ═════════
function politicsPolicy() {
  const IND = '#6366F1';
  const eff = (label, val, cat) => {
    const col = cat === 'pos' ? T.success : cat === 'neg' ? T.danger : T.text2;
    return `<div style="flex:1;min-width:44%;${L1}padding:9px 11px;"><div style="color:${T.muted};font-size:8px;font-weight:700;letter-spacing:.5px;">${label}</div><div style="color:${col};font-size:15px;font-weight:800;${tnum}margin-top:2px;">${val}</div></div>`;
  };
  return barHeader('Enact Policy', '99,102,241', 'Council Member · Term 1') + scroll(`
    <div style="${L2}overflow:hidden;">
      <div style="height:66px;background:linear-gradient(135deg,#6366F1,#4338CA);display:flex;align-items:center;padding:0 14px;gap:11px;">
        ${icon('#fff', '<path d="M3 21h18M5 21V11l7-5 7 5v10M9 21v-5h6v5"/>', 26)}
        <div><div style="color:#fff;font-size:15px;font-weight:800;">Universal Healthcare Act</div><div style="color:rgba(255,255,255,0.85);font-size:9px;">Healthcare reform · Contentious</div></div>
      </div>
      <div style="padding:12px;"><div style="color:${T.text2};font-size:11px;line-height:16px;">Guarantee coverage for every citizen. A landmark bill — expensive up front, popular for years.</div></div>
    </div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;">
      ${eff('One-time cash', '−$2.4M', 'neg')}
      ${eff('Approval', '+8%', 'pos')}
      ${eff('Public health', '+5', 'pos')}
      ${eff('Stability', '−3', 'neg')}
    </div>
    <div style="display:flex;align-items:flex-start;gap:9px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.28);border-radius:12px;padding:10px 12px;">
      <div style="flex:0 0 auto;margin-top:1px;">${icon(IND, '<circle cx="12" cy="12" r="9"/><path d="M12 8v4M12 16h.01"/>', 16)}</div>
      <span style="color:${T.text2};font-size:10px;line-height:14px;flex:1;">A <b style="color:${T.text};">one-time</b> treasury cost at enactment — not a weekly drain. This readout used to say "Weekly income," so players enacted expecting a stream that never came.</span>
    </div>
    <div style="background:${IND};border-radius:11px;padding:12px;text-align:center;color:#fff;font-size:13px;font-weight:800;">Enact policy →</div>
    <div style="color:${T.muted};font-size:9px;text-align:center;">Contentious bills lift your base's approval but cost stability.</div>
  `, 10);
}

function page(title, subtitle, phones, legend) {
  return pageShell({
    title, subtitle,
    body: `<div style="display:flex;justify-content:center;gap:40px;margin-top:32px;flex-wrap:wrap;">${phones}</div>
      <div style="display:flex;justify-content:center;gap:44px;margin-top:44px;flex-wrap:wrap;max-width:1050px;margin-left:auto;margin-right:auto;">${legend}</div>`,
  });
}

const OUT = resolve(ROOT, 'screenshots');
const jobs = [
  {
    file: 'depth-pulse-spark.png',
    title: "The paid perks that finally deliver",
    subtitle: "Two features players were sold but never received — now real.",
    phones: [
      phone(pulseInsights(), { caption: 'Pulse · Creator Studio', captionColor: PULSE[0], w: 264, h: 548 }),
      phone(sparkLikes(), { caption: 'Spark · Likes You (Ultra)', captionColor: SPARK, w: 264, h: 548 }),
      phone(sparkJealousy(), { caption: 'Spark · Jealousy event', captionColor: SPARK, w: 264, h: 548 }),
    ].join(''),
    legend: [
      legendItem(PULSE[0], 'Pulse Creator Studio', "Verified Pro's \"advanced analytics\" bullet returned nothing. Now it opens a real Insights screen: follower-growth sparkline, a trophy case (peak tier, scandals survived, brand deals), and your top posts."),
      legendItem(SPARK, 'Spark: Likes You', 'Ultra\'s headline "see who liked you" accrued data weekly with no UI. Now it\'s a real grid of people who swiped right — with like-back to match instantly.'),
      legendItem(T.warning, 'Spark: Jealousy, unblocked', 'One unresolved jealousy event used to silently block every future one. It\'s now a confrontation modal with real choices (and a confess option at high severity).'),
    ].join(''),
  },
  {
    file: 'depth-bank-education.png',
    title: "Dead loops brought to life",
    subtitle: "Contributing money that vanished; a class system that never populated.",
    phones: [
      phone(bankGoals(), { caption: 'Bank · funded goals', captionColor: '#3B82F6', w: 300, h: 600 }),
      phone(eduClasses(), { caption: 'Education · class picker', captionColor: '#06B6D4', w: 300, h: 600 }),
    ].join(''),
    legend: [
      legendItem('#3B82F6', 'Bank: real savings goals', 'The modal said "Cash on hand" but Contribute spent nothing and the bar filled for free. Now it moves real money from a linked account, caps at target, and pays a bounded completion bonus — plus a live rate-outlook chip.'),
      legendItem('#06B6D4', 'Education: pick your classes', 'enrolledClasses was always empty, so 19 class templates and their GPA bonuses were dead. Now you build a schedule each semester (with a study-group option), lighting up completion bonuses and exam difficulty.'),
    ].join(''),
  },
  {
    file: 'depth-travel-vehicle-politics.png',
    title: "The desktop apps — honest specs, real stakes",
    subtitle: "Trips that surprise you, cars with real numbers and real risk, policies that stop lying about payouts.",
    phones: [
      phone(travelPreview(), { caption: 'Travel · trip preview', captionColor: TEAL, w: 264, h: 548 }),
      phone(vehicleDetail(), { caption: 'Vehicle · spec sheet', captionColor: '#EF4444', w: 264, h: 548 }),
      phone(politicsPolicy(), { caption: 'Politics · enact policy', captionColor: '#818CF8', w: 264, h: 548 }),
    ].join(''),
    legend: [
      legendItem(TEAL, 'Travel: destinations that mean something', 'The "What could happen" preview now draws from the SAME event pool the trip actually rolls — 15 hand-written destination events (Iceland aurora, Dubai desert safari, Rome romance). Dropped stress-relief and intelligence benefits finally land, New York\'s stress is now an honest red penalty, and passport milestones track distinct destinations.'),
      legendItem('#EF4444', 'Vehicle: real specs, real risk', 'Every car now carries authored top-speed / fuel-economy / tank specs (211 mph, 13 mpg for the Exotic). Accidents can total a car and remove it from your fleet, insurance actually reduces your injury (not just the repair bill), and the dealer "+40 rep" badge is finally paid — cash or financed.'),
      legendItem('#818CF8', 'Politics: no more phantom income', 'Policies advertised a "Weekly income +$X" that was really a one-time treasury delta paid once at enactment — players enacted expecting a recurring stream that never existed. Relabeled to the honest "One-time cash" at all three decision points.'),
    ].join(''),
  },
];

for (const j of jobs) {
  await renderToPng(chromium, page(j.title, j.subtitle, j.phones, j.legend), resolve(OUT, j.file), j.file.includes('bank') ? 1160 : 1320);
  console.log('wrote', j.file);
}
console.log('done');
