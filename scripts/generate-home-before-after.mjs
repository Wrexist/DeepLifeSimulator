/**
 * Complete Home Screen — before/after of the core-screen revamp:
 * gray-800 flat cards + bar HUD  →  slate elevated cards + floating ring HUD.
 *   node scripts/generate-home-before-after.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, legendItem, renderToPng, faceURI } from './lib/phoneFrame.mjs';

const MALE = faceURI('Male.png');
const tn = 'font-variant-numeric:tabular-nums;';
const HEART = '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>';
const SMILE = '<circle cx="12" cy="12" r="9"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2"/><path d="M9 9.5h.01M15 9.5h.01"/>';
const BOLT = '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>';
const VIT = [
  { icon: HEART, fill: true, color: '#EF4444', val: 88 },
  { icon: SMILE, fill: false, color: '#F59E0B', val: 82 },
  { icon: BOLT, fill: true, color: '#3B82F6', val: 64 },
];
const ic = (v, size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${v.fill ? v.color : 'none'}" stroke="${v.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${v.icon}</svg>`;

function screen(revamped) {
  const cardBg = revamped ? '#1E293B' : '#1F2937';
  const elevated = revamped ? '#334155' : '#374151';
  const muted = revamped ? '#94A3B8' : '#9CA3AF';
  const hair = revamped ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.05)';
  const cardShadow = revamped ? 'box-shadow:0 12px 28px -12px rgba(0,0,0,0.7);' : '';
  const hud = revamped
    ? 'border-bottom:1px solid rgba(255,255,255,0.07);box-shadow:0 6px 18px rgba(0,0,0,0.5);'
    : 'border-bottom:1px solid rgba(255,255,255,0.02);';
  const chipRim = revamped ? 'border:1px solid rgba(255,255,255,0.2);' : 'border:1px solid transparent;';

  // vitals: bars (before) vs rings (after)
  const vitals = revamped
    ? `<div style="display:flex;gap:14px;">${VIT.map(v => {
        const S = 38, r = (S - 5) / 2, c = 2 * Math.PI * r, dash = (c * v.val / 100).toFixed(1);
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <div style="position:relative;width:${S}px;height:${S}px;">
            <svg width="${S}" height="${S}" viewBox="0 0 ${S} ${S}"><circle cx="${S / 2}" cy="${S / 2}" r="${r}" stroke="rgba(148,163,184,0.18)" stroke-width="5" fill="none"/><circle cx="${S / 2}" cy="${S / 2}" r="${r}" stroke="${v.color}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="${dash} ${c.toFixed(1)}" transform="rotate(-90 ${S / 2} ${S / 2})"/></svg>
            <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">${ic(v, 15)}</div>
          </div>
          <span style="color:#E2E8F0;font-size:10px;font-weight:800;${tn}">${v.val}</span>
        </div>`;
      }).join('')}</div>`
    : `<div style="display:flex;flex-direction:column;gap:5px;">${VIT.map(v =>
        `<div style="display:flex;align-items:center;gap:6px;">${ic(v, 14)}<div style="width:104px;height:13px;background:${elevated};border-radius:7px;overflow:hidden;"><div style="width:${v.val}%;height:100%;background:${v.color};"></div></div></div>`).join('')}</div>`;

  const money = (grad, glyph, val) => `<span style="display:inline-flex;align-items:center;gap:5px;background:${grad};${chipRim}border-radius:999px;padding:4px 9px;color:#fff;font-size:10px;font-weight:800;${tn}"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4">${glyph}</svg>${val}</span>`;
  const pill = (label, val, col) => `<div style="flex:1;background:${elevated};border-radius:9px;padding:7px 8px;"><div style="color:${muted};font-size:8px;font-weight:700;letter-spacing:.3px;text-transform:uppercase;">${label}</div><div style="color:${col};font-size:13px;font-weight:800;${tn}margin-top:1px;">${val}</div></div>`;

  return `<div style="flex:1;background:${T.bg};display:flex;flex-direction:column;">
    <!-- HUD -->
    <div style="background:#0F172A;${hud}padding:9px 12px 11px;flex:0 0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">
        <div style="display:flex;flex-direction:column;gap:8px;">
          <div style="display:flex;gap:5px;">
            <span style="background:rgba(255,255,255,0.08);color:#E5E7EB;font-size:8px;font-weight:700;padding:2px 7px;border-radius:999px;">Gen 1</span>
            <span style="background:#F59E0B;color:#fff;font-size:8px;font-weight:800;padding:2px 7px;border-radius:999px;">★ P2</span>
          </div>
          ${vitals}
          <div style="display:flex;gap:6px;">
            ${money('#16A34A', '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', '$48.2K')}
            ${money('#2563EB', '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M3 8l9-5 9 5"/>', '$210K')}
            ${money('#7C3AED', '<path d="M6 3h12l4 6-10 12L2 9z"/>', '340')}
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:5px 9px;text-align:center;flex:0 0 auto;">
          <div style="color:#fff;font-size:15px;font-weight:800;line-height:1;">2031</div>
          <div style="color:#fff;font-size:8px;font-weight:700;margin-top:2px;">MAR</div>
          <div style="color:rgba(255,255,255,0.8);font-size:8px;margin-top:1px;">Age 34</div>
        </div>
      </div>
    </div>

    <!-- body -->
    <div style="flex:1;padding:12px;display:flex;flex-direction:column;gap:11px;">
      <!-- Identity hero -->
      <div style="background:${cardBg};border:1px solid ${hair};border-radius:16px;${cardShadow}padding:13px;">
        <div style="display:flex;align-items:center;gap:11px;">
          <img src="${MALE}" style="width:48px;height:48px;border-radius:24px;object-fit:cover;object-position:center top;border:2px solid ${elevated};"/>
          <div style="flex:1;"><div style="color:${T.text};font-size:15px;font-weight:800;">Alex Rivera</div><div style="color:${muted};font-size:10px;margin-top:1px;">Tech Founder · Level 12</div></div>
          <div style="width:40px;height:40px;border-radius:20px;border:3px solid ${elevated};border-top-color:#3B82F6;display:flex;align-items:center;justify-content:center;color:${T.text};font-size:11px;font-weight:800;">L12</div>
        </div>
        <div style="display:flex;gap:7px;margin-top:11px;">
          ${pill('Net worth', '$258K', '#34D399')}${pill('Happiness', '82%', '#FBBF24')}${pill('Reputation', '640', '#A5B4FC')}
        </div>
      </div>

      <!-- Achievements -->
      <div style="background:${cardBg};border:1px solid ${hair};border-radius:16px;${cardShadow}padding:13px;">
        <div style="display:flex;justify-content:space-between;align-items:center;"><span style="color:${T.text};font-size:13px;font-weight:700;">Achievements</span><span style="color:${muted};font-size:10px;${tn}">18 / 40</span></div>
        <div style="height:8px;background:${elevated};border-radius:5px;margin-top:9px;overflow:hidden;"><div style="width:45%;height:100%;background:#A855F7;"></div></div>
        <div style="display:flex;gap:6px;margin-top:10px;">
          <div style="flex:1;background:${elevated};border-radius:9px;padding:7px;text-align:center;color:${muted};font-size:8.5px;font-weight:600;">🏆 First Million</div>
          <div style="flex:1;background:${elevated};border-radius:9px;padding:7px;text-align:center;color:${muted};font-size:8.5px;font-weight:600;">💼 CEO</div>
          <div style="flex:1;background:${elevated};border-radius:9px;padding:7px;text-align:center;color:${muted};font-size:8.5px;font-weight:600;">🔥 10y</div>
        </div>
      </div>

      <!-- Continue link card -->
      <div style="display:flex;align-items:center;gap:11px;background:${revamped ? 'rgba(30,41,59,0.75)' : cardBg};border:1px solid ${hair};border-radius:14px;${cardShadow}padding:12px 13px;">
        <div style="width:34px;height:34px;border-radius:10px;background:rgba(59,130,246,0.16);border:1px solid rgba(59,130,246,0.32);display:flex;align-items:center;justify-content:center;">${ic({ icon: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>', fill: true, color: '#60A5FA' }, 16)}</div>
        <div style="flex:1;"><div style="color:${T.text};font-size:12px;font-weight:700;">Continue your career</div><div style="color:${muted};font-size:9px;margin-top:1px;">Next promotion in 2 weeks</div></div>
        <span style="color:${muted};font-size:16px;">›</span>
      </div>
    </div>
  </div>`;
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'The Home screen, on the apps’ design language',
  subtitle: 'Gray-800 flat cards + a flat bar HUD → slate cards that lift, and a floating HUD with glanceable vitals rings.',
  body: `<div style="display:flex;justify-content:center;gap:44px;margin-top:30px;flex-wrap:wrap;">
      ${phone(screen(false), { caption: 'Before', captionColor: '#9CA3AF', w: 300, h: 640 })}
      ${phone(screen(true), { caption: 'After', captionColor: '#34D399', w: 300, h: 640 })}
    </div>
    <div style="display:flex;justify-content:center;gap:44px;margin-top:40px;flex-wrap:wrap;max-width:1040px;margin-left:auto;margin-right:auto;">
      ${legendItem('#34D399', 'Slate, elevated cards', 'The legacy gray-800 cards became slate and now lift off the canvas with real glass shadows — identity, achievements and the career-link card read as one system with the apps.')}
      ${legendItem('#818CF8', 'A HUD that floats, vitals that glance', 'The persistent bar gained a hairline + app-bar shadow, and health / mood / energy went from stacked bars to Apple-Watch-style activity rings.')}
    </div>`,
});

await renderToPng(chromium, page, resolve(OUT, 'home-before-after.png'), 1140);
console.log('wrote home-before-after.png');
