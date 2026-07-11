/**
 * Vitals-in-HUD design options — three creative ways to surface health /
 * happiness / energy in the persistent top bar alongside the money chips + date.
 * Faithful HUD mock (slate #0F172A, floating shadow, glass chips).
 *
 *   node scripts/generate-vitals-hud-options.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, pageShell, renderToPng } from './lib/phoneFrame.mjs';

const tnum = 'font-variant-numeric:tabular-nums;';
const HEART = '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>';
const SMILE = '<circle cx="12" cy="12" r="9"/><path d="M8 14.5s1.5 2 4 2 4-2 4-2"/><path d="M9 9.5h.01M15 9.5h.01"/>';
const BOLT = '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>';
const V = [
  { icon: HEART, fillIcon: true, color: '#F43F5E', label: 'Health', val: 88 },
  { icon: SMILE, fillIcon: false, color: '#FACC15', label: 'Mood', val: 82 },
  { icon: BOLT, fillIcon: true, color: '#38E1B0', label: 'Energy', val: 64 },
];
const ic = (v, size = 13, sw = 2) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="${v.fillIcon ? v.color : 'none'}" stroke="${v.color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${v.icon}</svg>`;

// ── the three vitals treatments ───────────────────────────────────────────────
// A — stacked slim bars, grouped in one glass panel
function optA() {
  const row = (v) => `<div style="display:flex;align-items:center;gap:7px;">
    ${ic(v, 12)}
    <div style="flex:1;height:6px;background:rgba(255,255,255,0.08);border-radius:3px;overflow:hidden;"><div style="width:${v.val}%;height:100%;background:${v.color};border-radius:3px;"></div></div>
    <span style="color:#E2E8F0;font-size:10px;font-weight:800;width:20px;text-align:right;${tnum}">${v.val}</span>
  </div>`;
  return `<div style="background:rgba(30,41,59,0.55);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:8px 10px;display:flex;flex-direction:column;gap:6px;min-width:172px;">${V.map(row).join('')}</div>`;
}
// B — inline stat chips (matches the money-chip language), thin underline bar
function optB() {
  const chip = (v) => `<div style="display:flex;flex-direction:column;gap:4px;background:rgba(30,41,59,0.6);border:1px solid rgba(255,255,255,0.1);border-radius:11px;padding:6px 10px 7px;min-width:52px;">
    <div style="display:flex;align-items:center;gap:5px;">${ic(v, 12)}<span style="color:#F1F5F9;font-size:12px;font-weight:800;${tnum}">${v.val}</span></div>
    <div style="height:3px;background:rgba(255,255,255,0.09);border-radius:2px;overflow:hidden;"><div style="width:${v.val}%;height:100%;background:${v.color};"></div></div>
  </div>`;
  return `<div style="display:flex;gap:7px;">${V.map(chip).join('')}</div>`;
}
// C — activity rings (Apple-Watch style), icon in center
function ring(v, size = 42) {
  const r = (size - 6) / 2, c = 2 * Math.PI * r, dash = (c * v.val / 100).toFixed(1);
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
    <div style="position:relative;width:${size}px;height:${size}px;">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="rgba(255,255,255,0.09)" stroke-width="4" fill="none"/><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${v.color}" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="${dash} ${c.toFixed(1)}" transform="rotate(-90 ${size / 2} ${size / 2})"/></svg>
      <div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;">${ic(v, 14)}</div>
    </div>
    <span style="color:#CBD5E1;font-size:9px;font-weight:800;${tnum}">${v.val}</span>
  </div>`;
}
function optC() {
  return `<div style="display:flex;gap:11px;align-items:center;">${V.map(v => ring(v)).join('')}</div>`;
}

// ── shared HUD chrome (badges · vitals · money chips · date) ───────────────────
const moneyChip = (grad, glyph, val) => `<span style="display:inline-flex;align-items:center;gap:5px;background:${grad};border:1px solid rgba(255,255,255,0.2);border-radius:999px;padding:4px 10px;color:#fff;font-size:11px;font-weight:800;${tnum}"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.2">${glyph}</svg>${val}</span>`;
function hud(vitals) {
  return `<div style="background:#0F172A;border-bottom:1px solid rgba(255,255,255,0.07);box-shadow:0 6px 18px rgba(0,0,0,0.5);border-radius:16px;padding:12px 15px;display:flex;justify-content:space-between;align-items:flex-start;gap:14px;">
    <div style="display:flex;flex-direction:column;gap:9px;">
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

const block = (tag, name, desc, hudHtml) => `<div style="max-width:560px;margin:0 auto;">
  <div style="display:flex;align-items:baseline;gap:10px;margin-bottom:9px;">
    <span style="font-family:ui-monospace,Menlo,monospace;font-size:12px;font-weight:700;color:${T.text};background:rgba(129,140,248,0.16);border:1px solid rgba(129,140,248,0.34);border-radius:6px;padding:2px 8px;">${tag}</span>
    <span style="color:${T.text};font-size:15px;font-weight:700;">${name}</span>
  </div>
  ${hudHtml}
  <div style="color:${T.muted};font-size:12.5px;line-height:1.5;margin-top:10px;">${desc}</div>
</div>`;

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Three ways to show your vitals in the HUD',
  subtitle: 'Health · Mood · Energy, surfaced in the top bar next to money & date — pick a direction.',
  body: `<div style="display:flex;flex-direction:column;gap:34px;margin-top:26px;">
    ${block('A', 'Grouped bars', 'One glass panel, three slim labelled bars. The clearest read of exact levels and the smallest change from today — the current three rows, just tightened into a cohesive module.', hud(optA()))}
    ${block('B', 'Vitals chips', 'Three compact chips in the money-chip language, each an icon + number over a thin fill bar. Most space-efficient and visually consistent with the cash chips right below.', hud(optB()))}
    ${block('C', 'Activity rings', 'Apple-Watch-style rings — glanceable and premium. Trades exact-level precision for personality; taps still open each breakdown. Boldest departure.', hud(optC()))}
  </div>`,
});

await renderToPng(chromium, page, resolve(OUT, 'vitals-hud-options.png'), 900);
console.log('wrote vitals-hud-options.png');
