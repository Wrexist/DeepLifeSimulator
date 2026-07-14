/**
 * Preview of the art-led Perks + Mindset cards. Perk paintings and mindset
 * symbols become full-bleed heroes with a scrim; the slate-glass body carries
 * description, unlock requirement, and benefit chips. Renders the Perks tab and
 * the Mindset tab side by side so the hero treatment can be judged on both.
 *   node scripts/generate-perks-hero.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, legendItem, renderToPng } from './lib/phoneFrame.mjs';

const imgURI = (rel) =>
  `data:image/png;base64,${readFileSync(resolve(ROOT, 'assets/images', rel)).toString('base64')}`;
const svg = (p, c = '#F8FAFC', s = 18) =>
  `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  back: '<path d="M15 18l-6-6 6-6"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7M7.5 8a2.5 2.5 0 010-5C11 3 12 8 12 8M16.5 8a2.5 2.5 0 000-5C13 3 12 8 12 8"/>',
  brain: '<path d="M12 5a3 3 0 00-3 3 3 3 0 00-3 3 3 3 0 001 5 3 3 0 005 1 3 3 0 005-1 3 3 0 001-5 3 3 0 00-3-3 3 3 0 00-3-3z"/>',
  play: '<path d="M6 3l14 9-14 9V3z"/>', star: '<path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1L12 2z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>', lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
  dollar: '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>', heart: '<path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.6l-1-1a5.5 5.5 0 00-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 000-7.8z"/>',
  users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8"/>',
};
const RAR = { Legendary: '#F59E0B', Epic: '#8B5CF6', Rare: '#3B82F6', Uncommon: '#10B981', Common: '#10B981' };

const heroCard = (o) => {
  const { img, title, badge, badgeColor, desc, state, req, benefits, accent = '#3B82F6' } = o;
  const dim = state === 'locked';
  return `
<div style="border-radius:16px;overflow:hidden;border:${state === 'selected' ? `2px solid rgba(255,255,255,0.5)` : state === 'permanent' ? '2px solid #F59E0B' : '1px solid rgba(255,255,255,0.1)'};background:linear-gradient(135deg, rgba(30,41,59,0.85), rgba(15,23,42,0.85));box-shadow:0 8px 16px rgba(0,0,0,0.3);margin-bottom:14px;opacity:${dim ? 0.6 : 1};">
  <div style="position:relative;width:100%;height:132px;background:#0F172A;">
    <img src="${imgURI(img)}" style="width:100%;height:100%;object-fit:cover;object-position:center;"/>
    <div style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(15,23,42,0) 0%, rgba(15,23,42,0.4) 50%, rgba(15,23,42,0.97) 100%);"></div>
    ${state === 'permanent' ? `<div style="position:absolute;top:10px;left:10px;background:rgba(245,158,11,0.9);padding:4px 9px;border-radius:999px;"><span style="color:#fff;font-size:10px;font-weight:800;letter-spacing:0.5px;">PERMANENT</span></div>` : ''}
    ${state === 'locked' ? `<div style="position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:14px;background:rgba(15,23,42,0.85);border:2px solid rgba(148,163,184,0.6);display:flex;align-items:center;justify-content:center;">${svg(I.lock, '#94A3B8', 15)}</div>` : ''}
    ${state === 'selected' ? `<div style="position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:14px;background:rgba(15,23,42,0.85);border:2px solid ${accent};display:flex;align-items:center;justify-content:center;">${svg(I.check, accent, 15)}</div>` : ''}
    ${state === 'permanent' ? `<div style="position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:14px;background:rgba(15,23,42,0.85);border:2px solid #F59E0B;display:flex;align-items:center;justify-content:center;">${svg(I.check, '#F59E0B', 15)}</div>` : ''}
    <div style="position:absolute;left:0;right:0;bottom:0;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:0 16px 12px;">
      <span style="color:${dim ? '#94A3B8' : '#fff'};font-size:18px;font-weight:800;text-shadow:0 1px 4px rgba(0,0,0,0.6);">${title}</span>
      <span style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);padding:4px 8px;border-radius:6px;color:${badgeColor};font-size:11px;font-weight:800;white-space:nowrap;">${badge}</span>
    </div>
  </div>
  <div style="padding:16px;">
    <div style="color:${dim ? '#94A3B8' : '#CBD5E1'};font-size:13px;font-weight:500;line-height:16px;">${desc}</div>
    ${req ? `<div style="color:#94A3B8;font-size:12px;font-style:italic;margin-top:8px;">${req}</div>` : ''}
    ${benefits ? `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">${benefits.map((b) => `<span style="display:flex;align-items:center;gap:5px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);padding:4px 8px;border-radius:6px;">${svg(b.icon, b.color, 15)}<span style="color:${b.color};font-size:12px;font-weight:600;">${b.label}</span></span>`).join('')}</div>` : ''}
  </div>
</div>`;
};

const tab = (icon, label, active, badge, badgeColor = '#3B82F6') => `
<div style="flex:1;border-radius:12px;overflow:hidden;box-shadow:${active ? '0 4px 8px rgba(59,130,246,0.3)' : 'none'};">
  <div style="position:relative;display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 16px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;background:${active ? 'linear-gradient(120deg,#3B82F6,#2563EB)' : 'linear-gradient(120deg,rgba(30,41,59,0.8),rgba(15,23,42,0.8))'};">
    ${svg(icon, active ? '#fff' : '#94A3B8', 18)}<span style="color:${active ? '#fff' : '#94A3B8'};font-size:14px;font-weight:600;">${label}</span>
    ${badge ? `<div style="min-width:20px;height:20px;border-radius:10px;background:${badgeColor};display:flex;align-items:center;justify-content:center;padding:0 6px;"><span style="color:#fff;font-size:11px;font-weight:700;">${badge}</span></div>` : ''}
  </div>
</div>`;

const screen = (which) => {
  const perksTab = which === 'perks';
  const cards = perksTab
    ? [
        heroCard({ img: 'Perks/Legacy Builder.png', title: 'Legacy Builder', badge: 'Legendary', badgeColor: RAR.Legendary, desc: 'Start new lives with +$5,000 and +5 reputation.', state: 'selected', benefits: [{ icon: I.dollar, color: '#34D399', label: '+$5,000 Starting Money' }, { icon: I.users, color: '#EC4899', label: '+5 Reputation' }] }),
        heroCard({ img: 'Perks/Iron Will.png', title: 'Iron Will', badge: 'Rare', badgeColor: RAR.Rare, desc: 'Resist stress and burnout; energy drains 10% slower.', state: 'normal', benefits: [{ icon: I.heart, color: '#F59E0B', label: '+10 Energy' }] }),
        heroCard({ img: 'Perks/Astute Planner.png', title: 'Astute Planner', badge: 'Epic', badgeColor: RAR.Epic, desc: '+5% salary, -10% energy cost for work actions.', state: 'locked', req: 'Requires achievement: master_planner' }),
      ]
    : [
        heroCard({ img: 'Mindsets/Optimist_final.png', title: 'Optimist', badge: 'Personality', badgeColor: '#A78BFA', desc: 'Happiness recovers faster, but you might overlook risks.', state: 'selected', accent: '#8B5CF6' }),
        heroCard({ img: 'Mindsets/Frugal_final.png', title: 'Frugal', badge: 'Personality', badgeColor: '#A78BFA', desc: 'You save a bit more, but big spending hurts your happiness slightly.', state: 'normal' }),
        heroCard({ img: 'Mindsets/Investor_final.png', title: 'Investor', badge: 'Financial', badgeColor: '#60A5FA', desc: 'Better returns on stocks and real estate, but higher initial costs.', state: 'normal' }),
      ];
  return `<div style="flex:1;background:${T.bg};display:flex;flex-direction:column;overflow:hidden;">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 15px 8px;">
    <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;">${svg(I.back)}</div>
    <span style="color:#fff;font-size:18px;font-weight:900;">Choose Perks</span>
    <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;">${svg(I.info, '#94A3B8')}</div>
  </div>
  <div style="display:flex;gap:6px;padding:4px 15px 8px;">
    <div style="flex:1;height:4px;border-radius:2px;background:rgba(59,130,246,0.9);"></div>
    <div style="flex:1;height:4px;border-radius:2px;background:rgba(59,130,246,0.9);"></div>
    <div style="flex:1;height:4px;border-radius:2px;background:rgba(59,130,246,0.9);"></div>
  </div>
  <div style="color:#94A3B8;font-size:13px;text-align:center;padding:0 20px 10px;">${perksTab ? 'Optional. Most perks unlock as you earn achievements.' : 'Optional. A mindset adds bonuses and trade-offs.'}</div>
  <div style="display:flex;gap:12px;padding:2px 15px 12px;">${tab(I.gift, 'Perks', perksTab, perksTab ? '1' : '')}${tab(I.brain, 'Mindset', !perksTab, !perksTab ? '1' : '', '#8B5CF6')}</div>
  <div style="flex:1;overflow:hidden;padding:2px 15px 0;position:relative;">
    ${cards.join('')}
    <div style="position:absolute;left:0;right:0;bottom:0;height:110px;background:linear-gradient(to bottom, rgba(15,23,42,0), #0F172A);pointer-events:none;"></div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;padding:14px 18px 22px;background:linear-gradient(to bottom, rgba(15,23,42,0), #0F172A 40%);">
    <div style="background:linear-gradient(120deg,#60A5FA,#3B82F6,#2563EB);border-radius:16px;padding:15px;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 10px 22px -6px rgba(59,130,246,0.55);">
      ${svg(I.play, '#fff', 18)}<span style="color:#fff;font-size:15px;font-weight:800;">Start Your Life</span>
    </div>
  </div>
</div>`;
};

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Perks & Mindset — art-led cards',
  subtitle: 'Same hero treatment as Scenarios: each perk painting / mindset symbol fills the top of its card with a scrim, and the slate body carries description, unlock requirement and benefit chips. Locked, selected and permanent states read over the art. Left: Perks tab. Right: Mindset tab.',
  body: `<div style="display:flex;justify-content:center;gap:40px;margin-top:26px;flex-wrap:wrap;">
      ${phone(screen('perks'), { caption: 'New Game · Perks', captionColor: '#60A5FA', h: 720 })}
      ${phone(screen('mindset'), { caption: 'New Game · Mindset', captionColor: '#A78BFA', h: 720 })}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'perks-hero.png'), 1400);
console.log('wrote perks-hero.png');
