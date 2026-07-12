/**
 * Preview of the new compact AchievementsSummaryCard for the Home tab —
 * a completion ring + the next claimable/in-progress achievements + "View all".
 *   node scripts/generate-achievements-summary.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, pageShell, renderToPng } from './lib/phoneFrame.mjs';

const tn = 'font-variant-numeric:tabular-nums;';
const svg = (p, c, s = 14, sw = 2, f = 'none') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const P = {
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.6V17a2 2 0 0 1-.8 1.6L8 20h8l-1.2-1.4a2 2 0 0 1-.8-1.6v-2.4"/><path d="M6 2h12v7a6 6 0 0 1-12 0z"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/>',
  sparkles: '<path d="M12 3l1.6 4.9L18 9.5l-4.4 1.6L12 16l-1.6-4.9L6 9.5l4.4-1.6z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
};

function ring(pct, completed, total, size = 58) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r, dash = (c * pct / 100).toFixed(1);
  return `<div style="position:relative;width:${size}px;height:${size}px;flex:0 0 auto;">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="rgba(148,163,184,0.18)" stroke-width="6" fill="none"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="#A855F7" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="${dash} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>
    <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;">
      <span style="color:#F8FAFC;font-size:16px;font-weight:800;line-height:1;">${completed}</span>
      <span style="color:#94A3B8;font-size:8px;font-weight:600;">of ${total}</span>
    </div>
  </div>`;
}
function row(icon, iconColor, iconBg, iconBorder, title, claim, pct, gold) {
  const mid = claim
    ? `<span style="color:#FBBF24;font-size:10px;font-weight:700;">Ready to claim</span>`
    : `<div style="height:5px;border-radius:3px;background:#334155;overflow:hidden;"><div style="width:${pct}%;height:100%;background:#818CF8;border-radius:3px;"></div></div>`;
  return `<div style="display:flex;align-items:center;gap:9px;">
    <div style="width:26px;height:26px;border-radius:8px;background:${iconBg};border:1px solid ${iconBorder};display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${svg(icon, iconColor, 12, 2, claim ? iconColor : 'none')}</div>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;"><span style="color:#E2E8F0;font-size:12px;font-weight:700;">${title}</span>${mid}</div>
    <div style="display:flex;align-items:center;gap:3px;">${svg(P.gem, '#818CF8', 10, 2, '#818CF8')}<span style="color:#818CF8;font-size:11px;font-weight:800;${tn}">${gold}</span></div>
  </div>`;
}

function card() {
  return `<div style="background:rgba(30,41,59,0.75);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:14px;box-shadow:0 12px 26px -12px rgba(0,0,0,0.65);width:320px;">
    <div style="display:flex;align-items:center;gap:10px;">
      <div style="width:30px;height:30px;border-radius:9px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.32);display:flex;align-items:center;justify-content:center;">${svg(P.trophy, '#FBBF24', 15)}</div>
      <div style="flex:1;"><div style="color:#F8FAFC;font-size:15px;font-weight:800;">Achievements</div><div style="color:#94A3B8;font-size:10.5px;margin-top:1px;">12 / 40 completed · 6 in progress</div></div>
      <div style="display:flex;align-items:center;gap:2px;"><span style="color:#94A3B8;font-size:11px;font-weight:700;">View all</span>${svg(P.chevron, '#94A3B8', 15)}</div>
    </div>
    <div style="display:flex;align-items:center;gap:14px;margin-top:13px;">
      ${ring(30, 12, 40)}
      <div style="flex:1;display:flex;flex-direction:column;gap:9px;">
        ${row(P.sparkles, '#FBBF24', 'rgba(251,191,36,0.15)', 'rgba(251,191,36,0.32)', 'Survivor', true, 100, 5)}
        ${row(P.target, '#818CF8', 'rgba(129,140,248,0.15)', 'rgba(129,140,248,0.32)', 'Hustler', false, 64, 10)}
        ${row(P.target, '#818CF8', 'rgba(129,140,248,0.15)', 'rgba(129,140,248,0.32)', 'Getting Started', false, 40, 10)}
      </div>
    </div>
  </div>`;
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Achievements on Home — now a compact card',
  subtitle: 'A completion ring + your next claimable & in-progress achievements. "View all" opens the full screen (shown earlier). The heavy full list no longer lives on the Home tab.',
  body: `<div style="display:flex;justify-content:center;margin-top:34px;background:#0F172A;border-radius:20px;padding:40px 30px;max-width:440px;margin-left:auto;margin-right:auto;box-shadow:0 10px 34px rgba(0,0,0,0.55);">
    ${card()}
  </div>`,
});

await renderToPng(chromium, page, resolve(OUT, 'achievements-summary.png'), 780);
console.log('wrote achievements-summary.png');
