/**
 * Vitals HUD — shipped result: old stacked bars → new activity rings.
 *   node scripts/generate-vitals-shipped.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, pageShell, renderToPng } from './lib/phoneFrame.mjs';

const tnum = 'font-variant-numeric:tabular-nums;';
const HEART = '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>';
const SMILE = '<circle cx="12" cy="12" r="9"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2"/><path d="M9 9.5h.01M15 9.5h.01"/>';
const BOLT = '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>';
// Real app stat colors (gradient[0]): health red, happiness amber, energy blue.
const V = [
  { icon: HEART, fill: true, color: '#EF4444', val: 88 },
  { icon: SMILE, fill: false, color: '#F59E0B', val: 82 },
  { icon: BOLT, fill: true, color: '#3B82F6', val: 64 },
];
const ic = (v, size = 14, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${v.fill ? v.color : 'none'}" stroke="${v.color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${v.icon}</svg>`;

// BEFORE — stacked horizontal bars (icon + bar + value)
function bars() {
  const row = (v) => `<div style="display:flex;align-items:center;gap:7px;">
    ${ic(v, 15)}
    <div style="width:120px;height:14px;background:#334155;border-radius:7px;overflow:hidden;"><div style="width:${v.val}%;height:100%;background:${v.color};border-radius:7px;"></div></div>
  </div>`;
  return `<div style="display:flex;flex-direction:column;gap:6px;">${V.map(row).join('')}</div>`;
}
// AFTER — activity rings (icon center, value below) — the shipped ProgressRing
function ring(v, size = 40) {
  const r = (size - 5) / 2, c = 2 * Math.PI * r, dash = (c * v.val / 100).toFixed(1);
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
    <div style="position:relative;width:${size}px;height:${size}px;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="rgba(148,163,184,0.18)" stroke-width="5" fill="none"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${v.color}" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="${dash} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">${ic(v, 16)}</div>
    </div>
    <span style="color:#E2E8F0;font-size:11px;font-weight:800;${tnum}">${v.val}</span>
  </div>`;
}
function rings() { return `<div style="display:flex;gap:16px;align-items:flex-start;">${V.map(v => ring(v)).join('')}</div>`; }

const moneyChip = (grad, glyph, val) => `<span style="display:inline-flex;align-items:center;gap:5px;background:${grad};border:1px solid rgba(255,255,255,0.2);border-radius:999px;padding:4px 10px;color:#fff;font-size:11px;font-weight:800;${tnum}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2">${glyph}</svg>${val}</span>`;
function hud(vitals) {
  return `<div style="background:#0F172A;border-bottom:1px solid rgba(255,255,255,0.07);box-shadow:0 6px 18px rgba(0,0,0,0.5);border-radius:16px;padding:12px 15px;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;min-height:150px;">
    <div style="display:flex;flex-direction:column;gap:10px;">
      <div style="display:flex;gap:6px;">
        <span style="background:rgba(255,255,255,0.08);color:#E5E7EB;font-size:9px;font-weight:700;padding:2px 8px;border-radius:999px;">Gen 1</span>
        <span style="background:#F59E0B;color:#fff;font-size:9px;font-weight:800;padding:2px 8px;border-radius:999px;">★ P2</span>
      </div>
      ${vitals}
      <div style="display:flex;gap:7px;">
        ${moneyChip('#16A34A', '<path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', '$48.2K')}
        ${moneyChip('#2563EB', '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M3 8l9-5 9 5"/>', '$210K')}
        ${moneyChip('#7C3AED', '<path d="M6 3h12l4 6-10 12L2 9z"/>', '340')}
      </div>
    </div>
    <div style="background:rgba(255,255,255,0.15);border-radius:11px;padding:6px 11px;text-align:center;flex:0 0 auto;">
      <div style="color:#fff;font-size:16px;font-weight:800;line-height:1;">2031</div>
      <div style="color:#fff;font-size:9px;font-weight:700;margin-top:2px;">MAR</div>
      <div style="color:rgba(255,255,255,0.8);font-size:9px;margin-top:2px;">Age 34</div>
    </div>
  </div>`;
}
const col = (label, color, hudHtml) => `<div style="flex:1;min-width:360px;max-width:440px;">
  <div style="font-family:ui-monospace,Menlo,monospace;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${color};margin-bottom:11px;text-align:center;">${label}</div>
  ${hudHtml}</div>`;

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Vitals, now as activity rings',
  subtitle: 'Health · Mood · Energy in the HUD — stacked bars replaced with glanceable rings. Tap any ring for its breakdown; the number stays for the exact level.',
  body: `<div style="display:flex;justify-content:center;gap:36px;margin-top:28px;flex-wrap:wrap;">
    ${col('Before · bars', '#94A3B8', hud(bars()))}
    ${col('After · rings', '#34D399', hud(rings()))}
  </div>`,
});

await renderToPng(chromium, page, resolve(OUT, 'vitals-rings-shipped.png'), 960);
console.log('wrote vitals-rings-shipped.png');
