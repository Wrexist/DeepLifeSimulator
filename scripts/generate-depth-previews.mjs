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
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, legendItem, renderToPng, faceURI } from './lib/phoneFrame.mjs';

const tnum = 'font-variant-numeric:tabular-nums;';
const L1 = `background:${T.surface};border:1px solid ${T.border};border-radius:14px;box-shadow:0 3px 14px rgba(0,0,0,0.28);`;
const L2 = `background:${T.surface};border:1px solid rgba(255,255,255,0.15);border-radius:18px;box-shadow:0 6px 16px rgba(0,0,0,0.3);`;
const FEMALE = faceURI('Female.png'), MALE = faceURI('Male.png'), OLDF = faceURI('Old_Female.png');
const PULSE = ['#EC4899', '#6366F1'];
const SPARK = '#F43F5E';
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
    <div style="position:absolute;right:8px;bottom:9px;width:30px;height:30px;border-radius:15px;background:${grad};display:flex;align-items:center;justify-content:center;">${icon('#fff', '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>', 15, 0)}</div>
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
];

for (const j of jobs) {
  await renderToPng(chromium, page(j.title, j.subtitle, j.phones, j.legend), resolve(OUT, j.file), j.file.includes('bank') ? 1160 : 1320);
  console.log('wrote', j.file);
}
console.log('done');
