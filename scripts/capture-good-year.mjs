/**
 * Capture the two Year in Review shots that need a year which went WELL.
 *
 *   04-year-in-review-good.png    the hero shot: "A whole life, one sitting"
 *   05-year-in-review-offer.png   the same screen carrying the DeepLife+ offer
 *
 * Prereq:  a PRODUCTION web export served somewhere (see
 *          capture-story-mode-shots.mjs's header — `--clear` is load-bearing).
 * Run:     CAPTURE_URL=http://localhost:8099 node scripts/capture-good-year.mjs
 *
 * ── WHY THIS IS SEPARATE FROM THE MAIN CAPTURE ───────────────────────────
 * `capture-story-mode-shots.mjs` drives a character who never acts, which is
 * the honest default: it is fast, deterministic, and it is what a story-mode
 * tap does. But that character is unemployed and sleeping rough, so the batch
 * correctly hands the year back after ~7 weeks with "Your life is in trouble"
 * across the Year in Review — a true screenshot of the feature working, and a
 * dishonest one under "A whole life, one sitting".
 *
 * So this script does the two things a player would do first, and nothing else:
 * take the entry-level job and rent the cheapest room. Line Cook pays $110/wk
 * against a Shared Room's $45/wk, and the room removes the "sleeping rough is
 * wearing you down" happiness drain that was killing the idle character.
 *
 * It is NOT guaranteed to produce a full 52 weeks, and it must not pretend to:
 * if the year still ends early or ends in danger, the script says so and writes
 * NOTHING, because a hero screenshot of a life going badly is exactly the
 * oversell the compositor's skip-and-report rule exists to prevent.
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'screenshots', 'story-mode');
const URL = process.env.CAPTURE_URL || 'http://localhost:8099';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Same raw pointer dispatch as the main capture — see its header for why. */
const TAP_IN_PAGE = ({ needle, nth }) => {
  const all = [...document.querySelectorAll('div,span,button,a,[role="button"]')];
  const exact = all.filter((e) => (e.textContent || '').trim() === needle);
  const loose = all.filter((e) => (e.textContent || '').trim().includes(needle));
  const pool = exact.length ? exact : loose;
  const leaves = pool.filter((e) => !pool.some((o) => o !== e && e.contains(o)));
  const el = (leaves.length ? leaves : pool)[nth];
  if (!el) return false;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2,
    clientY: r.top + r.height / 2, pointerId: 1, isPrimary: true };
  el.dispatchEvent(new PointerEvent('pointerdown', o));
  el.dispatchEvent(new PointerEvent('pointerup', o));
  el.dispatchEvent(new MouseEvent('click', o));
  return true;
};

const TAP_ARIA = (selector) => {
  const el = document.querySelector(selector);
  if (!el) return false;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  const o = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2,
    clientY: r.top + r.height / 2, pointerId: 1, isPrimary: true };
  el.dispatchEvent(new PointerEvent('pointerdown', o));
  el.dispatchEvent(new PointerEvent('pointerup', o));
  el.dispatchEvent(new MouseEvent('click', o));
  return true;
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: ['--no-sandbox', '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
});
try {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  page.on('dialog', async (d) => { await d.dismiss().catch(() => {}); });

  const text = () => page.evaluate(() => document.body?.innerText || '');
  const tap = async (n, i = 0) => { const h = await page.evaluate(TAP_IN_PAGE, { needle: n, nth: i }); await sleep(1400); return h; };
  const tapAria = async (s) => { const h = await page.evaluate(TAP_ARIA, s); await sleep(1400); return h; };
  const shot = async (name) => { await mkdir(OUT, { recursive: true }); await page.screenshot({ path: join(OUT, `${name}.png`) }); console.log(`  ✓ ${name}.png`); };

  console.log('→ boot');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(16000);
  await tap('Save Slots'); await sleep(1500);
  await tap('Start a new life here', 0); await sleep(1200);
  await tap('Start New Game'); await sleep(2600);
  await tap('Food Courier'); await sleep(1400);

  console.log('→ story mode');
  for (let i = 0; i < 16; i++) { await page.mouse.wheel(0, 700); await sleep(150);
    if ((await text()).includes('Choose your pace')) break; }
  await page.mouse.wheel(0, 400); await sleep(800);
  await tap('1 tap = 52 weeks'); await sleep(700);

  for (let s = 0; s < 12; s++) {
    const before = await text();
    let clicked = '';
    for (const l of ['Continue To Identity', 'Continue To Ambitions', 'Continue To Perks', 'Start Your Life']) {
      if (before.includes(l) && (await tap(l))) { clicked = l; break; }
    }
    await sleep(clicked === 'Start Your Life' ? 9000 : 1800);
    const now = await text();
    if (/AGE\s*\d/i.test(now) && /WEEK\s*\d/i.test(now)) break;
    if (!clicked && now === before) break;
  }
  for (const l of ['Got it', 'Dismiss', 'Close']) if ((await text()).includes(l) && (await tap(l))) break;
  await sleep(2500);

  // ── The two things a player does first ──────────────────────────────────
  console.log('→ take the entry-level job');
  await tap('Work'); await sleep(2200);
  await tap('Career'); await sleep(2400);
  const applied = await tap('Apply');
  console.log('   apply tapped:', applied);
  await sleep(2600);
  for (const l of ['Accept', 'Confirm', 'Take the job', 'Got it', 'Continue', 'Close']) {
    if ((await text()).includes(l) && (await tap(l))) break;
  }
  await sleep(1500);

  console.log('→ rent the cheapest room');
  await tap('Life'); await sleep(2200);
  await tap('Market'); await sleep(2200);
  await tap('Housing'); await sleep(2400);
  const rented = await tapAria('[aria-label^="Shared Room"]');
  console.log('   shared room tapped:', rented);
  await sleep(2200);
  for (const l of ['Got it', 'Continue', 'Close']) if ((await text()).includes(l) && (await tap(l))) break;

  console.log('→ live the year');
  await tap('Home'); await sleep(2200);
  await page.evaluate(() => {
    const el = document.querySelector('[aria-label="Live the next year"]');
    if (!el) return;
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2, pointerId: 1, isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
    el.dispatchEvent(new MouseEvent('click', o));
  });

  let body = '';
  for (let i = 0; i < 40; i++) {
    await sleep(5000);
    body = await text();
    if (/weeks? lived/.test(body)) break;
  }

  if (!/weeks? lived/.test(body)) {
    console.log('\n✗ No Year in Review appeared. Writing nothing.');
    console.log('  page:', body.replace(/\n+/g, ' | ').slice(0, 260));
  } else {
    const weeks = Number((body.match(/(\d+)\s+weeks? lived/) || [])[1] || 0);
    const inTrouble = /in trouble/.test(body);
    const hasOffer = /Make the next one count/.test(body);
    console.log(`\n  weeks lived: ${weeks} · in danger: ${inTrouble} · offer: ${hasOffer}`);

    if (inTrouble || weeks < 26) {
      // The whole point of this script is a year worth putting on a store page.
      // A short or troubled one is the DEFAULT capture's job, and writing it
      // here under a hero filename is how an oversell gets uploaded.
      console.log('✗ Not a good year — writing nothing. Re-run, or capture from a played save.');
    } else {
      await shot('04-year-in-review-good');
      if (hasOffer) await shot('05-year-in-review-offer');
      else console.log('  (no DeepLife+ offer this year — that slot stays empty)');
    }
  }
  console.log('DONE');
} finally {
  await browser.close();
}
