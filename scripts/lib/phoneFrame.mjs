/**
 * Shared phone-frame + design-token scaffolding for app preview renders.
 *
 * Renders faithful in-game app screens (dark theme tokens, real brand
 * gradients) inside an iPhone-style bezel with a status bar. Used by the
 * app-gallery before/after generators. Not a screenshot of the running app —
 * a high-fidelity mock built from the same tokens.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '..', '..');

// ── Real theme tokens (lib/config/theme.ts, dark) ────────────────────────────
export const T = {
  bg: '#0F172A',        // dark900 background
  surface: '#1E293B',   // dark800 card / surface
  surface2: '#334155',  // dark700 elevated
  border: 'rgba(255,255,255,0.10)',
  text: '#FFFFFF',
  text2: '#CBD5E1',     // light300 secondary
  muted: '#64748B',     // dark500
  primary: '#6366F1',
  primaryLight: '#818CF8',
  success: '#10B981',
  successLight: '#34D399',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
  reputation: '#EC4899',
};

// Brand gradients per app (from mobile.tsx appsList)
export const GRAD = {
  pulse: ['#EC4899', '#6366F1'],
  spark: ['#F43F5E', '#FB923C'],
  contacts: ['#00D2D3', '#54A0FF'],
  stocks: ['#00B894', '#00CEC9'],
  bank: ['#FD79A8', '#FDCB6E'],
  education: ['#00B894', '#00CEC9'],
  hustle: ['#6366F1', '#06B6D4'],
  pet: ['#D97706', '#CA8A04'],
};
export const grad = (pair, angle = 120) => `linear-gradient(${angle}deg, ${pair[0]}, ${pair[1]})`;

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function faceURI(name) {
  const b64 = readFileSync(resolve(ROOT, 'assets/images/Face', name)).toString('base64');
  return `data:image/png;base64,${b64}`;
}

export function avatarFace(uri, size) {
  return `<img src="${uri}" style="width:${size}px;height:${size}px;border-radius:${size / 2}px;object-fit:cover;object-position:center top;"/>`;
}
export function avatarInitial(letter, size, bg) {
  return `<div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:${bg};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${size * 0.42}px;flex:0 0 auto;">${esc(letter)}</div>`;
}

const statusBar = () => `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 22px 2px;color:${T.text};font-size:12px;font-weight:600;flex:0 0 auto;">
  <span>9:41</span>
  <span style="display:flex;gap:5px;align-items:center;">
    <svg width="17" height="11" viewBox="0 0 17 11" fill="#fff"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4" y="5" width="3" height="6" rx="1"/><rect x="8" y="3" width="3" height="8" rx="1"/><rect x="12" y="1" width="3" height="10" rx="1"/></svg>
    <svg width="22" height="11" viewBox="0 0 24 12" fill="none"><rect x="1" y="1" width="20" height="10" rx="3" stroke="#fff" opacity="0.6"/><rect x="2.5" y="2.5" width="15" height="7" rx="1.5" fill="#fff"/><rect x="22" y="4" width="1.5" height="4" rx="0.75" fill="#fff"/></svg>
  </span>
</div>`;

/**
 * Wrap screen HTML in a phone bezel. `screenHtml` fills the area below the
 * status bar. `w`/`h` are the inner screen size (default 320x660).
 */
export function phone(screenHtml, { w = 320, h = 660, caption, captionColor } = {}) {
  const cap = caption
    ? `<div style="font-size:15px;font-weight:800;letter-spacing:1px;color:${captionColor || T.muted};text-transform:uppercase;text-align:center;margin-bottom:14px;">${caption}</div>`
    : '';
  return `<div style="display:flex;flex-direction:column;align-items:center;">
    ${cap}
    <div style="position:relative;width:${w + 22}px;height:${h + 22}px;border-radius:44px;background:#000;padding:11px;box-shadow:0 30px 70px rgba(0,0,0,0.55);">
      <div style="position:relative;width:100%;height:100%;border-radius:34px;overflow:hidden;background:${T.bg};display:flex;flex-direction:column;">
        ${statusBar()}
        ${screenHtml}
      </div>
    </div>
  </div>`;
}

/** Standard page shell + soft backdrop. `title`/`subtitle` optional. */
export function pageShell({ title, subtitle, body, padTop = 56 }) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:-apple-system,'SF Pro Display','Segoe UI',Inter,system-ui,sans-serif;background:radial-gradient(1200px 700px at 50% 0%, #16233b 0%, #0a1120 60%, #070c17 100%);padding:${padTop}px 48px 48px;}
  </style></head><body>
    ${title ? `<div style="text-align:center;margin-bottom:8px;"><div style="color:${T.text};font-size:30px;font-weight:800;letter-spacing:-0.5px;">${title}</div>${subtitle ? `<div style="color:${T.text2};font-size:15px;margin-top:8px;">${subtitle}</div>` : ''}</div>` : ''}
    ${body}
  </body></html>`;
}

/** Legend row: colored dot + title + body. */
export function legendItem(color, title, body) {
  return `<div style="display:flex;align-items:flex-start;max-width:330px;">
    <span style="display:inline-block;width:10px;height:10px;border-radius:5px;background:${color};margin-right:8px;flex:0 0 auto;margin-top:5px;"></span>
    <div><div style="color:${T.text};font-weight:700;font-size:15px;">${title}</div>
    <div style="color:${T.text2};font-size:13px;line-height:19px;margin-top:2px;">${body}</div></div>
  </div>`;
}

/**
 * Render an HTML doc to PNG at a given width, auto-measuring height.
 */
export async function renderToPng(chromium, html, outPath, width = 1160) {
  const { writeFileSync } = await import('node:fs');
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width, height: 1200 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  await p.setContent(html, { waitUntil: 'networkidle' });
  const box = await (await p.$('body')).boundingBox();
  const height = Math.ceil(box.height);
  await p.setViewportSize({ width, height });
  writeFileSync(outPath, await p.screenshot({ clip: { x: 0, y: 0, width, height } }));
  await browser.close();
  return outPath;
}
