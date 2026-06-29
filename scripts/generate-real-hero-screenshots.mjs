/**
 * DeepLife Simulator — "Real Hero" App Store Screenshots
 * ------------------------------------------------------
 * Wraps the ACTUAL captured app screens (screenshots/iphone-real/*.png, grabbed
 * from the running app with an impressive seeded profile) in the premium hero
 * treatment: a titanium iPhone tilted in 3D, ambient accent glow, a bold caption,
 * and floating glass chips whose numbers MATCH what's on the real screen.
 *
 * Genuine UI (Apple 2.3.3-safe) + 3D immersion + satisfying numbers.
 *
 * Prereq: run scripts/capture-real-screenshots.mjs first (seeded build).
 * Run:    node scripts/generate-real-hero-screenshots.mjs
 * Out:    screenshots/iphone-real-hero/01…05-*.png  (+ contact sheet)
 */
import { createRequire } from 'module';
import { readFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Buffer } from 'node:buffer';
import { screenBuilder, THEMES, C } from './generate-app-store-screenshots.mjs';

const require = createRequire(import.meta.url);
// Loaded lazily so `buildFrame` can be imported without pulling in the native
// `sharp` dependency (only the rasterizing main() actually needs it).
function loadSharp() {
  try { return require('sharp'); }
  catch { return require('/tmp/shottest/node_modules/sharp'); }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REAL = join(ROOT, 'screenshots', 'iphone-real');
const OUT = join(ROOT, 'screenshots', 'iphone-real-hero');

// device-space canvas (export to Apple 6.5")
const W = 1290, H = 2796, CX = W / 2;
const OW = 1284, OH = 2778;
// device + screen geometry (matches the synthetic hero look)
const PW = 860, PH = 1812, PX = (W - PW) / 2, PY = 770, PR = 118, BB = 22;
const SX = PX + BB, SY = PY + BB, SW = PW - 2 * BB, SH = PH - 2 * BB, SR = 96;
const SCX = SX + SW / 2, SBOT = SY + SH;

// Each frame: a real capture + caption + accent + chips that match the screen.
const FRAMES = [
  {
    img: '01-life-home.png', file: '01-live-any-life', theme: 1, tilt: -1,
    pre: 'Live any', word: 'life.', sub: 'Be born, make choices, and write a story that is yours.',
    chips: [
      { ic: 'star', label: 'Career', val: 'Chief of Medicine', col: 'amber', side: 'L', y: 980 },
      { ic: 'trend', label: 'Net worth', val: '$4.80M', col: 'emerald', side: 'R', y: 1300 },
      { ic: 'gem', label: 'Gems', val: '3,200', col: 'purple', side: 'L', y: 1720 },
    ],
  },
  {
    img: '02-work.png', file: '02-hustle-and-rise', theme: 2, tilt: 1,
    pre: 'Hustle &', word: 'rise.', sub: 'Grind side jobs or climb a career — from the streets to CEO.',
    chips: [
      { ic: 'briefcase', label: 'Dozens of jobs', val: 'Street → CEO', col: 'amber', side: 'L', y: 1050 },
      { ic: 'banknote', label: 'Weekly income', val: '+$4,800', col: 'gold', side: 'R', y: 1420 },
      { ic: 'bolt', label: 'Side hustles', val: 'Earn daily', col: 'amber', side: 'L', y: 1760 },
    ],
  },
  {
    img: '04-market.png', file: '03-build-the-empire', theme: 3, tilt: -1,
    pre: 'Build the', word: 'empire.', sub: 'Invest, spend, and turn a fortune into an empire.',
    chips: [
      { ic: 'banknote', label: 'Cash to spend', val: '$4.8M', col: 'emerald', side: 'L', y: 1050 },
      { ic: 'cart', label: 'Buy anything', val: 'Cars · Homes', col: 'gold', side: 'R', y: 1420 },
      { ic: 'gem', label: 'Net worth', val: '$4.80M', col: 'emerald', side: 'L', y: 1760 },
    ],
  },
  {
    img: '03-phone.png', file: '04-go-viral', theme: 6, tilt: 1,
    pre: 'Go', word: 'viral.', sub: 'Date, post, and invest — a whole phone inside your life.',
    chips: [
      { ic: 'heart', label: 'Dating app', val: 'Find your match', col: 'pink', side: 'L', y: 1050 },
      { ic: 'spark', label: 'Social feed', val: 'Go viral', col: 'cyan', side: 'R', y: 1420 },
      { ic: 'trend', label: 'Trade & invest', val: 'Stocks · Crypto', col: 'sky', side: 'L', y: 1760 },
    ],
  },
  {
    img: '05-health.png', file: '05-live-well', theme: 4, tilt: -1,
    pre: 'Live', word: 'well.', sub: 'Train, rest, and stay alive — your body keeps the score.',
    chips: [
      { ic: 'heart', label: 'Stay healthy', val: 'Mind & body', col: 'rose', side: 'L', y: 1050 },
      { ic: 'bolt', label: 'Activities', val: 'Gym · Yoga · Spa', col: 'pink', side: 'R', y: 1420 },
      { ic: 'star', label: 'Wellbeing', val: 'Feel alive', col: 'rose', side: 'L', y: 1760 },
    ],
  },
];

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

function heroDefs(b) {
  b.def(`<filter id="hglow" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="90"/></filter>`);
  b.def(`<filter id="hblur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="26"/></filter>`);
  b.def(`<filter id="devshadow" x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="60" stdDeviation="70" flood-color="#000" flood-opacity="0.7"/></filter>`);
  b.def(`<filter id="chipshadow" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="22" stdDeviation="28" flood-color="#000" flood-opacity="0.55"/></filter>`);
  b.def(`<filter id="headglow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="14" flood-color="#000" flood-opacity="0.55"/></filter>`);
}

function heroBg(b, theme, accent, seed) {
  b.rrect(0, 0, W, H, 0, b.linGrad([[0, theme.bg[0]], [.5, theme.bg[1]], [1, theme.bg[2]]]));
  b.add(`<ellipse cx="${CX}" cy="${H * 0.5}" rx="${W * 0.62}" ry="${H * 0.4}" fill="${b.radGrad([[0, accent, .5], [.55, accent, .14], [1, accent, 0]])}" filter="url(#hglow)"/>`);
  b.add(`<rect x="0" y="0" width="${W}" height="${H * .42}" fill="${b.linGrad([[0, accent, .16], [1, accent, 0]])}"/>`);
  b.add(`<ellipse cx="${CX}" cy="${H * 0.92}" rx="${W * 0.5}" ry="${H * 0.12}" fill="${b.radGrad([[0, accent, .22], [1, accent, 0]])}" filter="url(#hglow)"/>`);
  const r = rng(seed); let dots = '';
  for (let i = 0; i < 90; i++) { const x = r() * W, y = r() * H, rad = .6 + r() * 2.6, op = .04 + r() * .26; dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad.toFixed(1)}" fill="#fff" opacity="${op.toFixed(2)}"/>`; }
  b.add(dots);
  b.add(`<rect x="0" y="0" width="${W}" height="${H}" fill="${b.radGrad([[0, '#000', 0], [1, '#000', .5]], .5, .46, .8)}"/>`);
}

function heroHeadline(b, theme, accent, f) {
  const top = 230;
  const k = 'DEEPLIFE SIMULATOR';
  const pw = 70 + k.length * 15.5, ph = 54;
  b.rrect(CX - pw / 2, top, pw, ph, ph / 2, b.linGrad([[0, accent, .24], [1, accent, .10]]), { stroke: accent, sw: 1.5 });
  b.add(`<circle cx="${CX - pw / 2 + 28}" cy="${top + ph / 2}" r="5.5" fill="${accent}"/>`);
  b.txt(CX + 14, top + ph / 2 + 8, k, { size: 24, w: 800, fill: theme.head[0], anchor: 'middle', ls: 3 });
  const hg = b.linGrad([[0, theme.head[0]], [1, theme.head[1]]], 0, 0, 1, 1);
  b.txt(CX, top + 168, f.pre, { size: 104, w: 900, fill: '#F8FAFC', anchor: 'middle', ls: -2, filter: 'url(#headglow)' });
  b.txt(CX, top + 288, f.word, { size: 104, w: 900, fill: hg, anchor: 'middle', ls: -2, filter: 'url(#headglow)' });
  b.txt(CX, top + 360, f.sub, { size: 31, w: 500, fill: 'rgba(226,232,240,0.82)', anchor: 'middle' });
}

function heroChip(b, accent, c) {
  const col = C[c.col] || accent;
  const wch = c.val.length > 12 ? 408 : 340, hch = 130;
  const x = c.side === 'L' ? 46 : W - 46 - wch;
  const y = c.y;
  b.rrect(x, y, wch, hch, 30, b.linGrad([[0, 'rgba(28,36,62,0.96)'], [1, 'rgba(15,21,40,0.96)']], 0, 0, 1, 1), { filter: 'url(#chipshadow)' });
  b.rrect(x, y, wch, hch, 30, b.linGrad([[0, col, .16], [1, col, .02]], 0, 0, 1, 1));
  b.rrect(x, y, wch, hch, 30, 'none', { stroke: 'rgba(255,255,255,0.16)', sw: 1.5 });
  b.add(`<rect x="${x}" y="${y}" width="${wch}" height="3" rx="1.5" fill="${col}" opacity="0.55"/>`);
  const mr = 42, mx = x + 30 + mr, my = y + hch / 2;
  b.add(`<circle cx="${mx}" cy="${my}" r="${mr + 6}" fill="${b.radGrad([[0, col, .55], [1, col, 0]])}" filter="url(#hblur)"/>`);
  b.add(`<circle cx="${mx}" cy="${my}" r="${mr}" fill="${b.linGrad([[0, col, .26], [1, col, .08]], 0, 0, 1, 1)}" stroke="${col}" stroke-width="2"/>`);
  b.icon(c.ic, mx, my, 40, col, { fill: ['heart', 'star', 'crown', 'gem', 'flame', 'bolt', 'spark'].includes(c.ic) ? col : undefined, sw: 2.2 });
  const tx = mx + mr + 22;
  b.txt(tx, y + 54, c.label.toUpperCase(), { size: 19, w: 700, fill: 'rgba(175,186,208,0.95)', ls: 1.5 });
  b.txt(tx, y + 100, c.val, { size: c.val.length > 12 ? 34 : 42, w: 900, fill: '#F8FAFC' });
}

// Build the device: bezel + the real capture clipped into the screen, tilted.
function tiltedDevice(b, accent, imgUri, dir) {
  const dcx = PX + PW / 2, dcy = PY + PH / 2;
  const za = 6.5 * dir, sky = 2.6 * dir, sx = 0.955, sy = 0.985;
  const sb = screenBuilder();
  // ambient device glow
  sb.add(`<ellipse cx="${CX}" cy="${PY + PH * 0.42}" rx="${PW * 0.72}" ry="${PH * 0.46}" fill="${sb.radGrad([[0, accent, .55], [1, accent, 0]])}" filter="url(#hglow)" opacity="0.55"/>`);
  // titanium body + bezel
  sb.rrect(PX, PY, PW, PH, PR, '#05060c');
  const bezel = sb.linGrad([[0, '#33384a'], [.5, '#0e1018'], [1, '#2a2f40']], 0, 0, 1, 1);
  sb.rrect(PX - 1, PY - 1, PW + 2, PH + 2, PR + 1, 'none', { stroke: bezel, sw: 3 });
  // the REAL captured screen
  const clip = sb.clipRound(SX, SY, SW, SH, SR);
  sb.rrect(SX, SY, SW, SH, SR, '#0b0b14');
  sb.img(imgUri, SX, SY, SW, SH, { clip, par: 'xMidYMid slice' });
  sb.add(`<rect x="${SX}" y="${SY}" width="${SW}" height="${SH}" rx="${SR}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`);
  // dynamic island + home indicator
  sb.rrect(SCX - 64, SY + 20, 128, 36, 18, '#000');
  sb.add(`<circle cx="${SCX + 40}" cy="${SY + 38}" r="6" fill="#0b0b14"/><circle cx="${SCX + 40}" cy="${SY + 38}" r="3" fill="#1c2740"/>`);
  sb.rrect(SCX - 64, SBOT - 26, 128, 6, 3, 'rgba(255,255,255,0.5)');
  b.def(sb.defs);
  const t = `translate(${dcx} ${dcy}) rotate(${za}) skewY(${sky}) scale(${sx} ${sy}) translate(${-dcx} ${-dcy})`;
  b.add(`<g transform="${t}" filter="url(#devshadow)">${sb.body}</g>`);
}

async function buildFrame(f) {
  const theme = THEMES[f.theme];
  const accent = theme.accent;
  const buf = await readFile(join(REAL, f.img));
  const imgUri = `data:image/png;base64,${buf.toString('base64')}`;
  const b = screenBuilder();
  heroDefs(b);
  heroBg(b, theme, accent, f.theme * 911 + 17);
  heroHeadline(b, theme, accent, f);
  tiltedDevice(b, accent, imgUri, f.tilt);
  for (const c of f.chips) heroChip(b, accent, c);
  const fy = H - 120;
  b.txt(CX, fy, 'DeepLife Simulator', { size: 30, w: 800, fill: 'rgba(248,250,252,0.92)', anchor: 'middle', ls: .5 });
  b.txt(CX, fy + 42, 'Live. Build. Love. Legacy.', { size: 23, w: 500, fill: 'rgba(175,186,208,0.85)', anchor: 'middle', ls: 1 });
  return `<svg width="${OW}" height="${OH}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg"><defs>${b.defs}</defs>${b.body}</svg>`;
}

async function main() {
  const sharp = loadSharp();
  await mkdir(OUT, { recursive: true });
  const files = [];
  for (const f of FRAMES) {
    const svg = await buildFrame(f);
    const file = join(OUT, `${f.file}.png`);
    await sharp(Buffer.from(svg)).png({ quality: 100 }).toFile(file);
    files.push(file);
    console.log('✓', file, `(${OW}×${OH})`);
  }
  const tw = 360, th = Math.round(tw * OH / OW), cols = 5;
  const thumbs = [];
  for (let i = 0; i < files.length; i++) {
    const t = await sharp(files[i]).resize(tw, th, { fit: 'inside' }).png().toBuffer();
    thumbs.push({ input: t, left: (i % cols) * (tw + 18) + 14, top: 14 });
  }
  await sharp({ create: { width: (tw + 18) * cols + 14, height: th + 28, channels: 3, background: { r: 9, g: 11, b: 22 } } })
    .composite(thumbs).png().toFile(join(OUT, '_contact-sheet.png'));
  console.log('✓ contact sheet →', OUT);
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main().catch(e => { console.error(e); process.exit(1); });

export { buildFrame };
