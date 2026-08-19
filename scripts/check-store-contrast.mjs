/**
 * Measures headline legibility on the store frames, and fails when it is not
 * good enough.
 *
 * The 2026-08 set puts its type over PHOTOGRAPHS — a golden-hour yacht, a
 * sunset island, a vineyard at dusk. A drawn gradient has a luminance you can
 * reason about from the CSS; a photograph does not, and "it looked fine on my
 * screen" is how a headline ships unreadable at the 141px a carousel actually
 * gives it. So this renders each frame TWICE — once normally, once with the
 * type block hidden — and samples the mean luminance of the backdrop the
 * headline actually sits on.
 *
 * The floor is WCAG AA-large (4.5:1) as a hard failure and AAA (7:1) as the
 * target this set is designed to clear, because a store screenshot is read at
 * a distance, at speed, on a phone held at arm's length, and often at a
 * fraction of its native size.
 *
 * Run: node scripts/check-store-contrast.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, existsSync, writeFileSync, rmSync, mkdtempSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { FRAMES, CAPTURES as SHOTS, GROUND, frameHtml, layoutFor, artDataUri } from './lib/storeFrameSystem.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FAIL = 4.5;
const TARGET = 7.0;

const SHELVES = [
  { dir: 'iphone-6.9', w: 1320, h: 2868, kind: 'phone', cap: 'rich-captures' },
  { dir: 'ipad-13', w: 2064, h: 2752, kind: 'tablet', cap: 'rich-captures-ipad' },
];

/** sRGB relative luminance, per WCAG 2.x. */
function lum(r, g, b) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function ratio(l1, l2) {
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}
/** '#RRGGBB' or 'rgba(r,g,b,a)' → [r,g,b]. */
function parse(c) {
  if (c.startsWith('#')) {
    const n = parseInt(c.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  return c.match(/[\d.]+/g).slice(0, 3).map(Number);
}

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
const tmp = mkdtempSync(join(tmpdir(), 'store-contrast-'));
const rows = [];
let failures = 0;

for (const shelf of SHELVES) {
  const CAP = join(ROOT, 'screenshots', 'appstore-2026', shelf.cap);
  const img = (f) => 'data:image/png;base64,' + readFileSync(join(CAP, f)).toString('base64');
  const L = layoutFor(shelf.w, shelf.h, shelf.kind);
  const pg = await browser.newPage({ viewport: { width: shelf.w, height: shelf.h }, deviceScaleFactor: 1 });

  for (const f of FRAMES) {
    const file = SHOTS[f.pick];
    if (!existsSync(join(CAP, file))) {
      console.log(`  … skipped ${shelf.dir} ${f.id} (no capture yet)`);
      continue;
    }
    const [lK, rK] = f.support || [];
    const html = join(tmp, `${shelf.dir}-${f.id}.html`);
    writeFileSync(html, frameHtml(f, {
      hero: img(file),
      left: lK && img(SHOTS[lK]),
      right: rK && img(SHOTS[rK]),
      art: artDataUri(f.art),
    }, L));
    await pg.goto('file://' + html, { waitUntil: 'networkidle' });
    await pg.evaluate(() => document.fonts.ready);
    await new Promise((r) => setTimeout(r, 200));

    // The box the type actually occupies, measured rather than assumed — the
    // block is anchored by its bottom edge and grows upward, so a two-line
    // headline does not sit where a one-line headline sits.
    const box = await pg.evaluate(() => {
      const b = document.querySelector('.head').getBoundingClientRect();
      return { x: Math.round(b.x), y: Math.round(b.y), width: Math.round(b.width), height: Math.round(b.height) };
    });
    // Hide the type and photograph what is UNDER it. Sampling the finished
    // frame instead would average the text in with its own backdrop, which
    // reports a contrast ratio the reader never experiences.
    await pg.addStyleTag({ content: '.head{visibility:hidden}' });
    await new Promise((r) => setTimeout(r, 60));
    const shot = await pg.screenshot({ clip: box });

    // Read the pixels back through a canvas rather than decoding PNG by hand.
    const stats = await pg.evaluate(async (dataUri) => {
      const im = new Image();
      await new Promise((res, rej) => { im.onload = res; im.onerror = rej; im.src = dataUri; });
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(im, 0, 0);
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      const px = [];
      for (let i = 0; i < d.length; i += 4) px.push([d[i], d[i + 1], d[i + 2]]);
      return px;
    }, 'data:image/png;base64,' + shot.toString('base64'));

    const lums = stats.map(([r, g, b]) => lum(r, g, b)).sort((a, b) => a - b);
    // The WORST backdrop the type sits on, not the average: a headline is
    // unreadable where it crosses the bright part of a sky, and an average
    // over the whole block hides exactly that.
    const p95 = lums[Math.floor(lums.length * 0.95)];
    const headL = lum(...parse(GROUND.headline));
    const subL = lum(...parse(GROUND.subStrong));
    const cHead = ratio(headL, p95);
    const cSub = ratio(subL, p95);
    const worst = Math.min(cHead, cSub);
    const verdict = worst < FAIL ? 'FAIL' : worst < TARGET ? 'thin' : 'ok';
    if (verdict === 'FAIL') failures++;
    rows.push({ shelf: shelf.dir, id: f.id, art: f.art, cHead, cSub, verdict });
    console.log(
      `  ${verdict === 'ok' ? '✓' : verdict === 'thin' ? '~' : '✗'} ${shelf.dir.padEnd(11)} ${f.id.padEnd(26)}`
      + ` head ${cHead.toFixed(1)}:1  sub ${cSub.toFixed(1)}:1  (${f.art})`,
    );
    rmSync(html);
  }
  await pg.close();
}
await browser.close();
rmSync(tmp, { recursive: true, force: true });

const thin = rows.filter((r) => r.verdict === 'thin');
console.log(`\n${rows.length} measurements · ${failures} below ${FAIL}:1 · ${thin.length} below the ${TARGET}:1 target`);
if (failures) {
  console.error(
    `\n${failures} frame(s) put type on a backdrop it cannot be read against. Fix by raising the `
    + `plate's scrim or re-cropping it in ART — never by shrinking the headline.`,
  );
  process.exit(1);
}
