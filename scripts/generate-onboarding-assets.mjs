/**
 * Onboarding gallery WITH the real artwork embedded — scenario/challenge
 * paintings (assets/images/Scenarios), sex images (assets/images/Sex), and perk
 * icons (assets/images/Perks), at their faithful render sizes. Includes the
 * Challenges tab to show each challenge now using its mapped painting.
 *   node scripts/generate-onboarding-assets.mjs
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ROOT, phone, pageShell, renderToPng } from './lib/phoneFrame.mjs';

const A = resolve(ROOT, 'assets/images');
const uri = (rel) => `data:image/png;base64,${readFileSync(resolve(A, rel)).toString('base64')}`;

const svg = (p, c, s = 18, sw = 2, f = 'none') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  back: '<path d="M15 18l-6-6 6-6"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  sparkles: '<path d="M12 3l1.6 4.9L18 9.5l-4.4 1.6L12 16l-1.6-4.9L6 9.5l4.4-1.6z"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', check: '<path d="M20 6L9 17l-5-5"/>',
  gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8M16.5 8a2.5 2.5 0 0 0 0-5C13 3 12 8 12 8"/>',
  brain: '<path d="M12 5a3 3 0 0 0-6 0 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 0zM12 5a3 3 0 0 1 6 0 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 0z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
};
function bg() {
  return `<div style="position:absolute;inset:0;background:#0F172A;overflow:hidden;">
    <div style="position:absolute;width:150%;height:60%;border-radius:50%;top:-22%;left:-25%;background:rgba(59,130,246,0.13);filter:blur(12px);"></div>
    <div style="position:absolute;width:120%;height:45%;border-radius:50%;bottom:-15%;right:-25%;background:rgba(37,99,235,0.08);filter:blur(12px);"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(37,99,235,0.20) 0%, rgba(30,41,59,0) 42%, rgba(2,6,23,0.58) 100%);"></div></div>`;
}
function head(title) {
  const g = 'rgba(30,41,59,0.55)';
  return `<div style="display:flex;align-items:center;gap:10px;padding:2px 0 10px;position:relative;">
    <div style="width:36px;height:36px;border-radius:12px;background:${g};border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">${svg(I.back, '#F1F5F9', 17)}</div>
    <div style="flex:1;color:#F8FAFC;font-size:17px;font-weight:800;">${title}</div>
    <div style="width:36px;height:36px;border-radius:12px;background:${g};border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">${svg(I.info, '#94A3B8', 16)}</div></div>`;
}
function step(cur) { return `<div style="display:flex;gap:4px;margin:2px 0 12px;position:relative;">${[1, 2, 3].map(i => `<div style="flex:1;height:3px;border-radius:2px;background:${i <= cur ? 'rgba(59,130,246,0.85)' : 'rgba(255,255,255,0.1)'};"></div>`).join('')}</div>`; }
function guide(t) { return `<div style="color:#94A3B8;font-size:11.5px;text-align:center;margin-bottom:12px;position:relative;">${t}</div>`; }
function segTabs(items) {
  return `<div style="display:flex;gap:8px;margin-bottom:13px;position:relative;">${items.map(([label, icon, on, badge]) => `<div style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 0;border-radius:12px;background:${on ? 'linear-gradient(135deg,#3B82F6,#2563EB)' : 'linear-gradient(160deg, rgba(30,41,59,0.8), rgba(15,23,42,0.8))'};${on ? 'box-shadow:0 4px 8px rgba(59,130,246,0.3);' : ''}">${svg(icon, on ? '#fff' : '#94A3B8', 16)}<span style="color:${on ? '#fff' : '#94A3B8'};font-size:12.5px;font-weight:700;">${label}</span>${badge ? `<span style="background:#3B82F6;color:#fff;font-size:9px;font-weight:800;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 3px;">${badge}</span>` : ''}</div>`).join('')}</div>`;
}
function cta(label) {
  return `<div style="position:absolute;left:15px;right:15px;bottom:15px;border-radius:16px;background:linear-gradient(135deg,#60A5FA,#3B82F6,#2563EB);border:2px solid rgba(255,255,255,0.3);box-shadow:0 8px 20px rgba(59,130,246,0.5);padding:16px 18px;display:flex;align-items:center;"><span style="flex:1;text-align:center;color:#fff;font-size:17px;font-weight:800;text-shadow:0 2px 4px rgba(0,0,0,0.3);">${label}</span><div style="width:30px;height:30px;border-radius:15px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;">${svg(I.arrow, '#fff', 17)}</div></div>`;
}
function frame(inner) { return `<div style="flex:1;position:relative;display:flex;flex-direction:column;overflow:hidden;">${bg()}<div style="position:relative;flex:1;display:flex;flex-direction:column;padding:12px 15px 0;">${inner}</div></div>`; }
const img74 = (rel) => `<img src="${uri(rel)}" style="width:74px;height:74px;border-radius:16px;object-fit:cover;box-shadow:0 6px 12px rgba(0,0,0,0.4);flex:0 0 auto;"/>`;

// ── Life Path (real painting) ──
function lifePath() {
  const card = `<div style="position:relative;border-radius:16px;background:linear-gradient(160deg, rgba(30,41,59,0.9), rgba(15,23,42,0.92));border:1.5px solid rgba(59,130,246,0.55);box-shadow:0 12px 28px -14px rgba(0,0,0,0.7), inset 0 0 0 100px rgba(59,130,246,0.12);padding:14px;">
    <div style="background:rgba(52,211,153,0.14);border:1px solid rgba(52,211,153,0.2);border-radius:8px;padding:4px 9px;color:#34D399;font-size:9px;font-weight:800;letter-spacing:0.5px;display:inline-block;margin-bottom:11px;">★ RECOMMENDED FOR BEGINNERS</div>
    <div style="display:flex;gap:12px;">${img74('Scenarios/Street Hustler.png')}
      <div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;"><span style="color:#F8FAFC;font-size:15px;font-weight:800;">Street Hustler</span><span style="background:rgba(245,158,11,0.16);border:1px solid rgba(245,158,11,0.4);color:#F59E0B;font-size:8px;font-weight:800;padding:2px 6px;border-radius:6px;">HARD</span></div>
        <div style="color:#CBD5E1;font-size:11px;line-height:1.4;margin-top:5px;">Start with nothing on the streets. Grind up from odd jobs to a criminal empire.</div></div></div>
    <div style="display:flex;gap:7px;margin-top:12px;">${[['Age', '16'], ['Cash', '$50'], ['Study', 'None']].map(([l, v]) => `<div style="flex:1;background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:7px 4px;text-align:center;"><div style="color:#94A3B8;font-size:8.5px;font-weight:600;">${l}</div><div style="color:#F1F5F9;font-size:11px;font-weight:800;margin-top:2px;">${v}</div></div>`).join('')}</div></div>`;
  return frame(`${head('Choose Scenario')}${step(1)}${guide('Pick the life you\'ll be born into')}${segTabs([['Life Paths', I.target, true], ['Challenges', I.sparkles, false]])}${card}${cta('Continue To Identity')}`);
}

// ── Challenges (real mapped paintings) ──
function challengeCard(rel, name, diff, diffColor, desc, gems) {
  return `<div style="border-radius:16px;background:linear-gradient(160deg, rgba(30,41,59,0.9), rgba(15,23,42,0.92));border:1.5px solid rgba(255,255,255,0.1);box-shadow:0 10px 24px -14px rgba(0,0,0,0.65);padding:13px;margin-bottom:11px;">
    <div style="display:flex;gap:12px;">${img74(rel)}
      <div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;"><span style="color:#F8FAFC;font-size:14.5px;font-weight:800;">${name}</span><span style="background:${diffColor}22;border:1px solid ${diffColor}55;color:${diffColor};font-size:8px;font-weight:800;padding:2px 6px;border-radius:6px;">${diff}</span></div>
        <div style="color:#CBD5E1;font-size:10.5px;line-height:1.4;margin-top:4px;">${desc}</div>
        <div style="display:flex;align-items:center;gap:8px;margin-top:8px;"><span style="background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.28);color:#60A5FA;font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:8px;">⚡ Challenge</span><span style="display:flex;align-items:center;gap:3px;color:#FBBF24;font-size:11px;font-weight:800;">${svg(I.gem, '#FBBF24', 11, 2, '#FBBF24')}${gems}</span></div></div></div></div>`;
}
function challenges() {
  const cards = challengeCard('Scenarios/Rags to Riches_final.png', 'Rags to Riches', 'MEDIUM', '#3B82F6', 'Start with nothing and build a fortune. Reach $1M net worth.', 5)
    + challengeCard('Scenarios/Aspiring Streamer.png', 'Fame Seeker', 'HARD', '#F59E0B', 'From unknown to icon. Build fame through social media and connections.', 8)
    + challengeCard('Scenarios/Aspiring Entrepreneur.png', 'Tech Mogul', 'EXPERT', '#EF4444', 'Start in a garage, build the next tech giant. Code your way to billions.', 12);
  return frame(`${head('Choose Scenario')}${step(1)}${guide('Beat a challenge for bonus gem rewards')}${segTabs([['Life Paths', I.target, false], ['Challenges', I.sparkles, true]])}${cards}${cta('Continue To Identity')}`);
}

// ── Create Identity (real sex images) ──
function customize() {
  const input = (ph) => `<div style="background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:11px;padding:11px 12px;color:#64748B;font-size:12.5px;font-weight:600;margin-top:8px;">${ph}</div>`;
  const name = `<div style="border-radius:16px;background:linear-gradient(160deg, rgba(30,41,59,0.9), rgba(15,23,42,0.92));border:1px solid rgba(255,255,255,0.1);box-shadow:0 12px 28px -14px rgba(0,0,0,0.7);padding:14px;margin-bottom:12px;"><div style="display:flex;align-items:center;justify-content:space-between;"><span style="color:#F8FAFC;font-size:14px;font-weight:800;">Name</span><div style="display:flex;align-items:center;gap:5px;color:#60A5FA;font-size:11.5px;font-weight:700;">${svg(I.shuffle, '#60A5FA', 13)}Shuffle</div></div>${input('First name')}${input('Last name')}</div>`;
  const opt = (rel, label, sel) => `<div style="flex:1;border-radius:13px;background:${sel ? 'rgba(59,130,246,0.15)' : 'rgba(15,23,42,0.5)'};border:2px solid ${sel ? '#3B82F6' : 'rgba(255,255,255,0.08)'};padding:12px 5px;display:flex;flex-direction:column;align-items:center;gap:7px;position:relative;">${sel ? `<div style="position:absolute;top:5px;right:5px;width:17px;height:17px;border-radius:9px;background:#3B82F6;display:flex;align-items:center;justify-content:center;">${svg(I.check, '#fff', 10, 3)}</div>` : ''}<img src="${uri(rel)}" style="width:38px;height:38px;border-radius:9px;object-fit:cover;"/><span style="color:${sel ? '#F1F5F9' : '#94A3B8'};font-size:11.5px;font-weight:700;">${label}</span></div>`;
  const sex = `<div style="border-radius:16px;background:linear-gradient(160deg, rgba(30,41,59,0.9), rgba(15,23,42,0.92));border:1px solid rgba(255,255,255,0.1);box-shadow:0 12px 28px -14px rgba(0,0,0,0.7);padding:14px;"><div style="color:#F8FAFC;font-size:14px;font-weight:800;margin-bottom:10px;">Sex</div><div style="display:flex;gap:8px;">${opt('Sex/Male.png', 'Male', true)}${opt('Sex/Female.png', 'Female', false)}${opt('Sex/Dice.png', 'Random', false)}</div></div>`;
  return frame(`${head('Create Identity')}${step(2)}${guide('Who are you in this life?')}${name}${sex}${cta('Continue To Perks')}`);
}

// ── Choose Perks (real 80px perk art) ──
function perkCard(rel, name, rarity, rc, desc, sel, locked) {
  const border = sel ? 'rgba(59,130,246,0.55)' : 'rgba(255,255,255,0.1)';
  return `<div style="position:relative;border-radius:16px;background:linear-gradient(160deg, rgba(30,41,59,0.9), rgba(15,23,42,0.92));border:1.5px solid ${border};box-shadow:0 10px 24px -14px rgba(0,0,0,0.65)${sel ? ', inset 0 0 0 100px rgba(59,130,246,0.12)' : ''};padding:12px;margin-bottom:11px;">
    <div style="display:flex;gap:12px;align-items:center;">
      <div style="position:relative;flex:0 0 auto;"><img src="${uri(rel)}" style="width:72px;height:72px;border-radius:15px;object-fit:cover;${locked ? 'filter:grayscale(0.7) brightness(0.6);' : ''}"/>${locked ? `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(2,6,23,0.35);border-radius:15px;">${svg(I.lock, '#CBD5E1', 22)}</div>` : ''}</div>
      <div style="flex:1;min-width:0;"><div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;"><span style="color:${locked ? '#94A3B8' : '#F8FAFC'};font-size:14.5px;font-weight:800;">${name}</span><span style="background:${rc}22;border:1px solid ${rc}55;color:${rc};font-size:8px;font-weight:800;padding:2px 6px;border-radius:5px;">${rarity}</span></div>
        <div style="color:${locked ? '#64748B' : '#CBD5E1'};font-size:10.5px;line-height:1.35;margin-top:4px;">${desc}</div>${locked ? '<div style="color:#64748B;font-size:9.5px;font-weight:600;margin-top:5px;">🔒 Unlock via achievement</div>' : ''}</div>
      ${sel ? `<div style="width:22px;height:22px;border-radius:11px;background:#3B82F6;display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${svg(I.check, '#fff', 13, 3)}</div>` : ''}</div></div>`;
}
function perks() {
  const cards = perkCard('Perks/Fast Learner.png', 'Fast Learner', 'RARE', '#3B82F6', '+15% skill XP for your first 5 years.', true, false)
    + perkCard('Perks/Trust Fund.png', 'Trust Fund', 'EPIC', '#8B5CF6', 'Begin with $10,000 in the bank.', false, true)
    + perkCard('Perks/Lucky Charm.png', 'Lucky Charm', 'COMMON', '#10B981', 'Slightly better odds on random events.', false, false);
  return frame(`${head('Choose Perks')}${step(3)}${guide('Optional — most perks unlock as you earn achievements')}${segTabs([['Perks', I.gift, true, '1'], ['Mindset', I.brain, false]])}${cards}${cta('Start Your Life')}`);
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Onboarding — now with the real artwork',
  subtitle: 'The same flow rendered with the actual asset paintings: Life-Path & Challenge scenarios, the Sex images on Create Identity, and the full-size Perk art. Every Challenge now shows its own mapped painting instead of one shared fallback.',
  body: `<div style="display:flex;justify-content:center;gap:30px;margin-top:26px;flex-wrap:wrap;max-width:1400px;margin-left:auto;margin-right:auto;">
      ${phone(lifePath(), { caption: 'Scenario · Life Paths', captionColor: '#60A5FA', w: 292, h: 600 })}
      ${phone(challenges(), { caption: 'Scenario · Challenges (mapped art)', captionColor: '#34D399', w: 292, h: 600 })}
      ${phone(customize(), { caption: 'Create Identity', captionColor: '#60A5FA', w: 292, h: 600 })}
      ${phone(perks(), { caption: 'Choose Perks', captionColor: '#60A5FA', w: 292, h: 600 })}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'onboarding-assets.png'), 1360);
console.log('wrote onboarding-assets.png');
