/**
 * Faithful "current Home" — the Home tab with every revamp applied: ring HUD +
 * week dots, slate elevated cards, IdentityCard, LifeChapter, ActiveGoals, and
 * the compact AchievementsSummaryCard. Built from the real card structures.
 *   node scripts/generate-home-current.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, renderToPng, faceURI } from './lib/phoneFrame.mjs';

const MALE = faceURI('Male.png');
const tn = 'font-variant-numeric:tabular-nums;';
const svg = (p, c, s = 14, sw = 2, f = 'none') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const P = {
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2"/><path d="M9 9.5h.01M15 9.5h.01"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.6V17a2 2 0 0 1-.8 1.6L8 20h8l-1.2-1.4a2 2 0 0 1-.8-1.6v-2.4"/><path d="M6 2h12v7a6 6 0 0 1-12 0z"/>',
  chevron: '<path d="M9 18l6-6-6-6"/>', gem: '<path d="M6 3h12l4 6-10 12L2 9z"/>',
  sparkles: '<path d="M12 3l1.6 4.9L18 9.5l-4.4 1.6L12 16l-1.6-4.9L6 9.5l4.4-1.6z"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  dollar: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  trending: '<path d="M22 7 13.5 15.5l-5-5L2 17"/><path d="M16 7h6v6"/>', check: '<path d="M20 6 9 17l-5-5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  home: '<path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  phone: '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M11 18h2"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  cart: '<circle cx="9" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2 3h2l2.4 12.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>',
};
const VIT = [{ p: P.heart, f: 1, c: '#EF4444', v: 88 }, { p: P.smile, f: 0, c: '#F59E0B', v: 82 }, { p: P.bolt, f: 1, c: '#3B82F6', v: 64 }];
const CARD = 'background:rgba(30,41,59,0.72);border:1px solid rgba(255,255,255,0.08);border-radius:16px;box-shadow:0 12px 26px -12px rgba(0,0,0,0.6);';

function ring(v, size) {
  const r = (size - 5) / 2, c = 2 * Math.PI * r, dash = (c * v.v / 100).toFixed(1);
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;"><div style="position:relative;width:${size}px;height:${size}px;">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="rgba(148,163,184,0.18)" stroke-width="5" fill="none"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${v.c}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="${dash} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>
    <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">${svg(v.p, v.c, 15, 2, v.f ? v.c : 'none')}</div></div>
    <span style="color:#E2E8F0;font-size:9px;font-weight:800;${tn}">${v.v}</span></div>`;
}
const money = (g, glyph, val) => `<span style="display:inline-flex;align-items:center;gap:4px;background:${g};border:1px solid rgba(255,255,255,0.2);border-radius:999px;padding:4px 9px;color:#fff;font-size:10px;font-weight:800;${tn}">${svg(glyph, '#fff', 10, 2.4)}${val}</span>`;
const pill = (l, v, c) => `<div style="flex:1;background:#334155;border-radius:9px;padding:7px 8px;"><div style="color:#94A3B8;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:.3px;">${l}</div><div style="color:${c};font-size:13px;font-weight:800;${tn}margin-top:1px;">${v}</div></div>`;
const weekDot = (st) => st === 'cur' ? `<div style="width:7px;height:7px;border-radius:4px;background:#fff;box-shadow:0 0 4px rgba(255,255,255,0.9);"></div>` : st === 'past' ? `<div style="width:6px;height:6px;border-radius:3px;background:rgba(255,255,255,0.55);"></div>` : `<div style="width:6px;height:6px;border-radius:3px;border:1px solid rgba(255,255,255,0.35);box-sizing:border-box;"></div>`;

function goalRow(icon, color, title, pct) {
  return `<div style="display:flex;align-items:center;gap:9px;">
    <div style="width:28px;height:28px;border-radius:8px;background:${color}22;border:1px solid ${color}44;display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${svg(icon, color, 14)}</div>
    <div style="flex:1;min-width:0;"><div style="color:#E2E8F0;font-size:12px;font-weight:700;">${title}</div>
      <div style="height:6px;background:#334155;border-radius:3px;margin-top:5px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:${color};border-radius:3px;"></div></div></div>
    <span style="color:#94A3B8;font-size:11px;font-weight:800;${tn}">${pct}%</span></div>`;
}

function tabBar() {
  const tab = (icon, label, active) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;">
    ${svg(icon, active ? '#60A5FA' : '#94A3B8', 19, 2)}
    <span style="color:${active ? '#60A5FA' : '#94A3B8'};font-size:8px;font-weight:${active ? '700' : '600'};">${label}</span></div>`;
  return `<div style="position:absolute;left:6px;right:6px;bottom:7px;height:52px;background:rgba(15,23,42,0.88);border:1px solid rgba(255,255,255,0.1);border-radius:20px;display:flex;align-items:center;padding:0 3px;box-shadow:0 -3px 18px rgba(0,0,0,0.45);">
    ${tab(P.home, 'Home', true)}${tab(P.briefcase, 'Work', false)}${tab(P.phone, 'Mobile', false)}${tab(P.monitor, 'Computer', false)}${tab(P.trophy, 'Progress', false)}${tab(P.cart, 'Market', false)}${tab(P.heart, 'Health', false)}
  </div>`;
}

function screen() {
  return `<div style="flex:1;background:${T.bg};display:flex;flex-direction:column;position:relative;">
    <div style="background:#0F172A;border-bottom:1px solid rgba(255,255,255,0.07);box-shadow:0 6px 16px rgba(0,0,0,0.5);padding:9px 12px 10px;flex:0 0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;gap:5px;"><span style="background:rgba(255,255,255,0.08);color:#E5E7EB;font-size:8px;font-weight:700;padding:2px 7px;border-radius:999px;">Gen 1</span><span style="background:#F59E0B;color:#fff;font-size:8px;font-weight:800;padding:2px 7px;border-radius:999px;">★ P2</span></div>
          <div style="display:flex;gap:13px;">${VIT.map(v => ring(v, 36)).join('')}</div>
          <div style="display:flex;gap:6px;">${money('#16A34A', P.dollar, '$48.2K')}${money('#2563EB', '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M3 8l9-5 9 5"/>', '$210K')}${money('#7C3AED', P.gem, '340')}</div>
        </div>
        <div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:5px 9px 6px;text-align:center;flex:0 0 auto;">
          <div style="color:#fff;font-size:15px;font-weight:800;line-height:1;">2031</div><div style="color:#fff;font-size:8px;font-weight:700;margin-top:2px;">MAR</div><div style="color:rgba(255,255,255,0.8);font-size:8px;">Age 34</div>
          <div style="display:flex;justify-content:center;align-items:center;gap:4px;margin-top:6px;height:7px;">${weekDot('past')}${weekDot('cur')}${weekDot('fut')}${weekDot('fut')}</div>
        </div>
      </div>
    </div>

    <div style="flex:1;padding:11px 11px 62px;display:flex;flex-direction:column;gap:10px;">
      <!-- Identity -->
      <div style="${CARD}padding:12px;">
        <div style="display:flex;align-items:center;gap:11px;">
          <img src="${MALE}" style="width:46px;height:46px;border-radius:23px;object-fit:cover;object-position:center top;border:2px solid #334155;"/>
          <div style="flex:1;"><div style="color:#F8FAFC;font-size:15px;font-weight:800;">Alex Rivera</div><div style="color:#94A3B8;font-size:10px;">Tech Founder · Level 12</div></div>
          <div style="width:38px;height:38px;border-radius:19px;border:3px solid #334155;border-top-color:#3B82F6;display:flex;align-items:center;justify-content:center;color:#F8FAFC;font-size:10px;font-weight:800;">L12</div>
        </div>
        <div style="display:flex;gap:7px;margin-top:10px;">${pill('Net worth', '$258K', '#34D399')}${pill('Happiness', '82%', '#FBBF24')}${pill('Reputation', '640', '#A5B4FC')}</div>
      </div>

      <!-- Life Chapter -->
      <div style="${CARD}padding:12px;">
        <div style="display:flex;align-items:center;gap:9px;">
          <div style="width:28px;height:28px;border-radius:8px;background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.32);display:flex;align-items:center;justify-content:center;">${svg(P.book, '#C084FC', 14)}</div>
          <div style="color:#F8FAFC;font-size:14px;font-weight:700;">Chapter 3: Building Momentum</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:10px;">
          <div style="width:18px;height:18px;border-radius:9px;background:#34D399;display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${svg(P.check, '#0F172A', 11, 3)}</div>
          <span style="color:#94A3B8;font-size:11px;text-decoration:line-through;flex:1;">Reach a $250K net worth</span></div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;">
          <div style="width:18px;height:18px;border-radius:9px;border:2px solid #475569;flex:0 0 auto;"></div>
          <span style="color:#E2E8F0;font-size:11px;flex:1;">Own 2 businesses</span></div>
        <div style="height:5px;background:rgba(148,163,184,0.2);border-radius:3px;margin-top:11px;overflow:hidden;"><div style="width:55%;height:100%;background:#A855F7;"></div></div>
      </div>

      <!-- Active Goals -->
      <div style="${CARD}padding:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:11px;"><span style="color:#F8FAFC;font-size:14px;font-weight:700;">Active Goals</span><span style="color:#94A3B8;font-size:10px;">3 active</span></div>
        <div style="display:flex;flex-direction:column;gap:11px;">
          ${goalRow(P.dollar, '#10B981', 'Save $10,000', 62)}
          ${goalRow(P.trending, '#3B82F6', 'Reach Level 15', 80)}
          ${goalRow(P.heart, '#EC4899', 'Get married', 40)}
        </div>
      </div>

      <!-- Achievements (compact) -->
      <div style="${CARD}padding:12px;">
        <div style="display:flex;align-items:center;gap:9px;">
          <div style="width:28px;height:28px;border-radius:8px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.32);display:flex;align-items:center;justify-content:center;">${svg(P.trophy, '#FBBF24', 14)}</div>
          <div style="flex:1;"><div style="color:#F8FAFC;font-size:14px;font-weight:800;">Achievements</div><div style="color:#94A3B8;font-size:10px;">12 / 40 completed · 6 in progress</div></div>
          <div style="display:flex;align-items:center;gap:2px;"><span style="color:#94A3B8;font-size:10px;font-weight:700;">View all</span>${svg(P.chevron, '#94A3B8', 14)}</div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:11px;">
          ${(() => { const s = 50, r = (s - 6) / 2, c = 2 * Math.PI * r; return `<div style="position:relative;width:${s}px;height:${s}px;flex:0 0 auto;"><svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${r}" stroke="rgba(148,163,184,0.18)" stroke-width="6" fill="none"/><circle cx="${s / 2}" cy="${s / 2}" r="${r}" stroke="#A855F7" stroke-width="6" fill="none" stroke-linecap="round" stroke-dasharray="${(c * 0.3).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 ${s / 2} ${s / 2})"/></svg><div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;"><span style="color:#F8FAFC;font-size:14px;font-weight:800;line-height:1;">12</span><span style="color:#94A3B8;font-size:7px;">of 40</span></div></div>`; })()}
          <div style="flex:1;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;align-items:center;gap:8px;"><div style="width:24px;height:24px;border-radius:7px;background:rgba(251,191,36,0.15);border:1px solid rgba(251,191,36,0.32);display:flex;align-items:center;justify-content:center;">${svg(P.sparkles, '#FBBF24', 11, 2, '#FBBF24')}</div><div style="flex:1;"><div style="color:#E2E8F0;font-size:11px;font-weight:700;">Survivor</div><div style="color:#FBBF24;font-size:9px;font-weight:700;">Ready to claim</div></div><div style="display:flex;gap:2px;align-items:center;">${svg(P.gem, '#818CF8', 9, 2, '#818CF8')}<span style="color:#818CF8;font-size:10px;font-weight:800;">5</span></div></div>
            <div style="display:flex;align-items:center;gap:8px;"><div style="width:24px;height:24px;border-radius:7px;background:rgba(129,140,248,0.15);border:1px solid rgba(129,140,248,0.32);display:flex;align-items:center;justify-content:center;">${svg(P.target, '#818CF8', 11)}</div><div style="flex:1;"><div style="color:#E2E8F0;font-size:11px;font-weight:700;">Hustler</div><div style="height:4px;background:#334155;border-radius:2px;margin-top:3px;overflow:hidden;"><div style="width:64%;height:100%;background:#818CF8;"></div></div></div><div style="display:flex;gap:2px;align-items:center;">${svg(P.gem, '#818CF8', 9, 2, '#818CF8')}<span style="color:#818CF8;font-size:10px;font-weight:800;">10</span></div></div>
          </div>
        </div>
      </div>
    </div>
    ${tabBar()}
  </div>`;
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'The Home screen now',
  subtitle: 'Every revamp together: ring HUD + week dots, slate cards that lift, and the compact achievements summary. Faithful to the current components (real data will vary).',
  body: `<div style="display:flex;justify-content:center;margin-top:28px;">
      ${phone(screen(), { caption: 'Home · current', captionColor: '#34D399', w: 322, h: 884 })}
    </div>`,
});

await renderToPng(chromium, page, resolve(OUT, 'home-current.png'), 640);
console.log('wrote home-current.png');
