/**
 * Onboarding accent unification — before/after, built faithfully from the real
 * screen structure (Scenarios + SaveSlots). BEFORE = emerald/red accent on
 * gray-800/900 cards; AFTER = the app's blue on slate. Semantic colors
 * (difficulty, gems, status) are unchanged in both.
 *   node scripts/generate-onboarding-revamp.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, phone, pageShell, legendItem, renderToPng } from './lib/phoneFrame.mjs';

const svg = (p, c, s = 18, sw = 2, f = 'none') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
  sparkles: '<path d="M12 3l1.6 4.9L18 9.5l-4.4 1.6L12 16l-1.6-4.9L6 9.5l4.4-1.6z"/>',
  gem: '<path d="M6 3h12l4 6-10 12L2 9z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
  briefcase: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
};

const BEFORE = {
  name: 'BEFORE · emerald + gray', color: '#F87171',
  cardBg: 'linear-gradient(160deg, rgba(31,41,55,0.85), rgba(17,24,39,0.9))',
  accent: '#10B981', accent2: '#059669', accentTint: 'rgba(16,185,129,0.2)', accentBorder: 'rgba(16,185,129,0.55)',
  tabB: ['#10B981', '#059669'], tabC: ['#EF4444', '#DC2626'],
  cta: 'linear-gradient(135deg, #10B981, #059669, #047857)', ctaGlow: 'rgba(16,185,129,0.5)',
  step: 'rgba(16,185,129,0.85)', body: '#D1D5DB',
};
const AFTER = {
  name: 'AFTER · blue + slate', color: '#34D399',
  cardBg: 'linear-gradient(160deg, rgba(30,41,59,0.9), rgba(15,23,42,0.92))',
  accent: '#3B82F6', accent2: '#2563EB', accentTint: 'rgba(59,130,246,0.2)', accentBorder: 'rgba(59,130,246,0.55)',
  tabB: ['#3B82F6', '#2563EB'], tabC: ['#3B82F6', '#2563EB'],
  cta: 'linear-gradient(135deg, #60A5FA, #3B82F6, #2563EB)', ctaGlow: 'rgba(59,130,246,0.5)',
  step: 'rgba(59,130,246,0.85)', body: '#CBD5E1',
};

function header(title) {
  const g = 'rgba(30,41,59,0.55)';
  return `<div style="display:flex;align-items:center;gap:10px;padding:2px 0 10px;">
    <div style="width:38px;height:38px;border-radius:12px;background:${g};border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">${svg(I.back, '#F1F5F9', 18)}</div>
    <div style="flex:1;color:#F8FAFC;font-size:18px;font-weight:800;">${title}</div>
    <div style="width:38px;height:38px;border-radius:12px;background:${g};border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">${svg(I.info, '#94A3B8', 17)}</div>
  </div>`;
}
function stepBar(t, cur = 1, total = 3) {
  return `<div style="display:flex;gap:4px;margin:2px 0 12px;">${Array.from({ length: total }, (_, i) => `<div style="flex:1;height:3px;border-radius:2px;background:${i < cur ? t.step : 'rgba(255,255,255,0.1)'};"></div>`).join('')}</div>`;
}
function seg2(t, a, aIcon, b, bIcon, activeIdx) {
  const tab = (label, icon, on, grad) => `<div style="flex:1;display:flex;align-items:center;justify-content:center;gap:7px;padding:11px 0;border-radius:12px;background:${on ? `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` : 'linear-gradient(160deg, rgba(30,41,59,0.8), rgba(15,23,42,0.8))'};${on ? `box-shadow:0 4px 8px ${grad[0]}4D;` : ''}">${svg(icon, on ? '#fff' : '#94A3B8', 17)}<span style="color:${on ? '#fff' : '#94A3B8'};font-size:13px;font-weight:700;">${label}</span></div>`;
  return `<div style="display:flex;gap:8px;margin-bottom:14px;">${tab(a, aIcon, activeIdx === 0, t.tabB)}${tab(b, bIcon, activeIdx === 1, t.tabC)}</div>`;
}
function scenarioCard(t) {
  return `<div style="border-radius:18px;background:${t.cardBg};border:1.5px solid ${t.accentBorder};box-shadow:0 10px 26px -12px rgba(0,0,0,0.7), inset 0 0 0 100px ${t.accentTint};overflow:hidden;">
    <div style="background:rgba(52,211,153,0.14);border-bottom:1px solid rgba(52,211,153,0.2);padding:6px 14px;color:#34D399;font-size:10px;font-weight:800;letter-spacing:0.5px;">★ RECOMMENDED FOR BEGINNERS</div>
    <div style="padding:14px;">
      <div style="display:flex;gap:12px;">
        <div style="width:60px;height:60px;border-radius:14px;background:linear-gradient(135deg,#334155,#1E293B);border:1px solid rgba(255,255,255,0.1);flex:0 0 auto;"></div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;"><span style="color:#F8FAFC;font-size:16px;font-weight:800;">Street Hustler</span><span style="background:rgba(245,158,11,0.16);border:1px solid rgba(245,158,11,0.4);color:#F59E0B;font-size:9px;font-weight:800;padding:2px 7px;border-radius:6px;">HARD</span></div>
          <div style="color:${t.body};font-size:11.5px;line-height:1.4;margin-top:4px;">Start with nothing on the city streets. Grind your way up from odd jobs to empire.</div>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        ${[['Age', '16'], ['Cash', '$50'], ['Study', 'None'], ['Reward', '', true]].map(([l, v, gem]) => `<div style="flex:1;background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:11px;padding:8px 4px;text-align:center;">
          <div style="color:#94A3B8;font-size:9px;font-weight:600;">${l}</div>
          ${gem ? `<div style="display:flex;align-items:center;justify-content:center;gap:2px;margin-top:2px;">${svg(I.gem, '#FBBF24', 11, 2, '#FBBF24')}<span style="color:#FBBF24;font-size:12px;font-weight:800;">3</span></div>` : `<div style="color:#F1F5F9;font-size:12px;font-weight:800;margin-top:2px;">${v}</div>`}
        </div>`).join('')}
      </div>
      <div style="display:flex;gap:6px;margin-top:11px;">${['#Poverty', '#GrindMode', '#Crime'].map(tag => `<span style="background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.28);color:#60A5FA;font-size:10px;font-weight:600;padding:3px 9px;border-radius:8px;">${tag}</span>`).join('')}</div>
    </div>
  </div>`;
}
function cta(t, label) {
  return `<div style="position:absolute;left:16px;right:16px;bottom:16px;border-radius:16px;background:${t.cta};border:2px solid rgba(255,255,255,0.3);box-shadow:0 8px 20px ${t.ctaGlow};padding:17px 20px;display:flex;align-items:center;">
    <span style="flex:1;text-align:center;color:#fff;font-size:18px;font-weight:800;text-shadow:0 2px 4px rgba(0,0,0,0.3);">${label}</span>
    <div style="width:32px;height:32px;border-radius:16px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;">${svg(I.arrow, '#fff', 18)}</div>
  </div>`;
}
function scenarios(t) {
  return `<div style="flex:1;background:linear-gradient(180deg,#0F172A,#111c30);position:relative;display:flex;flex-direction:column;padding:12px 15px 0;overflow:hidden;">
    ${header('Choose Scenario')}
    ${stepBar(t)}
    <div style="color:#94A3B8;font-size:12px;text-align:center;margin-bottom:12px;">Pick the life you'll be born into</div>
    ${seg2(t, 'Life Paths', I.target, 'Challenges', I.sparkles, 0)}
    ${scenarioCard(t)}
    ${cta(t, 'Continue To Identity')}
  </div>`;
}

// ── SaveSlots ──
function slotCard(t, selected) {
  const border = selected ? t.accentBorder : 'rgba(255,255,255,0.1)';
  const glow = selected ? `, inset 0 0 0 100px ${t.accentTint}` : '';
  return `<div style="border-radius:16px;background:${t.cardBg};border:1.5px solid ${border};box-shadow:0 8px 22px -12px rgba(0,0,0,0.65)${glow};padding:14px;margin-bottom:12px;">
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span style="color:#F8FAFC;font-size:15px;font-weight:800;">Slot 1</span>
      <span style="background:rgba(52,211,153,0.16);border:1px solid rgba(52,211,153,0.35);color:#34D399;font-size:10px;font-weight:800;padding:3px 9px;border-radius:8px;">ACTIVE</span>
    </div>
    <div style="color:${t.body};font-size:13px;font-weight:500;margin-top:6px;">Alex Rivera · Entrepreneur</div>
    <div style="display:flex;gap:8px;margin-top:12px;">
      ${[['Money', '$2.4M'], ['Age', '34'], ['Weeks', '892']].map(([l, v]) => `<div style="flex:1;background:rgba(15,23,42,0.5);border:1px solid rgba(255,255,255,0.06);border-radius:11px;padding:9px 4px;text-align:center;"><div style="color:#F1F5F9;font-size:13px;font-weight:800;">${v}</div><div style="color:#94A3B8;font-size:9px;font-weight:600;margin-top:2px;">${l}</div></div>`).join('')}
    </div>
    <div style="display:flex;gap:14px;margin-top:12px;padding-top:11px;border-top:1px solid rgba(255,255,255,0.07);">
      <span style="color:#60A5FA;font-size:12px;font-weight:700;">↺ Backups</span>
      <span style="color:#F87171;font-size:12px;font-weight:700;">🗑 Delete</span>
    </div>
  </div>`;
}
function saveSlots(t) {
  return `<div style="flex:1;background:linear-gradient(180deg,#0F172A,#111c30);position:relative;display:flex;flex-direction:column;padding:12px 15px 0;overflow:hidden;">
    ${header('Save Slots')}
    ${slotCard(t, true)}
    ${slotCard(t, false)}
    ${cta(t, 'Continue Game')}
  </div>`;
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Onboarding — one accent, matched to the game',
  subtitle: 'The flow used an emerald (and a red Challenges tab) on gray-800/900 cards, clashing with MainMenu\'s blue and the slate game UI. Now every screen is the app\'s blue on slate. Difficulty, gems, status and delete keep their semantic colors.',
  body: `<div style="display:flex;flex-direction:column;gap:34px;margin-top:28px;align-items:center;">
      <div style="display:flex;justify-content:center;gap:40px;flex-wrap:wrap;">
        ${phone(scenarios(BEFORE), { caption: BEFORE.name, captionColor: BEFORE.color, w: 300, h: 600 })}
        ${phone(scenarios(AFTER), { caption: AFTER.name, captionColor: AFTER.color, w: 300, h: 600 })}
      </div>
      <div style="display:flex;justify-content:center;gap:40px;flex-wrap:wrap;">
        ${phone(saveSlots(BEFORE), { caption: 'Save Slots · before', captionColor: BEFORE.color, w: 300, h: 560 })}
        ${phone(saveSlots(AFTER), { caption: 'Save Slots · after', captionColor: AFTER.color, w: 300, h: 560 })}
      </div>
    </div>
    <div style="display:flex;justify-content:center;gap:36px;margin-top:40px;flex-wrap:wrap;max-width:1040px;margin-left:auto;margin-right:auto;">
      ${legendItem('#3B82F6', 'One blue accent, shared', 'CTAs, step bars, active tabs, and selection highlights all move to the game\'s blue via the shared OnboardingFloatingButton + OnboardingStepBar and per-screen swaps. Customize + Perks got the same treatment; MainMenu was already on-system.')}
      ${legendItem('#94A3B8', 'Slate cards, not gray', 'Card fills move gray-800/900 → slate to sit on the slate shell without a mismatch; body text #D1D5DB/#6B7280 → slate. Perks\' gray locked cards also go slate.')}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'onboarding-revamp.png'), 1080);
console.log('wrote onboarding-revamp.png');
