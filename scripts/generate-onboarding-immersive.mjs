/**
 * Onboarding "minimalist but immersive" — before/after of the atmosphere refit,
 * shown on the Create Identity (character creation) screen.
 * BEFORE = flat slate shell; AFTER = soft blue aurora fading to a deep base +
 * elevated glass cards. Same content, same blue accent — just depth & polish.
 *   node scripts/generate-onboarding-immersive.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, phone, pageShell, legendItem, renderToPng } from './lib/phoneFrame.mjs';

const svg = (p, c, s = 18, sw = 2, f = 'none') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="${f}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const I = {
  back: '<path d="M15 18l-6-6 6-6"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="M20 6L9 17l-5-5"/>',
};

// Backdrop: BEFORE = flat slate + faint orbs; AFTER = aurora gradient + orbs.
function backdrop(immersive) {
  const orbs = `
    <div style="position:absolute;width:150%;height:60%;border-radius:50%;top:-20%;left:-25%;background:rgba(59,130,246,${immersive ? 0.13 : 0.1});filter:blur(10px);"></div>
    <div style="position:absolute;width:120%;height:45%;border-radius:50%;bottom:-15%;right:-25%;background:rgba(${immersive ? '37,99,235,0.09' : '99,102,241,0.05'});filter:blur(10px);"></div>`;
  const aurora = immersive
    ? `<div style="position:absolute;inset:0;background:linear-gradient(180deg, rgba(37,99,235,0.22) 0%, rgba(30,41,59,0) 42%, rgba(2,6,23,0.6) 100%);"></div>`
    : '';
  return `<div style="position:absolute;inset:0;background:#0F172A;overflow:hidden;">${orbs}${aurora}</div>`;
}

function header() {
  const g = 'rgba(30,41,59,0.55)';
  return `<div style="display:flex;align-items:center;gap:10px;padding:2px 0 10px;position:relative;">
    <div style="width:38px;height:38px;border-radius:12px;background:${g};border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">${svg(I.back, '#F1F5F9', 18)}</div>
    <div style="flex:1;color:#F8FAFC;font-size:18px;font-weight:800;">Create Identity</div>
    <div style="width:38px;height:38px;border-radius:12px;background:${g};border:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;">${svg(I.info, '#94A3B8', 17)}</div>
  </div>`;
}
function stepBar() {
  return `<div style="display:flex;gap:4px;margin:2px 0 14px;position:relative;">${[1, 2, 3].map(i => `<div style="flex:1;height:3px;border-radius:2px;background:${i <= 2 ? 'rgba(59,130,246,0.85)' : 'rgba(255,255,255,0.1)'};"></div>`).join('')}</div>`;
}
function card(inner, immersive) {
  const shadow = immersive ? '0 14px 30px -14px rgba(0,0,0,0.72)' : '0 4px 10px -6px rgba(0,0,0,0.4)';
  const border = immersive ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.08)';
  return `<div style="position:relative;border-radius:18px;background:linear-gradient(160deg, rgba(30,41,59,0.9), rgba(15,23,42,0.92));border:1px solid ${border};box-shadow:${shadow};padding:15px;margin-bottom:13px;">${inner}</div>`;
}
function nameCard(immersive) {
  const input = (ph) => `<div style="background:rgba(15,23,42,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:12px 13px;color:#64748B;font-size:13px;font-weight:600;margin-top:9px;">${ph}</div>`;
  return card(`
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span style="color:#F8FAFC;font-size:15px;font-weight:800;">Name</span>
      <div style="display:flex;align-items:center;gap:5px;color:#60A5FA;font-size:12px;font-weight:700;">${svg(I.shuffle, '#60A5FA', 14)}Shuffle</div>
    </div>
    ${input('First name')}${input('Last name')}`, immersive);
}
function sexCard(immersive) {
  const opt = (label, sel) => `<div style="flex:1;border-radius:14px;background:${sel ? 'rgba(59,130,246,0.15)' : 'rgba(15,23,42,0.5)'};border:2px solid ${sel ? '#3B82F6' : 'rgba(255,255,255,0.08)'};padding:14px 6px;display:flex;flex-direction:column;align-items:center;gap:7px;position:relative;">
    ${sel ? `<div style="position:absolute;top:6px;right:6px;width:18px;height:18px;border-radius:9px;background:#3B82F6;display:flex;align-items:center;justify-content:center;">${svg(I.check, '#fff', 11, 3)}</div>` : ''}
    <div style="width:34px;height:34px;border-radius:17px;background:${sel ? 'rgba(59,130,246,0.25)' : 'rgba(148,163,184,0.15)'};display:flex;align-items:center;justify-content:center;">${svg(I.user, sel ? '#60A5FA' : '#94A3B8', 18)}</div>
    <span style="color:${sel ? '#F1F5F9' : '#94A3B8'};font-size:12px;font-weight:700;">${label}</span></div>`;
  return card(`
    <div style="color:#F8FAFC;font-size:15px;font-weight:800;margin-bottom:11px;">Sex</div>
    <div style="display:flex;gap:9px;">${opt('Male', true)}${opt('Female', false)}${opt('Random', false)}</div>`, immersive);
}
function cta() {
  return `<div style="position:absolute;left:16px;right:16px;bottom:16px;border-radius:16px;background:linear-gradient(135deg,#60A5FA,#3B82F6,#2563EB);border:2px solid rgba(255,255,255,0.3);box-shadow:0 8px 20px rgba(59,130,246,0.5);padding:17px 20px;display:flex;align-items:center;">
    <span style="flex:1;text-align:center;color:#fff;font-size:18px;font-weight:800;text-shadow:0 2px 4px rgba(0,0,0,0.3);">Continue To Perks</span>
    <div style="width:32px;height:32px;border-radius:16px;background:rgba(255,255,255,0.14);border:1px solid rgba(255,255,255,0.25);display:flex;align-items:center;justify-content:center;">${svg(I.arrow, '#fff', 18)}</div>
  </div>`;
}
function screen(immersive) {
  return `<div style="flex:1;position:relative;display:flex;flex-direction:column;overflow:hidden;">
    ${backdrop(immersive)}
    <div style="position:relative;flex:1;display:flex;flex-direction:column;padding:12px 15px 0;">
      ${header()}${stepBar()}
      <div style="color:#94A3B8;font-size:12px;text-align:center;margin-bottom:14px;">Who are you in this life?</div>
      ${nameCard(immersive)}${sexCard(immersive)}
    </div>
    ${cta()}
  </div>`;
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Onboarding — minimalist, but immersive',
  subtitle: 'Same content and the same blue accent — now on a soft blue aurora that fades into a deep base, with cards that genuinely float. Calm and uncluttered, but with real depth to draw new players in. Applied across the whole flow via the shared shell.',
  body: `<div style="display:flex;justify-content:center;gap:44px;margin-top:30px;flex-wrap:wrap;">
      ${phone(screen(false), { caption: 'Before · flat slate', captionColor: '#94A3B8', w: 306, h: 620 })}
      ${phone(screen(true), { caption: 'After · immersive atmosphere', captionColor: '#60A5FA', w: 306, h: 620 })}
    </div>
    <div style="display:flex;justify-content:center;gap:36px;margin-top:40px;flex-wrap:wrap;max-width:1040px;margin-left:auto;margin-right:auto;">
      ${legendItem('#3B82F6', 'Immersive, not busy', 'A single soft aurora + slow-drifting glows in the shared OnboardingScreenShellV2 (and matched in Perks). Depth from light, not decoration — the background stays calm behind the content.')}
      ${legendItem('#94A3B8', 'Cards that float', 'GlassPanel + the screen cards get real elevation, so panels lift off the atmosphere instead of sitting flat on it. Minimal surfaces, clear hierarchy, one obvious primary action.')}
    </div>`,
});
await renderToPng(chromium, page, resolve(OUT, 'onboarding-immersive.png'), 1020);
console.log('wrote onboarding-immersive.png');
