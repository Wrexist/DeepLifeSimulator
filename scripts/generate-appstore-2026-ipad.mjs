/**
 * The 13" iPad App Store set — the same ten frames, the same design system.
 *
 * Layout and palette come from `lib/storeFrameSystem.mjs`, shared with the
 * iPhone generator, so the two sets differ only in PROPORTION. The pair this
 * replaces duplicated their whole layout and had drifted apart.
 *
 * Prereq: screenshots/appstore-2026/rich-captures-ipad/
 *         (VIEW_W=1024 VIEW_H=1366 DSF=2 OUT=… node scripts/capture-rich-state.mjs)
 * Run:    node scripts/generate-appstore-2026-ipad.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FRAMES, frameHtml } from './lib/storeFrameSystem.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAP = join(ROOT, 'screenshots', 'appstore-2026', 'rich-captures-ipad');
const img = (f) => 'data:image/png;base64,' + readFileSync(join(CAP, f)).toString('base64');

const SHOTS = {
  home: img('00-home.png'),
  spark: img('05-app-spark.png'),
  pulse: img('06-app-pulse.png'),
  apps: img('03-apps.png'),
  education: img('10-app-education.png'),
  contacts: img('09-app-contacts.png'),
  company: img('17-x-company.png'),
  darkweb: img('18-x-darkweb.png'),
  crypto: img('19-x-crypto.png'),
  luxury: img('22-x-luxury.png'),
};

/**
 * iPad proportions. A tablet canvas is far wider relative to its height, so
 * the device takes a smaller share of the width and the margins grow — the
 * numbers differ, the design does not.
 */
const L = {
  W: 2064, H: 2752,
  bloomW: 2100, bloomH: 1500, bloomY: 60,
  headBaseline: 700, headPad: 220,
  h1: 150, h1Track: -3.4,
  sub: 56, subTrack: 0.1, subGap: 40,
  pill: 34, pillTrack: 0.4, pillGap: 46, pillPadX: 42, pillPadY: 21,
  devW: 1240, devTop: 860, bezel: 18, devR: 74, scrR: 58,
  shadowTop: 2452, shadowH: 170,
};

const OUT = join(ROOT, 'screenshots', 'appstore-2026', 'ipad-13');
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const pg = await browser.newPage({ viewport: { width: L.W, height: L.H }, deviceScaleFactor: 1 });
for (const f of FRAMES) {
  const shot = SHOTS[f.pick];
  if (!shot) throw new Error(`No capture registered for frame ${f.id} (pick: ${f.pick})`);
  const file = join(OUT, f.id + '.html');
  writeFileSync(file, frameHtml(f, shot, L));
  await pg.goto('file://' + file, { waitUntil: 'networkidle' });
  await new Promise((r) => setTimeout(r, 400));
  await pg.screenshot({ path: join(OUT, f.id + '.png'), clip: { x: 0, y: 0, width: L.W, height: L.H } });
  rmSync(file);
  console.log('✓', f.id);
}
await pg.close();
await browser.close();
console.log('Done →', OUT);
