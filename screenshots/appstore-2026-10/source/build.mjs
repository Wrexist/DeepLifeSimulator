// App Store set - October 2026 edition, v2 layout.
//
// v1 printed a small cropped panel on an art plate; on iPad the panel sat in a
// sea of empty canvas and the owner called it boring. v2 puts the REAL screen
// in a real device frame (status bar, Dynamic Island, titanium bezel), lets the
// device run off the edge of the canvas, and pops the frame's key moment out
// of the screen at reading size. The art plates and typefaces are reused from
// ../../appstore-2026/source.
//
// Every frame's claims are still asserted against the text of the capture it
// is printed over (Guideline 2.3.3).
//
// Also renders the two Product Page creative assets:
//   final/header/*.png   3840 x 1646 (21:9 header)
//   final/search/*.png   3840 x 2560 (3:2 search results visual)
//
//   node screenshots/appstore-2026-10/source/build.mjs [--ids=01,02] [--devices=iphone-6.9,ipad-13,header,search]
import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const legacy = resolve(root, '../appstore-2026/source');
const assets = join(legacy, 'assets');
const repo = resolve(root, '../..');
writeFileSync(join(here, 'fonts.conf'), `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${assets}</dir><cachedir>${join(here, '.font-cache')}</cachedir></fontconfig>`);
process.env.FONTCONFIG_FILE = join(here, 'fonts.conf');
const require = createRequire(join(legacy, 'build.mjs'));
const sharp = require('sharp');

const board = JSON.parse(readFileSync(join(here, 'storyboard.json'), 'utf8'));
const frames = board.frames;
const metrics = JSON.parse(readFileSync(join(assets, 'font-metrics.json'), 'utf8'));
const cache = new Map();
const uri = (p) => {
  if (!cache.has(p)) cache.set(p, 'data:image/png;base64,' + readFileSync(p).toString('base64'));
  return cache.get(p);
};
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const measure = (s, size, weight = 800) => [...s].reduce((v, c) => v + (metrics[weight][c] || 0.5), 0) * size;
const fit = (lines, max, size, weight = 800) => Math.min(size, ...lines.map((s) => max / measure(s, 1, weight)));

// Text as glyph OUTLINES when opentype.js is available (DLS_FONT_MODULES), so
// the campaign typeface renders on Windows too, where fontconfig falls back to
// a monospace face.
let outlineFonts = null;
try {
  const req = createRequire(join(process.env.DLS_FONT_MODULES || here, 'anchor.js'));
  const ot = req('opentype.js');
  outlineFonts = { 500: ot.loadSync(join(assets, 'DLS500.ttf')), 800: ot.loadSync(join(assets, 'DLS800.ttf')) };
} catch {
  console.warn('opentype.js not found - falling back to <text> (fonts may substitute)');
}
const txt = (s, x, y, size, color = '#FAF5EA', weight = 800, spacing = 0, anchor = 'start') => {
  if (!outlineFonts) {
    return `<text x="${x}" y="${y}" font-family="DLS${weight}" font-size="${size}" fill="${color}" letter-spacing="${spacing}" text-anchor="${anchor}">${esc(s)}</text>`;
  }
  const font = outlineFonts[weight];
  const scale = size / font.unitsPerEm;
  const glyphs = font.stringToGlyphs(String(s));
  let width = 0;
  glyphs.forEach((g, i) => {
    width += g.advanceWidth * scale + spacing;
    if (i < glyphs.length - 1) width += font.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  let cx = anchor === 'middle' ? x - width / 2 : anchor === 'end' ? x - width : x;
  const parts = [];
  glyphs.forEach((g, i) => {
    parts.push(g.getPath(cx, y, size).toPathData(2));
    cx += g.advanceWidth * scale + spacing;
    if (i < glyphs.length - 1) cx += font.getKerningValue(g, glyphs[i + 1]) * scale;
  });
  return `<path d="${parts.join(' ')}" fill="${color}"/>`;
};
const pill = (s, x, y, size, color) => {
  const w = measure(s, size, 800) + 2 * [...s].length + 64;
  return `<g><rect x="${x}" y="${y - size - 18}" width="${w}" height="${size + 36}" rx="${(size + 36) / 2}" fill="#07101C" fill-opacity=".78" stroke="${color}" stroke-opacity=".7" stroke-width="2"/>${txt(s, x + 29, y + 2, size, color, 800, 2)}</g>`;
};

let seq = 0;
const nid = (p) => p + ++seq;

/** Shared <defs>: titanium bezel, shadows, blur. */
const DEFS = (accent) => `
<linearGradient id="ti" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#C9CED6"/><stop offset=".25" stop-color="#5D636D"/><stop offset=".5" stop-color="#9AA1AB"/><stop offset=".75" stop-color="#3E434B"/><stop offset="1" stop-color="#B7BDC6"/></linearGradient>
<linearGradient id="tiAccent" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${accent}"/><stop offset=".35" stop-color="#4A515C"/><stop offset=".7" stop-color="#8C939D"/><stop offset="1" stop-color="#2B3038"/></linearGradient>
<filter id="softShadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="38"/></filter>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="60"/></filter>
<filter id="blurBg" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="14"/></filter>`;

/** Average colour of a capture's top rows - the status bar is painted in it. */
const topColors = new Map();
async function topColor(file) {
  if (!topColors.has(file)) {
    const m = await sharp(file).metadata();
    const st = await sharp(file).extract({ left: 0, top: 0, width: m.width, height: 6 }).stats();
    const hex = st.channels.slice(0, 3).map((c) => Math.round(c.mean).toString(16).padStart(2, '0')).join('');
    topColors.set(file, '#' + hex);
  }
  return topColors.get(file);
}

/**
 * A device showing a capture. `w` is the SCREEN width in canvas px. The screen
 * gets a status bar (and a Dynamic Island on phones) so it reads as a phone,
 * not a web page. Returns { svg, h } where h is the screen height.
 */
function device({ file, srcW, srcH, x, y, w, angle = 0, kind = 'phone', bar = '#0B1220', maxH = Infinity, frameStroke = 'url(#ti)' }) {
  const SB = kind === 'phone' ? Math.round(srcW * 0.118) : Math.round(srcW * 0.034);
  const vbH = srcH + SB;
  const s = w / srcW;
  const h = Math.min(vbH * s, maxH);
  const bz = kind === 'phone' ? w * 0.034 : w * 0.026;
  const r = kind === 'phone' ? w * 0.13 : w * 0.045;
  const id = nid('scr');
  const cx = x + w / 2, cy = y + h / 2;
  const time = kind === 'phone'
    ? `${txt('9:41', srcW * 0.105, SB * 0.66, SB * 0.36, '#FFFFFF', 800)}
       <rect x="${(srcW - srcW * 0.29) / 2}" y="${SB * 0.2}" width="${srcW * 0.29}" height="${SB * 0.62}" rx="${SB * 0.31}" fill="#000"/>`
    : txt('9:41  Mon 11 Oct', srcW * 0.03, SB * 0.7, SB * 0.5, '#FFFFFF', 800);
  const bx = srcW * (kind === 'phone' ? 0.79 : 0.9), by = SB * (kind === 'phone' ? 0.43 : 0.3), bh = SB * (kind === 'phone' ? 0.24 : 0.42);
  const status = `${[0, 1, 2, 3].map((i) => `<rect x="${bx + i * bh * 0.42}" y="${by + bh * (1 - (i + 1) / 4)}" width="${bh * 0.28}" height="${(bh * (i + 1)) / 4}" rx="${bh * 0.06}" fill="#fff"/>`).join('')}
    <rect x="${bx + bh * 2.2}" y="${by}" width="${bh * 2.1}" height="${bh}" rx="${bh * 0.28}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="${bh * 0.09}"/>
    <rect x="${bx + bh * 2.32}" y="${by + bh * 0.14}" width="${bh * 1.6}" height="${bh * 0.72}" rx="${bh * 0.18}" fill="#fff"/>`;
  const buttons = kind === 'phone'
    ? `<rect x="${x - bz - 7}" y="${y + h * 0.17}" width="9" height="${h * 0.05}" rx="4" fill="url(#ti)"/>
       <rect x="${x - bz - 7}" y="${y + h * 0.25}" width="9" height="${h * 0.09}" rx="4" fill="url(#ti)"/>
       <rect x="${x - bz - 7}" y="${y + h * 0.36}" width="9" height="${h * 0.09}" rx="4" fill="url(#ti)"/>
       <rect x="${x + w + bz - 2}" y="${y + h * 0.27}" width="9" height="${h * 0.13}" rx="4" fill="url(#ti)"/>`
    : '';
  const svg = `<g transform="rotate(${angle} ${cx} ${cy})">
    <rect x="${x - bz}" y="${y - bz + 40}" width="${w + 2 * bz}" height="${h + 2 * bz}" rx="${r + bz}" fill="#000" fill-opacity=".7" filter="url(#softShadow)"/>
    ${buttons}
    <rect x="${x - bz}" y="${y - bz}" width="${w + 2 * bz}" height="${h + 2 * bz}" rx="${r + bz}" fill="#07080A" stroke="${frameStroke}" stroke-width="${Math.max(4, w * 0.008)}"/>
    <defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath></defs>
    <g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${w}" height="${vbH * s}" viewBox="0 0 ${srcW} ${vbH}">
      <rect width="${srcW}" height="${SB + 2}" fill="${bar}"/>${time}${status}
      <image href="${uri(file)}" y="${SB}" width="${srcW}" height="${srcH}"/>
    </svg></g>
    <rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4}" rx="${r}" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width="2"/>
  </g>`;
  return { svg, h };
}

/** The frame's key moment, lifted out of the screen at reading size. */
function popout({ file, srcW, srcH, focus, x, y, w, angle = 0, accent }) {
  const [fx, fy, fw, fh] = focus;
  const h = (w * fh) / fw;
  const id = nid('pop');
  const r = Math.min(56, w * 0.05);
  return {
    h,
    svg: `<g transform="rotate(${angle} ${x + w / 2} ${y + h / 2})">
    <rect x="${x - 30}" y="${y - 30}" width="${w + 60}" height="${h + 60}" rx="${r + 30}" fill="${accent}" fill-opacity=".38" filter="url(#glow)"/>
    <rect x="${x}" y="${y + 36}" width="${w}" height="${h}" rx="${r}" fill="#000" fill-opacity=".8" filter="url(#softShadow)"/>
    <defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"/></clipPath></defs>
    <g clip-path="url(#${id})"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0B1220"/><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${focus.join(' ')}" overflow="hidden"><image href="${uri(file)}" width="${srcW}" height="${srcH}"/></svg></g>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="none" stroke="${accent}" stroke-opacity=".9" stroke-width="5"/>
  </g>`,
  };
}

const SIZES = [
  { id: 'iphone-6.9', w: 1320, h: 2868 },
  { id: 'iphone-6.5', w: 1284, h: 2778 },
  { id: 'ipad-13', w: 2064, h: 2752, pad: true },
];

async function renderFrame(f, size) {
  const pad = !!size.pad;
  const W = pad ? 2064 : 1320;
  const H = pad ? 2752 : (size.h * 1320) / size.w;
  const art = join(legacy, 'art', f.art + '.png');
  const file = join(root, 'captures', pad ? 'ipad' : 'phone', f.shot + '.png');
  const [srcW, srcH] = pad ? [2048, 2732] : [1290, 2796];
  const accent = f.accent;
  const bar = await topColor(file);
  const p = [`<svg xmlns="http://www.w3.org/2000/svg" width="${size.w}" height="${size.h}" viewBox="0 0 ${W} ${H}"><defs>${DEFS(accent)}
    <linearGradient id="shade" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#020610" stop-opacity=".78"/><stop offset=".26" stop-color="#020610" stop-opacity=".2"/><stop offset=".6" stop-color="#020610" stop-opacity=".1"/><stop offset="1" stop-color="#020610" stop-opacity=".75"/></linearGradient>
    <radialGradient id="aura" cx=".5" cy=".5" r=".5"><stop stop-color="${accent}" stop-opacity=".5"/><stop offset="1" stop-color="${accent}" stop-opacity="0"/></radialGradient>
  </defs><rect width="100%" height="100%" fill="#080D17"/>`];

  if (pad) {
    // The plates are 851 px wide: full-bleed on a 2064 canvas would be soft,
    // so the plate is blurred on purpose and becomes atmosphere.
    p.push(`<image href="${uri(art)}" x="-80" y="-80" width="${W + 160}" height="${H + 160}" preserveAspectRatio="xMidYMid slice" filter="url(#blurBg)"/><rect width="${W}" height="${H}" fill="#050A14" fill-opacity=".38"/>`);
  } else {
    p.push(`<image href="${uri(art)}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  }
  p.push(`<rect width="${W}" height="${H}" fill="url(#shade)"/>`);

  const margin = pad ? 120 : 88;
  p.push(txt('DEEP LIFE', margin, 112, pad ? 42 : 36, '#FAF5EA', 800, 4), txt('SIMULATOR', margin + measure('DEEP LIFE', pad ? 42 : 36) + (pad ? 66 : 52), 112, pad ? 30 : 26, '#E0D6C5', 500, 4));
  const fs = fit(f.title, pad ? 1820 : 1150, pad ? 236 : 190);
  f.title.forEach((s, i) => p.push(txt(s, margin, (pad ? 330 : 312) + i * fs * 0.96, fs, i ? accent : '#FAF5EA')));
  const subY = (pad ? 330 : 312) + (f.title.length - 1) * fs * 0.96 + (pad ? 120 : 104);
  p.push(txt(f.sub, margin, subY, fit([f.sub], pad ? 1800 : 1140, pad ? 52 : 44, 500), '#F5EDE1', 500));

  const dev = pad
    ? { w: 1480, x: W - 1480 - 130, y: 1010, angle: 0 }
    : { w: 850, x: W - 850 - 64, y: 1010, angle: f.tilt ?? -3 };
  p.push(`<ellipse cx="${dev.x + dev.w / 2}" cy="${dev.y + 700}" rx="${dev.w * 0.95}" ry="${dev.w * 1.1}" fill="url(#aura)"/>`);
  p.push(device({ file, srcW, srcH, ...dev, kind: pad ? 'pad' : 'phone', bar, frameStroke: 'url(#tiAccent)' }).svg);

  const focus = pad ? f.focusPad : f.focus;
  const pw = pad ? (f.popWPad ?? 1260) : (f.popW ?? 1000);
  const ph = (pw * focus[3]) / focus[2];
  let py = pad ? (f.popYPad ?? 1560) : (f.popY ?? 1640);
  py = Math.min(py, H - (pad ? 240 : 190) - ph);
  p.push(popout({ file, srcW, srcH, focus, x: pad ? 110 : 52, y: py, w: pw, angle: pad ? -1.5 : 2, accent }).svg);

  p.push(pill(f.proof, margin, subY + (pad ? 130 : 112), pad ? 32 : 27, accent));
  p.push(pill(f.category, margin, H - (pad ? 80 : 58), pad ? 30 : 23, accent));
  if (!pad) p.push(txt(f.id.slice(0, 2), W - 90, H - 54, 26, '#DFD8CD', 500, 2, 'end'));
  p.push('</svg>');
  return p.join('');
}

// ---------------------------------------------------------------------------
// Product Page creative assets. Apple crops and overlays the header per
// device, so everything that matters sits inside SAFE, and the edges carry
// only atmosphere.
// ---------------------------------------------------------------------------
const icon = join(repo, 'assets/images/icon.png');

function mosaic(W, H, plates) {
  const pw = W / plates.length;
  return plates.map((a, i) => `<image href="${uri(join(legacy, 'art', a + '.png'))}" x="${i * pw - 40}" y="-60" width="${pw + 80}" height="${H + 120}" preserveAspectRatio="xMidYMid slice" filter="url(#blurBg)"/>`).join('');
}

async function phoneTrio(shots, { cx, y, w, spread, tilt, sideScale = 0.86, maxH }) {
  const out = [];
  const order = [0, 2, 1]; // sides first, centre on top
  for (const i of order) {
    const file = join(root, 'captures', 'phone', shots[i] + '.png');
    const bar = await topColor(file);
    const side = i === 1 ? 0 : i === 0 ? -1 : 1;
    const sw = side ? w * sideScale : w;
    const x = cx - sw / 2 + side * spread;
    out.push(device({ file, srcW: 1290, srcH: 2796, x, y: y + (side ? w * 0.12 : 0), w: sw, angle: side * tilt, kind: 'phone', bar, maxH: side ? maxH * sideScale : maxH }).svg);
  }
  return out.join('');
}

async function renderHeader(v) {
  const W = 3840, H = 1646;
  const SAFE = { x0: 560, x1: 3280, y0: 190, y1: 1456 };
  const p = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${DEFS(v.accent)}
    <linearGradient id="hl" x1="0" x2="1"><stop stop-color="#040812" stop-opacity=".92"/><stop offset=".45" stop-color="#040812" stop-opacity=".55"/><stop offset="1" stop-color="#040812" stop-opacity=".35"/></linearGradient>
    <radialGradient id="aura" cx=".5" cy=".5" r=".5"><stop stop-color="${v.accent}" stop-opacity=".55"/><stop offset="1" stop-color="${v.accent}" stop-opacity="0"/></radialGradient>
    <linearGradient id="vig" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#040812" stop-opacity=".6"/><stop offset=".3" stop-color="#040812" stop-opacity="0"/><stop offset=".7" stop-color="#040812" stop-opacity="0"/><stop offset="1" stop-color="#040812" stop-opacity=".7"/></linearGradient>
    <clipPath id="iconClip"><rect x="${SAFE.x0 + 40}" y="330" width="150" height="150" rx="34"/></clipPath>
  </defs><rect width="${W}" height="${H}" fill="#060B16"/>${mosaic(W, H, v.plates)}<rect width="${W}" height="${H}" fill="url(#hl)"/><rect width="${W}" height="${H}" fill="url(#vig)"/>`];
  if (v.layout === 'center') {
    // Crop-proof: everything stacks on the vertical centre line, so any
    // centred crop Apple applies keeps the name, the headline and the phones.
    p.push(`<ellipse cx="${W / 2}" cy="${H * 0.75}" rx="1100" ry="560" fill="url(#aura)"/>`);
    const iconX = W / 2 - (measure('Deep Life Simulator', 54) + 130) / 2;
    p.push(`<defs><clipPath id="iconC"><rect x="${iconX}" y="${SAFE.y0 + 20}" width="104" height="104" rx="24"/></clipPath></defs><image href="${uri(icon)}" x="${iconX}" y="${SAFE.y0 + 20}" width="104" height="104" clip-path="url(#iconC)"/>`);
    p.push(txt('Deep Life Simulator', iconX + 130, SAFE.y0 + 92, 54, '#FAF5EA', 800, 1));
    const line = v.title.join(' ');
    const fs = fit([line], 2300, 160);
    const lw = measure(line, fs);
    const ax = W / 2 - lw / 2;
    p.push(txt(v.title[0], ax, SAFE.y0 + 330, fs), txt(v.title[1], ax + measure(v.title[0] + ' ', fs), SAFE.y0 + 330, fs, v.accent));
    p.push(await phoneTrio(v.shots, { cx: W / 2, y: SAFE.y0 + 430, w: 440, spread: 520, tilt: 8, maxH: 960 }));
    p.push('</svg>');
    return p.join('');
  }
  const cx = 2560;
  p.push(`<ellipse cx="${cx}" cy="${H / 2}" rx="900" ry="640" fill="url(#aura)"/>`);
  p.push(await phoneTrio(v.shots, { cx, y: 250, w: 520, spread: 470, tilt: 9, maxH: 1180 }));
  const tx = SAFE.x0 + 40;
  p.push(`<image href="${uri(icon)}" x="${tx}" y="330" width="150" height="150" clip-path="url(#iconClip)"/>`);
  p.push(txt('Deep Life Simulator', tx + 190, 425, 64, '#FAF5EA', 800, 1));
  const fs = fit(v.title, 1260, 176);
  v.title.forEach((s, i) => p.push(txt(s, tx, 700 + i * fs * 0.98, fs, i ? v.accent : '#FAF5EA')));
  p.push(txt(v.sub, tx, 700 + (v.title.length - 1) * fs * 0.98 + 130, fit([v.sub], 1250, 54, 500), '#E9E2D6', 500));
  p.push('</svg>');
  return p.join('');
}

async function renderSearch(v) {
  const W = 3840, H = 2560;
  const p = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${DEFS(v.accent)}
    <linearGradient id="hl" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#040812" stop-opacity=".9"/><stop offset=".35" stop-color="#040812" stop-opacity=".45"/><stop offset="1" stop-color="#040812" stop-opacity=".55"/></linearGradient>
    <radialGradient id="aura" cx=".5" cy=".5" r=".5"><stop stop-color="${v.accent}" stop-opacity=".55"/><stop offset="1" stop-color="${v.accent}" stop-opacity="0"/></radialGradient>
    <clipPath id="iconClip"><rect x="${W / 2 - 420}" y="170" width="120" height="120" rx="28"/></clipPath>
  </defs><rect width="${W}" height="${H}" fill="#060B16"/>${mosaic(W, H, v.plates)}<rect width="${W}" height="${H}" fill="url(#hl)"/>`];
  p.push(`<image href="${uri(icon)}" x="${W / 2 - 420}" y="170" width="120" height="120" clip-path="url(#iconClip)"/>`);
  p.push(txt('Deep Life Simulator', W / 2 - 270, 255, 62, '#FAF5EA', 800, 1));
  const line = v.title.join(' ');
  const fs = fit([line], 3100, 230);
  const lw = measure(line, fs);
  const [a, b] = v.title;
  const ax = W / 2 - lw / 2;
  p.push(txt(a, ax, 560, fs), txt(b, ax + measure(a + ' ', fs), 560, fs, v.accent));
  p.push(txt(v.sub, W / 2, 700, 64, '#E9E2D6', 500, 0, 'middle'));
  p.push(`<ellipse cx="${W / 2}" cy="1750" rx="1350" ry="900" fill="url(#aura)"/>`);
  p.push(await phoneTrio(v.shots, { cx: W / 2, y: 880, w: 800, spread: 930, tilt: 7, maxH: 1700 }));
  p.push('</svg>');
  return p.join('');
}

async function write(out, svg) {
  mkdirSync(dirname(out), { recursive: true });
  const png = await sharp(Buffer.from(svg)).flatten({ background: '#080D17' }).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
  writeFileSync(out + '.tmp', png);
  renameSync(out + '.tmp', out);
  console.log('Rendered', out.slice(root.length + 1));
}

const ids = process.argv.find((a) => a.startsWith('--ids='))?.slice(6).split(',');
const devices = process.argv.find((a) => a.startsWith('--devices='))?.slice(10).split(',');
const want = (d) => !devices || devices.includes(d);
const norm = (s) => s.toLowerCase().replace(/\s+/g, '');
const assertClaims = (label, shot, kind, checks) => {
  const evidencePath = join(root, 'captures', kind, shot + '.txt');
  if (!existsSync(evidencePath)) throw new Error(`Missing capture ${kind}/${shot}`);
  const evidence = norm(readFileSync(evidencePath, 'utf8'));
  for (const claim of checks ?? []) {
    if (!evidence.includes(norm(claim))) throw new Error(`${label} claims "${claim}" but capture ${kind}/${shot} does not show it`);
  }
};

for (const f of frames.filter((x) => !ids || ids.includes(x.id.slice(0, 2)))) {
  for (const size of SIZES.filter((s) => want(s.id))) {
    assertClaims(`Frame ${f.id} (${size.id})`, f.shot, size.pad ? 'ipad' : 'phone', f.checks);
    await write(join(root, 'final', size.id, f.id + '.png'), await renderFrame(f, size));
  }
}
for (const v of board.header ?? []) {
  if (!want('header') || (ids && !ids.includes(v.id))) continue;
  for (const s of v.shots) assertClaims(`Header ${v.id}`, s, 'phone', []);
  await write(join(root, 'final', 'header', `header-${v.id}.png`), await renderHeader(v));
}
for (const v of board.search ?? []) {
  if (!want('search') || (ids && !ids.includes(v.id))) continue;
  await write(join(root, 'final', 'search', `search-${v.id}.png`), await renderSearch(v));
}
