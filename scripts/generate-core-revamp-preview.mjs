/**
 * Core-screen revamp — before/after of the Home top (persistent HUD + hero card
 * + a progress card), showing the gray-800 → slate re-skin and the flat → floating
 * glass-HUD depth. Faithful mock from the real token shifts (flat-fill fallback rules).
 *
 *   node scripts/generate-core-revamp-preview.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, phone, pageShell, legendItem, renderToPng, faceURI } from './lib/phoneFrame.mjs';

const MALE = faceURI('Male.png');
const tnum = 'font-variant-numeric:tabular-nums;';
const icon = (stroke, path, size = 15, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="${sw}">${path}</svg>`;

function homeTop(revamped) {
  // Legacy gray-800 palette vs slate tokens.
  const cardBg = revamped ? '#1E293B' : '#1F2937';
  const elevated = revamped ? '#334155' : '#374151';
  const muted = revamped ? '#94A3B8' : '#9CA3AF';
  const hair = revamped ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.04)';
  // Depth: flat before, floating glass after.
  const hudDepth = revamped
    ? 'box-shadow:0 6px 18px rgba(0,0,0,0.5);border-bottom:1px solid rgba(255,255,255,0.07);'
    : 'border-bottom:1px solid rgba(255,255,255,0.02);';
  const chipRim = revamped ? 'border:1px solid rgba(255,255,255,0.20);' : 'border:1px solid transparent;';
  const cardShadow = revamped ? 'box-shadow:0 12px 28px -12px rgba(0,0,0,0.65);' : '';

  const chip = (grad, glyph, val) => `<span style="display:inline-flex;align-items:center;gap:5px;background:${grad};${chipRim}border-radius:999px;padding:5px 11px;color:#fff;font-size:12px;font-weight:800;${tnum}">${icon('#fff', glyph, 12, 2.2)}${val}</span>`;

  const statPill = (label, val, col) => `<div style="flex:1;background:${elevated};border-radius:10px;padding:8px 9px;">
    <div style="color:${muted};font-size:8.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;">${label}</div>
    <div style="color:${col};font-size:14px;font-weight:800;${tnum}margin-top:2px;">${val}</div></div>`;

  return `<div style="flex:1;background:${T.bg};display:flex;flex-direction:column;">
    <!-- HUD -->
    <div style="background:#0F172A;${hudDepth}padding:9px 13px 11px;flex:0 0 auto;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div style="display:flex;flex-direction:column;gap:7px;">
          <div style="display:flex;gap:6px;">
            <span style="background:rgba(255,255,255,0.08);color:#E5E7EB;font-size:9px;font-weight:700;padding:2px 8px;border-radius:999px;">Gen 1</span>
            <span style="display:inline-flex;align-items:center;gap:3px;background:#F59E0B;color:#fff;font-size:9px;font-weight:800;padding:2px 8px;border-radius:999px;">★ P2</span>
          </div>
          <div style="display:flex;gap:7px;flex-wrap:wrap;">
            ${chip('#16A34A', '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', '$48.2K')}
            ${chip('#2563EB', '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M3 8l9-5 9 5"/>', '$210K')}
            ${chip('#7C3AED', '<path d="M6 3h12l4 6-10 12L2 9z"/>', '340')}
          </div>
        </div>
        <div style="background:rgba(255,255,255,0.15);border-radius:11px;padding:6px 10px;text-align:center;flex:0 0 auto;">
          <div style="color:#fff;font-size:16px;font-weight:800;line-height:1;">2031</div>
          <div style="color:#fff;font-size:9px;font-weight:700;margin-top:2px;">MAR</div>
          <div style="color:rgba(255,255,255,0.8);font-size:9px;margin-top:2px;">Age 34</div>
        </div>
      </div>
    </div>

    <!-- body -->
    <div style="flex:1;padding:13px;display:flex;flex-direction:column;gap:12px;">
      <!-- Identity hero card -->
      <div style="background:${cardBg};border:1px solid ${hair};border-radius:16px;${cardShadow}padding:14px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <img src="${MALE}" style="width:52px;height:52px;border-radius:26px;object-fit:cover;object-position:center top;border:2px solid ${elevated};"/>
          <div style="flex:1;">
            <div style="color:${T.text};font-size:16px;font-weight:800;">Alex Rivera</div>
            <div style="color:${muted};font-size:11px;margin-top:1px;">Tech Founder · Level 12</div>
          </div>
          <div style="width:44px;height:44px;border-radius:22px;border:3px solid ${elevated};border-top-color:#3B82F6;display:flex;align-items:center;justify-content:center;color:${T.text};font-size:12px;font-weight:800;">L12</div>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;">
          ${statPill('Net worth', '$258K', '#34D399')}
          ${statPill('Happiness', '82%', '#FBBF24')}
          ${statPill('Reputation', '640', '#A5B4FC')}
        </div>
      </div>

      <!-- Achievements card -->
      <div style="background:${cardBg};border:1px solid ${hair};border-radius:16px;${cardShadow}padding:14px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <span style="color:${T.text};font-size:13px;font-weight:700;">Achievements</span>
          <span style="color:${muted};font-size:11px;${tnum}">18 / 40</span>
        </div>
        <div style="height:8px;background:${elevated};border-radius:5px;margin-top:10px;overflow:hidden;"><div style="width:45%;height:100%;background:#A855F7;"></div></div>
        <div style="display:flex;gap:7px;margin-top:11px;">
          <div style="flex:1;background:${elevated};border-radius:9px;padding:8px;text-align:center;color:${muted};font-size:9px;font-weight:600;">🏆 First Million</div>
          <div style="flex:1;background:${elevated};border-radius:9px;padding:8px;text-align:center;color:${muted};font-size:9px;font-weight:600;">💼 CEO</div>
          <div style="flex:1;background:${elevated};border-radius:9px;padding:8px;text-align:center;color:${muted};font-size:9px;font-weight:600;">🔥 10y Streak</div>
        </div>
      </div>
    </div>
  </div>`;
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Core screens — flat gray → floating slate glass',
  subtitle: 'The persistent HUD and the Home cards, brought onto the same design language as the apps.',
  body: `<div style="display:flex;justify-content:center;gap:46px;margin-top:30px;flex-wrap:wrap;">
      ${phone(homeTop(false), { caption: 'Before', captionColor: '#9CA3AF', w: 300, h: 600 })}
      ${phone(homeTop(true), { caption: 'After', captionColor: '#34D399', w: 300, h: 600 })}
    </div>
    <div style="display:flex;justify-content:center;gap:44px;margin-top:40px;flex-wrap:wrap;max-width:1000px;margin-left:auto;margin-right:auto;">
      ${legendItem('#34D399', 'Gray-800 → slate', 'The four legacy cards (identity, achievements, progress, prestige) used the Tailwind gray-800 palette (#1F2937/#374151) that clashed with the slate apps. Shifted 1:1 to slate tokens so Home and Progression read as one system.')}
      ${legendItem('#818CF8', 'A HUD that floats', 'The persistent top bar was flat — no border, no shadow. It now has a hairline + soft app-bar shadow so it lifts above the scrolling content, and the money chips wear the same glass rim as the apps.')}
    </div>`,
});

await renderToPng(chromium, page, resolve(OUT, 'core-revamp-before-after.png'), 1120);
console.log('wrote core-revamp-before-after.png');
