/**
 * In-game screens — current state after the Part 2 sweep. Faithful slate-glass
 * representations of the Work/Career screen (rebuilt), Prestige, Journal, and
 * Family. Not screenshots of the running app — high-fidelity mocks from the
 * same slate tokens + the committed color/elevation changes.
 *   node scripts/generate-ingame-now.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, phone, pageShell, renderToPng } from './lib/phoneFrame.mjs';

const svg = (p, c, s = 16, sw = 2, f = 'none') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  back: '<path d="M15 18l-6-6 6-6"/>', brief: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  check: '<path d="M20 6L9 17l-5-5"/>', crown: '<path d="M2 18h20l-2-9-5 4-3-7-3 7-5-4z"/>', gem: '<path d="M6 3h12l4 6-10 12L2 9z"/>',
  spark: '<path d="M12 3l1.6 4.9L18 9.5l-4.4 1.6L12 16l-1.6-4.9L6 9.5l4.4-1.6z"/>', book: '<path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2z"/><path d="M19 3v18"/>',
  heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  up: '<path d="M18 15l-6-6-6 6"/>', star: '<path d="M12 2l3 7 7 .5-5.5 4.5 2 7L12 17l-6.5 4 2-7L2 9.5 9 9z"/>', trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.6V17a2 2 0 0 1-.8 1.6L8 20h8l-1.2-1.4a2 2 0 0 1-.8-1.6v-2.4M6 2h12v7a6 6 0 0 1-12 0z"/>',
};
const bg = () => `<div style="position:absolute;inset:0;background:#0F172A;"></div>`;
function head(title, right) {
  return `<div style="display:flex;align-items:center;gap:11px;padding:14px 15px 10px;position:relative;">${svg(I.back, '#F1F5F9', 18)}<div style="flex:1;color:#F8FAFC;font-size:18px;font-weight:800;">${title}</div>${right || ''}</div>`;
}
function card(inner, pad = 14) { return `<div style="border-radius:16px;background:#1E293B;border:1px solid rgba(255,255,255,0.06);box-shadow:0 12px 26px -14px rgba(0,0,0,0.7);padding:${pad}px;margin:0 15px 12px;">${inner}</div>`; }
function frame(inner) { return `<div style="flex:1;position:relative;display:flex;flex-direction:column;overflow:hidden;">${bg()}<div style="position:relative;flex:1;display:flex;flex-direction:column;">${inner}</div></div>`; }

// ── Work / Career ──
function work() {
  const levels = [['1', 'Jr', 'done'], ['2', 'Assoc', 'done'], ['3', 'Mid', 'cur'], ['4', 'Senior', 'lock'], ['5', 'Lead', 'lock']];
  const node = ([n, name, s]) => {
    const c = s === 'done' ? '#10B981' : s === 'cur' ? '#3B82F6' : '#475569';
    const br = s === 'cur' ? 'border:2px solid #60A5FA;' : '';
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;"><div style="width:26px;height:26px;border-radius:13px;background:${c};${br}display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800;">${s === 'done' ? svg(I.check, '#fff', 13, 3) : n}</div><span style="color:${s === 'cur' ? '#60A5FA' : s === 'lock' ? '#94A3B8' : '#CBD5E1'};font-size:8.5px;font-weight:${s === 'cur' ? 700 : 500};">${name}</span></div>`;
  };
  const row = levels.map((l, i) => `${node(l)}${i < 4 ? `<div style="flex:1;height:2px;background:#475569;margin-top:13px;"></div>` : ''}`).join('');
  const career = card(`
    <div style="display:flex;align-items:center;gap:11px;margin-bottom:13px;">
      <div style="width:44px;height:44px;border-radius:12px;background:rgba(96,165,250,0.15);border:1px solid rgba(96,165,250,0.3);display:flex;align-items:center;justify-content:center;">${svg(I.brief, '#60A5FA', 21)}</div>
      <div style="flex:1;"><div style="display:flex;align-items:center;gap:7px;"><span style="color:#F8FAFC;font-size:16px;font-weight:800;">Software Engineer</span></div><div style="color:#94A3B8;font-size:11px;margin-top:2px;">TechCorp · Mid Level</div></div>
      <span style="background:rgba(245,158,11,0.16);border:1px solid rgba(245,158,11,0.4);color:#F59E0B;font-size:9px;font-weight:800;padding:3px 8px;border-radius:7px;">RANK 4</span>
    </div>
    <div style="margin-bottom:13px;"><div style="color:#94A3B8;font-size:11px;margin-bottom:5px;">Level 3 of 5 · $92k/yr</div><div style="display:flex;align-items:center;gap:8px;"><div style="flex:1;height:6px;border-radius:3px;background:#334155;overflow:hidden;"><div style="width:60%;height:100%;background:#3B82F6;border-radius:3px;"></div></div><span style="color:#CBD5E1;font-size:11px;font-weight:600;">60%</span></div></div>
    <div style="color:#94A3B8;font-size:10px;font-weight:700;letter-spacing:0.5px;margin-bottom:8px;">CAREER PATH</div>
    <div style="display:flex;align-items:flex-start;padding:0 2px;">${row}</div>`);
  const promo = `<div style="margin:0 15px;border-radius:14px;background:linear-gradient(135deg,#3B82F6,#2563EB);box-shadow:0 8px 20px rgba(59,130,246,0.4);padding:14px 16px;display:flex;align-items:center;gap:10px;justify-content:center;">${svg(I.up, '#fff', 18)}<span style="color:#fff;font-size:15px;font-weight:800;">Work Toward Promotion</span></div>`;
  return frame(`${head('Career')}${career}
    <div style="display:flex;gap:10px;margin:0 15px 12px;">${[['$92k', 'Salary'], ['Lv 12', 'Skill'], ['4.8★', 'Rating']].map(([v, l]) => `<div style="flex:1;border-radius:12px;background:#1E293B;border:1px solid rgba(255,255,255,0.06);box-shadow:0 8px 18px -12px rgba(0,0,0,0.6);padding:11px 6px;text-align:center;"><div style="color:#F1F5F9;font-size:15px;font-weight:800;">${v}</div><div style="color:#94A3B8;font-size:9px;font-weight:600;margin-top:2px;">${l}</div></div>`).join('')}</div>
    ${promo}`);
}

// ── Prestige ──
function prestige() {
  const hero = card(`<div style="display:flex;align-items:center;gap:12px;">
    <div style="width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#A855F7,#7C3AED);display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px -4px rgba(168,85,247,0.6);">${svg(I.crown, '#fff', 26, 2, '#fff')}</div>
    <div style="flex:1;"><div style="color:#F8FAFC;font-size:20px;font-weight:800;">Prestige Lv 4</div><div style="color:#94A3B8;font-size:12px;margin-top:2px;">1,240 prestige points</div></div>
    <div style="display:flex;align-items:center;gap:4px;">${svg(I.gem, '#FBBF24', 15, 2, '#FBBF24')}<span style="color:#FBBF24;font-size:16px;font-weight:800;">86</span></div></div>`);
  const tiles = `<div style="display:flex;gap:10px;margin:0 15px 12px;">${[[I.trophy, '#FBBF24', 'Legacy', 'Tier 6'], [I.star, '#60A5FA', 'DeepLife+', 'Active']].map(([ic, c, t, s]) => `<div style="flex:1;border-radius:14px;background:#1E293B;border:1px solid rgba(255,255,255,0.06);box-shadow:0 10px 22px -14px rgba(0,0,0,0.65);padding:13px;"><div style="width:32px;height:32px;border-radius:9px;background:${c}22;border:1px solid ${c}44;display:flex;align-items:center;justify-content:center;margin-bottom:8px;">${svg(ic, c, 16)}</div><div style="color:#F8FAFC;font-size:13px;font-weight:800;">${t}</div><div style="color:#94A3B8;font-size:10px;margin-top:1px;">${s}</div></div>`).join('')}</div>`;
  const btn = `<div style="margin:0 15px;border-radius:14px;background:linear-gradient(135deg,#A855F7,#7C3AED);box-shadow:0 8px 20px rgba(168,85,247,0.4);padding:14px;text-align:center;color:#fff;font-size:15px;font-weight:800;">✦ Prestige Now (+3 points)</div>`;
  return frame(`${head('Progress')}${hero}${tiles}
    ${card(`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;"><span style="color:#F8FAFC;font-size:14px;font-weight:800;">Lifetime Stats</span></div>${[['Net worth', '$4.2M'], ['Careers held', '7'], ['Weeks lived', '1,892']].map(([l, v]) => `<div style="display:flex;justify-content:space-between;padding:6px 0;"><span style="color:#94A3B8;font-size:12px;">${l}</span><span style="color:#F1F5F9;font-size:12.5px;font-weight:700;">${v}</span></div>`).join('')}`)}${btn}`);
}

// ── Journal ──
function journal() {
  const entry = (date, cat, catColor, text) => card(`<div style="display:flex;align-items:center;gap:8px;margin-bottom:7px;"><span style="background:${catColor}22;border:1px solid ${catColor}44;color:${catColor};font-size:9px;font-weight:800;padding:2px 8px;border-radius:6px;">${cat}</span><span style="color:#94A3B8;font-size:10.5px;">${date}</span></div><div style="color:#CBD5E1;font-size:12.5px;line-height:1.45;">${text}</div>`);
  return frame(`${head('Journal')}
    ${entry('Age 34 · Week 12', 'CAREER', '#60A5FA', 'Got promoted to Senior Engineer at TechCorp. The raise finally makes the late nights worth it.')}
    ${entry('Age 34 · Week 8', 'FAMILY', '#F472B6', 'Maya took her first steps today. Missed the actual moment but the video made me cry at my desk.')}
    ${entry('Age 33 · Week 45', 'WEALTH', '#34D399', 'Crossed $1M net worth. Fifteen years of grinding since the Street Hustler days.')}
    ${entry('Age 33 · Week 20', 'HEALTH', '#FBBF24', 'Doctor said the stress is catching up. Started running again — 5k three times a week.')}`);
}

// ── Family ──
function family() {
  const member = (initial, grad, name, rel, mood, moodC) => card(`<div style="display:flex;align-items:center;gap:12px;"><div style="width:46px;height:46px;border-radius:23px;background:${grad};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:18px;">${initial}</div><div style="flex:1;"><div style="color:#F8FAFC;font-size:15px;font-weight:800;">${name}</div><div style="color:#94A3B8;font-size:11px;margin-top:1px;">${rel}</div></div><div style="display:flex;align-items:center;gap:5px;"><div style="width:60px;height:6px;border-radius:3px;background:#334155;overflow:hidden;"><div style="width:${mood}%;height:100%;background:${moodC};border-radius:3px;"></div></div>${svg(I.heart, moodC, 14, 2, moodC)}</div></div>`, 13);
  return frame(`${head('Family')}
    ${member('S', 'linear-gradient(135deg,#EC4899,#8B5CF6)', 'Sofia Rivera', 'Spouse · Married 6y', 88, '#34D399')}
    ${member('M', 'linear-gradient(135deg,#60A5FA,#3B82F6)', 'Maya Rivera', 'Daughter · Age 2', 95, '#34D399')}
    ${member('D', 'linear-gradient(135deg,#F59E0B,#D97706)', 'Diego Rivera', 'Father · Age 68', 62, '#FBBF24')}
    ${member('L', 'linear-gradient(135deg,#10B981,#059669)', 'Luna', 'Golden Retriever', 100, '#34D399')}`);
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'In-game screens — how they look now',
  subtitle: 'After the Part 2 sweep: the rebuilt Work/Career screen plus the cleaned-up Prestige, Journal and Family screens, all on the app\'s slate-glass — elevated cards, slate surfaces, blue accent, with semantic colors (green, gold, pink, amber) intact.',
  body: `<div style="display:flex;justify-content:center;gap:28px;margin-top:26px;flex-wrap:wrap;max-width:1400px;margin-left:auto;margin-right:auto;">
      ${phone(work(), { caption: 'Work · Career (rebuilt)', captionColor: '#34D399', w: 300, h: 600 })}
      ${phone(prestige(), { caption: 'Progress · Prestige', captionColor: '#60A5FA', w: 300, h: 600 })}
      ${phone(journal(), { caption: 'Journal', captionColor: '#60A5FA', w: 300, h: 600 })}
      ${phone(family(), { caption: 'Family', captionColor: '#60A5FA', w: 300, h: 600 })}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'ingame-now.png'), 1360);
console.log('wrote ingame-now.png');
