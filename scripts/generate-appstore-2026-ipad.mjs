/**
 * The iPad App Store set — the same ten frames, from TABLET captures.
 *
 * The captures are the point: Guideline 2.3.3 asks for screenshots taken on
 * the device class they are filed under, and the iPad layouts are genuinely
 * different screens, not the phone stretched. `rich-captures-ipad/` is the
 * same run at 1024×1366 @2x.
 *
 * Layout, palette, type and the frame list come from `lib/storeFrameSystem.mjs`,
 * shared with the iPhone generator, so the two sets cannot drift apart.
 *
 * Prereq: screenshots/appstore-2026/rich-captures-ipad/
 * Run:    node scripts/generate-appstore-2026-ipad.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FRAMES, frameHtml, layoutFor } from './lib/storeFrameSystem.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAP = join(ROOT, 'screenshots', 'appstore-2026', 'rich-captures-ipad');

/** Same picks as the iPhone set — see the note there for the three that are
 *  deliberately not the obvious capture. */
const SHOTS = {
  home: '00-home.png',
  spark: '05-app-spark.png',
  stocks: '07-app-stocks.png',
  contacts: '09-app-contacts.png',
  apps: '03-apps.png',
  company: '17-x-company.png',
  darkweb: '18-x-darkweb.png',
  crypto: '19-x-crypto.png',
  education: '28-app-education-earned.png',
  luxury: '29-x-luxury-collection.png',
};

const img = (f) => {
  const p = join(CAP, f);
  if (!existsSync(p)) {
    throw new Error(
      `Missing iPad capture ${f}. Re-run the capture with `
      + `VIEW_W=1024 VIEW_H=1366 DSF=2 OUT=screenshots/appstore-2026/rich-captures-ipad `
      + `— see screenshots/appstore-2026/README.md.`,
    );
  }
  return 'data:image/png;base64,' + readFileSync(p).toString('base64');
};

/** 13" iPad Pro, the shelf App Store Connect requires when an app ships on iPad. */
const SIZES = [{ dir: 'ipad-13', w: 2064, h: 2752 }];

/**
 * Removes PNGs the current frame list no longer produces.
 *
 * Renaming a frame (`03-build-your-companies` → `03-build-an-empire`) leaves
 * the old file on disk, and the upload instruction everywhere in this repo is
 * "upload all ten in filename order" — so a stale frame does not look stale,
 * it looks like frame three. Both files even sort adjacently. The set went to
 * twelve files this way while every generator log line said the run had
 * succeeded.
 */
function pruneOrphans(dir, keep) {
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.png')) continue;
    if (keep.has(f)) continue;
    rmSync(join(dir, f));
    console.log('  ✕ removed orphan', f);
  }
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
for (const size of SIZES) {
  const OUT = join(ROOT, 'screenshots', 'appstore-2026', size.dir);
  mkdirSync(OUT, { recursive: true });
  const L = layoutFor(size.w, size.h, 'tablet');
  const pg = await browser.newPage({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: 1,
  });
  for (const f of FRAMES) {
    const file = SHOTS[f.pick];
    if (!file) throw new Error(`No capture registered for frame ${f.id} (pick: ${f.pick})`);
    const html = join(OUT, f.id + '.html');
    writeFileSync(html, frameHtml(f, img(file), L));
    await pg.goto('file://' + html, { waitUntil: 'networkidle' });
    await pg.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 250));
    await pg.screenshot({
      path: join(OUT, f.id + '.png'),
      clip: { x: 0, y: 0, width: size.w, height: size.h },
    });
    rmSync(html);
    console.log('✓', size.dir, f.id);
  }
  pruneOrphans(OUT, new Set(FRAMES.map((f) => f.id + '.png')));
  await pg.close();
}
await browser.close();
console.log('Done → screenshots/appstore-2026/ipad-13');
