/**
 * Faithful preview of the REAL AchievementsProgress component — built from the
 * actual component structure (gold-trophy header + stats, Filters/sort row,
 * category chips, achievement cards with icon bubble / rarity badge / gem reward
 * / progress|claim|claimed) and REAL achievement data. No emojis; lucide-style
 * vector icons + real theme tokens (flat-fill fallback rules).
 *   node scripts/generate-achievements-real.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, renderToPng } from './lib/phoneFrame.mjs';

const tn = 'font-variant-numeric:tabular-nums;';
// lucide-style paths
const P = {
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.6V17a2 2 0 0 1-.8 1.6L8 20h8l-1.2-1.4a2 2 0 0 1-.8-1.6v-2.4"/><path d="M6 2h12v7a6 6 0 0 1-12 0z"/>',
  sparkles: '<path d="M12 3l1.6 4.9L18 9.5l-4.4 1.6L12 16l-1.6-4.9L6 9.5l4.4-1.6z"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  dollar: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.1a4 4 0 0 1 0 7.75"/>',
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  star: '<path d="M12 2l3 7 7 .5-5.5 4.5 2 7-6.5-4-6.5 4 2-7L2 9.5 9 9z"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5z"/>',
  shield: '<path d="M12 2 4 5v6c0 5 3.5 8 8 11 4.5-3 8-6 8-11V5z"/>',
};
const svg = (path, color, size = 16, sw = 2, fill = 'none') => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${fill}" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const RARITY = {
  common: { label: 'Common', color: '#9CA3AF', bg: 'rgba(107,114,128,0.16)' },
  rare: { label: 'Rare', color: '#60A5FA', bg: 'rgba(59,130,246,0.16)' },
  epic: { label: 'Epic', color: '#A78BFA', bg: 'rgba(139,92,246,0.16)' },
  legendary: { label: 'Legendary', color: '#FBBF24', bg: 'rgba(245,158,11,0.16)' },
};
const CAT = {
  career: { icon: P.briefcase, color: '#3B82F6' },
  wealth: { icon: P.dollar, color: '#10B981' },
  social: { icon: P.users, color: '#EC4899' },
  health: { icon: P.activity, color: '#14B8A6' },
  special: { icon: P.star, color: '#EF4444' },
};

const chip = (icon, label, count, color, active) => `<div style="display:inline-flex;align-items:center;gap:5px;flex:0 0 auto;background:${active ? color : 'rgba(30,41,59,0.7)'};border:1px solid ${active ? color : 'rgba(255,255,255,0.08)'};border-radius:999px;padding:5px 11px;">
  ${svg(icon, active ? '#fff' : color, 13)}<span style="color:${active ? '#fff' : T.text2};font-size:11px;font-weight:700;">${label} (${count})</span></div>`;

function card({ cat, title, desc, rarity, gold, state, progress }) {
  const c = CAT[cat], r = RARITY[rarity];
  const footer = state === 'claimed'
    ? `<div style="display:flex;align-items:center;gap:6px;margin-top:10px;">${svg(P.sparkles, '#10B981', 14, 2, '#10B981')}<span style="color:#10B981;font-size:11px;font-weight:700;">Claimed</span><span style="color:${T.muted};font-size:10px;margin-left:4px;">· Unlocked at age 19 (2016)</span></div>`
    : state === 'claim'
    ? `<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:11px;background:linear-gradient(120deg,#6366F1,#4F46E5);border-radius:11px;padding:9px;">${svg(P.sparkles, '#fff', 14, 2, '#fff')}<span style="color:#fff;font-size:12px;font-weight:800;">Claim Reward</span></div>`
    : `<div style="margin-top:11px;"><div style="height:7px;background:${T.surface2};border-radius:4px;overflow:hidden;"><div style="width:${progress}%;height:100%;background:linear-gradient(90deg,#6366F1,#818CF8);"></div></div><div style="color:${T.muted};font-size:9px;margin-top:5px;text-align:right;${tn}">${progress}%</div></div>`;
  const cardBg = state === 'claimed' ? 'rgba(16,185,129,0.06)' : 'rgba(30,41,59,0.55)';
  const cardBorder = state === 'claimed' ? 'rgba(16,185,129,0.28)' : 'rgba(255,255,255,0.08)';
  return `<div style="background:${cardBg};border:1px solid ${cardBorder};border-radius:15px;padding:13px;box-shadow:0 8px 20px -10px rgba(0,0,0,0.55);">
    <div style="display:flex;align-items:flex-start;gap:11px;">
      <div style="width:40px;height:40px;border-radius:11px;background:${c.color}22;border:1px solid ${c.color}44;display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${svg(c.icon, c.color, 19)}</div>
      <div style="flex:1;min-width:0;"><div style="color:${T.text};font-size:14px;font-weight:800;">${title}</div>
        <span style="display:inline-flex;align-items:center;gap:4px;background:${r.bg};border-radius:6px;padding:2px 7px;margin-top:5px;">${svg(P.shield, r.color, 10, 2, 'none')}<span style="color:${r.color};font-size:9px;font-weight:800;letter-spacing:.3px;">${r.label}</span></span>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex:0 0 auto;">
        <span style="color:${T.muted};font-size:10px;${tn}">1/1</span>
        <div style="display:inline-flex;align-items:center;gap:4px;"><div style="width:20px;height:20px;border-radius:6px;background:linear-gradient(120deg,#6366F1,#4F46E5);display:flex;align-items:center;justify-content:center;">${svg(P.gem, '#fff', 11, 2, '#fff')}</div><span style="color:#818CF8;font-size:12px;font-weight:800;${tn}">${gold}</span></div>
      </div>
    </div>
    <div style="color:${T.text2};font-size:11px;line-height:15px;margin-top:9px;">${desc}</div>
    ${footer}
  </div>`;
}

function screen() {
  return `<div style="flex:1;background:${T.bg};display:flex;flex-direction:column;">
    <!-- header -->
    <div style="background:rgba(99,102,241,0.1);padding:14px 15px;flex:0 0 auto;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="position:relative;width:44px;height:44px;flex:0 0 auto;">
          <div style="width:44px;height:44px;border-radius:13px;background:linear-gradient(120deg,#FBBF24,#F59E0B);display:flex;align-items:center;justify-content:center;">${svg(P.trophy, '#fff', 22, 2)}</div>
          <div style="position:absolute;top:-3px;right:-3px;">${svg(P.sparkles, '#6366F1', 12, 2, '#6366F1')}</div>
        </div>
        <div><div style="color:${T.text};font-size:18px;font-weight:800;">Achievements</div><div style="color:${T.muted};font-size:11px;margin-top:1px;">12 / 40 completed • 6 in progress</div></div>
      </div>
    </div>
    <!-- controls + chips + cards -->
    <div style="flex:1;overflow:hidden;padding:12px 13px;display:flex;flex-direction:column;gap:11px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div style="display:inline-flex;align-items:center;gap:6px;background:#6366F1;border-radius:9px;padding:6px 11px;">${svg(P.filter, '#fff', 14)}<span style="color:#fff;font-size:11px;font-weight:700;">Filters</span></div>
        <div style="display:flex;gap:4px;">
          <span style="background:#6366F1;color:#fff;font-size:10px;font-weight:700;padding:5px 10px;border-radius:8px;">Progress</span>
          <span style="background:rgba(30,41,59,0.7);color:${T.muted};font-size:10px;font-weight:700;padding:5px 10px;border-radius:8px;">Rarity</span>
          <span style="background:rgba(30,41,59,0.7);color:${T.muted};font-size:10px;font-weight:700;padding:5px 10px;border-radius:8px;">Title</span>
        </div>
      </div>
      <div style="display:flex;gap:7px;overflow:hidden;">
        ${chip(P.trophy, 'All', 40, '#6366F1', true)}${chip(P.briefcase, 'Career', 9, '#3B82F6', false)}${chip(P.dollar, 'Wealth', 11, '#10B981', false)}${chip(P.users, 'Social', 7, '#EC4899', false)}
      </div>
      ${card({ cat: 'wealth', title: 'Hustler', desc: 'Have $500 in cash.', rarity: 'common', gold: 10, state: 'progress', progress: 64 })}
      ${card({ cat: 'special', title: 'Survivor', desc: 'Survive your first month (4 weeks).', rarity: 'rare', gold: 5, state: 'claim' })}
      ${card({ cat: 'career', title: 'First Gig', desc: 'Complete your first street job.', rarity: 'common', gold: 10, state: 'claimed' })}
    </div>
  </div>`;
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'The real Achievements screen',
  subtitle: 'Faithful to the actual AchievementsProgress component + real achievement data — vector icons, rarity badges, gem rewards, claim/progress states. No emojis.',
  body: `<div style="display:flex;justify-content:center;margin-top:30px;">
      ${phone(screen(), { caption: 'Achievements · as it ships', captionColor: '#818CF8', w: 320, h: 660 })}
    </div>`,
});

await renderToPng(chromium, page, resolve(OUT, 'achievements-real.png'), 760);
console.log('wrote achievements-real.png');
