/**
 * Week-dots preview — the date box's 4 month-progress dots at each week.
 * Faithful to the real dateInner + the new weekDot states.
 *   node scripts/generate-weekdots-preview.mjs
 */
import { chromium } from '@playwright/test';
import { resolve } from 'node:path';
import { ROOT, T, pageShell, renderToPng } from './lib/phoneFrame.mjs';

function dot(state) {
  // past = filled 0.55; current = bright white 8px + glow; future = hollow ring.
  if (state === 'current') return `<div style="width:8px;height:8px;border-radius:4px;background:#fff;box-shadow:0 0 5px rgba(255,255,255,0.9);"></div>`;
  if (state === 'past') return `<div style="width:7px;height:7px;border-radius:3.5px;background:rgba(255,255,255,0.55);"></div>`;
  return `<div style="width:7px;height:7px;border-radius:3.5px;background:transparent;border:1px solid rgba(255,255,255,0.35);box-sizing:border-box;"></div>`;
}
function dateBox(week) {
  const dots = [1, 2, 3, 4].map(w => dot(w < week ? 'past' : w === week ? 'current' : 'future')).join('');
  return `<div style="display:flex;flex-direction:column;align-items:center;gap:9px;">
    <div style="background:rgba(255,255,255,0.15);border-radius:12px;padding:8px 14px 9px;display:flex;flex-direction:column;align-items:center;min-width:78px;">
      <div style="color:#fff;font-size:19px;font-weight:800;line-height:1;">2031</div>
      <div style="color:#fff;font-size:10px;font-weight:700;margin-top:3px;letter-spacing:.5px;">MAR</div>
      <div style="color:rgba(255,255,255,0.8);font-size:10px;margin-top:2px;">Age 34</div>
      <div style="display:flex;align-items:center;gap:5px;margin-top:8px;height:9px;">${dots}</div>
    </div>
    <div style="font-family:ui-monospace,Menlo,monospace;font-size:11px;color:${T.muted};">Week ${week} of 4</div>
  </div>`;
}

const OUT = resolve(ROOT, 'screenshots');
const page = pageShell({
  title: 'Week dots — month progress in the date box',
  subtitle: 'Four dots, one per week: elapsed weeks filled, the current week bright and glowing, upcoming weeks hollow.',
  body: `<div style="display:flex;justify-content:center;gap:34px;margin-top:36px;flex-wrap:wrap;background:#0F172A;border-radius:20px;padding:34px 24px;max-width:620px;margin-left:auto;margin-right:auto;box-shadow:0 8px 30px rgba(0,0,0,0.5);">
    ${dateBox(1)}${dateBox(2)}${dateBox(3)}${dateBox(4)}
  </div>`,
});

await renderToPng(chromium, page, resolve(OUT, 'weekdots-preview.png'), 820);
console.log('wrote weekdots-preview.png');
