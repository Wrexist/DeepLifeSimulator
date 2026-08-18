/**
 * The iPhone App Store set — ten frames from real gameplay captures.
 *
 * Layout, palette, type and the frame list live in `lib/storeFrameSystem.mjs`,
 * shared with the iPad generator. What this file owns is which capture each
 * frame shows and which canvases get written.
 *
 * Prereq: screenshots/appstore-2026/rich-captures/ (see capture-rich-state.mjs)
 * Run:    node scripts/generate-appstore-2026-set.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FRAMES, CAPTURES as SHOTS, frameHtml, layoutFor } from './lib/storeFrameSystem.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CAP = join(ROOT, 'screenshots', 'appstore-2026', 'rich-captures');


const img = (f) => {
  const p = join(CAP, f);
  if (!existsSync(p)) {
    throw new Error(
      `Missing capture ${f}. Re-run scripts/capture-rich-state.mjs — see `
      + `screenshots/appstore-2026/README.md. Composing around a missing file `
      + `is how a stale screenshot reaches the store.`,
    );
  }
  return 'data:image/png;base64,' + readFileSync(p).toString('base64');
};

/**
 * Both canvases Apple accepts for the two iPhone shelves.
 *
 * Each is rendered NATIVELY at its own size. The version this replaces laid
 * out one 1320×2868 canvas and scaled it to 6.5" with `transform:scale(sx,sy)`
 * where `sx = 0.9727` and `sy = 0.9686` — the entire 6.5" set shipped squashed
 * 0.4% anamorphically, type and device alike. Deriving each canvas's own
 * numbers costs one extra render and cannot distort.
 */
const SIZES = [
  { dir: 'iphone-6.9', w: 1320, h: 2868 },
  { dir: 'iphone-6.5', w: 1284, h: 2778 },
];

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
  const L = layoutFor(size.w, size.h, 'phone');
  const pg = await browser.newPage({
    viewport: { width: size.w, height: size.h },
    deviceScaleFactor: 1,
  });
  for (const f of FRAMES) {
    const file = SHOTS[f.pick];
    if (!file) throw new Error(`No capture registered for frame ${f.id} (pick: ${f.pick})`);
    const [lKey, rKey] = f.support || [];
    for (const [role, k] of [['left', lKey], ['right', rKey]]) {
      if (k && !SHOTS[k]) throw new Error(`No capture registered for frame ${f.id} ${role} flank (${k})`);
    }
    const html = join(OUT, f.id + '.html');
    writeFileSync(html, frameHtml(f, {
      hero: img(file),
      left: lKey && img(SHOTS[lKey]),
      right: rKey && img(SHOTS[rKey]),
    }, L));
    await pg.goto('file://' + html, { waitUntil: 'networkidle' });
    // The embedded font is `font-display:block`, so give the first paint a
    // beat to swap it in — a frame shot mid-swap renders the headline in the
    // fallback face and nothing about the file says so.
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
console.log('Done → screenshots/appstore-2026/{iphone-6.9,iphone-6.5}');
