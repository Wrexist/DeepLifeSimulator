/**
 * The iPhone App Store set — ten frames from real gameplay captures.
 *
 * Layout and palette live in `lib/storeFrameSystem.mjs`, shared with the iPad
 * generator. What this file owns is the iPhone proportions and which capture
 * each frame shows.
 *
 * Prereq: screenshots/appstore-2026/rich-captures/ (see capture-rich-state.mjs)
 * Run:    node scripts/generate-appstore-2026-set.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FRAMES, frameHtml } from './lib/storeFrameSystem.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAP = join(ROOT, 'screenshots', 'appstore-2026', 'rich-captures');
const img = (f) => 'data:image/png;base64,' + readFileSync(join(CAP, f)).toString('base64');

const SHOTS = {
  home: img('00-home.png'),
  spark: img('05-app-spark.png'),
  pulse: img('06-app-pulse.png'),
  apps: img('03-apps.png'),
  education: img('10-app-education.png'),
  family: img('14-life-family.png'),
  company: img('17-x-company.png'),
  darkweb: img('18-x-darkweb.png'),
  crypto: img('19-x-crypto.png'),
  contacts: img('09-app-contacts.png'),
  // Luxury, not the Garage. The garage capture leads with an economy sedan and
  // a "Get your driver's licence — Pay $500" prompt; luxury opens on a rare
  // watch collection and a museum-grade diamond.
  luxury: img('22-x-luxury.png'),
};

/**
 * The design canvas. Every output size renders this and scales to fit, so the
 * proportions are decided once.
 *
 * The device is 63% of the canvas width and fully contained with a real bottom
 * margin — it is the largest thing in the frame, because it is the product.
 */
const L = {
  W: 1320, H: 2868,
  // The bloom sits BEHIND the device, not behind the type. Its job is to
  // separate the phone's silhouette from a ground that is nearly the same
  // navy as the app's own chrome.
  bloomW: 1420, bloomH: 1500, bloomY: 62,
  // The type block's BASELINE — its bottom edge. 190px of air below it, then
  // the device. Extra headline lines grow upward into the top margin.
  headBaseline: 570, headPad: 96,
  // Sized for the App Store CAROUSEL, where these are shown as thumbnails a
  // fraction of this size — a headline that only works at full resolution is
  // a headline nobody reads. 116px still clears the longest line in the set
  // without crushing tracking; the old 158px at -5px collided its letterforms.
  h1: 116, h1Track: -2.8,
  sub: 42, subTrack: 0.1, subGap: 34,
  pill: 27, pillTrack: 0.4, pillGap: 40, pillPadX: 34, pillPadY: 17,
  // 900 wide = 68% of the canvas. The device is meant to dominate; the type
  // block above it gets 255px of air and the bottom margin 168px, which is
  // balanced. The first pass left 475px above and 100px below and the frame
  // read top-heavy and unfinished.
  devW: 900, devTop: 760, bezel: 14, devR: 84, scrR: 71,
  shadowTop: 2642, shadowH: 150,
};

const SIZES = [
  { dir: 'iphone-6.9', w: 1320, h: 2868 },
  { dir: 'iphone-6.5', w: 1284, h: 2778 },
];

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
for (const size of SIZES) {
  const OUT = join(ROOT, 'screenshots', 'appstore-2026', size.dir);
  mkdirSync(OUT, { recursive: true });
  const pg = await browser.newPage({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 1 });
  const sx = size.w / L.W, sy = size.h / L.H;
  for (const f of FRAMES) {
    const shot = SHOTS[f.pick];
    if (!shot) throw new Error(`No capture registered for frame ${f.id} (pick: ${f.pick})`);
    let html = frameHtml(f, shot, L);
    if (size.w !== L.W || size.h !== L.H) {
      html = html.replace('<div class="canvas">',
        `<div class="canvas" style="transform:scale(${sx},${sy}); transform-origin:top left;">`);
    }
    const file = join(OUT, f.id + '.html');
    writeFileSync(file, html);
    await pg.goto('file://' + file, { waitUntil: 'networkidle' });
    await new Promise((r) => setTimeout(r, 400));
    await pg.screenshot({ path: join(OUT, f.id + '.png'), clip: { x: 0, y: 0, width: size.w, height: size.h } });
    rmSync(file);
    console.log('✓', size.dir, f.id);
  }
  await pg.close();
}
await browser.close();
console.log('Done');
