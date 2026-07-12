/**
 * Onboarding — current state gallery (after accent unification + immersive
 * atmosphere + Perks-on-shared-shell). Faithful to the real screen structure:
 * every screen on the same blue-aurora backdrop, blue accent, elevated slate
 * cards. Semantic colors (difficulty, rarity, gems, status) preserved.
 *   node scripts/generate-onboarding-now.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, phone, pageShell, renderToPng } from './lib/phoneFrame.mjs';

const svg = (p, c, s = 18, sw = 2, f = 'none') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  back: '<path d="M15 18l-6-6 6-6"/>', info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  sparkles: '<path d="M12 3l1.6 4.9L18 9.5l-4.4 1.6L12 16l-1.6-4.9L6 9.5l4.4-1.6z"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/>', arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  check: '<path d="M20 6L9 17l-5-5"/>', gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8M16.5 8a2.5 2.5 0 0 0 0-5C13 3 12 8 12 8"/>',
  brain: '<path d="M12 5a3 3 0 0 0-6 0 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 6 0zM12 5a3 3 0 0 1 6 0 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-6 0z"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>', star: '<path d="M12 2l3 7 7 .5-5.5 4.5 2 7L12 17l-6.5 4 2-7L2 9.5 9 9z"/>',
};

// Immersive aurora backdrop (matches OnboardingScreenShellV2).
function bg() {
  return `<div style="position:absolute;inset:0;background:#0F172A;overflow:hidden;">
    <div style="position:absolute;width:150%;height:60%;border-radius:50%;top:-22%;left:-25%;background:rgba(59,130,246,0.13);filter:blur(12px);"></div>
    <div style="position:absolute;width:120%;height:45%;border-radius:50%;bottom:-15%;right:-25%;background:rgba(37,99,235,0.08);filter:blur(12px);"></div>
    <div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(37,99,235,0.20) 0%, rgba(30,41,59,0) 42%, rgba(2,6,23,0.58) 100%);"></div>
  </div>`;
}
function head(title) {
  const g = 'rgba(30,41,59,0.55)';
  return `<div style="display:flex;align-items:center;gap:10px;padding:2px 0 10px;position:relative;">
    <div style="width:36px;height:36px;border-radius:12px;background:${g};border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">${svg(I.back, '#F1F5F9', 17)}</div>
    <div style="flex:1;color:#F8FAFC;font-size:17px;font-weight:800;">${title}</div>
    <div style="width:36px;height:36px;border-radius:12px;background:${g};border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">${svg(I.info, '#94A3B8', 16)}</div>
  </div>`;
}
function step(cur) {
  return `<div style="display:flex;gap:4px;margin:2px 0 12px;position:relative;">${[1, 2, 3].map(i => `<div style="flex:1;height:3px;border-radius:2px;background:${i <= cur ? 'rgba(59,130,246,0.85)' : 'rgba(255,255,255,0.1)'};"></div>`).join('')}</div>`;
}
function guide(t) { return `<div style="color:#94A3B8;font-size:11.5px;text-align:center;margin-bottom:12px;position:relative;">${t}</div>`; }
function tabs(items) {
  return `<div style="display:flex;gap:8px;margin-bottom:13px;position:relative;">${items.map(([label, icon, on, badge]) => `<div style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:10px 0;border-radius:12px;background:${on ? 'linear-gradient(135deg,#3B82F6,#2563EB)' : 'linear-gradient(160deg, rgba(30,41,59,0.8), rgba(15,23,42,0.8))'};${on ? 'box-shadow:0 4px 8px rgba(59,130,246,0.3);' : ''}">${svg(icon, on ? '#fff' : '#94A3B8', 16)}<span style="color:${on ? '#fff' : '#94A3B8'};font-size:12.5px;font-weight:700;">${label}</span>${badge ? `<span style="background:#3B82F6;color:#fff;font-size:9px;font-weight:800;min-width:16px;height:16px;border-radius:8px;display:flex;align-items:center;justify-content:center;padding:0 3px;">${badge}</span>` : ''}</div>`).join('')}</div>`;
}
function cta(label) {
  return `<div style="position:absolute;left:15px;right:15px;bottom:15px;border-radius:16px;background:linear-gradient(135deg,#60A5FA,#3B82F6,#2563EB);border:2px solid rgba(255,255,255,0.3);box-shadow:0 8px 20px rgba(59,130,246,0.5);padding:16px 18px;display:flex;align-items:center;">
    <span style="flex:1;text-align:center;color:#fff;font-size:17px;font-weight:800;text-shadow:0 2px 4px rgba(0,0,0,0.3);">${label}</span>
    <div style="width:30px;height:30px;border-radius:15px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;">${svg(I.arrow, '#fff', 17)}</div>
  </div>`;
}
function slateCard(inner, sel) {
  return `<div style="position:relative;border-radius:16px;background:linear-gradient(160deg, rgba(30,41,59,0.9), rgba(15,23,42,0.92));border:1.5px solid ${sel ? 'rgba(59,130,246,0.55)' : 'rgba(255,255,255,0.1)'};box-shadow:0 12px 28px -14px rgba(0,0,0,0.7)${sel ? ', inset 0 0 0 100px rgba(59,130,246,0.14)' : ''};padding:14px;margin-bottom:12px;">${inner}</div>`;
}
function frame(inner) { return `<div style="flex:1;position:relative;display:flex;flex-direction:column;overflow:hidden;">${bg()}<div style="position:relative;flex:1;display:flex;flex-direction:column;padding:12px 15px 0;">${inner}</div></div>`; }

// ── Scenarios ──
function scenarios() {
  const card = slateCard(`
    <div style="position:absolute;top:0;left:0;right:0;background:rgba(52,211,153,0.14);border-bottom:1px solid rgba(52,211,153,0.2);padding:5px 12px;border-radius:16px 16px 0 0;color:#34D399;font-size:9px;font-weight:800;letter-spacing:0.5px;">★ RECOMMENDED FOR BEGINNERS</div>
    <div style="height:20px;"></div>
    <div style="display:flex;gap:11px;">
      <div style="width:56px;height:56px;border-radius:13px;background:linear-gradient(135deg,#334155,#1E293B);border:1px solid rgba(255,255,255,0.1);flex:0 0 auto;"></div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:7px;"><span style="color:#F8FAFC;font-size:15px;font-weight:800;">Street Hustler</span><span style="background:rgba(245,158,11,0.16);border:1px solid rgba(245,158,11,0.4);color:#F59E0B;font-size:8px;font-weight:800;padding:2px 6px;border-radius:6px;">HARD</span></div>
        <div style="color:#CBD5E1;font-size:11px;line-height:1.4;margin-top:4px;">Start with nothing on the streets. Grind up from odd jobs to empire.</div>
      </div>
    </div>
    <div style="display:flex;gap:7px;margin-top:11px;">
      ${[['Age', '16'], ['Cash', '$50'], ['Reward', '', 1]].map(([l, v, g]) => `<div style="flex:1;background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:7px 4px;text-align:center;"><div style="color:#94A3B8;font-size:8.5px;font-weight:600;">${l}</div>${g ? `<div style="display:flex;align-items:center;justify-content:center;gap:2px;margin-top:2px;">${svg(I.gem, '#FBBF24', 10, 2, '#FBBF24')}<span style="color:#FBBF24;font-size:11px;font-weight:800;">3</span></div>` : `<div style="color:#F1F5F9;font-size:11px;font-weight:800;margin-top:2px;">${v}</div>`}</div>`).join('')}
    </div>
    <div style="display:flex;gap:6px;margin-top:10px;">${['#Poverty', '#GrindMode'].map(t => `<span style="background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.28);color:#60A5FA;font-size:9.5px;font-weight:600;padding:3px 8px;border-radius:8px;">${t}</span>`).join('')}</div>`, true);
  return frame(`${head('Choose Scenario')}${step(1)}${guide('Pick the life you\'ll be born into')}${tabs([['Life Paths', I.target, true], ['Challenges', I.sparkles, false]])}${card}${cta('Continue To Identity')}`);
}

// ── Customize ──
function customize() {
  const input = (ph) => `<div style="background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:11px;padding:11px 12px;color:#64748B;font-size:12.5px;font-weight:600;margin-top:8px;">${ph}</div>`;
  const name = slateCard(`<div style="display:flex;align-items:center;justify-content:space-between;"><span style="color:#F8FAFC;font-size:14px;font-weight:800;">Name</span><div style="display:flex;align-items:center;gap:5px;color:#60A5FA;font-size:11.5px;font-weight:700;">${svg(I.shuffle, '#60A5FA', 13)}Shuffle</div></div>${input('First name')}${input('Last name')}`, false);
  const opt = (label, sel) => `<div style="flex:1;border-radius:13px;background:${sel ? 'rgba(59,130,246,0.15)' : 'rgba(15,23,42,0.5)'};border:2px solid ${sel ? '#3B82F6' : 'rgba(255,255,255,0.08)'};padding:12px 5px;display:flex;flex-direction:column;align-items:center;gap:6px;position:relative;">${sel ? `<div style="position:absolute;top:5px;right:5px;width:17px;height:17px;border-radius:9px;background:#3B82F6;display:flex;align-items:center;justify-content:center;">${svg(I.check, '#fff', 10, 3)}</div>` : ''}<div style="width:30px;height:30px;border-radius:15px;background:${sel ? 'rgba(59,130,246,0.25)' : 'rgba(148,163,184,0.15)'};display:flex;align-items:center;justify-content:center;">${svg(I.user, sel ? '#60A5FA' : '#94A3B8', 16)}</div><span style="color:${sel ? '#F1F5F9' : '#94A3B8'};font-size:11.5px;font-weight:700;">${label}</span></div>`;
  const sex = slateCard(`<div style="color:#F8FAFC;font-size:14px;font-weight:800;margin-bottom:10px;">Sex</div><div style="display:flex;gap:8px;">${opt('Male', true)}${opt('Female', false)}${opt('Random', false)}</div>`, false);
  return frame(`${head('Create Identity')}${step(2)}${guide('Who are you in this life?')}${name}${sex}${cta('Continue To Perks')}`);
}

// ── Perks ──
function perkCard(icon, name, rarity, rarityColor, desc, sel, locked) {
  const bgc = locked ? 'linear-gradient(160deg, rgba(51,65,85,0.6), rgba(30,41,59,0.6))' : 'linear-gradient(160deg, rgba(30,41,59,0.9), rgba(15,23,42,0.92))';
  const border = sel ? 'rgba(59,130,246,0.55)' : 'rgba(255,255,255,0.1)';
  return `<div style="position:relative;border-radius:16px;background:${bgc};border:1.5px solid ${border};box-shadow:0 10px 24px -14px rgba(0,0,0,0.65)${sel ? ', inset 0 0 0 100px rgba(59,130,246,0.14)' : ''};padding:13px;margin-bottom:11px;opacity:${locked ? 0.72 : 1};">
    <div style="display:flex;align-items:center;gap:11px;">
      <div style="width:40px;height:40px;border-radius:12px;background:${locked ? 'rgba(148,163,184,0.12)' : 'rgba(59,130,246,0.15)'};border:1px solid ${locked ? 'rgba(148,163,184,0.2)' : 'rgba(59,130,246,0.3)'};display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${svg(locked ? I.lock : icon, locked ? '#94A3B8' : '#60A5FA', 19)}</div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;align-items:center;gap:7px;"><span style="color:${locked ? '#94A3B8' : '#F8FAFC'};font-size:14px;font-weight:800;">${name}</span><span style="background:${rarityColor}22;border:1px solid ${rarityColor}55;color:${rarityColor};font-size:8px;font-weight:800;padding:2px 6px;border-radius:5px;">${rarity}</span></div>
        <div style="color:${locked ? '#64748B' : '#CBD5E1'};font-size:10.5px;line-height:1.35;margin-top:3px;">${desc}</div>
      </div>
      ${sel ? `<div style="width:22px;height:22px;border-radius:11px;background:#3B82F6;display:flex;align-items:center;justify-content:center;flex:0 0 auto;">${svg(I.check, '#fff', 13, 3)}</div>` : ''}
    </div>
  </div>`;
}
function perks() {
  const cards = perkCard(I.zap, 'Fast Learner', 'RARE', '#3B82F6', '+15% skill XP for your first 5 years.', true, false)
    + perkCard(I.star, 'Trust Fund', 'EPIC', '#8B5CF6', 'Begin with $10,000 in the bank.', false, true)
    + perkCard(I.gift, 'Lucky Break', 'COMMON', '#10B981', 'Slightly better odds on random events.', false, false);
  return frame(`${head('Choose Perks')}${step(3)}${guide('Optional — most perks unlock as you earn achievements')}${tabs([['Perks', I.gift, true, '1'], ['Mindset', I.brain, false]])}${cards}${cta('Start Your Life')}`);
}

// ── SaveSlots ──
function slot(sel, filled) {
  const inner = filled ? `<div style="display:flex;align-items:center;justify-content:space-between;"><span style="color:#F8FAFC;font-size:14px;font-weight:800;">Slot 1</span><span style="background:rgba(52,211,153,0.16);border:1px solid rgba(52,211,153,0.35);color:#34D399;font-size:9px;font-weight:800;padding:3px 8px;border-radius:8px;">ACTIVE</span></div>
    <div style="color:#CBD5E1;font-size:12.5px;font-weight:500;margin-top:6px;">Alex Rivera · Entrepreneur</div>
    <div style="display:flex;gap:7px;margin-top:11px;">${[['$2.4M', 'Money'], ['34', 'Age'], ['892', 'Weeks']].map(([v, l]) => `<div style="flex:1;background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:8px 4px;text-align:center;"><div style="color:#F1F5F9;font-size:12.5px;font-weight:800;">${v}</div><div style="color:#94A3B8;font-size:8.5px;font-weight:600;margin-top:2px;">${l}</div></div>`).join('')}</div>
    <div style="display:flex;gap:14px;margin-top:11px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.07);"><span style="color:#60A5FA;font-size:11.5px;font-weight:700;">↺ Backups</span><span style="color:#F87171;font-size:11.5px;font-weight:700;">🗑 Delete</span></div>`
    : `<div style="display:flex;align-items:center;justify-content:space-between;"><span style="color:#F8FAFC;font-size:14px;font-weight:800;">Slot 2</span><span style="color:#94A3B8;font-size:10px;font-weight:700;">EMPTY</span></div><div style="color:#64748B;font-size:12px;margin-top:8px;">Tap to start a new life here</div>`;
  return slateCard(inner, sel);
}
function saveSlots() {
  return frame(`${head('Save Slots')}<div style="height:2px;"></div>${slot(true, true)}${slot(false, false)}${cta('Continue Game')}`);
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Onboarding — how it looks now',
  subtitle: 'The full new-player flow after this pass: one blue accent, a soft immersive aurora on every screen, elevated slate cards, and Perks now on the same shared shell. Difficulty, rarity, gems and status keep their semantic colors.',
  body: `<div style="display:flex;justify-content:center;gap:34px;margin-top:28px;flex-wrap:wrap;max-width:1360px;margin-left:auto;margin-right:auto;">
      ${phone(saveSlots(), { caption: 'Save Slots', captionColor: '#60A5FA', w: 300, h: 600 })}
      ${phone(scenarios(), { caption: 'Choose Scenario', captionColor: '#60A5FA', w: 300, h: 600 })}
      ${phone(customize(), { caption: 'Create Identity', captionColor: '#60A5FA', w: 300, h: 600 })}
      ${phone(perks(), { caption: 'Choose Perks (now on the shared shell)', captionColor: '#34D399', w: 300, h: 600 })}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'onboarding-now.png'), 1360);
console.log('wrote onboarding-now.png');
