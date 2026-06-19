/**
 * DeepLife Simulator — App Store Screenshot Generator
 * ----------------------------------------------------
 * Builds immersive, "alive" marketing screenshots at App Store resolution
 * (1290 × 2796, iPhone 6.7"/6.9") by rendering rich SVG scenes to PNG via sharp.
 *
 * Design goals (life-sim genre):
 *   • Real game art (character portraits, supercars, mansions, scenario icons)
 *     embedded into faithful, polished recreations of the app's own screens.
 *   • Cohesive dark/premium look using the app's real theme tokens.
 *   • Each shot = themed background (gradient + glow orbs + particles) + bold
 *     gradient headline + a floating device + floating "alive" accents.
 *
 * Run:  node scripts/generate-app-store-screenshots.mjs
 * Out:  screenshots/01-*.png … 06-*.png  (+ a contact-sheet preview)
 *
 * Requires `sharp` and the Inter font available to fontconfig.
 */

import { createRequire } from 'module';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); }
catch { sharp = require('/tmp/shottest/node_modules/sharp'); }

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ART = join(ROOT, 'assets', 'images');
const OUT = join(ROOT, 'screenshots');

// ───────────────────────────────────────────────────────── canvas + layout
const W = 1290, H = 2796;
const CX = W / 2;

// Device
const PW = 860, PH = 1812, PX = (W - PW) / 2, PY = 818;
const PR = 118, BB = 22;                       // phone radius, bezel thickness
const SX = PX + BB, SY = PY + BB;              // screen origin
const SW = PW - 2 * BB, SH = PH - 2 * BB;      // screen size
const SR = 96;                                 // screen radius
const SCX = SX + SW / 2;                        // screen center x
const SBOT = SY + SH;                            // screen bottom
const CP = 38;                                  // content padding
const cX = SX + CP, cW = SW - 2 * CP;          // content x / width
const STATUS_H = 84;
const TAB_H = 138;
const appTop = SY + STATUS_H;
const appBottom = SBOT - TAB_H;                  // content bottom when a tab bar is shown
const fullBottom = SBOT - 40;                    // content bottom with no tab bar

// ───────────────────────────────────────────────────────── palette
const C = {
  bgDeep: '#0B1022', surface: '#161E36', surface2: '#1C2742', elevated: '#27314F',
  line: 'rgba(255,255,255,0.10)', line2: 'rgba(255,255,255,0.18)',
  text: '#F8FAFC', sub: '#AFBAD0', muted: '#73809B',
  indigo: '#6366F1', purple: '#8B5CF6', pink: '#EC4899', rose: '#FB7185',
  green: '#10B981', emerald: '#34D399', amber: '#F59E0B', gold: '#FACC15', orange: '#F97316',
  blue: '#3B82F6', sky: '#60A5FA', cyan: '#22D3EE', red: '#EF4444', violet: '#A855F7',
  active: '#60A5FA',
};

// ───────────────────────────────────────────────────────── themes per screen
const THEMES = {
  1: { name: 'live-your-life', bg: ['#1C0F40', '#120B2A', '#070713'], orbs: [['#7C3AED', .55, .22, .20], ['#4338CA', .45, .82, .30], ['#9333EA', .35, .55, .62]], head: ['#C9B7FF', '#F0ABFC'], accent: C.purple, kicker: 'LIVE YOUR LIFE' },
  2: { name: 'choose-your-origin', bg: ['#2C1B06', '#1A1126', '#090710'], orbs: [['#F59E0B', .5, .22, .20], ['#B45309', .4, .8, .26], ['#7C3AED', .3, .6, .6]], head: ['#FDE68A', '#FBBF24'], accent: C.amber, kicker: 'CHOOSE YOUR PATH' },
  3: { name: 'build-an-empire', bg: ['#06291F', '#0A1730', '#070712'], orbs: [['#10B981', .5, .22, .2], ['#CA8A04', .4, .82, .28], ['#0E7490', .3, .55, .62]], head: ['#86EFAC', '#FDE68A'], accent: C.emerald, kicker: 'BUILD WEALTH' },
  4: { name: 'find-love', bg: ['#340A26', '#1F0A30', '#0A0714'], orbs: [['#EC4899', .55, .24, .2], ['#A855F7', .42, .8, .3], ['#F43F5E', .32, .55, .64]], head: ['#FDA4AF', '#F5B8FF'], accent: C.pink, kicker: 'FIND LOVE' },
  5: { name: 'leave-a-dynasty', bg: ['#0A1742', '#140E36', '#080814'], orbs: [['#3B82F6', .5, .22, .2], ['#CA8A04', .32, .8, .28], ['#6366F1', .45, .55, .62]], head: ['#9EC6FF', '#FCD34D'], accent: C.sky, kicker: 'YOUR LEGACY' },
  6: { name: 'go-viral', bg: ['#042A40', '#0A1736', '#070812'], orbs: [['#22D3EE', .5, .22, .2], ['#3B82F6', .42, .82, .3], ['#8B5CF6', .32, .55, .62]], head: ['#7DEBFB', '#A8B6FF'], accent: C.cyan, kicker: 'GET FAMOUS' },
};

const COPY = {
  1: { lines: ['Live a Life.', 'Any Life.'], sub: 'Be born, grow up, chase dreams — and rewrite your fate.' },
  2: { lines: ['Your Story', 'Starts Here.'], sub: '13 origins, from street hustler to trust-fund heir.' },
  3: { lines: ['Build an', 'Empire.'], sub: 'Hustle, invest, mine crypto, and stack your millions.' },
  4: { lines: ['Find Love.', 'Or Lose It.'], sub: 'Swipe, date, marry — every romance is yours to write.' },
  5: { lines: ['Leave a', 'Dynasty.'], sub: 'Your heirs inherit your fortune, your perks, your name.' },
  6: { lines: ['Go Viral.', 'Get Famous.'], sub: 'Post, blow up, and turn your clout into a fortune.' },
};

// ───────────────────────────────────────────────────────── tiny utils
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const WEIGHT = { 400: ['Inter', 'normal'], 500: ['Inter Medium', 'normal'], 600: ['Inter SemiBold', 'normal'], 700: ['Inter', 'bold'], 800: ['Inter ExtraBold', 'normal'], 900: ['Inter Black', 'normal'] };

function txt(x, y, s, o = {}) {
  const w = o.w || 600; const [fam, fw] = WEIGHT[w] || WEIGHT[400];
  const a = o.anchor || 'start';
  const ls = o.ls != null ? ` letter-spacing="${o.ls}"` : '';
  const op = o.opacity != null ? ` opacity="${o.opacity}"` : '';
  const fil = o.filter ? ` filter="${o.filter}"` : '';
  return `<text x="${x}" y="${y}" font-family="${fam}" font-weight="${fw}" font-size="${o.size || 24}" fill="${o.fill || C.text}" text-anchor="${a}"${ls}${op}${fil}>${esc(s)}</text>`;
}

// ───────────────────────────────────────────────────────── icon library (24×24)
const ICONS = {
  home: { s: ['M3 10.2 12 3l9 7.2', 'M5.4 9.1V20a1 1 0 0 0 1 1h11.2a1 1 0 0 0 1-1V9.1', 'M9.4 21v-6.5h5.2V21'] },
  briefcase: { s: ['M3 8h18v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z', 'M16 21V6a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v15', 'M3 13h18'] },
  heart: { f: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z' },
  heartline: { s: ['M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'] },
  phone: { s: ['M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z', 'M11 18h2'] },
  monitor: { s: ['M3 4h18v12H3Z', 'M8 21h8', 'M12 16v5'] },
  cart: { s: ['M2.5 3h2l2.2 11.2a1.6 1.6 0 0 0 1.6 1.3h8.4a1.6 1.6 0 0 0 1.55-1.2L20.5 7H6'], c: [[9, 20, 1.4], [18, 20, 1.4]] },
  bolt: { f: 'M13 2 4.6 13.4H11l-1 8.6L19.4 10H13Z' },
  gem: { f: 'M6 3h12l4 6-10 12L2 9Z' },
  star: { f: 'M12 2l2.95 6.1L21.5 9l-4.9 4.6 1.2 6.7L12 17.1 6.2 20.3l1.2-6.7L2.5 9l6.55-.9Z' },
  check: { s: ['M20 6 9 17l-5-5'] },
  chevR: { s: ['M9 6l6 6-6 6'] },
  plus: { s: ['M12 5v14', 'M5 12h14'] },
  x: { s: ['M18 6 6 18', 'M6 6l12 12'] },
  trend: { s: ['M22 7 13.5 15.5 8.5 10.5 2 17', 'M16 7h6v6'] },
  arrUR: { s: ['M7 17 17 7', 'M8 7h9v9'] },
  flame: { f: 'M12 2c.7 3.2-1.2 4.6-2.6 6.2C8 9.8 7 11.3 7 13.5A5 5 0 0 0 17 13.5c0-1.8-.8-3.4-2-4.8-.5 1-1.3 1.6-2.2 1.8C13.6 8 14 5 12 2Z' },
  msg: { s: ['M21 11.5a8.5 8.5 0 0 1-12.2 7.7L3 21l1.8-5.8A8.5 8.5 0 1 1 21 11.5Z'] },
  repeat: { s: ['M17 2l4 4-4 4', 'M3 11V9a4 4 0 0 1 4-4h14', 'M7 22l-4-4 4-4', 'M21 13v2a4 4 0 0 1-4 4H3'] },
  crown: { f: 'M2.5 6 7 10l5-6 5 6 4.5-4-1.8 12.5H4.3L2.5 6Z' },
  mapPin: { s: ['M20 10c0 5.5-8 12-8 12s-8-6.5-8-12a8 8 0 0 1 16 0Z'], c: [[12, 10, 2.6]] },
  users: { s: ['M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2', 'M22 20v-2a4 4 0 0 0-3-3.85', 'M16 4.1a4 4 0 0 1 0 7.75'], c: [[9, 8, 4]] },
  eye: { s: ['M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z'], c: [[12, 12, 3]] },
  play: { f: 'M7 4v16l13-8Z' },
  spark: { f: 'M12 2l1.8 6.7L20.5 12l-6.7 1.8L12 22l-1.8-8.2L3.5 12l6.7-1.8Z' },
  dollar: { s: ['M12 2v20', 'M17 6.5C17 4.6 14.8 3.5 12 3.5S7 4.8 7 7s2.2 3 5 3.5 5 1.5 5 3.7-2.2 3.3-5 3.3-5-1.1-5-3'] },
  banknote: { s: ['M3 6h18v12H3Z', 'M3 10h2M19 14h2'], c: [[12, 12, 2.4]] },
  building: { s: ['M5 21V4a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v17', 'M15 9h3a1 1 0 0 1 1 1v11', 'M3 21h18', 'M8 7h2M8 11h2M8 15h2'] },
  target: { s: [], c: [[12, 12, 9], [12, 12, 5], [12, 12, 1.4]] },
  ring: { s: [], c: [[12, 12, 9]] },
};

function icon(name, x, y, size, color, o = {}) {
  const def = ICONS[name]; if (!def) return '';
  const s = size / 24;
  const sw = (o.sw || 2) / s;
  const t = `translate(${x - size / 2},${y - size / 2}) scale(${s})`;
  let inner = '';
  if (def.f) inner += `<path d="${def.f}" fill="${o.fill || color}"/>`;
  if (def.s) for (const d of def.s) inner += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
  if (def.c) for (const [cx, cy, r] of def.c) inner += (def.f || o.fillCircle) ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}"/>` : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"/>`;
  return `<g transform="${t}">${inner}</g>`;
}
function smiley(x, y, size, color, o = {}) {
  const s = size / 24, sw = (o.sw || 2) / s, t = `translate(${x - size / 2},${y - size / 2}) scale(${s})`;
  return `<g transform="${t}"><circle cx="12" cy="12" r="9.2" fill="none" stroke="${color}" stroke-width="${sw}"/><circle cx="9" cy="10" r="1.05" fill="${color}"/><circle cx="15" cy="10" r="1.05" fill="${color}"/><path d="M8 14.2a4.3 3.4 0 0 0 8 0" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round"/></g>`;
}
function dumbbell(x, y, size, color) {
  const s = size / 24, t = `translate(${x - size / 2},${y - size / 2}) scale(${s})`;
  return `<g transform="${t}" fill="${color}"><rect x="2" y="7" width="3.4" height="10" rx="1.5"/><rect x="5.6" y="9" width="2.4" height="6" rx="1"/><rect x="8" y="10.6" width="8" height="2.8" rx="1.2"/><rect x="16" y="9" width="2.4" height="6" rx="1"/><rect x="18.6" y="7" width="3.4" height="10" rx="1.5"/></g>`;
}

// ───────────────────────────────────────────────────────── screen builder
function screenBuilder() {
  let defs = '', body = '', uid = 0;
  const id = (p) => `${p}${uid++}`;
  const api = {
    get defs() { return defs; }, get body() { return body; },
    add(s) { body += s; return api; },
    def(s) { defs += s; return api; },
    linGrad(stops, x1 = 0, y1 = 0, x2 = 0, y2 = 1) {
      const i = id('lg');
      defs += `<linearGradient id="${i}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`;
      return `url(#${i})`;
    },
    radGrad(stops, cx = .5, cy = .5, r = .5) {
      const i = id('rg');
      defs += `<radialGradient id="${i}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`;
      return `url(#${i})`;
    },
    clipRound(x, y, w, h, r) { const i = id('cr'); defs += `<clipPath id="${i}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}"/></clipPath>`; return i; },
    clipCircle(cx, cy, r) { const i = id('cc'); defs += `<clipPath id="${i}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>`; return i; },
    rrect(x, y, w, h, r, fill, o = {}) {
      const st = o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : '';
      const op = o.opacity != null ? ` opacity="${o.opacity}"` : '';
      const fl = o.filter ? ` filter="${o.filter}"` : '';
      body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}"${st}${op}${fl}/>`;
      return api;
    },
    img(href, x, y, w, h, o = {}) {
      const par = o.par || 'xMidYMid meet';
      const clip = o.clip ? ` clip-path="url(#${o.clip})"` : '';
      const op = o.opacity != null ? ` opacity="${o.opacity}"` : '';
      body += `<image href="${href}" x="${x}" y="${y}" width="${w}" height="${h}" preserveAspectRatio="${par}"${clip}${op}/>`;
      return api;
    },
    txt(x, y, s, o) { body += txt(x, y, s, o); return api; },
    icon(n, x, y, s, c, o) { body += icon(n, x, y, s, c, o); return api; },
    raw(s) { body += s; return api; },
    bar(x, y, w, pct, color, o = {}) {
      const h = o.h || 10, r = h / 2;
      body += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="rgba(255,255,255,0.10)"/>`;
      const fw = Math.max(h, w * Math.min(1, pct / 100));
      const g = api.linGrad([[0, color], [1, o.color2 || color]], 0, 0, 1, 0);
      body += `<rect x="${x}" y="${y}" width="${fw}" height="${h}" rx="${r}" fill="${g}"/>`;
      return api;
    },
  };
  return api;
}

// ───────────────────────────────────────────────────────── art preloader
const artCache = {};
async function art(rel, w, h, fit = 'inside') {
  const key = `${rel}@${w}x${h}@${fit}`;
  if (artCache[key]) return artCache[key];
  const buf = await sharp(join(ART, rel))
    .resize(w, h, { fit, background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer();
  const uri = `data:image/png;base64,${buf.toString('base64')}`;
  artCache[key] = uri; return uri;
}

// ───────────────────────────────────────────────────────── device chrome
function deviceFrame(b, theme, screenSVG) {
  const glow = b.radGrad([[0, theme.accent, .55], [1, theme.accent, 0]]);
  b.add(`<ellipse cx="${CX}" cy="${PY + PH * 0.42}" rx="${PW * 0.72}" ry="${PH * 0.46}" fill="${glow}" filter="url(#softblur)" opacity="0.6"/>`);
  b.rrect(PX, PY, PW, PH, PR, '#05060c', { filter: 'url(#phoneshadow)' });
  const bezel = b.linGrad([[0, '#33384a'], [.5, '#0e1018'], [1, '#2a2f40']], 0, 0, 1, 1);
  b.rrect(PX - 1, PY - 1, PW + 2, PH + 2, PR + 1, 'none', { stroke: bezel, sw: 3 });
  const clip = b.clipRound(SX, SY, SW, SH, SR);
  b.add(`<g clip-path="url(#${clip})">${screenSVG}</g>`);
  b.add(`<rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="${SR}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`);
  b.rrect(SCX - 64, SY + 20, 128, 36, 18, '#000');
  b.add(`<circle cx="${SCX + 40}" cy="${SY + 38}" r="6" fill="#0b0b14"/><circle cx="${SCX + 40}" cy="${SY + 38}" r="3" fill="#1c2740"/>`);
  b.rrect(SCX - 64, SBOT - 26, 128, 6, 3, 'rgba(255,255,255,0.5)');
}

function statusBar(b) {
  const col = '#F8FAFC';
  b.txt(SX + 40, SY + 50, '9:41', { size: 26, w: 700, fill: col });
  const rx = SX + SW - 40;
  b.rrect(rx - 46, SY + 30, 40, 20, 5, 'none', { stroke: col, sw: 2, opacity: .9 });
  b.add(`<rect x="${rx - 7}" y="${SY + 35}" width="3" height="10" rx="1.5" fill="${col}" opacity="0.9"/>`);
  b.rrect(rx - 43, SY + 33, 30, 14, 3, col);
  const wx = rx - 64;
  b.add(`<g transform="translate(${wx - 13},${SY + 28})" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round"><path d="M2 8a13 13 0 0 1 18 0"/><path d="M5 12a8.5 8.5 0 0 1 12 0"/><path d="M8.5 16a3.6 3.6 0 0 1 5 0"/></g><circle cx="${wx - 2}" cy="${SY + 46}" r="1.6" fill="${col}"/>`);
  const cx = wx - 30;
  for (let i = 0; i < 4; i++) b.add(`<rect x="${cx - 28 + i * 8}" y="${SY + 44 - (6 + i * 4)}" width="5" height="${6 + i * 4}" rx="1.5" fill="${col}" opacity="0.95"/>`);
}

function tabBar(b, active) {
  const y0 = appBottom;
  b.add(`<rect x="${SX}" y="${y0}" width="${SW}" height="${TAB_H}" fill="${b.linGrad([[0, 'rgba(11,16,34,0.2)'], [.5, 'rgba(11,16,34,0.92)'], [1, 'rgba(8,11,24,0.98)']])}"/>`);
  b.add(`<line x1="${SX}" y1="${y0}" x2="${SX + SW}" y2="${y0}" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`);
  const tabs = [['home', 'Life'], ['briefcase', 'Work'], ['heartline', 'Health'], ['phone', 'Phone'], ['monitor', 'PC'], ['cart', 'Market']];
  const iw = SW / tabs.length;
  tabs.forEach(([ic, lb], i) => {
    const x = SX + iw * (i + .5), on = i === active, col = on ? C.active : '#7B879F';
    b.icon(ic, x, y0 + 48, 30, col, { sw: 2.1 });
    b.txt(x, y0 + 84, lb, { size: 17, w: on ? 700 : 500, fill: col, anchor: 'middle' });
    if (on) b.add(`<circle cx="${x}" cy="${y0 + 16}" r="3" fill="${C.active}"/>`);
  });
}

function appBg(b, theme) {
  b.rrect(SX, SY, SW, SH, SR, C.bgDeep);
  b.add(`<rect x="${SX}" y="${SY}" width="${SW}" height="${SH * .5}" fill="${b.linGrad([[0, theme.accent, .14], [1, theme.accent, 0]])}"/>`);
}

function floatIcon(b, name, x, y, size, color, o = {}) {
  const g = b.radGrad([[0, color, .8], [1, color, 0]]);
  b.add(`<circle cx="${x}" cy="${y}" r="${size * 1.5}" fill="${g}" filter="url(#softblur)" opacity="${o.glow ?? .5}"/>`);
  if (o.card !== false) {
    const r = size * .92;
    b.rrect(x - r, y - r, r * 2, r * 2, r * .5, b.linGrad([[0, 'rgba(30,38,64,0.96)'], [1, 'rgba(16,22,42,0.96)']]), { stroke: 'rgba(255,255,255,0.16)', sw: 1.5 });
  }
  if (name === 'smiley') b.add(smiley(x, y, size, color));
  else if (name === 'dumbbell') b.add(dumbbell(x, y, size, color));
  else b.icon(name, x, y, size, color, { sw: 2.2, fill: color });
}

// ───────────────────────────────────────────────────────── shared defs / bg / headline
function globalDefs(b) {
  b.def(`<filter id="softblur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="60"/></filter>`);
  b.def(`<filter id="softblur2" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="22"/></filter>`);
  b.def(`<filter id="phoneshadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="40" stdDeviation="60" flood-color="#000" flood-opacity="0.6"/></filter>`);
  b.def(`<filter id="cardshadow" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="10" stdDeviation="16" flood-color="#000" flood-opacity="0.45"/></filter>`);
  b.def(`<filter id="headshadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="4" stdDeviation="10" flood-color="#000" flood-opacity="0.5"/></filter>`);
}

function background(b, theme, seed) {
  b.rrect(0, 0, W, H, 0, b.linGrad([[0, theme.bg[0]], [.45, theme.bg[1]], [1, theme.bg[2]]]));
  for (const [col, a, fx, fy] of theme.orbs) {
    const g = b.radGrad([[0, col, a], [1, col, 0]]);
    b.add(`<circle cx="${W * fx}" cy="${H * fy}" r="${W * .62}" fill="${g}" filter="url(#softblur)"/>`);
  }
  b.add(`<rect x="0" y="0" width="${W}" height="${H}" fill="${b.radGrad([[0, '#000', 0], [1, '#000', .45]], .5, .42, .75)}"/>`);
  const r = rng(seed);
  let dots = '';
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = r() * H, rad = .6 + r() * 2.6, op = .04 + r() * .22;
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="#ffffff" opacity="${op.toFixed(2)}"/>`;
  }
  b.add(dots);
  const sr = rng(seed * 7 + 1);
  for (let i = 0; i < 5; i++) {
    const x = 80 + sr() * (W - 160), y = 200 + sr() * 520, s = 12 + sr() * 18;
    b.add(icon('spark', x, y, s, theme.head[1], { fill: theme.head[1] }).replace('<g', `<g opacity="${(.25 + sr() * .4).toFixed(2)}"`));
  }
}

function headline(b, theme, copy) {
  const kText = theme.kicker, kx = CX;
  const pillW = 64 + kText.length * 15.5, pillH = 52;
  b.rrect(kx - pillW / 2, 230, pillW, pillH, pillH / 2, b.linGrad([[0, theme.accent, .22], [1, theme.accent, .10]]), { stroke: theme.accent, sw: 1.5 });
  b.add(`<circle cx="${kx - pillW / 2 + 26}" cy="${230 + pillH / 2}" r="5" fill="${theme.accent}"/>`);
  b.txt(kx + 12, 230 + pillH / 2 + 7, kText, { size: 23, w: 800, fill: theme.head[0], anchor: 'middle', ls: 3 });
  const hg = b.linGrad([[0, theme.head[0]], [1, theme.head[1]]], 0, 0, 1, 1);
  b.txt(CX, 392, copy.lines[0], { size: 90, w: 900, fill: hg, anchor: 'middle', ls: -1.5, filter: 'url(#headshadow)' });
  b.txt(CX, 490, copy.lines[1], { size: 90, w: 900, fill: hg, anchor: 'middle', ls: -1.5, filter: 'url(#headshadow)' });
  b.txt(CX, 560, copy.sub, { size: 31, w: 500, fill: C.sub, anchor: 'middle' });
}

// helper: chip with icon + text
function chip(b, x, y, h, icName, t, col, o = {}) {
  const wch = o.w || (h + 18 + t.length * 11);
  b.rrect(x, y, wch, h, h / 2, o.bg || 'rgba(255,255,255,0.05)', { stroke: o.stroke || C.line, sw: 1 });
  if (icName) b.icon(icName, x + h / 2 + 2, y + h / 2, h * .52, col, { fill: o.fillIcon ? col : undefined, sw: 2 });
  b.txt(x + (icName ? h - 2 : 14), y + h / 2 + 6, t, { size: o.size || 16, w: o.w2 || 600, fill: o.tc || C.sub });
  return wch;
}

// ───────────────────────────────────────────────────────── SCREEN CONTENTS
async function screen1(b, theme) { // HOME / identity
  appBg(b, theme);
  const face = await art('Face/Male.png', 320, 320);
  const hy = appTop + 36;
  const seg = (x, t) => b.txt(x, hy, t, { size: 19, w: 700, fill: 'rgba(226,232,240,0.66)', anchor: 'middle', ls: 1.6 });
  seg(SCX - 165, 'MARCH'); seg(SCX, 'WEEK 3'); seg(SCX + 165, 'AGE 28');
  b.add(`<circle cx="${SCX - 56}" cy="${hy - 6}" r="4" fill="${C.emerald}"/>`);
  for (const dx of [-235, -90, 90, 235]) b.add(`<circle cx="${SCX + dx}" cy="${hy - 6}" r="2.5" fill="rgba(255,255,255,0.2)"/>`);
  // identity card
  let y = appTop + 64, h = 548;
  b.rrect(cX, y, cW, h, 34, C.surface, { filter: 'url(#cardshadow)' });
  b.rrect(cX, y, cW, h, 34, b.linGrad([[0, 'rgba(99,102,241,0.20)'], [1, 'rgba(236,72,153,0.10)']], 0, 0, 1, 1));
  b.rrect(cX, y, cW, h, 34, 'none', { stroke: C.line2, sw: 1.5 });
  const acx = SCX, acy = y + 112, ar = 80;
  b.add(`<circle cx="${acx}" cy="${acy}" r="${ar + 8}" fill="${b.radGrad([[0, theme.accent, .5], [1, theme.accent, 0]])}" filter="url(#softblur2)"/>`);
  const cc = b.clipCircle(acx, acy, ar);
  b.add(`<circle cx="${acx}" cy="${acy}" r="${ar}" fill="#0d1326"/>`);
  b.img(face, acx - ar, acy - ar, ar * 2, ar * 2, { clip: cc, par: 'xMidYMid slice' });
  b.add(`<circle cx="${acx}" cy="${acy}" r="${ar}" fill="none" stroke="${b.linGrad([[0, theme.head[0]], [1, theme.head[1]]], 0, 0, 1, 1)}" stroke-width="4"/>`);
  b.add(`<circle cx="${acx + ar - 6}" cy="${acy + ar - 14}" r="22" fill="${C.amber}" stroke="#0d1326" stroke-width="3"/>`);
  b.txt(acx + ar - 6, acy + ar - 7, '12', { size: 22, w: 900, fill: '#1a1304', anchor: 'middle' });
  b.txt(SCX, y + 234, 'Alexander Reed', { size: 40, w: 800, fill: C.text, anchor: 'middle' });
  b.txt(SCX, y + 274, 'Age 28  ·  Software Engineer', { size: 23, w: 600, fill: C.amber, anchor: 'middle' });
  const stats = [['heart', 'Health', 87, C.green], ['smiley', 'Happiness', 92, C.amber], ['bolt', 'Energy', 76, C.blue], ['dumbbell', 'Fitness', 64, C.violet]];
  const gx = cX + 32, gw = (cW - 64 - 28) / 2, gy = y + 308, gh = 88;
  stats.forEach(([ic, label, val, col], i) => {
    const cxp = gx + (i % 2) * (gw + 28), cyp = gy + Math.floor(i / 2) * (gh + 16);
    b.rrect(cxp, cyp, gw, gh, 18, 'rgba(255,255,255,0.05)', { stroke: C.line, sw: 1 });
    if (ic === 'smiley') b.add(smiley(cxp + 34, cyp + 32, 30, col)); else if (ic === 'dumbbell') b.add(dumbbell(cxp + 34, cyp + 32, 30, col)); else b.icon(ic, cxp + 34, cyp + 32, 30, col, { fill: col });
    b.txt(cxp + 60, cyp + 30, label, { size: 20, w: 600, fill: C.sub });
    b.txt(cxp + gw - 16, cyp + 32, val + '%', { size: 23, w: 800, fill: col, anchor: 'end' });
    b.bar(cxp + 60, cyp + 50, gw - 76, val, col, { h: 9, color2: col });
  });
  const ny = y + h - 76;
  b.rrect(cX + 24, ny, cW - 48, 56, 16, 'rgba(16,185,129,0.12)', { stroke: 'rgba(16,185,129,0.3)', sw: 1.5 });
  b.icon('trend', cX + 56, ny + 28, 26, C.emerald);
  b.txt(cX + 80, ny + 36, 'NET WORTH', { size: 19, w: 700, fill: C.sub, ls: 1 });
  b.txt(cX + cW - 44, ny + 38, '$1,284,920', { size: 30, w: 900, fill: C.emerald, anchor: 'end' });
  // goals card
  y = y + h + 24; h = 360;
  b.rrect(cX, y, cW, h, 30, C.surface, { filter: 'url(#cardshadow)' });
  b.rrect(cX, y, cW, h, 30, 'none', { stroke: C.line, sw: 1.5 });
  b.icon('target', cX + 38, y + 46, 28, theme.accent);
  b.txt(cX + 62, y + 54, 'Active Goals', { size: 27, w: 800, fill: C.text });
  b.txt(cX + cW - 30, y + 54, '3 in progress', { size: 19, w: 600, fill: C.muted, anchor: 'end' });
  const goals = [['briefcase', 'Get promoted to Senior Engineer', 72, C.indigo], ['building', 'Buy a luxury penthouse', 45, C.emerald], ['heart', 'Marry the love of your life', 60, C.pink]];
  goals.forEach(([ic, name, pct, col], i) => {
    const gy2 = y + 90 + i * 84;
    b.rrect(cX + 24, gy2, 56, 56, 16, 'rgba(255,255,255,0.05)', { stroke: C.line, sw: 1 });
    b.icon(ic, cX + 52, gy2 + 28, 26, col, { fill: ic === 'heart' ? col : undefined });
    b.txt(cX + 96, gy2 + 26, name, { size: 21, w: 600, fill: C.text });
    b.bar(cX + 96, gy2 + 40, cW - 200, pct, col, { h: 10, color2: col });
    b.txt(cX + cW - 30, gy2 + 32, pct + '%', { size: 22, w: 800, fill: col, anchor: 'end' });
  });
  // achievements card (fills remaining)
  y = y + h + 24; h = appBottom - y - 22;
  b.rrect(cX, y, cW, h, 30, C.surface, { filter: 'url(#cardshadow)' });
  b.rrect(cX, y, cW, h, 30, 'none', { stroke: C.line, sw: 1.5 });
  b.icon('star', cX + 38, y + 46, 28, C.gold, { fill: C.gold });
  b.txt(cX + 64, y + 54, 'Achievements', { size: 27, w: 800, fill: C.text });
  b.txt(cX + cW - 30, y + 54, '24 / 60', { size: 21, w: 800, fill: C.gold, anchor: 'end' });
  const badges = [['crown', C.gold], ['banknote', C.emerald], ['heart', C.pink], ['gem', C.indigo], ['bolt', C.blue], ['trend', C.emerald]];
  const bw = (cW - 48 - 5 * 16) / 6;
  badges.forEach(([ic, col], i) => {
    const bx = cX + 24 + i * (bw + 16);
    b.rrect(bx, y + 80, bw, bw, 18, `${col}1f`, { stroke: `${col}55`, sw: 1.2 });
    b.icon(ic, bx + bw / 2, y + 80 + bw / 2, bw * 0.5, col, { fill: ['crown', 'heart', 'gem', 'bolt'].includes(ic) ? col : undefined });
  });
  // next-achievement progress + streak
  const py = y + 80 + bw + 30;
  b.icon('target', cX + 40, py, 24, C.sky);
  b.txt(cX + 64, py + 8, 'Next: Millionaire Mogul', { size: 21, w: 600, fill: C.text });
  b.txt(cX + cW - 30, py + 8, '83%', { size: 20, w: 800, fill: C.sky, anchor: 'end' });
  b.bar(cX + 40, py + 24, cW - 80, 83, C.sky, { h: 10, color2: C.cyan });
  const ry = py + 70;
  b.icon('flame', cX + 40, ry, 26, C.orange, { fill: C.orange });
  b.txt(cX + 64, ry + 8, 'Legacy streak', { size: 21, w: 600, fill: C.text });
  b.txt(cX + cW - 30, ry + 8, '7 lives', { size: 21, w: 800, fill: C.orange, anchor: 'end' });
  tabBar(b, 0);
}

async function screen2(b, theme) { // ORIGINS / scenario selection
  appBg(b, theme);
  b.txt(SCX, appTop + 54, 'Choose Your Origin', { size: 38, w: 800, fill: C.text, anchor: 'middle' });
  b.txt(SCX, appTop + 94, 'Every origin changes how your story unfolds', { size: 22, w: 500, fill: C.sub, anchor: 'middle' });
  const cards = [
    { img: 'Scenarios/Rags to Riches_final.png', name: 'Rags to Riches', diff: 'HARD', dc: C.red, desc: 'Born with nothing. Build an empire from the streets up.', sel: true, stats: [['banknote', '$0', C.muted], ['star', 'Rep 5', C.amber], ['bolt', 'Grit 90', C.violet]] },
    { img: 'Scenarios/Trust Fund Baby_final.png', name: 'Trust Fund Baby', diff: 'EASY', dc: C.green, desc: 'Start with $5M and famous parents — don’t waste it.', stats: [['banknote', '$5M', C.emerald], ['star', 'Rep 80', C.amber], ['heart', 'Charm 70', C.pink]] },
    { img: 'Scenarios/Street Hustler.png', name: 'Street Hustler', diff: 'HARD', dc: C.red, desc: 'Fast money, fast risk. Stay ahead of the law.', stats: [['banknote', '$200', C.muted], ['flame', 'Risk 95', C.orange], ['bolt', 'Grit 85', C.violet]] },
    { img: 'Scenarios/Aspiring Entrepreneur.png', name: 'Aspiring Entrepreneur', diff: 'MEDIUM', dc: C.amber, desc: 'A garage, a laptop, and a billion-dollar idea.', stats: [['banknote', '$8K', C.emerald], ['bolt', 'IQ 88', C.blue], ['star', 'Drive 92', C.amber]] },
    { img: 'Scenarios/Single Parent_final.png', name: 'Single Parent', diff: 'MEDIUM', dc: C.amber, desc: 'Two mouths to feed and a dream to chase.', stats: [['banknote', '$1.2K', C.muted], ['heart', 'Love 95', C.pink], ['bolt', 'Grit 80', C.violet]] },
  ];
  // pinned CTA at bottom
  const bh = 92, by = fullBottom - bh;
  const top = appTop + 124, gap = 22;
  const ch = (by - 24 - top - gap * (cards.length - 1)) / cards.length;
  let y = top;
  for (const c of cards) {
    const sel = c.sel, im = await art(c.img, 260, 260);
    b.rrect(cX, y, cW, ch, 26, sel ? 'rgba(245,158,11,0.12)' : C.surface, { filter: 'url(#cardshadow)' });
    b.rrect(cX, y, cW, ch, 26, 'none', { stroke: sel ? theme.accent : C.line, sw: sel ? 2.5 : 1.2 });
    const ts = ch - 36;
    b.rrect(cX + 20, y + 18, ts, ts, 20, b.linGrad([[0, 'rgba(124,58,237,0.25)'], [1, 'rgba(245,158,11,0.18)']], 0, 0, 1, 1));
    b.img(im, cX + 20, y + 18, ts, ts, { par: 'xMidYMid meet' });
    const tx = cX + 20 + ts + 26;
    b.txt(tx, y + 50, c.name, { size: 27, w: 800, fill: C.text });
    const dw = 36 + c.diff.length * 12;
    b.rrect(cX + cW - dw - 22, y + 28, dw, 32, 16, 'rgba(0,0,0,0.28)', { stroke: c.dc, sw: 1.4 });
    b.txt(cX + cW - 22 - dw / 2, y + 49, c.diff, { size: 16, w: 800, fill: c.dc, anchor: 'middle', ls: 1 });
    b.txt(tx, y + 84, c.desc, { size: 19, w: 500, fill: C.sub });
    let hx = tx;
    for (const [ic, t, col] of c.stats) hx += chip(b, hx, y + ch - 54, 36, ic, t, col, { fillIcon: ic !== 'banknote' && ic !== 'building' }) + 12;
    if (sel) { b.add(`<circle cx="${cX + cW - 44}" cy="${y + ch - 36}" r="20" fill="${theme.accent}"/>`); b.icon('check', cX + cW - 44, y + ch - 36, 22, '#1a1304', { sw: 3 }); }
    y += ch + gap;
  }
  b.rrect(cX, by, cW, bh, bh / 2, b.linGrad([[0, C.amber], [1, C.orange]], 0, 0, 1, 0), { filter: 'url(#cardshadow)' });
  b.icon('play', SCX - 132, by + bh / 2, 26, '#1a1304', { fill: '#1a1304' });
  b.txt(SCX + 16, by + bh / 2 + 10, 'Start Your Life', { size: 31, w: 900, fill: '#1a1304', anchor: 'middle' });
}

async function screen3(b, theme) { // EMPIRE / wealth
  appBg(b, theme);
  b.txt(cX, appTop + 46, 'Net Worth', { size: 25, w: 700, fill: C.sub });
  b.txt(cX, appTop + 104, '$4.28M', { size: 64, w: 900, fill: C.emerald });
  b.rrect(cX + cW - 158, appTop + 56, 158, 46, 23, 'rgba(16,185,129,0.14)', { stroke: 'rgba(16,185,129,0.35)', sw: 1.4 });
  b.icon('trend', cX + cW - 134, appTop + 79, 22, C.emerald);
  b.txt(cX + cW - 22, appTop + 87, '+18.4%', { size: 24, w: 800, fill: C.emerald, anchor: 'end' });
  // chart card
  let y = appTop + 132, h = 360;
  b.rrect(cX, y, cW, h, 26, C.surface, { filter: 'url(#cardshadow)' });
  b.rrect(cX, y, cW, h, 26, 'none', { stroke: C.line, sw: 1.2 });
  b.txt(cX + 26, y + 38, 'Portfolio', { size: 21, w: 700, fill: C.text });
  ['1M', '1Y', '5Y', 'ALL'].forEach((t, i) => { const on = i === 2, bx = cX + cW - 26 - (4 - i) * 58; b.rrect(bx, y + 18, 50, 30, 15, on ? 'rgba(16,185,129,0.2)' : 'transparent'); b.txt(bx + 25, y + 38, t, { size: 16, w: on ? 800 : 600, fill: on ? C.emerald : C.muted, anchor: 'middle' }); });
  const px0 = cX + 26, py0 = y + h - 40, pw = cW - 52, ph = h - 100;
  const r = rng(33); let pts = []; let v = .12;
  for (let i = 0; i <= 24; i++) { v += (r() - 0.34) * .06; v = Math.max(.05, Math.min(.95, v + i * 0.004)); pts.push([px0 + pw * i / 24, py0 - ph * v]); }
  pts[pts.length - 1][1] = py0 - ph * .93;
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' ');
  b.add(`<path d="${path} L${px0 + pw} ${py0} L${px0} ${py0} Z" fill="${b.linGrad([[0, C.emerald, .35], [1, C.emerald, 0]])}"/>`);
  b.add(`<path d="${path}" fill="none" stroke="${b.linGrad([[0, C.emerald], [1, C.gold]], 0, 0, 1, 0)}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`);
  const last = pts[pts.length - 1];
  b.add(`<circle cx="${last[0]}" cy="${last[1]}" r="7" fill="${C.gold}" stroke="#0d1326" stroke-width="3"/>`);
  // 3 stat tiles
  y += h + 24; const th = 150, tw = (cW - 2 * 22) / 3;
  const tile = (i, label, ic, big, small, col) => {
    const mx = cX + i * (tw + 22);
    b.rrect(mx, y, tw, th, 22, C.surface, { stroke: C.line, sw: 1.2 });
    b.rrect(mx + 18, y + 18, 46, 46, 13, `${col}22`, { stroke: `${col}55`, sw: 1.2 });
    b.icon(ic, mx + 41, y + 41, 24, col, { fill: ic === 'gem' || ic === 'bolt' ? col : undefined });
    b.txt(mx + 18, y + 92, label, { size: 18, w: 600, fill: C.sub });
    b.txt(mx + 18, y + 122, big, { size: 26, w: 900, fill: C.text });
    b.txt(mx + 18, y + 142, small, { size: 15, w: 700, fill: col });
  };
  tile(0, 'Cash', 'banknote', '$92.4K', '+ $8.2K/wk', C.emerald);
  tile(1, 'Crypto', 'bolt', '1.84 BTC', '▲ $124.9K', C.amber);
  tile(2, 'Stocks', 'trend', '$1.62M', '▲ 11.3%', C.sky);
  // assets showcase
  y += th + 26;
  b.txt(cX, y, 'YOUR ASSETS', { size: 19, w: 800, fill: C.muted, ls: 2 });
  y += 22;
  const car = await art('Vehicles/exotic_supercar_final.png', 560, 380);
  const house = await art('Real Estate/Modern Mansion.png', 560, 380);
  const mw = (cW - 24) / 2, showH = 234;
  const showcase = async (sx, label, sub, im, par, bgStops) => {
    const cl = b.clipRound(sx, y, mw, showH, 22);
    b.rrect(sx, y, mw, showH, 22, b.linGrad(bgStops, 0, 0, 1, 1), { filter: 'url(#cardshadow)' });
    b.add(`<g clip-path="url(#${cl})">`);
    b.img(im, sx, y, mw, showH, { par: par === 'slice' ? 'xMidYMid slice' : 'xMidYMid meet' });
    b.add(`<rect x="${sx}" y="${y + showH - 84}" width="${mw}" height="84" fill="${b.linGrad([[0, 'rgba(8,11,24,0)'], [1, 'rgba(8,11,24,0.94)']])}"/>`);
    b.add(`</g>`);
    b.rrect(sx, y, mw, showH, 22, 'none', { stroke: C.line2, sw: 1.2 });
    b.txt(sx + 18, y + showH - 36, label, { size: 23, w: 800, fill: C.text });
    b.txt(sx + 18, y + showH - 12, sub, { size: 17, w: 700, fill: C.gold });
  };
  await showcase(cX, 'Aventador SVJ', '$485,000', car, 'meet', [['0', 'rgba(124,58,237,0.35)'], ['1', 'rgba(8,11,24,0.6)']]);
  await showcase(cX + mw + 24, 'Modern Mansion', '$3.2M', house, 'slice', [['0', 'rgba(14,116,144,0.35)'], ['1', 'rgba(8,11,24,0.6)']]);
  // passive income card (fills remaining)
  y += showH + 26; h = appBottom - y - 18;
  b.rrect(cX, y, cW, h, 26, C.surface, { filter: 'url(#cardshadow)' });
  b.rrect(cX, y, cW, h, 26, 'none', { stroke: C.line, sw: 1.2 });
  b.txt(cX + 26, y + 42, 'Passive Income', { size: 24, w: 800, fill: C.text });
  b.txt(cX + 26, y + 70, 'per month', { size: 17, w: 600, fill: C.muted });
  b.txt(cX + cW - 26, y + 56, '+$48,200', { size: 34, w: 900, fill: C.emerald, anchor: 'end' });
  const rows = [['building', 'Real-estate rentals', '$22,400', 0.46, C.emerald], ['bolt', 'Crypto mining', '$13,800', 0.29, C.amber], ['trend', 'Stock dividends', '$12,000', 0.25, C.sky]];
  rows.forEach(([ic, label, amt, frac, col], i) => {
    const ry2 = y + 104 + i * ((h - 116) / 3);
    b.rrect(cX + 22, ry2, 50, 50, 14, `${col}22`, { stroke: `${col}55`, sw: 1.1 });
    b.icon(ic, cX + 47, ry2 + 25, 24, col, { fill: ic === 'bolt' ? col : undefined });
    b.txt(cX + 86, ry2 + 22, label, { size: 21, w: 600, fill: C.text });
    b.bar(cX + 86, ry2 + 36, cW - 280, frac * 100, col, { h: 9, color2: col });
    b.txt(cX + cW - 26, ry2 + 32, amt, { size: 22, w: 800, fill: col, anchor: 'end' });
  });
  tabBar(b, 4);
}

async function screen4(b, theme) { // LOVE / dating
  appBg(b, theme);
  const face = await art('Face/Female.png', 600, 600);
  let y = appTop + 24, h = appBottom - y - 132;
  const cl = b.clipRound(cX, y, cW, h, 32);
  b.rrect(cX, y, cW, h, 32, '#160e22', { filter: 'url(#cardshadow)' });
  b.add(`<g clip-path="url(#${cl})">`);
  const photoH = h * .62;
  b.add(`<rect x="${cX}" y="${y}" width="${cW}" height="${photoH}" fill="${b.linGrad([[0, '#EC4899'], [.5, '#A855F7'], [1, '#6366F1']], 0, 0, 1, 1)}"/>`);
  b.add(`<circle cx="${cX + cW / 2}" cy="${y + photoH * .5}" r="${cW * .42}" fill="${b.radGrad([[0, 'rgba(255,255,255,0.25)'], [1, 'rgba(255,255,255,0)']])}"/>`);
  b.img(face, cX + cW / 2 - photoH * .54, y + photoH * .06, photoH * 1.08, photoH * .95, { par: 'xMidYMid meet' });
  b.add(`<rect x="${cX}" y="${y + photoH - 170}" width="${cW}" height="${h - photoH + 170}" fill="${b.linGrad([[0, 'rgba(22,14,34,0)'], [.4, 'rgba(22,14,34,0.85)'], [1, 'rgba(22,14,34,1)']])}"/>`);
  b.rrect(cX + 22, y + 22, 120, 40, 20, 'rgba(0,0,0,0.4)');
  b.add(`<circle cx="${cX + 44}" cy="${y + 42}" r="6" fill="${C.green}"/>`);
  b.txt(cX + 58, y + 49, 'Online', { size: 18, w: 700, fill: '#fff' });
  b.rrect(cX + cW - 156, y + 22, 134, 40, 20, 'rgba(236,72,153,0.92)');
  b.icon('heart', cX + cW - 134, y + 42, 20, '#fff', { fill: '#fff' });
  b.txt(cX + cW - 116, y + 49, '94% Match', { size: 18, w: 800, fill: '#fff' });
  let iy = y + photoH + 8;
  b.txt(cX + 28, iy + 30, 'Sofia, 26', { size: 42, w: 900, fill: '#fff' });
  b.add(`<circle cx="${cX + 250}" cy="${iy + 18}" r="14" fill="${C.sky}"/>`); b.icon('check', cX + 250, iy + 18, 16, '#fff', { sw: 3 });
  b.icon('mapPin', cX + 32, iy + 66, 20, C.sub);
  b.txt(cX + 52, iy + 72, '2 km away  ·  Marketing Director', { size: 20, w: 600, fill: C.sub });
  b.txt(cX + 28, iy + 116, '“Coffee, hiking and spontaneous road', { size: 21, w: 500, fill: 'rgba(255,255,255,0.88)' });
  b.txt(cX + 28, iy + 146, 'trips. Make me laugh and you’re in.”', { size: 21, w: 500, fill: 'rgba(255,255,255,0.88)' });
  let tx = cX + 28;
  [['spark', 'Coffee'], ['mapPin', 'Hiking'], ['arrUR', 'Travel'], ['play', 'Music']].forEach(([ic, t]) => {
    tx += chip(b, tx, iy + 168, 40, ic, t, '#C7D2FE', { bg: 'rgba(99,102,241,0.18)', stroke: 'rgba(129,140,248,0.4)', tc: '#C7D2FE', size: 17, fillIcon: ic === 'spark' || ic === 'play' }) + 12;
  });
  b.add('</g>');
  b.rrect(cX, y, cW, h, 32, 'none', { stroke: C.line2, sw: 1.5 });
  // action buttons
  const ay = appBottom - 86; const btns = [['x', C.red, 66], ['msg', C.blue, 58], ['heart', C.pink, 80], ['gem', C.amber, 58]];
  const bxs = [SCX - 224, SCX - 80, SCX + 80, SCX + 236];
  btns.forEach(([ic, col, sz], i) => {
    const x = bxs[i];
    b.add(`<circle cx="${x}" cy="${ay}" r="${sz / 2 + 7}" fill="${b.radGrad([[0, col, .6], [1, col, 0]])}" filter="url(#softblur2)"/>`);
    b.add(`<circle cx="${x}" cy="${ay}" r="${sz / 2}" fill="rgba(20,16,30,0.95)" stroke="${col}" stroke-width="2.5"/>`);
    b.icon(ic, x, ay, sz * .46, col, { fill: ic === 'heart' || ic === 'gem' ? col : undefined, sw: 3 });
  });
  tabBar(b, 3);
}

async function screen5(b, theme) { // DYNASTY / family tree
  appBg(b, theme);
  b.txt(cX + 4, appTop + 50, 'Family Tree', { size: 34, w: 800, fill: C.text });
  b.icon('crown', cX + 208, appTop + 40, 28, C.gold, { fill: C.gold });
  b.rrect(cX + cW - 52, appTop + 24, 44, 44, 22, 'rgba(255,255,255,0.06)', { stroke: C.line, sw: 1 });
  b.icon('x', cX + cW - 30, appTop + 46, 22, C.sub, { sw: 2.4 });
  b.txt(cX + 4, appTop + 88, 'The Reed Dynasty  ·  4 generations', { size: 21, w: 600, fill: C.sub });
  const faces = {
    om: await art('Face/Old_Male.png', 220, 220), of: await art('Face/Old_Female.png', 220, 220),
    m: await art('Face/Male.png', 220, 220), f: await art('Face/Female.png', 220, 220), bb: await art('Face/Baby.png', 220, 220),
  };
  const node = (x, yc, r, im, name, worth, ringCol, opts = {}) => {
    if (opts.glow) b.add(`<circle cx="${x}" cy="${yc}" r="${r + 14}" fill="${b.radGrad([[0, ringCol, .6], [1, ringCol, 0]])}" filter="url(#softblur2)"/>`);
    const cc = b.clipCircle(x, yc, r);
    b.add(`<circle cx="${x}" cy="${yc}" r="${r}" fill="#0d1326"/>`);
    b.img(im, x - r, yc - r, r * 2, r * 2, { clip: cc, par: 'xMidYMid slice' });
    b.add(`<circle cx="${x}" cy="${yc}" r="${r}" fill="none" stroke="${ringCol}" stroke-width="${opts.glow ? 4 : 3}"/>`);
    if (opts.you) { b.rrect(x - 28, yc - r - 24, 56, 30, 15, ringCol); b.txt(x, yc - r - 3, 'YOU', { size: 17, w: 900, fill: '#0d1326', anchor: 'middle', ls: 1 }); }
    if (opts.crown) b.icon('crown', x, yc - r - 16, 24, C.gold, { fill: C.gold });
    b.txt(x, yc + r + 30, name, { size: 19, w: 700, fill: C.text, anchor: 'middle' });
    b.txt(x, yc + r + 54, worth, { size: 17, w: 600, fill: C.emerald, anchor: 'middle' });
  };
  const conn = (x1, y1, x2, y2) => b.add(`<path d="M${x1} ${y1} C ${x1} ${(y1 + y2) / 2}, ${x2} ${(y1 + y2) / 2}, ${x2} ${y2}" fill="none" stroke="rgba(255,255,255,0.16)" stroke-width="2"/>`);
  const gLabel = (y, t) => b.txt(cX + 4, y, t, { size: 16, w: 800, fill: C.muted, ls: 2 });
  const g1 = appTop + 196, g2 = appTop + 510, g3 = appTop + 850, g4 = appTop + 1150;
  // connectors first (behind)
  conn(SCX - 90, g1 + 54, SCX - 150, g2 - 50); conn(SCX + 90, g1 + 54, SCX + 150, g2 - 50);
  conn(SCX - 150, g2 + 50, SCX - 76, g3 - 58); conn(SCX + 150, g2 + 50, SCX + 96, g3 - 50);
  conn(SCX - 76, g3 + 58, SCX, g4 - 46);
  gLabel(g1 - 86, 'GEN 1  ·  FOUNDERS');
  node(SCX - 90, g1, 54, faces.om, 'William R.', '$12.4M', C.gold, { crown: true });
  node(SCX + 90, g1, 54, faces.of, 'Margaret R.', '$8.1M', '#D7D7DD');
  gLabel(g2 - 82, 'GEN 2');
  node(SCX - 150, g2, 50, faces.m, 'Robert R.', '$5.8M', '#E0A06A');
  node(SCX + 150, g2, 50, faces.f, 'Diana R.', '$3.2M', '#D7D7DD');
  gLabel(g3 - 92, 'GEN 3  ·  CURRENT');
  node(SCX - 76, g3, 58, faces.m, 'Alexander R.', '$1.28M', theme.accent, { you: true, glow: true });
  node(SCX + 96, g3, 48, faces.f, 'Jessica R.', '$640K', C.emerald);
  gLabel(g4 - 80, 'GEN 4  ·  HEIR');
  node(SCX, g4, 46, faces.bb, 'Baby Reed', 'Inherits $1.28M', C.amber);
  // summary strip
  const sy = fullBottom - 104;
  b.rrect(cX, sy, cW, 96, 24, 'rgba(250,204,21,0.08)', { stroke: 'rgba(250,204,21,0.3)', sw: 1.4, filter: 'url(#cardshadow)' });
  const sums = [['$24.7M', 'Total Wealth', C.gold], ['7', 'Members', C.sky], ['4', 'Generations', C.emerald], ['12', 'Perks', C.pink]];
  const sw2 = cW / 4;
  sums.forEach(([v, l, col], i) => {
    const x = cX + sw2 * (i + .5);
    b.txt(x, sy + 46, v, { size: 28, w: 900, fill: col, anchor: 'middle' });
    b.txt(x, sy + 74, l, { size: 16, w: 600, fill: C.sub, anchor: 'middle' });
    if (i) b.add(`<line x1="${cX + sw2 * i}" y1="${sy + 22}" x2="${cX + sw2 * i}" y2="${sy + 74}" stroke="rgba(255,255,255,0.1)"/>`);
  });
}

async function screen6(b, theme) { // VIRAL / social feed
  appBg(b, theme);
  const male = await art('Face/Male.png', 160, 160), female = await art('Face/Female.png', 160, 160);
  b.txt(cX, appTop + 50, 'Pulse', { size: 34, w: 900, fill: C.cyan });
  b.icon('spark', cX + 96, appTop + 38, 22, C.cyan, { fill: C.cyan });
  b.rrect(cX + cW - 210, appTop + 18, 210, 52, 26, 'rgba(34,211,238,0.12)', { stroke: 'rgba(34,211,238,0.35)', sw: 1.3 });
  b.icon('users', cX + cW - 184, appTop + 44, 22, C.cyan);
  b.txt(cX + cW - 162, appTop + 40, '128.4K', { size: 23, w: 900, fill: C.text });
  b.txt(cX + cW - 162, appTop + 60, 'followers ▲ 12%', { size: 14, w: 600, fill: C.emerald });
  let tx = cX;
  ['For You', 'Following', 'Trending'].forEach((t, i) => { const on = i === 0; b.txt(tx + 6, appTop + 118, t, { size: 21, w: on ? 800 : 600, fill: on ? C.text : C.muted }); if (on) b.add(`<rect x="${tx + 4}" y="${appTop + 130}" width="${t.length * 12 + 8}" height="4" rx="2" fill="${C.cyan}"/>`); tx += t.length * 13 + 44; });
  b.add(`<line x1="${cX}" y1="${appTop + 142}" x2="${cX + cW}" y2="${appTop + 142}" stroke="rgba(255,255,255,0.08)"/>`);
  const post = (y, ph, av, name, handle, verified, time, lines, eng, opts = {}) => {
    if (opts.you) b.rrect(cX, y, cW, ph, 22, 'rgba(34,211,238,0.06)', { stroke: 'rgba(34,211,238,0.25)', sw: 1.2 });
    else b.add(`<line x1="${cX}" y1="${y + ph}" x2="${cX + cW}" y2="${y + ph}" stroke="rgba(255,255,255,0.07)"/>`);
    const ar = 32, ax = cX + 24 + ar, ay = y + 26 + ar;
    if (opts.flame) { b.add(`<circle cx="${ax}" cy="${ay}" r="${ar}" fill="${b.linGrad([[0, C.orange], [1, C.red]], 0, 0, 1, 1)}"/>`); b.icon('flame', ax, ay, 34, '#fff', { fill: '#fff' }); }
    else { const cc = b.clipCircle(ax, ay, ar); b.add(`<circle cx="${ax}" cy="${ay}" r="${ar}" fill="#0d1326"/>`); b.img(av, ax - ar, ay - ar, ar * 2, ar * 2, { clip: cc, par: 'xMidYMid slice' }); b.add(`<circle cx="${ax}" cy="${ay}" r="${ar}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>`); }
    let nx = ax + ar + 16;
    b.txt(nx, ay - 4, name, { size: 23, w: 800, fill: C.text });
    let adv = name.length * 13.5 + 16;
    if (verified) { b.add(`<circle cx="${nx + adv - 2}" cy="${ay - 11}" r="12" fill="${C.sky}"/>`); b.icon('check', nx + adv - 2, ay - 11, 14, '#fff', { sw: 3 }); adv += 26; }
    b.txt(nx + adv, ay - 4, handle, { size: 18, w: 500, fill: C.muted });
    b.txt(nx, ay + 24, time, { size: 16, w: 500, fill: C.muted });
    lines.forEach((ln, i) => b.txt(cX + 24, ay + ar + 24 + i * 32, ln, { size: 22, w: 500, fill: 'rgba(255,255,255,0.93)' }));
    if (opts.viral) { const vy = ay + ar + 24 + lines.length * 32 + 6; b.icon('flame', cX + 34, vy - 5, 18, C.orange, { fill: C.orange }); b.txt(cX + 52, vy, 'Trending #1  ·  1.2M views', { size: 17, w: 700, fill: C.orange }); }
    const ey = y + ph - 24;
    const items = [['msg', eng[0], C.muted], ['repeat', eng[1], C.emerald], ['heart', eng[2], C.pink], ['eye', eng[3], C.sky]];
    let ex = cX + 30;
    items.forEach(([ic, val, col]) => { b.icon(ic, ex, ey, 22, col, { fill: ic === 'heart' ? col : undefined, sw: 2 }); b.txt(ex + 18, ey + 7, val, { size: 18, w: 600, fill: col }); ex += 56 + val.length * 11; });
  };
  let y = appTop + 158, gap = 16;
  const region = appBottom - y - 18;
  post(y, 300, null, 'Maya Quartz', '@mayaq', true, '2h', ['Just quit my 9–5 to go all-in on my', 'startup. Terrified — but let’s build.'], ['1.2K', '3.4K', '15.2K', '1.2M'], { flame: true, viral: true });
  y += 300 + gap;
  post(y, 236, female, 'FitQueen', '@fitqueen', false, '4h', ['Morning 10K done in 44 min — new PB!', 'Who else is chasing goals today?'], ['89', '234', '2.1K', '88K']);
  y += 236 + gap;
  post(y, 250, male, 'Alexander R.', '@alexr', true, '6h', ['Just crossed $1M net worth.', 'Started from the streets. No cap.'], ['456', '1.8K', '8.7K', '231K'], { you: true });
  y += 250 + gap;
  // suggested creators card fills the rest
  const ch = appBottom - y - 18;
  b.rrect(cX, y, cW, ch, 22, C.surface, { stroke: C.line, sw: 1.2 });
  b.txt(cX + 24, y + 40, 'Suggested for you', { size: 21, w: 800, fill: C.text });
  b.txt(cX + cW - 24, y + 40, 'See all', { size: 17, w: 700, fill: C.cyan, anchor: 'end' });
  const sug = [[female, 'Luna Vale', '@lunav', '2.4M'], [male, 'Max Steel', '@maxs', '880K']];
  sug.forEach(([av, nm, hd, fol], i) => {
    const ry = y + 64 + i * ((ch - 76) / 2);
    const ar = 26, ax = cX + 24 + ar, ayc = ry + ar;
    const cc = b.clipCircle(ax, ayc, ar); b.add(`<circle cx="${ax}" cy="${ayc}" r="${ar}" fill="#0d1326"/>`); b.img(av, ax - ar, ayc - ar, ar * 2, ar * 2, { clip: cc, par: 'xMidYMid slice' });
    b.add(`<circle cx="${ax}" cy="${ayc}" r="${ar}" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="2"/>`);
    b.txt(ax + ar + 16, ayc - 2, nm, { size: 21, w: 700, fill: C.text });
    b.txt(ax + ar + 16, ayc + 22, hd + '  ·  ' + fol + ' followers', { size: 16, w: 500, fill: C.muted });
    b.rrect(cX + cW - 134, ayc - 22, 110, 44, 22, b.linGrad([[0, C.cyan], [1, C.blue]], 0, 0, 1, 0));
    b.txt(cX + cW - 79, ayc + 6, 'Follow', { size: 18, w: 800, fill: '#06131f', anchor: 'middle' });
  });
  tabBar(b, 3);
}

// ───────────────────────────────────────────────────────── floating accents per screen
function floaters(b, idx) {
  const sets = {
    1: [['gem', 200, 760, 52, C.indigo], ['star', 1090, 690, 46, C.amber], ['heart', 150, 1150, 44, C.pink], ['bolt', 1130, 1150, 46, C.blue]],
    2: [['star', 175, 740, 50, C.amber], ['spark', 1110, 700, 44, C.gold], ['crown', 150, 1200, 46, C.amber], ['gem', 1135, 1180, 44, C.violet]],
    3: [['banknote', 185, 730, 50, C.emerald], ['bolt', 1100, 690, 48, C.amber], ['trend', 150, 1180, 46, C.emerald], ['gem', 1140, 1200, 44, C.gold]],
    4: [['heart', 180, 720, 54, C.pink], ['spark', 1110, 700, 44, C.rose], ['heart', 140, 1200, 40, C.rose], ['msg', 1140, 1170, 44, C.blue]],
    5: [['crown', 185, 720, 52, C.gold], ['star', 1110, 700, 44, C.sky], ['gem', 150, 1210, 44, C.violet], ['spark', 1140, 1180, 42, C.gold]],
    6: [['heart', 180, 730, 50, C.pink], ['flame', 1110, 690, 50, C.orange], ['repeat', 150, 1190, 44, C.emerald], ['users', 1140, 1190, 44, C.cyan]],
  };
  for (const [n, x, y, s, c] of (sets[idx] || [])) floatIcon(b, n, x, y, s, c, { glow: .45 });
}

// ───────────────────────────────────────────────────────── assemble + render
async function buildScreen(idx) {
  const theme = THEMES[idx], copy = COPY[idx];
  const b = screenBuilder();
  globalDefs(b);
  background(b, theme, idx * 99 + 7);
  headline(b, theme, copy);
  const sb = screenBuilder();
  statusBar(sb);
  const screens = { 1: screen1, 2: screen2, 3: screen3, 4: screen4, 5: screen5, 6: screen6 };
  await screens[idx](sb, theme);
  b.def(sb.defs);
  deviceFrame(b, theme, sb.body);
  floaters(b, idx);
  return `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"><defs>${b.defs}</defs>${b.body}</svg>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const labels = { 1: 'live-your-life', 2: 'choose-your-origin', 3: 'build-an-empire', 4: 'find-love', 5: 'leave-a-dynasty', 6: 'go-viral' };
  const files = [];
  for (let i = 1; i <= 6; i++) {
    const svg = await buildScreen(i);
    const file = join(OUT, `${String(i).padStart(2, '0')}-${labels[i]}.png`);
    await sharp(Buffer.from(svg)).png({ quality: 100 }).toFile(file);
    files.push(file);
    console.log('✓', file);
  }
  const thumbs = [];
  for (let i = 0; i < files.length; i++) {
    const t = await sharp(files[i]).resize(360, 780, { fit: 'inside' }).png().toBuffer();
    thumbs.push({ input: t, left: (i % 3) * 380 + 14, top: Math.floor(i / 3) * 800 + 14 });
  }
  await sharp({ create: { width: 380 * 3 + 14, height: 800 * 2 + 14, channels: 3, background: { r: 10, g: 11, b: 20 } } })
    .composite(thumbs).png().toFile(join(OUT, '_contact-sheet.png'));
  console.log('✓ contact sheet');
}

main().catch(e => { console.error(e); process.exit(1); });
