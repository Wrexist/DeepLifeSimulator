/**
 * DeepLife Simulator — "Hero" App Store Screenshot Generator
 * ----------------------------------------------------------
 * Premium, immersive marketing frames in the modern App-Store hero style:
 *   • a titanium iPhone tilted in real 3D perspective (2.5D card-tilt + shadow)
 *   • a single large accent glow + ambient particles, one accent color / frame
 *   • a bold caption headline with one accent word (reference-style voice)
 *   • floating glass "live" chips that pop FORWARD off the device for depth
 *
 * The on-device art is the app's OWN faithful screens — reused from
 * generate-app-store-screenshots.mjs via buildDeviceLayer() — so the marketing
 * never drifts from the real UI.
 *
 * Run:  node scripts/generate-hero-screenshots.mjs
 * Out:  screenshots/iphone-hero/01…05-*.png  (+ a contact-sheet preview)
 *
 * Requires `sharp` and the Inter font available to fontconfig.
 */

import { createRequire } from 'module';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Buffer } from 'node:buffer';
import { buildDeviceLayer, screenBuilder, THEMES, C } from './generate-app-store-screenshots.mjs';

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); }
catch { sharp = require('/tmp/shottest/node_modules/sharp'); }

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'screenshots', 'iphone-hero');
const ICON = join(ROOT, 'assets', 'images', 'icon.png');

// ── canvas (work in the device's native space; export to Apple's 6.5" size) ──
const W = 1290, H = 2796, CX = W / 2;        // device-layer coordinate space
const OW = 1284, OH = 2778;                   // exported PNG (App Store 6.5")

// ── the five hero frames (one per app pillar) ──
// screen = which faithful app screen to mount (screen1…6 in the base generator)
// tilt   = +1 leans right-edge back, -1 leans left-edge back
const FRAMES = [
  {
    screen: 1, file: '01-live-any-life', tilt: -1,
    pre: 'Live any', word: 'life.', sub: 'Be born, make choices, and write a story that is yours.',
    chips: [
      { ic: 'star', label: 'Age', val: '28', col: 'amber', side: 'L', y: 980 },
      { ic: 'trend', label: 'Net worth', val: '$1.28M', col: 'emerald', side: 'R', y: 1300 },
      { ic: 'smiley', label: 'Happiness', val: '92%', col: 'purple', side: 'L', y: 1720 },
    ],
  },
  {
    screen: 3, file: '02-build-the-empire', tilt: 1,
    pre: 'Build the', word: 'empire.', sub: 'Invest, hustle, and stack your first million.',
    chips: [
      { ic: 'banknote', label: 'Passive income', val: '+$8,400/mo', col: 'emerald', side: 'L', y: 1150 },
      { ic: 'trend', label: 'Bitcoin', val: '▲ 12%', col: 'gold', side: 'R', y: 1480 },
      { ic: 'gem', label: 'Portfolio', val: '$2.4M', col: 'emerald', side: 'L', y: 1770 },
    ],
  },
  {
    screen: 4, file: '03-find-your-person', tilt: -1,
    pre: 'Find your', word: 'person.', sub: 'Swipe, date, marry — every romance is yours to write.',
    chips: [
      { ic: 'heart', label: 'New matches', val: '3', col: 'pink', side: 'L', y: 980 },
      { ic: 'ring', label: 'Charm', val: '88%', col: 'rose', side: 'R', y: 1300 },
      { ic: 'msg', label: 'Unread', val: '5 chats', col: 'blue', side: 'L', y: 1720 },
    ],
  },
  {
    screen: 6, file: '04-go-viral', tilt: 1,
    pre: 'Go', word: 'viral.', sub: 'Post, blow up, and turn your clout into a fortune.',
    chips: [
      { ic: 'users', label: 'Followers', val: '128.4K', col: 'cyan', side: 'L', y: 980 },
      { ic: 'eye', label: 'Views today', val: '1.2M', col: 'sky', side: 'R', y: 1300 },
      { ic: 'flame', label: 'Trending', val: '#1', col: 'orange', side: 'L', y: 1720 },
    ],
  },
  {
    screen: 5, file: '05-leave-a-dynasty', tilt: -1,
    pre: 'Leave a', word: 'dynasty.', sub: 'Your heirs inherit your fortune, your name, your legacy.',
    chips: [
      { ic: 'crown', label: 'Generation', val: '4th', col: 'gold', side: 'L', y: 980 },
      { ic: 'banknote', label: 'Inheritance', val: '$24M', col: 'sky', side: 'R', y: 1300 },
      { ic: 'users', label: 'Bloodline', val: 'Family of 9', col: 'violet', side: 'L', y: 1720 },
    ],
  },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ── hero defs: stronger, depth-cued filters for the floating layer ──
function heroDefs(b) {
  b.def(`<filter id="hglow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="90"/></filter>`);
  b.def(`<filter id="hblur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="26"/></filter>`);
  b.def(`<filter id="devshadow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="60" stdDeviation="70" flood-color="#000" flood-opacity="0.7"/></filter>`);
  b.def(`<filter id="chipshadow" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#000" flood-opacity="0.55"/></filter>`);
  b.def(`<filter id="headglow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="14" flood-color="#000" flood-opacity="0.55"/></filter>`);
}

// ── premium background: gradient + one big accent glow behind the phone ──
function heroBg(b, theme, accent, seed) {
  b.rrect(0, 0, W, H, 0, b.linGrad([[0, theme.bg[0]], [.5, theme.bg[1]], [1, theme.bg[2]]]));
  // big ambient accent glow centred behind the device
  b.add(`<ellipse cx="${CX}" cy="${H * 0.5}" rx="${W * 0.62}" ry="${H * 0.4}" fill="${b.radGrad([[0, accent, .5], [.55, accent, .14], [1, accent, 0]])}" filter="url(#hglow)"/>`);
  // top accent wash so the headline sits on color
  b.add(`<rect x="0" y="0" width="${W}" height="${H * .42}" fill="${b.linGrad([[0, accent, .16], [1, accent, 0]])}"/>`);
  // floor reflection of the glow
  b.add(`<ellipse cx="${CX}" cy="${H * 0.92}" rx="${W * 0.5}" ry="${H * 0.12}" fill="${b.radGrad([[0, accent, .22], [1, accent, 0]])}" filter="url(#hglow)"/>`);
  // sparse star particles
  const r = rng(seed);
  let dots = '';
  for (let i = 0; i < 90; i++) {
    const x = r() * W, y = r() * H, rad = .6 + r() * 2.6, op = .04 + r() * .26;
    dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="#fff" opacity="${op.toFixed(2)}"/>`;
  }
  b.add(dots);
  // vignette
  b.add(`<rect x="0" y="0" width="${W}" height="${H}" fill="${b.radGrad([[0, '#000', 0], [1, '#000', .5]], .5, .46, .8)}"/>`);
}

// ── caption headline (reference voice: lead words + one accent word) ──
function heroHeadline(b, theme, accent, f) {
  const top = 250;
  // kicker pill
  const k = 'DEEPLIFE SIMULATOR';
  const pw = 70 + k.length * 15.5, ph = 54;
  b.rrect(CX - pw / 2, top, pw, ph, ph / 2, b.linGrad([[0, accent, .24], [1, accent, .10]]), { stroke: accent, sw: 1.5 });
  b.add(`<circle cx="${CX - pw / 2 + 28}" cy="${top + ph / 2}" r="5.5" fill="${accent}"/>`);
  b.txt(CX + 14, top + ph / 2 + 8, k, { size: 24, w: 800, fill: theme.head[0], anchor: 'middle', ls: 3 });
  // headline — lead (white) then accent word, on one tight line each
  const hg = b.linGrad([[0, theme.head[0]], [1, theme.head[1]]], 0, 0, 1, 1);
  b.txt(CX, top + 168, f.pre, { size: 104, w: 900, fill: '#F8FAFC', anchor: 'middle', ls: -2, filter: 'url(#headglow)' });
  b.txt(CX, top + 288, f.word, { size: 104, w: 900, fill: hg, anchor: 'middle', ls: -2, filter: 'url(#headglow)' });
  b.txt(CX, top + 360, f.sub, { size: 32, w: 500, fill: 'rgba(226,232,240,0.82)', anchor: 'middle' });
}

// ── floating glass "live" chip that pops forward off the device ──
function heroChip(b, accent, f, c) {
  const col = C[c.col] || accent;
  const wch = 332, hch = 130;
  const x = c.side === 'L' ? 46 : W - 46 - wch;
  const y = c.y;
  // glass body
  b.rrect(x, y, wch, hch, 30, b.linGrad([[0, 'rgba(28,36,62,0.96)'], [1, 'rgba(15,21,40,0.96)']], 0, 0, 1, 1), { filter: 'url(#chipshadow)' });
  b.rrect(x, y, wch, hch, 30, b.linGrad([[0, col, .16], [1, col, .02]], 0, 0, 1, 1));
  b.rrect(x, y, wch, hch, 30, 'none', { stroke: 'rgba(255,255,255,0.16)', sw: 1.5 });
  b.add(`<rect x="${x}" y="${y}" width="${wch}" height="3" rx="1.5" fill="${col}" opacity="0.55"/>`);
  // icon medallion
  const mr = 42, mx = x + 30 + mr, my = y + hch / 2;
  b.add(`<circle cx="${mx}" cy="${my}" r="${mr + 6}" fill="${b.radGrad([[0, col, .55], [1, col, 0]])}" filter="url(#hblur)"/>`);
  b.add(`<circle cx="${mx}" cy="${my}" r="${mr}" fill="${b.linGrad([[0, col, .26], [1, col, .08]], 0, 0, 1, 1)}" stroke="${col}" stroke-width="2"/>`);
  if (c.ic === 'smiley') {
    b.add(`<g transform="translate(${mx - 24},${my - 24})"><circle cx="12" cy="12" r="9.2" fill="none" stroke="${col}" stroke-width="2"/><circle cx="9" cy="10" r="1.05" fill="${col}"/><circle cx="15" cy="10" r="1.05" fill="${col}"/><path d="M8 14.2a4.3 3.4 0 0 0 8 0" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round"/></g>`);
  } else {
    b.icon(c.ic, mx, my, 40, col, { fill: ['heart', 'star', 'crown', 'gem', 'flame', 'bolt'].includes(c.ic) ? col : undefined, sw: 2.2 });
  }
  // text
  const tx = mx + mr + 24;
  b.txt(tx, y + 56, c.label.toUpperCase(), { size: 20, w: 700, fill: 'rgba(175,186,208,0.95)', ls: 1.5 });
  b.txt(tx, y + 102, c.val, { size: 44, w: 900, fill: '#F8FAFC' });
}

// ── tilted device — wrap the reused device body in a 2.5D perspective group ──
function tiltedDevice(theme, dev, dir) {
  const dcx = (dev.geom.PX + dev.geom.PW / 2);
  const dcy = (dev.geom.PY + dev.geom.PH / 2);
  const za = 6.5 * dir;          // z rotation
  const sky = 2.6 * dir;         // vertical shear → "leaning into the page"
  const sx = 0.955, sy = 0.985;  // gentle foreshorten
  const t = `translate(${dcx} ${dcy}) rotate(${za}) skewY(${sky}) scale(${sx} ${sy}) translate(${-dcx} ${-dcy})`;
  return `<g transform="${t}" filter="url(#devshadow)">${dev.body}</g>`;
}

async function buildFrame(f) {
  const dev = await buildDeviceLayer(f.screen);
  const theme = dev.theme;
  const accent = theme.accent;
  const b = screenBuilder();
  heroDefs(b);
  heroBg(b, theme, accent, f.screen * 911 + 17);
  heroHeadline(b, theme, accent, f);
  // device (its own defs carry the screen art, gradients, clips)
  b.def(dev.defs);
  b.add(tiltedDevice(theme, dev, f.tilt));
  // floating chips pop forward, after the device
  for (const c of f.chips) heroChip(b, accent, f, c);
  // footer wordmark
  const fy = H - 120;
  b.txt(CX, fy, 'DeepLife Simulator', { size: 30, w: 800, fill: 'rgba(248,250,252,0.92)', anchor: 'middle', ls: .5 });
  b.txt(CX, fy + 42, 'Live. Build. Love. Legacy.', { size: 23, w: 500, fill: 'rgba(175,186,208,0.85)', anchor: 'middle', ls: 1 });
  return `<svg width="${OW}" height="${OH}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs>${b.defs}</defs>${b.body}</svg>`;
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const files = [];
  for (const f of FRAMES) {
    const svg = await buildFrame(f);
    const file = join(OUT, `${f.file}.png`);
    await sharp(Buffer.from(svg)).png({ quality: 100 }).toFile(file);
    files.push(file);
    console.log('✓', file, `(${OW}×${OH})`);
  }
  // contact sheet
  const tw = 360, th = Math.round(tw * OH / OW), cols = 5;
  const thumbs = [];
  for (let i = 0; i < files.length; i++) {
    const t = await sharp(files[i]).resize(tw, th, { fit: 'inside' }).png().toBuffer();
    thumbs.push({ input: t, left: (i % cols) * (tw + 18) + 14, top: Math.floor(i / cols) * (th + 18) + 14 });
  }
  await sharp({ create: { width: (tw + 18) * cols + 14, height: (th + 18) + 14, channels: 3, background: { r: 9, g: 11, b: 22 } } })
    .composite(thumbs).png().toFile(join(OUT, '_contact-sheet.png'));
  console.log('✓ contact sheet →', OUT);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) main().catch(e => { console.error(e); process.exit(1); });

export { buildFrame };
