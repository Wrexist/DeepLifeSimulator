/**
 * DeepLife Simulator — "Gameplay" App Store Screenshot Generator
 * --------------------------------------------------------------
 * Clean, full-bleed captures of the ACTUAL game UI — no marketing headline,
 * no tilt, no floating chips. Exactly what a real on-device screenshot looks
 * like, at the App Store 6.5" size (1284×2778). The on-screen numbers are tuned
 * to be aspirational (impressive net worth, followers, stats) to drive installs,
 * while staying believable for a rags-to-riches life sim.
 *
 * Reuses the same screen1…6 builders as the hero/base sets via buildAppScreen(),
 * so the marketing never drifts from the real app.
 *
 * Run:  node scripts/generate-gameplay-screenshots.mjs
 * Out:  screenshots/iphone-gameplay/01…06-*.png  (+ a contact-sheet preview)
 *
 * Requires `sharp` and the Inter font available to fontconfig.
 */

import { createRequire } from 'module';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { Buffer } from 'node:buffer';
import { buildAppScreen } from './generate-app-store-screenshots.mjs';

const require = createRequire(import.meta.url);
let sharp;
try { sharp = require('sharp'); }
catch { sharp = require('/tmp/shottest/node_modules/sharp'); }

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'screenshots', 'iphone-gameplay');

const OW = 1284, OH = 2778;   // App Store 6.5"
const SCREENS = [
  { idx: 1, file: '01-your-life' },
  { idx: 2, file: '02-choose-your-origin' },
  { idx: 3, file: '03-build-wealth' },
  { idx: 4, file: '04-dating' },
  { idx: 5, file: '05-family-dynasty' },
  { idx: 6, file: '06-go-viral' },
];

async function main() {
  await mkdir(OUT, { recursive: true });
  const files = [];
  for (const s of SCREENS) {
    const svg = await buildAppScreen(s.idx, OW, OH);
    const file = join(OUT, `${s.file}.png`);
    await sharp(Buffer.from(svg)).png({ quality: 100 }).toFile(file);
    files.push(file);
    console.log('✓', file, `(${OW}×${OH})`);
  }
  // contact sheet
  const tw = 320, th = Math.round(tw * OH / OW), cols = 6;
  const thumbs = [];
  for (let i = 0; i < files.length; i++) {
    const t = await sharp(files[i]).resize(tw, th, { fit: 'inside' }).png().toBuffer();
    thumbs.push({ input: t, left: (i % cols) * (tw + 16) + 12, top: Math.floor(i / cols) * (th + 16) + 12 });
  }
  await sharp({ create: { width: (tw + 16) * cols + 12, height: (th + 16) + 12, channels: 3, background: { r: 9, g: 11, b: 22 } } })
    .composite(thumbs).png().toFile(join(OUT, '_contact-sheet.png'));
  console.log('✓ contact sheet →', OUT);
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) main().catch(e => { console.error(e); process.exit(1); });
