/**
 * HUD scaling check — renders the ring HUD at true device widths with the real
 * scale() factor applied (clamp(width/375, 0.7, tablet?1.8:1.3)), to confirm the
 * ring row + money chips + date box fit and stay legible from iPhone SE → iPad.
 *   node scripts/generate-hud-scaling-check.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, pageShell, renderToPng } from './lib/phoneFrame.mjs';

const tnum = 'font-variant-numeric:tabular-nums;';
const HEART = '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>';
const SMILE = '<circle cx="12" cy="12" r="9"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2"/><path d="M9 9.5h.01M15 9.5h.01"/>';
const BOLT = '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>';
const V = [
  { icon: HEART, fill: true, color: '#EF4444', val: 88 },
  { icon: SMILE, fill: false, color: '#F59E0B', val: 82 },
  { icon: BOLT, fill: true, color: '#3B82F6', val: 64 },
];
// Mirror utils/scaling.ts scale(): clamp(width/375, 0.7, tablet?1.8:1.3).
const factorFor = (w, tablet) => Math.min(Math.max(w / 375, 0.7), tablet ? 1.8 : 1.3);

function hud(width, tablet, label, sub) {
  const f = factorFor(width, tablet);
  const s = (n) => Math.round(n * f);
  const ic = (v, size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${v.fill ? v.color : 'none'}" stroke="${v.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${v.icon}</svg>`;
  const ringSize = s(40);
  const ring = (v) => {
    const r = (ringSize - s(5)) / 2, c = 2 * Math.PI * r, dash = (c * v.val / 100).toFixed(1);
    return `<div style="display:flex;flex-direction:column;align-items:center;gap:${s(3)}px;">
      <div style="position:relative;width:${ringSize}px;height:${ringSize}px;">
        <svg width="${ringSize}" height="${ringSize}" viewBox="0 0 ${ringSize} ${ringSize}"><circle cx="${ringSize / 2}" cy="${ringSize / 2}" r="${r}" stroke="rgba(148,163,184,0.18)" stroke-width="${s(5)}" fill="none"/><circle cx="${ringSize / 2}" cy="${ringSize / 2}" r="${r}" stroke="${v.color}" stroke-width="${s(5)}" fill="none" stroke-linecap="round" stroke-dasharray="${dash} ${c.toFixed(1)}" transform="rotate(-90 ${ringSize / 2} ${ringSize / 2})"/></svg>
        <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">${ic(v, s(16))}</div>
      </div>
      <span style="color:#E2E8F0;font-size:${s(11)}px;font-weight:800;${tnum}">${v.val}</span>
    </div>`;
  };
  const chip = (grad, glyph, val) => `<span style="display:inline-flex;align-items:center;gap:${s(5)}px;background:${grad};border:1px solid rgba(255,255,255,0.2);border-radius:999px;padding:${s(4)}px ${s(10)}px;color:#fff;font-size:${s(11)}px;font-weight:800;${tnum}"><svg width="${s(11)}" height="${s(11)}" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2">${glyph}</svg>${val}</span>`;
  return `<div style="margin:0 auto;">
    <div style="font-family:ui-monospace,Menlo,monospace;font-size:12px;color:${T.text};margin-bottom:8px;text-align:center;">${label} <span style="color:${T.muted};">· ${width}pt · ×${f.toFixed(2)}</span></div>
    <div style="width:${width}px;background:#0F172A;border-bottom:1px solid rgba(255,255,255,0.07);box-shadow:0 6px 18px rgba(0,0,0,0.5);border-radius:14px;padding:${s(11)}px ${s(14)}px;display:flex;justify-content:space-between;align-items:flex-start;gap:${s(12)}px;">
      <div style="display:flex;flex-direction:column;gap:${s(9)}px;min-width:0;">
        <div style="display:flex;gap:${s(6)}px;">
          <span style="background:rgba(255,255,255,0.08);color:#E5E7EB;font-size:${s(9)}px;font-weight:700;padding:${s(2)}px ${s(8)}px;border-radius:999px;">Gen 1</span>
          <span style="background:#F59E0B;color:#fff;font-size:${s(9)}px;font-weight:800;padding:${s(2)}px ${s(8)}px;border-radius:999px;">★ P2</span>
        </div>
        <div style="display:flex;gap:${s(16)}px;">${V.map(ring).join('')}</div>
        <div style="display:flex;gap:${s(7)}px;flex-wrap:${width < 360 ? 'wrap' : 'nowrap'};">
          ${chip('#16A34A', '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', '$48.2K')}
          ${chip('#2563EB', '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M3 8l9-5 9 5"/>', '$210K')}
          ${chip('#7C3AED', '<path d="M6 3h12l4 6-10 12L2 9z"/>', '340')}
        </div>
      </div>
      <div style="background:rgba(255,255,255,0.15);border-radius:${s(11)}px;padding:${s(6)}px ${s(11)}px;text-align:center;flex:0 0 auto;">
        <div style="color:#fff;font-size:${s(16)}px;font-weight:800;line-height:1;">2031</div>
        <div style="color:#fff;font-size:${s(9)}px;font-weight:700;margin-top:2px;">MAR</div>
        <div style="color:rgba(255,255,255,0.8);font-size:${s(9)}px;margin-top:2px;">Age 34</div>
      </div>
    </div>
  </div>`;
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'HUD scaling — iPhone SE → iPad',
  subtitle: 'The ring HUD at true device widths with the real scale() factor. Rings, chips, spacing and the date box all fit at every tier.',
  body: `<div style="display:flex;flex-direction:column;align-items:center;gap:26px;margin-top:26px;">
    ${hud(320, false, 'iPhone SE')}
    ${hud(393, false, 'iPhone 15')}
    ${hud(430, false, 'iPhone 15 Pro Max')}
    ${hud(834, true, 'iPad (portrait)')}
  </div>`,
});

await renderToPng(chromium, page, resolve(OUT, 'hud-scaling-check.png'), 1000);
console.log('wrote hud-scaling-check.png');
