/**
 * Capture the v2.7.0 story-mode surfaces from the running Expo web build.
 *
 *   01  pace picker, Classic selected
 *   02  pace picker, Story selected
 *   03  HUD, in story mode
 *   04  Year in Review — one tap, one year
 *   05  Year in Review carrying the DeepLife+ offer (only after a good year)
 *   06  the DeepLife+ paywall, opened from that offer
 *
 * Prereq:  npx expo start --web      (Metro on :8081)
 * Run:     node scripts/capture-story-mode-shots.mjs
 *
 * Output goes to screenshots/story-mode/, which is gitignored — regenerable
 * artifacts, not assets the app ships.
 *
 * ── WHY EVERY TAP IS A RAW POINTER SEQUENCE ───────────────────────────────
 * Playwright's locator `.click()` — even with `force: true` — hangs
 * indefinitely on this app's onboarding shell, which animates and re-lays-out
 * continuously (particles, gradients, entrance transitions), so the driver's
 * actionability and auto-scroll machinery never settles.
 *
 * Diagnosed rather than guessed: `elementFromPoint` at a slot card's centre
 * returns that card's own `<button>`, with `pointer-events: auto` and nothing
 * overlaying it. The markup is fine and the app is NOT broken — the driver
 * cannot cope with the animation. So taps are dispatched as
 * pointerdown → pointerup → click straight onto the node, which is what RN-web
 * Pressable listens for and which cannot block.
 *
 * ── SCREENS 04-06 NEED A PRODUCTION EXPORT, NOT A DEV SERVER ──────────────
 * Against `npx expo start --web` a single tap was polled for 25 MINUTES and
 * advanced roughly 11 of its 52 weeks — about 136 seconds per weekly tick in
 * the unminified dev bundle under headless Chromium. A full year is over an
 * hour, so the Year in Review (which only mounts once `liveYear` RESOLVES)
 * never appears. Raising the per-tap wait, polling instead of sleeping, and
 * disabling requestAnimationFrame throttling were all tried; none move a
 * number that far. Use an export:
 *
 *   npx expo export --platform web --clear --output-dir /tmp/webexport
 *   npx serve -s -l 8099 /tmp/webexport
 *   CAPTURE_URL=http://localhost:8099 node scripts/capture-story-mode-shots.mjs
 *
 * `--clear` IS LOAD-BEARING, and this cost a full debugging round. Metro
 * caches the *transformed* module, env inlining included, so an export made
 * after setting EXPO_PUBLIC_SAVE_HMAC_KEY can still bake in the value the
 * variable had on a PREVIOUS run. The bundle then contains
 * `EXPO_PUBLIC_SAVE_HMAC_KEY:void 0`, every save is refused with
 * SaveSigningConfigError, and onboarding cannot complete — which looks exactly
 * like "Metro won't inline this variable" and is not. Verify rather than
 * assume, by grepping the export for the value you set:
 *
 *   grep -rl "<your key>" /tmp/webexport/_expo/static/js/web/
 *
 * An earlier revision of this comment claimed the export path was blocked
 * outright because the key "does not reach that module". That was wrong: the
 * inlining works, and `utils/saveSigningConfig.ts` already handles the
 * member-read requirement. The blocker was a stale cache.
 *
 * Story mode is independently verified regardless of screenshots:
 * `__tests__/gameMode/batchEquivalence.test.ts` proves 52 batched ticks equal
 * 52 individual ones from the same seed, and the live HUD exposes the
 * "Live the next year" control, which only renders when gameMode is 'story'.
 *
 * ── AND WHY IT GOES THROUGH SAVE SLOTS ────────────────────────────────────
 * `slotSafety.ts` leaves the target slot at NEW_LIFE_SLOT_UNSET until the
 * player picks one, and `initializeAndSaveGame` refuses to write without it —
 * deliberately, so a flow reaching onboarding without a slot cannot overwrite
 * slot 1. Driving straight into New Game reproduces exactly that: every screen
 * advances, "Start Your Life" taps fine, and nothing happens, because the save
 * is being correctly refused.
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'screenshots', 'story-mode');
const URL = process.env.CAPTURE_URL || 'http://localhost:8081';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Dispatch a pointer sequence on a DOM node, in-page. */
const TAP_IN_PAGE = ({ needle, nth }) => {
  const all = [...document.querySelectorAll('div,span,button,a,[role="button"]')];
  // EXACT matches first, and this is not a nicety. The Perks screen's help text
  // reads: 'new players can just tap "Start Your Life"' — so a substring search
  // finds that PARAGRAPH before the button, taps it, and reports success while
  // nothing happens. Cost an embarrassing number of runs to spot.
  const exact = all.filter((e) => (e.textContent || '').trim() === needle);
  const loose = all.filter((e) => (e.textContent || '').trim().includes(needle));
  const pool = exact.length ? exact : loose;
  // Deepest wins — outer containers also match.
  const leaves = pool.filter((e) => !pool.some((o) => o !== e && e.contains(o)));
  const el = (leaves.length ? leaves : pool)[nth];
  if (!el) return false;
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  const o = {
    bubbles: true, cancelable: true,
    clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
    pointerId: 1, isPrimary: true,
  };
  el.dispatchEvent(new PointerEvent('pointerdown', o));
  el.dispatchEvent(new PointerEvent('pointerup', o));
  el.dispatchEvent(new MouseEvent('click', o));
  return true;
};

const browser = await chromium.launch({
  executablePath: '/opt/pw-browsers/chromium',
  args: [
    '--no-sandbox',
    // The advance handler defers its work through requestAnimationFrame so the
    // spinner paints before the tick blocks the thread. Headless Chromium
    // treats the page as backgrounded and throttles rAF to a crawl, so a
    // 52-tick batch appears to advance one week per tap and the Year in Review
    // never opens. Nothing wrong with the app — the frame clock is asleep.
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
  ],
});

try {
  const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  page.on('console', (m) => {
    const t = m.text();
    if (/error|fail|invalid|missing/i.test(t)) console.log('   [console]', t.slice(0, 220));
  });
  page.on('pageerror', (e) => console.log('   [pageerror]', String(e).slice(0, 220)));
  // RN-web renders Alert.alert as window.alert, which Playwright auto-dismisses
  // silently — exactly how a validation failure here becomes invisible.
  page.on('dialog', async (d) => {
    console.log('   [alert]', d.message().slice(0, 200));
    await d.dismiss().catch(() => {});
  });

  const text = () => page.evaluate(() => document.body?.innerText || '');
  const line1 = async () => (await text()).split('\n').filter(Boolean)[0] || '';

  async function tap(needle, nth = 0) {
    const hit = await page.evaluate(TAP_IN_PAGE, { needle, nth });
    await sleep(1500);
    return hit;
  }

  async function shot(name) {
    await mkdir(OUT, { recursive: true });
    await page.screenshot({ path: join(OUT, `${name}.png`) });
    console.log(`  ✓ ${name}.png`);
  }

  console.log('→ boot');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await sleep(18000);
  console.log('   ', await line1());

  console.log('→ save slots:', await tap('Save Slots'));
  await sleep(2000);
  console.log('   ', await line1());
  // Tapping a slot only SELECTS it; the screen has its own confirm button.
  console.log('→ slot 1:', await tap('Start a new life here', 0));
  await sleep(1500);
  console.log('→ confirm:', await tap('Start New Game'));
  await sleep(3000);
  console.log('   ', await line1());

  console.log('→ scenario:', await tap('Food Courier'));
  await sleep(1500);

  console.log('→ pace picker');
  for (let i = 0; i < 16; i++) {
    await page.mouse.wheel(0, 700);
    await sleep(160);
    if ((await text()).includes('Choose your pace')) break;
  }
  await page.mouse.wheel(0, 400);
  await sleep(900);
  if (!(await text()).includes('Choose your pace')) {
    console.log('   !! never reached the picker — aborting so no misleading shots are saved');
    throw new Error('picker not reached');
  }

  // Park the heading clear of the STICKY tab row ("Life Paths / Challenges"),
  // which floats above the scroller. Stopping as soon as the text merely exists
  // in the DOM cut "Choose your pace" through the middle — fine for proving the
  // screen was reached, useless as a store screenshot, which is what shot 3 in
  // marketing/aso-v2.7.0-paste-ready.md is for. Measure the gap rather than
  // guessing a scroll distance: the sticky row's height is not a constant.
  for (let i = 0; i < 12; i++) {
    const gap = await page.evaluate(() => {
      const all = [...document.querySelectorAll('div,span')];
      const h = all.filter((e) => (e.textContent || '').trim() === 'Choose your pace').pop();
      if (!h) return null;
      const tabs = all.filter((e) => (e.textContent || '').trim() === 'Challenges').pop();
      const floor = tabs ? tabs.getBoundingClientRect().bottom : 0;
      return h.getBoundingClientRect().top - floor;
    });
    if (gap === null || gap > 24) break;
    await page.mouse.wheel(0, -90);
    await sleep(220);
  }
  await sleep(600);
  await shot('01-picker-classic');
  await tap('1 tap = 52 weeks');
  await sleep(800);
  await shot('02-picker-story');

  console.log('→ onboarding');
  const NEXTS = ['Continue To Identity', 'Continue To Ambitions', 'Continue To Perks', 'Start Your Life'];
  for (let step = 0; step < 12; step++) {
    const before = await text();
    let clicked = '';
    for (const label of NEXTS) {
      if (before.includes(label) && (await tap(label))) { clicked = label; break; }
    }
    await sleep(clicked === 'Start Your Life' ? 10000 : 2000);
    const now = await text();
    console.log(`   ${step}: "${clicked}" → ${now.split('\n').filter(Boolean)[0]}`);
    if (/Age\s*\d/.test(now) || now.includes('Net Worth')) { console.log('   in game'); break; }
    if (!clicked && now === before) { console.log('   stalled'); break; }
  }

  for (const label of ['Got it', 'Dismiss', 'Close']) {
    if ((await text()).includes(label) && (await tap(label))) break;
  }
  await sleep(2500);
  await shot('03-hud');

  // The rest of the store set (marketing/aso-v2.7.0-paste-ready.md §6 wants six
  // shots, and three of them are ordinary in-game screens). Taken BEFORE the
  // year loop on purpose: that loop runs 52 real weekly ticks and can time out,
  // and there is no reason for a slow, failure-prone step to take three easy
  // screenshots down with it.
  console.log('→ tab screens');
  for (const [tab, name] of [
    ['Work', '07-careers'],
    ['Apps', '08-apps'],
    ['Life', '09-life'],
  ]) {
    if (!(await tap(tab))) {
      console.log(`   ${tab}: not found — skipped`);
      continue;
    }
    await sleep(2600);
    await shot(name);
  }
  // Back to Home, or the year loop starts on whatever tab we left behind and
  // the advance control may not be mounted.
  await tap('Home');
  await sleep(2000);

  console.log('→ living years');
  let gotReview = false;
  let gotOffer = false;
  for (let year = 1; year <= 1; year++) {
    const advanced = await page.evaluate(() => {
      const el =
        document.querySelector('[aria-label="Live the next year"]') ||
        document.querySelector('[aria-label="Advance to next week"]');
      if (!el) return false;
      const r = el.getBoundingClientRect();
      const o = {
        bubbles: true, cancelable: true,
        clientX: r.left + r.width / 2, clientY: r.top + r.height / 2,
        pointerId: 1, isPrimary: true,
      };
      el.dispatchEvent(new PointerEvent('pointerdown', o));
      el.dispatchEvent(new PointerEvent('pointerup', o));
      el.dispatchEvent(new MouseEvent('click', o));
      return true;
    });
    if (!advanced) { console.log('   no advance control'); break; }
    // 52 ticks. Measured at ~184ms in Node, but this is an UNMINIFIED dev web
    // bundle with React DevTools hooks live — an order of magnitude slower. Six
    // seconds silently screenshotted a year that had not finished running.
    // Poll for up to 25 minutes: the Year in Review only mounts once liveYear
    // RESOLVES, and a full 52-tick batch is ~18 minutes in the dev bundle.
    let t = '';
    for (let waited = 0; waited < 1500; waited += 10) {
      await sleep(10000);
      t = await text();
      if (/weeks? lived/.test(t)) { console.log(`   year landed after ~${waited}s`); break; }
      if (waited % 120 === 0) console.log(`   ...${waited}s`);
    }
    const inReview = /weeks? lived/.test(t);
    const hasOffer = t.includes('Make the next one count');
    console.log(`   year ${year}: review=${inReview} offer=${hasOffer}`);

    if (inReview && !gotReview) { await shot('04-year-in-review'); gotReview = true; }
    if (inReview && hasOffer) {
      await shot('05-year-in-review-offer');
      gotOffer = true;
      console.log('→ paywall');
      await tap('Make the next one count');
      await sleep(4000);
      await shot('06-paywall');
      console.log('   paywall:', (await text()).replace(/\n+/g, ' | ').slice(0, 180));
      break;
    }
    if (inReview) await tap('Continue');
    await sleep(1200);
  }

  if (!gotOffer) {
    console.log('→ offer did not fire; opening the paywall directly');
    await tap('Continue');
    await sleep(1500);
    for (const tab of ['Progress', 'Life']) if (await tap(tab)) break;
    await sleep(2500);
    for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 600); await sleep(160); }
    if (await tap('DeepLife+')) {
      await sleep(4000);
      await shot('06-paywall');
      console.log('   paywall:', (await text()).replace(/\n+/g, ' | ').slice(0, 180));
    } else {
      await shot('06-paywall-miss');
      console.log('   could not reach it:', (await text()).replace(/\n+/g, ' | ').slice(0, 180));
    }
  }
  console.log('DONE');
} finally {
  await browser.close();
}
