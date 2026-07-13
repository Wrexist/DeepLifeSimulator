/**
 * Faithful preview of the revamped, art-led Scenario + Challenge cards: each
 * scenario's own 1024² painting is now a full-bleed hero with a scrim, the
 * title and difficulty overlaid on the art (BitLife-style), and the slate-glass
 * body (description, goal, stats, tags) below. Container + buttons unchanged.
 *   node scripts/generate-scenarios-hero.mjs
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
  back: '<path d="M15 18l-6-6 6-6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  sparkles: '<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2L12 3z"/>',
  play: '<path d="M6 3l14 9-14 9V3z"/>',
  star: '<path d="M12 2l3 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.9 21l1.2-6.8-5-4.9 6.9-1L12 2z"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M11 3 8 9l4 12 4-12-3-6M2 9h20"/>',
};

const DIFF = { Easy: '#10B981', Moderate: '#3B82F6', Medium: '#3B82F6', Hard: '#F59E0B', Expert: '#EF4444' };

const heroCard = (s, { recommended = false, selected = false } = {}) => `
<div style="border-radius:16px;overflow:hidden;border:${selected ? '2px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.1)'};background:linear-gradient(135deg, rgba(30,41,59,0.85), rgba(15,23,42,0.85));box-shadow:0 8px 16px rgba(0,0,0,0.3);margin-bottom:16px;">
  <div style="position:relative;width:100%;height:140px;background:#0F172A;">
    <img src="${imgURI(s.img)}" style="width:100%;height:100%;object-fit:cover;object-position:center;"/>
    <div style="position:absolute;inset:0;background:linear-gradient(to bottom, rgba(15,23,42,0) 0%, rgba(15,23,42,0.4) 50%, rgba(15,23,42,0.97) 100%);"></div>
    ${recommended ? `<div style="position:absolute;top:10px;left:10px;display:flex;align-items:center;gap:5px;background:rgba(15,23,42,0.78);border:1px solid rgba(96,165,250,0.6);padding:5px 10px;border-radius:999px;">${svg(I.star, '#60A5FA', 11)}<span style="color:#60A5FA;font-size:10px;font-weight:800;letter-spacing:0.6px;">RECOMMENDED</span></div>` : ''}
    ${selected ? `<div style="position:absolute;top:10px;right:10px;width:28px;height:28px;border-radius:14px;background:rgba(15,23,42,0.85);border:2px solid rgba(96,165,250,0.85);display:flex;align-items:center;justify-content:center;">${svg(I.check, '#3B82F6', 15)}</div>` : ''}
    <div style="position:absolute;left:0;right:0;bottom:0;display:flex;align-items:flex-end;justify-content:space-between;gap:8px;padding:0 16px 12px;">
      <span style="color:#fff;font-size:19px;font-weight:800;text-shadow:0 1px 4px rgba(0,0,0,0.6);">${s.title}</span>
      <span style="background:${DIFF[s.difficulty]};padding:4px 8px;border-radius:999px;color:#fff;font-size:9px;font-weight:800;white-space:nowrap;">${s.difficulty.toUpperCase()}</span>
    </div>
  </div>
  <div style="padding:16px;">
    <div style="color:#CBD5E1;font-size:13px;font-weight:500;line-height:16px;margin-bottom:8px;">${s.desc}</div>
    <div style="color:#60A5FA;font-size:11px;font-weight:700;margin-bottom:12px;">Goal: ${s.goal}</div>
    <div style="display:flex;gap:6px;margin-bottom:${s.tags ? '12px' : '0'};">
      ${s.stats.map((c) => `<div style="flex:1;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:8px 8px;"><div style="color:#94A3B8;font-size:10px;font-weight:600;margin-bottom:2px;">${c[0]}</div><div style="color:${c[2] || '#fff'};font-size:11px;font-weight:800;">${c[1]}</div></div>`).join('')}
    </div>
    ${s.tags ? `<div style="display:flex;gap:6px;flex-wrap:wrap;">${s.tags.map((t) => `<span style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.1);border-radius:999px;padding:5px 10px;color:#60A5FA;font-size:10px;font-weight:700;">${t}</span>`).join('')}</div>` : ''}
  </div>
</div>`;

const LIFE_PATHS = [
  {
    title: 'Food Courier', difficulty: 'Easy', goal: 'Any', img: 'Scenarios/Uber Driver.png',
    desc: 'Deliver food on your bike with a phone. Honest grind to start out.',
    stats: [['Age', '20'], ['Cash', '$1,500'], ['Study', 'None']],
    tags: ['📱 Smartphone', '🚲 Bike'], recommended: true,
  },
  {
    title: 'Highschool Dropout', difficulty: 'Easy', goal: 'Wealth Collector', img: 'Scenarios/Highschool Dropout.png',
    desc: 'Young and broke, with no education. Can you turn life around?',
    stats: [['Age', '18'], ['Cash', '$500'], ['Study', 'Dropout']],
    selected: true,
  },
  {
    title: 'Corporate Intern', difficulty: 'Moderate', goal: 'Career Climber', img: 'Scenarios/Corporate Intern.png',
    desc: 'Starting at the bottom of the corporate ladder. Can you climb to CEO?',
    stats: [['Age', '21'], ['Cash', '$500'], ['Study', 'College']],
    tags: ['👔 Suit'],
  },
];

const CHALLENGES = [
  {
    title: 'Rags to Riches', difficulty: 'Hard', goal: 'Reach $1M net worth', img: 'Scenarios/Rags to Riches_final.png',
    desc: 'Claw your way from nothing to a seven-figure fortune. First prestige pays gems.',
    stats: [['Age', '18'], ['Cash', '$0'], ['Study', 'None'], ['Reward', '💎 500', '#FBBF24']],
    tags: ['🔥 Challenge'], selected: true,
  },
  {
    title: 'Single Parent', difficulty: 'Expert', goal: 'Raise a happy, funded child', img: 'Scenarios/Single Parent_final.png',
    desc: 'Provide and protect on one income. Every dollar and every hour counts.',
    stats: [['Age', '28'], ['Cash', '$1,200'], ['Study', 'None'], ['Reward', '💎 800', '#FBBF24']],
    tags: ['🔥 Challenge', '📱 Smartphone'],
  },
];

const tab = (icon, label, active) => `
<div style="flex:1;border-radius:12px;overflow:hidden;box-shadow:${active ? '0 4px 8px rgba(59,130,246,0.3)' : 'none'};">
  <div style="display:flex;align-items:center;justify-content:center;gap:8px;padding:14px 16px;border:1px solid rgba(255,255,255,0.1);border-radius:12px;background:${active ? 'linear-gradient(120deg,#3B82F6,#2563EB)' : 'linear-gradient(120deg,rgba(30,41,59,0.8),rgba(15,23,42,0.8))'};">
    ${svg(icon, active ? '#fff' : '#94A3B8', 18)}
    <span style="color:${active ? '#fff' : '#94A3B8'};font-size:14px;font-weight:600;">${label}</span>
  </div>
</div>`;

const screen = (mode) => {
  const life = mode === 'life';
  const cards = life ? LIFE_PATHS : CHALLENGES;
  return `<div style="flex:1;background:${T.bg};display:flex;flex-direction:column;overflow:hidden;">
  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 15px 8px;">
    <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;">${svg(I.back)}</div>
    <span style="color:#fff;font-size:18px;font-weight:900;">Choose Scenario</span>
    <div style="width:38px;height:38px;border-radius:12px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);display:flex;align-items:center;justify-content:center;">${svg(I.info, '#94A3B8')}</div>
  </div>
  <div style="display:flex;gap:6px;padding:4px 15px 8px;">
    <div style="flex:1;height:4px;border-radius:2px;background:rgba(59,130,246,0.9);"></div>
    <div style="flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,0.14);"></div>
    <div style="flex:1;height:4px;border-radius:2px;background:rgba(255,255,255,0.14);"></div>
  </div>
  <div style="color:#94A3B8;font-size:12px;text-align:center;padding:0 20px 10px;">${life ? 'Pick how your life begins. New here? Tap the "Recommended" path at the top.' : 'Challenges add tougher goals and gem rewards — best once you know the game.'}</div>
  <div style="display:flex;gap:12px;padding:2px 15px 12px;">${tab(I.target, 'Life Paths', life)}${tab(I.sparkles, 'Challenges', !life)}</div>
  <div style="flex:1;overflow:hidden;padding:2px 15px 0;position:relative;">
    ${cards.map((c) => heroCard(c, { recommended: c.recommended, selected: c.selected })).join('')}
    <div style="position:absolute;left:0;right:0;bottom:0;height:120px;background:linear-gradient(to bottom, rgba(15,23,42,0), #0F172A);pointer-events:none;"></div>
  </div>
  <div style="position:absolute;left:0;right:0;bottom:0;padding:14px 18px 22px;background:linear-gradient(to bottom, rgba(15,23,42,0), #0F172A 40%);">
    <div style="background:linear-gradient(120deg,#60A5FA,#3B82F6,#2563EB);border-radius:16px;padding:15px;display:flex;align-items:center;justify-content:center;gap:9px;box-shadow:0 10px 22px -6px rgba(59,130,246,0.55);">
      ${svg(I.play, '#fff', 18)}<span style="color:#fff;font-size:15px;font-weight:800;">Continue To Identity</span>
    </div>
  </div>
</div>`;
};

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Scenarios & Challenges — art-led hero cards',
  subtitle:
    'Each scenario/challenge painting is now a full-bleed hero with a scrim; the title and difficulty read over the art and the slate-glass body carries the details. The container, tabs, and blue Continue button are exactly as they are now. Left: Life Paths. Right: Challenges (gem reward on the art-led card).',
  body: `<div style="display:flex;justify-content:center;gap:40px;margin-top:26px;flex-wrap:wrap;">
      ${phone(screen('life'), { caption: 'New Game · Life Paths', captionColor: '#60A5FA', h: 720 })}
      ${phone(screen('challenge'), { caption: 'New Game · Challenges', captionColor: '#60A5FA', h: 720 })}
    </div>
    <div style="display:flex;justify-content:center;gap:34px;margin-top:34px;flex-wrap:wrap;max-width:1000px;margin-left:auto;margin-right:auto;">
      ${legendItem('#60A5FA', 'Art is the hero', 'The 1024² paintings fill the top of every card instead of a small 74px thumbnail — the screen feels alive and immersive, while the card frame, tabs and Continue button stay exactly as the slate-glass system defines them.')}
      ${legendItem('#34D399', 'Challenges reuse the same card', 'Challenges get the identical hero card plus a 💎 gem-reward stat and a Challenge tag, so both tabs feel like one cohesive system — nothing bespoke, nothing off-brand.')}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'scenarios-hero.png'), 1400);
console.log('wrote scenarios-hero.png');
