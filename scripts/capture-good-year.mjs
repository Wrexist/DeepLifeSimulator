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
 * So this script does what a player would do, in order of how much it should
 * help, and reports how far each gets:
 *
 *   1. Take the entry-level job and rent the cheapest room. Line Cook pays
 *      $110/wk against a Shared Room's $45/wk, and the room removes the
 *      "sleeping rough is wearing you down" drain. MEASURED: this moved the
 *      year from 7 weeks to 8. The two obvious player actions bought one week,
 *      which is why the balance note in tasks/todo.md says this is the decay
 *      curve rather than player skill.
 *   2. Start from a scenario at the opposite end of the wealth multiplier —
 *      see the comment at the scenario pick below.
 *
 * It is NOT guaranteed to produce a full 52 weeks, and it must not pretend to:
 * if the year still ends early or ends in danger, the script says so and writes
 * NOTHING, because a hero screenshot of a life going badly is exactly the
 * oversell the compositor's skip-and-report rule exists to prevent.
 *
 * Override the scenario with SCENARIO="Food Courier" to reproduce (1).
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

  // ── Why the Lottery Winner scenario and not the default start ───────────
  // Decay scales with `wealthMultiplier = clamp(100000/netWorth, 0.5, 2.0)`.
  // A default character starts at ~$1,500 and therefore sits permanently on
  // the 2.0 CEILING — maximum decay. Lottery Winner starts at $500,000, which
  // pins the multiplier to its 0.5 FLOOR: a 4x slower decay.
  //
  // This is run for the DATA as much as the screenshot. If even a character
  // with every economic advantage cannot complete 52 weeks, story mode's
  // headline promise is unreachable by anyone and the balance problem is not
  // "poor characters struggle" but "nobody gets a year". That distinction
  // changes which of the options in tasks/todo.md is the right one.
  const scenario = process.env.SCENARIO || 'Lottery Winner';
  if (scenario !== 'Food Courier') {
    await tap('Challenges'); await sleep(1800);
    for (let i = 0; i < 14; i++) {
      if ((await text()).includes(scenario)) break;
      await page.mouse.wheel(0, 500); await sleep(220);
    }
  }
  const picked = await tap(scenario);
  console.log(`   scenario "${scenario}" picked:`, picked);
  await sleep(1600);

  console.log('→ story mode');
  for (let i = 0; i < 16; i++) { await page.mouse.wheel(0, 700); await sleep(150);
    if ((await text()).includes('Choose your pace')) break; }
  await page.mouse.wheel(0, 400); await sleep(800);
  // Select Story by its ROLE label, not its marketing copy. This used to match
  // the tempo chip text "1 tap = 52 weeks"; the chip was later reworded to
  // "1 tap = up to 52 weeks" and the substring stopped matching, so story mode
  // was silently never selected and a whole capture run advanced zero weeks
  // while reporting success. The card's accessibilityLabel starts with
  // "Story mode," and is derived from the mode id, so it survives copy edits.
  await page.evaluate(() => {
    const el = document.querySelector('[aria-label^="Story mode"]');
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2,
      clientY: r.top + r.height / 2, pointerId: 1, isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
    el.dispatchEvent(new MouseEvent('click', o));
    return true;
  });
  await sleep(900);
  // INFORMATIONAL ONLY, and deliberately not a gate. RN-web does not emit
  // `aria-checked` for `accessibilityState={{ selected }}` any more than it
  // emits `aria-selected` — both read null on a control that IS selected. A
  // previous version of this check gated on the equivalent attribute, reported
  // a false negative, and three measurements were retracted on the strength of
  // it. The run itself is the evidence: story mode advances many weeks per tap
  // and raises a pause banner; classic advances one and does not.
  const storyAttr = await page.evaluate(() =>
    document.querySelector('[aria-label^="Story mode"]')?.getAttribute('aria-checked')
  );
  console.log(`   story card aria-checked: ${storyAttr} (null is normal — see note)`);
  await sleep(700);

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
  // ── The job is OPTIONAL, and that is the experiment ─────────────────────
  // Every job carries a `weeklyToll` (lib/careers/jobMarket.ts) that is
  // NEGATIVE on happiness and energy — Line Cook is -14 energy, and the career
  // cards show -3 happiness / -2 health a week. In classic mode a player
  // absorbs that by resting and spending between weeks. Story mode removes
  // exactly those weeks, so the toll compounds unopposed for the whole batch.
  //
  // Set NO_JOB=1 to skip employment and isolate the toll's contribution. With
  // a Lottery Winner's $500,000 there is no reason to work at all, which makes
  // the unemployed wealthy run both the cleanest experiment and the most
  // plausible route to a year that actually completes.
  if (process.env.NO_JOB) {
    console.log('→ skipping the job (NO_JOB set) — isolating the weekly toll');
  } else {
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
  }

  console.log('→ rent the cheapest room');
  await tap('Life'); await sleep(2200);
  await tap('Market'); await sleep(2200);
  await tap('Housing'); await sleep(2400);
  // Playwright's own click, not the hand-rolled pointer sequence. The rental
  // card is a real <button>, so the locator click drives it correctly, and it
  // is PROVEN to reach `rentHome` — the confirmation toast below is the proof.
  await page.locator('[aria-label^="Shared Room"]').first()
    .click({ timeout: 8000 })
    .catch((e) => console.log('   rent click threw:', String(e).slice(0, 100)));
  await sleep(2400);

  // VERIFY on the CONFIRMATION TOAST, which is the only signal that reflects
  // what `rentHome` actually did.
  //
  // An earlier version checked `aria-selected` on the card. That check was
  // broken and produced a FALSE NEGATIVE that I acted on: RN-web does not emit
  // `aria-selected` for `accessibilityState={{ selected }}`, so the attribute
  // reads `null` before and after a SUCCESSFUL rental alike. It reported "not
  // housed" for a tenancy that existed, and I retracted three correct
  // measurements on the strength of it.
  //
  // Which is the real lesson: a verification step is code too, and a check that
  // can only ever fail is worse than no check — it manufactures false evidence
  // and looks rigorous doing it. Assert on the thing the feature SAYS it did.
  const housed = /Moved into|already live/i.test(await text());
  console.log(`   tenancy confirmed by toast: ${housed}`);
  if (!housed) {
    console.log('   !! NOT HOUSED — this run carries -4 happiness/week (HOMELESS_PENALTY)');
  }
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

  // Detect the PAUSE BANNER, not the old Year in Review — that modal was
  // deleted when story mode became a live run. Matching on text the app no
  // longer renders is how a working feature gets reported as a failure, which
  // is exactly what happened on the first run after the redesign.
  let body = '';
  const PAUSED = /come down with|fallen ill|life is in trouble|quiet year|interrupted the run/i;
  for (let i = 0; i < 40; i++) {
    await sleep(4000);
    body = await text();
    if (PAUSED.test(body)) break;
  }

  if (!PAUSED.test(body)) {
    console.log('\n✗ The run never paused. Writing nothing.');
    console.log('  page:', body.replace(/\n+/g, ' | ').slice(0, 260));
  } else {
    const weeks = Number((body.match(/(\d+)\s+weeks/) || [])[1] || 0);
    const inTrouble = /in trouble|come down with|fallen ill/i.test(body);
    const hasOffer = /DeepLife\+/.test(body);
    console.log(`\n  weeks lived: ${weeks} · in danger: ${inTrouble} · offer: ${hasOffer}`);

    console.log(`  (52 weeks is a full year; this run reached ${weeks})`);
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
