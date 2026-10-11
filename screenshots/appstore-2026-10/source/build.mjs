// App Store set - October 2026 edition.
//
// Same visual system as the September immersive edition (its art plates,
// typefaces, framed device panel and shading are reused from
// ../../appstore-2026/source), rebuilt on fresh captures of the shipping UI
// and re-sequenced so the first three frames sell the game on their own in a
// search result. Every frame's claims are asserted against the text of the
// capture it is printed over, so the store never says something the picture
// cannot show (Guideline 2.3.3).
//
//   node screenshots/appstore-2026-10/source/build.mjs [--ids=01,02] [--devices=iphone-6.9]
import { Buffer } from 'node:buffer';
import { readFileSync, writeFileSync, mkdirSync, renameSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const legacy = resolve(root, '../appstore-2026/source');
const assets = join(legacy, 'assets');
writeFileSync(join(here, 'fonts.conf'), `<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd"><fontconfig><dir>${assets}</dir><cachedir>${join(here, '.font-cache')}</cachedir></fontconfig>`);
process.env.FONTCONFIG_FILE = join(here, 'fonts.conf');
const require = createRequire(join(legacy, 'build.mjs'));
const sharp = require('sharp');

const frames = JSON.parse(readFileSync(join(here, 'storyboard.json'), 'utf8'));
const metrics = JSON.parse(readFileSync(join(assets, 'font-metrics.json'), 'utf8'));
const esc = (s) => String(s).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const cache = new Map();
const uri = (p) => {
  if (!cache.has(p)) cache.set(p, 'data:image/png;base64,' + readFileSync(p).toString('base64'));
  return cache.get(p);
};
const measure = (s, size, weight = 800) => [...s].reduce((v, c) => v + (metrics[weight][c] || 0.5), 0) * size;
const fit = (lines, max, size, weight = 800) => Math.min(size, ...lines.map((s) => max / measure(s, 1, weight)));
// Text is drawn as glyph OUTLINES when opentype.js is available, so the
// headline always renders in the campaign typeface. As plain <text> it depends
// on the renderer finding the font through fontconfig, which works on Linux CI
// and silently falls back to a monospace face on Windows. Point
// DLS_FONT_MODULES at a node_modules folder containing opentype.js.
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
  const w = measure(s, size * 0.58, 800) + 54;
  return `<g><rect x="${x}" y="${y - size - 17}" width="${w}" height="${size + 34}" rx="${(size + 34) / 2}" fill="#07101C" fill-opacity=".74" stroke="${color}" stroke-opacity=".6"/>${txt(s, x + 27, y + 2, size, color, 800, 2)}</g>`;
};

let seq = 0;
/** A framed device panel showing `crop` of `file` (x, y, w, h in capture pixels). */
function panel(file, x, y, w, crop, srcW, srcH, angle = 0) {
  const id = 'c' + ++seq;
  const h = (w * crop[3]) / crop[2];
  return `<g transform="rotate(${angle} ${x + w / 2} ${y + h / 2})"><rect x="${x - 26}" y="${y - 24}" width="${w + 52}" height="${h + 48}" rx="66" fill="#02050A" fill-opacity=".78" filter="url(#shadow)"/><rect x="${x - 9}" y="${y - 9}" width="${w + 18}" height="${h + 18}" rx="50" fill="#111925" stroke="url(#metal)" stroke-width="4"/><defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="41"/></clipPath></defs><g clip-path="url(#${id})"><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${crop.join(' ')}" overflow="hidden"><image href="${uri(file)}" width="${srcW}" height="${srcH}"/></svg></g></g>`;
}

const SIZES = [
  { id: 'iphone-6.9', w: 1320, h: 2868 },
  { id: 'iphone-6.5', w: 1284, h: 2778 },
  { id: 'ipad-13', w: 2064, h: 2752, pad: true },
];

function render(f, size) {
  const pad = !!size.pad;
  const W = pad ? 2064 : 1320;
  const H = pad ? 2752 : (size.h * 1320) / size.w;
  const art = join(legacy, 'art', f.art + '.png');
  const capDir = join(root, 'captures', pad ? 'ipad' : 'phone');
  const file = join(capDir, f.shot + '.png');
  const [srcW, srcH] = pad ? [2048, 2732] : [1290, 2796];
  const crop = (pad ? f.cropPad : f.crop) || [0, 0, srcW, srcH];
  const accent = f.accent;
  const p = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.w}" height="${size.h}" viewBox="0 0 ${W} ${H}"><defs>`,
    `<linearGradient id="shade" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#020610" stop-opacity=".62"/><stop offset=".2" stop-color="#020610" stop-opacity=".12"/><stop offset=".55" stop-color="#020610" stop-opacity="0"/><stop offset="1" stop-color="#020610" stop-opacity=".55"/></linearGradient>`,
    `<linearGradient id="headlineGlow" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#020610" stop-opacity=".74"/><stop offset="1" stop-color="#020610" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="metal" x1="0" x2="1" y1="0" y2="1"><stop stop-color="${accent}" stop-opacity=".95"/><stop offset=".34" stop-color="#394454"/><stop offset=".68" stop-color="#7C8794"/><stop offset="1" stop-color="#111724"/></linearGradient>`,
    `<filter id="shadow" x="-40%" y="-30%" width="180%" height="170%"><feGaussianBlur stdDeviation="30"/></filter>`,
    `<linearGradient id="side"><stop stop-color="#080D17" stop-opacity="0"/><stop offset=".95" stop-color="#080D17" stop-opacity=".9"/></linearGradient>`,
    `</defs><rect width="100%" height="100%" fill="#080D17"/>`,
  ];
  if (pad) p.push(`<image href="${uri(art)}" x="0" y="0" width="1268" height="2752" preserveAspectRatio="xMidYMid slice"/><rect width="2064" height="2752" fill="url(#side)"/>`);
  else p.push(`<image href="${uri(art)}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>`);
  p.push(`<rect width="${W}" height="${H}" fill="url(#shade)"/><rect width="${W}" height="${pad ? 1000 : 940}" fill="url(#headlineGlow)"/>`);

  const margin = pad ? 112 : 90;
  p.push(txt('DEEP LIFE', margin, 104, pad ? 39 : 35, '#FAF5EA', 800, 4), txt('SIMULATOR', pad ? 388 : 334, 104, pad ? 28 : 25, '#E0D6C5', 500, 4));
  const fs = fit(f.title, pad ? 1820 : 1150, pad ? 184 : 176);
  f.title.forEach((s, i) => p.push(txt(s, margin, 300 + i * fs * 0.98, fs, i ? accent : '#FAF5EA')));
  const subY = 300 + f.title.length * fs * 0.98 + 44;
  p.push(txt(f.sub, margin, subY, fit([f.sub], pad ? 1800 : 1150, pad ? 46 : 42, 500), '#F5EDE1', 500));

  if (pad) {
    // Size the panel to the crop: as large as fits (up to 1300 wide, 1760
    // tall), right-aligned. A fixed 980 panel shrank full-width tablet screens
    // to unreadable text.
    const cap = crop[2] < 1200 ? 1100 : 1300;
    const w = Math.min(cap, (1760 * crop[2]) / crop[3]);
    const x = 2064 - 112 - w, y = 900;
    p.push(pill(f.proof, x, 840, 29, accent));
    p.push(panel(file, x, y, w, crop, srcW, srcH, 0));
    p.push(pill(f.category, 112, 2560, 31, accent));
  } else {
    const w = f.w || 1000;
    const x = f.x ?? (W - w) / 2;
    const y = f.y || 1240;
    p.push(pill(f.proof, 94, y - 64, 27, accent));
    p.push(panel(file, x, y, w, crop, srcW, srcH, f.angle || 0));
    p.push(pill(f.category, 90, H - 46, 22, accent), txt(f.id.slice(0, 2), 1173, H - 41, 25, '#DFD8CD', 500, 2));
  }
  p.push('</svg>');
  return p.join('');
}

const ids = process.argv.find((a) => a.startsWith('--ids='))?.slice(6).split(',');
const devices = process.argv.find((a) => a.startsWith('--devices='))?.slice(10).split(',');
const norm = (s) => s.toLowerCase().replace(/\s+/g, '');
for (const f of frames.filter((x) => !ids || ids.includes(x.id.slice(0, 2)))) {
  for (const size of SIZES.filter((s) => !devices || devices.includes(s.id))) {
    const capDir = join(root, 'captures', size.pad ? 'ipad' : 'phone');
    const evidencePath = join(capDir, f.shot + '.txt');
    if (!existsSync(evidencePath)) throw new Error(`Missing capture ${size.pad ? 'ipad' : 'phone'}/${f.shot}`);
    const evidence = norm(readFileSync(evidencePath, 'utf8'));
    for (const claim of f.checks) {
      if (!evidence.includes(norm(claim))) throw new Error(`Frame ${f.id} (${size.id}) claims "${claim}" but its capture does not show it`);
    }
    const dir = join(root, 'final', size.id);
    mkdirSync(dir, { recursive: true });
    const out = join(dir, f.id + '.png');
    const png = await sharp(Buffer.from(render(f, size))).flatten({ background: '#080D17' }).removeAlpha().png({ compressionLevel: 9 }).toBuffer();
    writeFileSync(out + '.tmp', png);
    renameSync(out + '.tmp', out);
    console.log('Rendered', f.id, size.id);
  }
}
