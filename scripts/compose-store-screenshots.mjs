/**
 * Compose upload-ready App Store screenshots from REAL app captures.
 *
 *   in   screenshots/story-mode/*.png   (1179 × 2556, from capture-story-mode-shots.mjs)
 *   out  screenshots/app-store/*.png    (1290 × 2796, the iPhone 6.7" slot)
 *
 * Run:  node scripts/compose-store-screenshots.mjs
 *
 * ── WHY THIS EXISTS ALONGSIDE generate-app-store-screenshots.mjs ──────────
 * That script draws faithful RECREATIONS of the app's screens in SVG. It makes
 * a polished image, but every pixel is a promise the marketing asset is making
 * on the app's behalf, and nothing keeps the two in sync — a recreation cannot
 * go stale loudly, it just quietly starts describing a version that no longer
 * exists. It also needs `sharp`, which is not installed here.
 *
 * This one composites the screenshots the app actually produced, so what the
 * store shows is by construction what ships. Chromium does the compositing,
 * which is already a proven dependency (the capture script drives it) and needs
 * no native module.
 *
 * ── KNOWN SUBSTITUTION: the caption typeface ─────────────────────────────
 * There is no Inter (or any brand font) in this container and none vendored in
 * the repo — the app itself uses the platform font. Captions therefore render
 * in Liberation Sans, which is metrically Helvetica-like and looks fine, but is
 * NOT a deliberate brand choice. Restyling is a CSS edit in `caption()` below;
 * drop a .ttf next to this script and add it as an @font-face if you want the
 * real thing. Flagged here rather than left for someone to notice on the store
 * page.
 *
 * ── ONLY COMPOSES WHAT EXISTS ────────────────────────────────────────────
 * A missing capture is SKIPPED and reported, never substituted with a
 * placeholder or a stale file. A store screenshot that shows the wrong build is
 * worse than a missing one: the missing one is obvious, and the wrong one gets
 * uploaded.
 */
import { chromium } from 'playwright';
import { readFile, mkdir, readdir } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const IN = join(ROOT, 'screenshots', 'story-mode');
const OUT = join(ROOT, 'screenshots', 'app-store');

/** App Store 6.7" slot. Apple accepts this exact size. */
const W = 1290;
const H = 2796;

/**
 * The shot list, captions verbatim from marketing/aso-v2.7.0-paste-ready.md §6.
 *
 * Order matters more than count: the first two are the only ones most people
 * see, so they carry the pitch on their own. `source` is the capture filename;
 * anything absent is skipped rather than faked.
 */
const SHOTS = [
  {
    out: '01-a-whole-life-one-sitting',
    source: '04-year-in-review.png',
    caption: 'A whole life,\none sitting',
    sub: 'One tap. One year. Every week still simulated.',
    bg: ['#1a0533', '#0d1b2a'],
    accent: '#a78bfa',
  },
  {
    out: '02-choose-your-pace',
    source: '02-picker-story.png',
    caption: 'Choose\nyour pace',
    sub: 'Classic week-by-week, or a year at a time.',
    bg: ['#0a1628', '#0d0d2b'],
    accent: '#60a5fa',
  },
  {
    out: '03-your-life-at-a-glance',
    source: '03-hud.png',
    caption: 'Your whole life,\non one screen',
    sub: 'Money, health, career, family — all live.',
    bg: ['#0a1a0d', '#0a0a1a'],
    accent: '#34d399',
  },
  {
    out: '04-make-the-next-one-count',
    source: '05-year-in-review-offer.png',
    caption: 'Make the\nnext one count',
    sub: 'Every year ends with the story of what happened.',
    bg: ['#2a1a00', '#1a0d00'],
    accent: '#fbbf24',
  },
  {
    out: '05-go-deeper',
    source: '06-paywall.png',
    caption: 'Go deeper',
    sub: 'DeepLife+ — no forced ads, no pay-to-win.',
    bg: ['#0a0a2e', '#1a0a2e'],
    accent: '#818cf8',
  },
];

const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function page(shot, dataUri) {
  // Device geometry: a centred slab with a hairline bezel. The capture is
  // 1179 × 2556 (aspect 0.4613); the slot is 1290 × 2796 (0.4613) — the SAME
  // aspect, so the screenshot scales without cropping or letterboxing.
  const PW = 900;
  const PH = Math.round(PW * (2556 / 1179));
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:${W}px;height:${H}px;overflow:hidden}
  body{
    font-family:'Liberation Sans','DejaVu Sans',Helvetica,Arial,sans-serif;
    background:linear-gradient(180deg,${shot.bg[0]} 0%,${shot.bg[1]} 55%,#07070f 100%);
    color:#fff; display:flex; flex-direction:column; align-items:center;
  }
  /* A single soft glow behind the device, tinted to the shot's accent. It is
     the only decoration: the screenshot is the subject, and anything competing
     with it costs the reader the half second they give the page. */
  .glow{
    position:absolute; left:50%; top:960px; transform:translateX(-50%);
    width:1180px; height:1180px; border-radius:50%;
    background:radial-gradient(circle, ${shot.accent}33 0%, ${shot.accent}00 62%);
  }
  .cap{
    position:relative; margin-top:150px; text-align:center;
    font-size:106px; line-height:1.06; font-weight:700;
    letter-spacing:-2.5px; white-space:pre-line; text-shadow:0 6px 40px rgba(0,0,0,.55);
  }
  .sub{
    position:relative; margin-top:34px; text-align:center;
    font-size:41px; line-height:1.35; font-weight:400; color:#c3cbe0;
    max-width:1010px; letter-spacing:-.2px;
  }
  .device{
    position:relative; margin-top:86px; width:${PW}px; height:${PH}px;
    border-radius:74px; padding:11px; background:#26262e;
    box-shadow:0 46px 130px rgba(0,0,0,.62), 0 0 0 1px rgba(255,255,255,.09);
  }
  .device img{
    width:100%; height:100%; display:block;
    border-radius:63px; object-fit:cover; object-position:top center;
  }
  </style></head><body>
    <div class="glow"></div>
    <div class="cap">${esc(shot.caption)}</div>
    <div class="sub">${esc(shot.sub)}</div>
    <div class="device"><img src="${dataUri}"></div>
  </body></html>`;
}

const missing = [];
const made = [];

await mkdir(OUT, { recursive: true });
const available = existsSync(IN) ? await readdir(IN) : [];

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox'],
});
try {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    deviceScaleFactor: 1,
  });
  const p = await ctx.newPage();

  for (const shot of SHOTS) {
    const src = join(IN, shot.source);
    if (!existsSync(src)) {
      missing.push(shot);
      continue;
    }
    const b64 = (await readFile(src)).toString('base64');
    await p.setContent(page(shot, `data:image/png;base64,${b64}`), {
      waitUntil: 'load',
    });
    await p.screenshot({ path: join(OUT, `${shot.out}.png`) });
    made.push(shot);
    console.log(`  ✓ ${shot.out}.png   ← ${shot.source}`);
  }
} finally {
  await browser.close();
}

console.log(`\n${made.length}/${SHOTS.length} composed → screenshots/app-store/`);
if (missing.length) {
  console.log('\nSkipped — no capture for these (NOT substituted with anything):');
  for (const m of missing) console.log(`  · ${m.out}  needs ${m.source}`);
  console.log(
    `\n  Available captures: ${available.filter((f) => f.endsWith('.png')).join(', ') || '(none)'}`
  );
  console.log('  Produce them with: node scripts/capture-story-mode-shots.mjs');
  console.log('  (read its header first — it needs a production export, not the dev server)');
}
