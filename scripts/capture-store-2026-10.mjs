/**
 * Captures for the October 2026 App Store set (screenshots/appstore-2026-10).
 *
 * Same harness as capture-rich-state.mjs (static web export on :8090 with a
 * throwaway EXPO_PUBLIC_SAVE_HMAC_KEY and EXPO_PUBLIC_ENABLE_DEVTOOLS=true),
 * driving the CURRENT onboarding and adding the 2.15.x moments: the stream
 * and video recaps and the Life Skills unlock. Every capture writes its
 * visible text beside the PNG; the compositor asserts frame claims against it.
 *
 *   node scripts/capture-store-2026-10.mjs                                  # phone (430x932 @3x)
 *   VIEW_W=1024 VIEW_H=1366 DSF=2 OUT=screenshots/appstore-2026-10/captures/ipad node scripts/capture-store-2026-10.mjs
 *   ONLY=garage,luxury node scripts/capture-store-2026-10.mjs              # just some screens
 *
 * Long runs can be derailed by a random life event or a purchase sheet;
 * ONLY= lets each screen be captured in its own fresh life.
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { writeFileSync } from 'fs';
import { join } from 'path';

const OUT = process.env.OUT || 'screenshots/appstore-2026-10/captures/phone';
const URL = 'http://localhost:8090';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const VIEWPORT = { width: Number(process.env.VIEW_W) || 430, height: Number(process.env.VIEW_H) || 932 };
const DSF = Number(process.env.DSF) || 3;

const text = (page) => page.evaluate(() => document.body?.innerText || '').catch(() => '');
// includes modal/portal text that innerText misses
const allText = (page) => page.evaluate(() => document.body?.textContent || '').catch(() => '');

async function clickText(page, t, { exact = false, last = false, wait = 1400 } = {}) {
  try {
    let loc = page.getByText(t, { exact });
    loc = last ? loc.last() : loc.first();
    await loc.scrollIntoViewIfNeeded({ timeout: 3000 });
    await loc.click({ timeout: 3000 });
    await sleep(wait);
    console.log('  → clicked', JSON.stringify(t));
    return true;
  } catch { }
  const ok = await page.evaluate((needle) => {
    const els = [...document.querySelectorAll('div,span,button,a,[role="button"],[tabindex]')];
    let best = null;
    for (const el of els) {
      const txt = (el.textContent || '').trim();
      if (!txt) continue;
      if (txt === needle || txt.includes(needle)) {
        if (!best || (el.textContent.length < best.textContent.length)) best = el;
      }
    }
    if (best) { best.click(); return true; }
    return false;
  }, t);
  await sleep(ok ? wait : 200);
  console.log(ok ? `  → dom-clicked ${JSON.stringify(t)}` : `  ✗ not found ${JSON.stringify(t)}`);
  return ok;
}

/**
 * Buys luxury pieces through the app's own Buy buttons, then photographs the
 * Collection tab.
 *
 * Asserts the collection is non-empty before shooting. Without that this is
 * exactly the silent-staleness failure documented at the top of this file: if
 * the Buy button is renamed or a confirm step is added, every click misses,
 * the Collection tab still opens, and a shot of an EMPTY collection is written
 * over the good one — which is the bug the whole capture is meant to remove.
 */
async function buyLuxuryAndShowCollection(page) {
  const owned = async () => {
    const m = (await allText(page)).match(/Collection \((\d+)\)/);
    return m ? Number(m[1]) : 0;
  };
  let bought = await owned();
  for (let attempt = 0; attempt < 5 && bought < 2; attempt++) {
    // Target the aria-label, not the text.
    //
    // The first version matched the shortest element whose text was exactly
    // "Buy" and called `.click()` on it, and every purchase silently missed.
    // `LuxuryApp` renders that label as `affordable ? 'Buy' : formatMoney(price)`
    // inside a Pressable, and the card's own accessibilityLabel is the stable
    // handle: `Buy <name> for <price>`.
    const buy = page.locator('[aria-label^="Buy "]').first();
    if (!(await buy.count())) break;
    try {
      await buy.scrollIntoViewIfNeeded({ timeout: 3000 });
      await buy.click({ timeout: 3000 });
    } catch { break; }
    await sleep(1400);
    // The purchase routes through the shared ConfirmDialog, whose affirmative
    // is "Acquire" — NOT Confirm/Buy Now/Yes/OK, which is what the first
    // attempt guessed, so `dismissPopups` cancelled the sheet Buy had just
    // raised, four times in a row.
    //
    // Match the aria-label, never the text: the Luxury screen's own item list
    // sits under a section header that is ALSO the word "Acquire", and a
    // text match takes the header (it is the shorter node), which is not
    // clickable. `ConfirmDialog` puts `accessibilityLabel={confirmText}` on
    // the button, so this addresses the dialog and nothing else.
    const confirm = page.locator('[aria-label="Acquire"]').first();
    if (!(await confirm.count())) {
      console.log('  ✗ Acquire confirm never appeared');
      break;
    }
    await confirm.click({ timeout: 3000 });
    await sleep(1800);
    const before = bought;
    bought = await owned();
    console.log('  luxury owned:', bought);
    if (bought === before) {
      // Say WHY rather than just counting again — a refused purchase surfaces
      // as a toast, and that sentence is the whole diagnosis.
      const t = (await allText(page)).replace(/\s+/g, ' ');
      console.log('  luxury no-op, screen says:', JSON.stringify(t.slice(0, 400)));
      break;
    }
  }
  await scrollMain(page, -3000); await sleep(800);
  if (!(await clickText(page, 'Collection', { wait: 2200 }))) {
    throw new Error('Luxury › Collection tab not found — frame 09 would keep a stale file.');
  }
  await scrollMain(page, 0); await sleep(1000);
  // Assert on the COUNT the tab itself prints, and nothing else.
  //
  // The first version also rejected `/No .*collectibles|nothing yet/i`, which
  // looks like a reasonable belt-and-braces check and is not: `textContent` is
  // one unbroken string, so `No .*collectibles` matches any page where the
  // words "No " and "collectibles" both appear in that order — and this one
  // has "No recent contact" long before it reaches "2 / 6 collectibles". Two
  // successful purchases were thrown away by the guard meant to protect them.
  const shown = await allText(page);
  const owns = Number((shown.match(/Collection \((\d+)\)/) || [, '0'])[1]);
  // Two separate things have to be true, and the count alone proves only the
  // first: `Collection (n)` is the TAB LABEL, so it reads the same whichever
  // tab is open. `resale value` comes from the collection summary, which only
  // the collection tab renders — that is what proves the tab actually changed.
  const onCollectionTab = /resale value/i.test(shown);
  if (owns < 1 || !onCollectionTab) {
    throw new Error(
      `Luxury shows Collection (${owns}), collection tab open: ${onCollectionTab}, after `
      + `${bought} purchase(s) — frame 09 would caption a collection that is not there. `
      + `Screen: ${JSON.stringify(shown.replace(/\s+/g, ' ').slice(0, 400))}`,
    );
  }
  await shot(page, 'x-luxury-collection');
}

/**
 * Buys property, then photographs the PORTFOLIO.
 *
 * Same shape of problem as the Luxury app, and the same fix. Real Estate opens
 * on an empty portfolio reading `Portfolio equity $0`, `0 properties` and
 * "You don't own any property yet" — so the store set had no real-estate frame
 * at all, against an 8-keyword `RealEstate` ad group in
 * `marketing/apple-ads/keywords/category-exact.csv`. That was a capture gap
 * being mistaken for a content decision.
 *
 * Cash, not a mortgage. The modal defaults to the `standard` down-payment tier
 * (its confirm reads "Sign Mortgage"), which is the realistic path but leaves
 * the portfolio showing equity far below the headline value plus a weekly debt
 * line — a worse picture and a harder caption to keep true week to week. This
 * save holds ~$11M, so "Pay cash" is a state the player can genuinely reach and
 * the equity it prints is simply what the properties are worth.
 */
async function buyPropertyAndShowPortfolio(page) {
  const owned = async () => {
    const m = (await allText(page)).match(/(\d+) properties/);
    return m ? Number(m[1]) : 0;
  };
  if (!(await clickAriaLast(page, 'Browse', { wait: 2000 }))) {
    throw new Error('Real Estate › Browse tab not found — frame 07 would have no portfolio to show.');
  }
  await scrollMain(page, 0); await sleep(900);

  let bought = 0;
  for (let attempt = 0; attempt < 6 && bought < 3; attempt++) {
    // The listing card's own handle. `RealEstateApp` puts
    // `accessibilityLabel={`Buy ${p.name}`}` on the card CTA, which is stable
    // where the visible label is not (it renders the price when unaffordable).
    const buy = page.locator('[aria-label^="Buy "]').nth(bought);
    if (!(await buy.count())) break;
    try {
      await buy.scrollIntoViewIfNeeded({ timeout: 3000 });
      await buy.click({ timeout: 3000 });
    } catch { break; }
    await sleep(1200);
    // Switch the down-payment tier before confirming: the confirm button's TEXT
    // is derived from the tier ("Buy with Cash" vs "Sign Mortgage"), so pressing
    // the wrong one is not a no-op, it signs a 30-year mortgage.
    await clickText(page, 'Pay cash', { exact: true, wait: 900 });
    if (!(await clickText(page, 'Buy with Cash', { exact: true, wait: 1600 }))) {
      console.log('  ✗ Buy with Cash confirm never appeared');
      break;
    }
    await sleep(1400);
    // "🏠 Sold!" comes back through Alert.alert. Handle OK explicitly rather
    // than leaning on dismissPopups, whose label list is tuned for the reward
    // and onboarding sheets and does not include it.
    await clickText(page, 'OK', { exact: true, wait: 900 });
    await dismissPopups(page);
    await sleep(900);
    bought++;
    console.log('  properties bought:', bought);
  }

  if (!(await clickAriaLast(page, 'Portfolio', { wait: 2000 }))) {
    throw new Error('Real Estate › Portfolio tab not found after buying.');
  }
  // Back to the top before shooting. Switching tabs does not reset scroll, and
  // the first run of this landed mid-card: the summary's own headline rows
  // (Portfolio equity, the property count) were above the fold, so the shot
  // opened on "Vacant 0" and the frame had no total to caption.
  await scrollMain(page, -3000); await sleep(700);
  await scrollMain(page, 0); await sleep(1200);
  const shown = await allText(page);
  const owns = Number((shown.match(/(\d+) properties/) || [, '0'])[1]);
  // Two things, for the same reason the Luxury check needs two: the count alone
  // can be read off a tab that is not open. The empty-state sentence is what
  // proves the portfolio actually filled.
  const stillEmpty = /don.t own any property yet/i.test(shown);
  if (owns < 1 || stillEmpty) {
    throw new Error(
      `Real Estate shows ${owns} properties, empty-state visible: ${stillEmpty}, after `
      + `${bought} purchase(s) — frame 07 would caption a portfolio that is not there. `
      + `Screen: ${JSON.stringify(shown.replace(/\s+/g, ' ').slice(0, 400))}`,
    );
  }
  await shot(page, 'x-realestate-portfolio');
}

/**
 * Buys a driver's licence and a car, then photographs the GARAGE.
 *
 * The third instance of the same pattern, and the last one this set needs. Like
 * Luxury and Real Estate, the Vehicles app opens on a shop rather than on
 * anything owned — worse here, because it opens BEHIND a gate: "Get your
 * driver's license — Costs $500 · Required to own any vehicle", with every Buy
 * button in the dealership reading "License needed". So the only picture the
 * pipeline could take of the garage was of a locked shop.
 *
 * The Exotic Supercar is the pick on purpose. It is $250,000 against the
 * ~$9.7M this save is holding, it requires reputation 50 and the save has 100,
 * and its render is the strongest object in `assets/images/Vehicles/` — which
 * matters because the frame composites it.
 *
 * Cash, not finance. The modal defaults to the `standard` down-payment tier and
 * its confirm reads "Sign Auto Loan"; pressing the affirmative without
 * switching the tier first signs a loan and leaves the garage showing a debt
 * line instead of a car somebody owns. Same trap as the property modal.
 */
async function buyVehicleAndShowGarage(page) {
  // The app opens on Dealership when nothing is owned, but say so explicitly
  // rather than relying on that: `activeTab` is initialised from the vehicle
  // count, so the tab it lands on changes the moment this step succeeds once.
  await clickAriaLast(page, 'Dealership', { wait: 1600 });
  await scrollMain(page, 0); await sleep(800);

  // The gate. Its label carries the price, which is a constant in
  // `lib/vehicles`, so match on the stable prefix instead.
  const licence = page.locator('[aria-label^="Pay 500 dollars for a driver"]').first();
  if (await licence.count()) {
    await licence.click({ timeout: 3000 });
    await sleep(1400);
    await clickText(page, 'OK', { exact: true, wait: 700 });
    console.log('  driver licence bought');
  }

  const buy = page.locator('[aria-label^="Buy Exotic Supercar"]').first();
  if (!(await buy.count())) {
    throw new Error('Dealership has no Exotic Supercar row — the catalog moved, or the licence gate is still up.');
  }
  await buy.scrollIntoViewIfNeeded({ timeout: 3000 });
  await buy.click({ timeout: 3000 });
  await sleep(1300);
  await clickText(page, 'Pay cash', { exact: true, wait: 900 });
  if (!(await clickText(page, 'Buy with Cash', { exact: true, wait: 1600 }))) {
    throw new Error('Vehicle purchase confirm never appeared — frame 08 would show an empty garage.');
  }
  await sleep(1500);
  await clickText(page, 'OK', { exact: true, wait: 900 });
  await dismissPopups(page);
  await sleep(900);

  if (!(await clickAriaLast(page, 'Garage', { wait: 2000 }))) {
    throw new Error('Vehicles > Garage tab not found after buying.');
  }
  await scrollMain(page, -3000); await sleep(700);
  await scrollMain(page, 0); await sleep(1200);
  const shown = await allText(page);
  // Two things again, for the reason the other two steps needed two: the car's
  // name alone can be read off the dealership listing, so the empty-state
  // sentence is what proves the GARAGE filled.
  const stillEmpty = /Garage is empty|Get your license first/i.test(shown);
  if (!/Exotic Supercar/i.test(shown) || stillEmpty) {
    throw new Error(
      `Garage does not show the Exotic Supercar (empty-state visible: ${stillEmpty}) — frame 08 `
      + `would caption a garage with nothing in it. Screen: `
      + `${JSON.stringify(shown.replace(/\s+/g, ' ').slice(0, 400))}`,
    );
  }
  await shot(page, 'x-garage-owned');
}

/**
 * The text a reader can actually SEE in the shot — not `document.body.textContent`.
 *
 * This is the difference between a guard and a fig leaf. The whole-DOM text of
 * any screen in this app includes every other tab, every collapsed section and
 * everything below the fold, so asserting a caption's number against it proves
 * only that the string exists SOMEWHERE in the app — which is exactly the
 * thing that was already true of "PhD unlocked" while the frame showed a
 * catalogue of un-taken courses.
 *
 * A rect-in-viewport test alone is NOT enough, and the first version of this
 * made exactly that mistake: every phone app in this game opens as a full
 * screen ABOVE the tab layout, which stays mounted underneath with all its
 * rects still inside the viewport. So the "visible" text of the Stocks app
 * came back led by the home screen's HUD, net worth and daily-gem banner —
 * none of which is in the picture. That is the same fig leaf as using the
 * whole DOM, just harder to notice.
 *
 * So each text node is hit-tested with `elementFromPoint` at its own rect
 * (a Range rect, not the parent's — a parent can be far larger than the line
 * it holds). A node counts as visible only if the topmost element at that
 * point is the node's own element, or in the same ancestor chain. Text under a
 * translucent overlay is rejected too, which is stricter than the screenshot
 * strictly is — the right direction for a check whose job is to refuse
 * unsupported claims.
 */
async function visibleText(page) {
  return page.evaluate(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const out = [];
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = (n.nodeValue || '').trim();
      if (!t) continue;
      const el = n.parentElement;
      if (!el) continue;
      const style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) continue;
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw) continue;
      // Hit-test the middle of the part of the line that is actually on screen.
      const x = Math.min(Math.max((r.left + r.right) / 2, 1), vw - 1);
      const y = Math.min(Math.max((r.top + r.bottom) / 2, 1), vh - 1);
      const hit = document.elementFromPoint(x, y);
      if (!hit) continue;
      if (hit !== el && !el.contains(hit) && !hit.contains(el)) continue;
      out.push(t);
    }
    return out.join(' ').replace(/\s+/g, ' ').trim();
  }).catch(() => '');
}

async function clickAriaLast(page, label, { wait = 1200 } = {}) {
  try {
    await page.locator(`[aria-label="${label}"]`).last().click({ timeout: 3000 });
    await sleep(wait);
    console.log('  → aria(last)', label);
    return true;
  } catch { console.log('  ✗ aria', label); return false; }
}

async function chewLifeMoments(page) {
  for (let i = 0; i < 20; i++) {
    if (!(await allText(page)).includes('Life Moment')) return;
    const r = await page.evaluate(() => {
      const all = [...document.querySelectorAll('div')];
      const marker = all.find(e => (e.textContent || '').trim() === 'Life Moment');
      if (!marker) return 'no-marker';
      // smallest ancestor that holds the whole popup (title + options) but not the page
      let root = marker.parentElement;
      while (root && root.parentElement) {
        const t = root.textContent || '';
        if (t.includes('Life Moment') && t.length > 80) break;
        root = root.parentElement;
      }
      while (root && root.parentElement && (root.parentElement.textContent || '').length < 900
             && (root.parentElement.textContent || '').includes('Life Moment')) {
        root = root.parentElement;
      }
      if (!root) return 'no-root';
      const btns = [...root.querySelectorAll('[role="button"],[tabindex="0"]')];
      for (const b of btns) {
        const t = (b.textContent || '').trim();
        // real options are wordy labels, not bare numbers/icons
        if (t && t.length >= 6 && t.length < 60 && /[a-zA-Z] [a-zA-Z]/.test(t) && t !== 'Life Moment') {
          b.click(); return 'chose: ' + t.slice(0, 30);
        }
      }
      return 'no-option';
    });
    console.log('  life-moment', r);
    await new Promise(res => setTimeout(res, 1500));
    if (r === 'no-marker' || r === 'no-option') return;
  }
}

// Canonical capture order. Each screenshot's numeric prefix is derived from its
// FIXED position here — not a mutable success-counter — so a skipped conditional
// capture (an app that fails to open) leaves its own slot empty instead of
// shifting every later file's index. The generators hardcode these names
// (e.g. `27-home-final.png`), so a missing capture then fails loudly (ENOENT)
// rather than silently remapping to the wrong screen. Keep this in sync with the
// shot() call order below.
const SHOT_ORDER = [
  'home', 'home-goals', 'work', 'apps', 'apps-2',
  'app-spark', 'app-pulse', 'app-stocks', 'app-bank', 'app-contacts', 'app-education',
  'life', 'life-2', 'life-market', 'life-family', 'life-stats', 'desktop',
  'x-company', 'x-darkweb', 'x-crypto', 'x-realestate', 'x-garage', 'x-luxury',
  'x-politics', 'x-travel', 'x-streaming', 'x-youvideo', 'home-final',
  // APPENDED, never inserted — the numbers above are baked into the generators
  // and into `screenshots/appstore-2026/README.md`, so inserting in the middle
  // silently remaps every later frame to the wrong screen.
  //
  // Both of these exist because the store set was making claims its pictures
  // contradicted. The Education app opens on its *Catalog* tab, so the frame
  // captioned "PhD unlocked" showed a course list with Enroll buttons and
  // nothing marked earned; the Luxury app opens on *Browse*, so the frame
  // captioned "Rare collection" showed `Collection (0)` and `0 / 6
  // collectibles`. The fix is to photograph the screen that holds the proof.
  'app-education-earned', 'x-luxury-collection',
  // The BEGINNING of the life, shot before any dev-tools grant lands.
  //
  // Everything above is one rich late-game save, which can only ever show the
  // destination. A life sim's pitch is the DISTANCE travelled, and the store
  // set's first frame is the hook — "start with nothing" is the strongest
  // opening this game has and there was no picture of it. These are free: the
  // run already walks through onboarding on its way to the rich state, so
  // photographing it on the way past costs two screenshots and no extra time.
  'early-home', 'early-work',
  // One weekly decision, OPEN, before the inbox is cleared.
  //
  // `CPP-LifeSim` slot 2 in marketing/apple-ads/04-custom-product-pages.md asks
  // for exactly this ("Every week is a decision." — the week loop with an event
  // choice open), and the Choices-Story ad group exists because "choices game"
  // carries large search volume. Until now the pipeline's first act was to
  // DELETE all twelve of these from every capture — the game's core loop was
  // the one thing the store page could never show.
  'event-decision',
  // The real-estate PORTFOLIO, after buying. Same reason as
  // `x-luxury-collection` above: the app opens on an empty portfolio, so the
  // only picture the pipeline could take of an 8-keyword intent group was of
  // owning nothing.
  'x-realestate-portfolio',
  // The GARAGE with a car in it. Third of the same kind: the Vehicles app opens
  // on a dealership behind a driver's-licence gate, so every previous capture of
  // it was a picture of a locked shop.
  'x-garage-owned',
];
/**
 * Empties the weekly-decision inbox.
 *
 * The 104 weeks of skipping that build the rich state also queue ~12 events,
 * and the tab layout floats a "12 decisions waiting" pill until they are dealt
 * with. It is not transient: it sat in EVERY capture, so the composed store
 * frames showed it on all three phones at once, and on the Home tab it landed
 * on top of the daily-gems banner with the two texts overlapping.
 *
 * Resolved the way a player would — open the pill, take a choice, repeat —
 * rather than hidden from the DOM. A store screenshot has to be a state the
 * app can actually be in.
 */
async function clearDecisions(page) {
  for (let round = 0; round < 40; round++) {
    const t = await allText(page);
    const pill = /(\d+ decisions waiting|A decision is waiting)/.exec(t);
    if (!pill) break;
    if (!(await clickText(page, pill[1], { wait: 1200 }))) break;
    // Take a choice. Any choice resolves the event, so this picks the LOWEST
    // button on screen — the choice list sits at the bottom of the sheet,
    // below the effects preview.
    const took = await page.evaluate(() => {
      const buttons = [...document.querySelectorAll('[role="button"]')]
        .map((el) => ({ el, r: el.getBoundingClientRect() }))
        .filter(({ el, r }) => r.width > 80 && r.height > 20 && (el.getAttribute('aria-label') || '').length > 2);
      if (!buttons.length) return false;
      buttons.sort((a, b) => b.r.top - a.r.top);
      buttons[0].el.click();
      return true;
    });
    if (!took) break;
    await sleep(1100);
  }
  const left = /(\d+ decisions waiting|A decision is waiting)/.test(await allText(page));
  console.log('decisions cleared?', !left);
  if (left) {
    throw new Error('Failed to clear decision inbox — UI states unavailable for capture');
  }
}

let SHOT_N = 0;
async function shot(page, name) {
  await chewLifeMoments(page);
  try {
    const d = page.locator('[aria-label="Dismiss"]');
    if (await d.count()) { await d.last().click({ timeout: 1500 }); await sleep(900); }
  } catch { }
  SHOT_N++;
  const file = join(OUT, name + '.png');
  await page.screenshot({ path: file });
  writeFileSync(file.replace(/[.]png$/, '.txt'), (await visibleText(page)) + String.fromCharCode(10));
  console.log('  SHOT', name);
}

/**
 * Scrolls the app's main list. Pass 0 to jump back to the top.
 *
 * `page.mouse.wheel` does NOTHING here — react-native-web's ScrollView is an
 * overflow div that Playwright's synthetic wheel never reaches, so every
 * `wheel()` in this script was a silent no-op and shots meant to be "the same
 * screen, scrolled" were byte-identical duplicates of the unscrolled one.
 *
 * The scrolling that DID happen was accidental: `clickText` calls
 * `scrollIntoViewIfNeeded`, so clicking the decision pill left Home parked
 * halfway down, and the hero capture of an avatar release contained no face.
 */
async function scrollMain(page, dy) {
  await page.evaluate((amount) => {
    const scrollers = [...document.querySelectorAll('*')].filter(
      (e) => e.scrollHeight > e.clientHeight + 40 && e.clientHeight > 200
    );
    if (!scrollers.length) return;
    // The biggest one is the screen's own list; the rest are modals and rails.
    scrollers.sort((a, b) => b.clientHeight * b.clientWidth - a.clientHeight * a.clientWidth);
    // "Top" means every list: the biggest scroller is not always the screen's
    // own list (the garage hero was left parked under its tab bar).
    if (amount === 0) { scrollers.forEach((e) => { e.scrollTop = 0; }); return; }
    const el = scrollers[0];
    el.scrollTop = el.scrollTop + amount;
  }, dy);
  await sleep(900);
}

async function waitFor(page, needle, timeout = 45000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if ((await text(page)).includes(needle)) { await sleep(600); return true; }
    await sleep(800);
  }
  console.log(`   (timed out waiting for "${needle}")`);
  return false;
}

// wait until page text is stable (no change across two 2s polls)
async function waitStable(page, maxMs = 90000) {
  let prev = '';
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    const t = await allText(page);
    if (t === prev && t.length > 0) return;
    prev = t;
    await sleep(2000);
  }
}

async function dismissPopups(page) {
  for (const label of ['Claim Reward', 'Claim', 'Awesome', 'Got it', 'Continue', 'Dismiss']) {
    if (await clickText(page, label, { exact: true, wait: 700 })) break;
  }
}

// ===== Store capture main (2026-10) =====
const realClick = async (page, label, { exact = true, last = true, wait = 1500 } = {}) => {
  const loc = page.getByText(label, { exact });
  const n = await loc.count();
  if (!n) return false;
  try {
    const el = last ? loc.last() : loc.first();
    await el.scrollIntoViewIfNeeded({ timeout: 2500 });
    await el.click({ timeout: 3000 });
    await sleep(wait);
    return true;
  } catch { return false; }
};
const clearPopups = async (page) => {
  for (let i = 0; i < 10; i++) {
    let hit = null;
    for (const l of ['Claim Reward', 'Maybe later', 'Not now', 'Got it', 'Awesome', 'Skip Guide', 'Nice!']) {
      if (await realClick(page, l, { wait: 1300 })) { hit = l; break; }
    }
    if (!hit) return;
    console.log('  popup:', hit);
  }
};
// An event modal can open on its own at any point. Take its first choice so
// it never sits over a screen being driven or photographed.
const firstChoiceLabel = (page) => page.evaluate(() => {
  const leaves = [...document.querySelectorAll('div,span')].filter(e => e.children.length === 0 && (e.textContent || '').trim());
  const k = leaves.findIndex(e => (e.textContent || '').trim().toLowerCase() === 'choice effects');
  return k >= 0 && leaves[k + 1] ? (leaves[k + 1].textContent || '').trim() : null;
});
const pickOpenChoice = async (page) => {
  for (let k = 0; k < 5; k++) {
    if (!(await allText(page)).includes('Choice Effects')) return;
    const label = await firstChoiceLabel(page);
    if (!label || !(await realClick(page, label, { exact: true, last: true, wait: 1600 }))) {
      await page.mouse.click(Math.round(VIEWPORT.width / 2), Math.round(VIEWPORT.height * 0.68));
      await sleep(1600);
    }
  }
};
const goTab = async (page, label) => {
  await pickOpenChoice(page);
  await page.evaluate((l) => {
    const tabs = [...document.querySelectorAll('[role="tab"],a[href]')].filter(e => {
      const r = e.getBoundingClientRect();
      return r.top > window.innerHeight - 110 && (e.textContent || '').trim() === l;
    });
    if (tabs.length) tabs[tabs.length - 1].click();
  }, label);
  await sleep(2400);
  await clearPopups(page);
  await scrollMain(page, 0);
  await chewLifeMoments(page);
};
const roleTab = (page, label) => page.evaluate((l) => {
  const t = [...document.querySelectorAll('[role="tab"]')].filter(e => (e.textContent || '').trim() === l && e.getBoundingClientRect().width > 0);
  if (t.length) { t[0].click(); return true; } return false;
}, label);
const openApp = async (page, name) => {
  await pickOpenChoice(page);
  await goTab(page, 'Apps');
  await roleTab(page, 'All apps'); await sleep(900);
  for (let s = 0; s < 5; s++) {
    try {
      const loc = page.getByText(name, { exact: true }).first();
      await loc.scrollIntoViewIfNeeded({ timeout: 2000 });
      await loc.click({ timeout: 2500 });
      await sleep(3200);
      const t = await text(page);
      if (!t.includes('Your phone and desktop software') && !t.includes('Next week')) return true;
    } catch { await scrollMain(page, 500); }
  }
  console.log('  APP NOT OPENED', name);
  if (!globalThis.__dbgShot) { globalThis.__dbgShot = true; await page.screenshot({ path: OUT + '/../dbg-app-not-opened.png' }); console.log('  DBG TEXT', JSON.stringify((await allText(page)).slice(-500))); }
  return false;
};
const back = async (page) => {
  const b = page.locator('[aria-label="Back"]').first();
  if (await b.count()) { try { await b.click({ timeout: 2000 }); await sleep(1500); return; } catch { } }
  await page.mouse.click(Math.round(VIEWPORT.width * 0.05) + 22, 36); await sleep(1500);
};

// Resolve every pending decision by taking its first choice, so no badge or
// pill sits on top of the shots. Photographs the first decision on the way.
const resolveDecisions = async (page, photograph) => {
  let shotTaken = false;
  for (let n = 0; n < 25; n++) {
    await goTab(page, 'Home');
    const pill = page.getByText(/decisions? (is )?waiting|A decision is waiting/).last();
    if (!(await pill.count())) break;
    try { await pill.click({ timeout: 2500 }); } catch { break; }
    let open = false;
    for (let i = 0; i < 8 && !open; i++) { await sleep(500); open = (await allText(page)).includes('Choice Effects'); }
    if (!open) break;
    if (photograph && !shotTaken) { await shot(page, 'event-decision'); shotTaken = true; }
    await pickOpenChoice(page);
    const picked = !(await allText(page)).includes('Choice Effects');
    await sleep(1600);
    await clearPopups(page);
    if (!picked) break;
  }
};

const want = (n) => !process.env.ONLY || process.env.ONLY.split(',').includes(n);
async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: DSF, isMobile: VIEWPORT.width < 700, hasTouch: true });
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 200)));
  page.on('console', m => { if (m.type() === 'error') console.log('[console.error]', m.text().slice(0, 400)); });
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  if (!(await waitFor(page, 'Custom life', 120000))) throw new Error('menu never appeared');
  await sleep(2000);

  // ---- New life through the current onboarding
  await clickText(page, 'Custom life', { wait: 3500 });
  const CTAS = ['See your life unfold', 'Look beyond one lifetime', 'Choose my starting life', 'Start Your Life', 'Continue To Perks', 'Continue To Identity'];
  let inGame = false;
  for (let step = 0; step < 14 && !inGame; step++) {
    const txt = await text(page);
    if (txt.includes('Next week')) { inGame = true; break; }
    if (txt.includes('Choose Scenario')) await clickText(page, 'Food Courier', { wait: 800 });
    const clicked = await page.evaluate((ctas) => {
      for (const c of ctas) {
        const els = [...document.querySelectorAll('div,span')].filter(e => (e.textContent || '').trim() === c && e.getBoundingClientRect().width > 0);
        if (els.length) { els[els.length - 1].click(); return c; }
      }
      return null;
    }, CTAS);
    console.log('  onboarding', step, '->', clicked);
    await sleep(4000);
    inGame = (await text(page)).includes('Next week');
  }
  if (!inGame) throw new Error('never reached the game');
  await clearPopups(page);

  // ---- Rich state through dev tools
  await clickAriaLast(page, 'Open Settings', { wait: 2500 });
  await clickText(page, 'Game Dev Tools', { wait: 2500 });
  await page.evaluate(() => {
    const label = [...document.querySelectorAll('div')].find(e => (e.textContent || '').trim() === 'God Mode (no stat drain)');
    let node = label;
    for (let up = 0; up < 6 && node; up++) {
      node = node.parentElement;
      const sw = node && node.querySelector('[role="switch"]');
      if (sw) { sw.click(); return; }
    }
  });
  await sleep(800);
  for (let i = 0; i < 2; i++) { await clickText(page, '+52 Weeks', { exact: true, wait: 2000 }); await waitStable(page, 120000); await clickText(page, 'Revive', { exact: true, wait: 900 }); }
  for (const c of ['Grant Top Career', 'Give a Company', 'Add All Education', 'Give Spouse + Kids', '+$1M', 'Net Worth +$10M', '+1000 Gems', '+1000 Prestige Pts', 'Max All Stats']) {
    await clickText(page, c, { exact: true, wait: 900 });
  }
  await clickText(page, 'Setups', { exact: true, wait: 1200 });
  await clickText(page, 'Darkweb (BTC + opsec)', { exact: true, wait: 1400 });
  await clickText(page, 'Creator (big channel)', { exact: true, wait: 1400 });
  await clickText(page, 'Cheats', { exact: true, wait: 1200 });
  await clickText(page, 'Revive', { exact: true, wait: 900 });
  await clickText(page, 'Save Game', { exact: true, wait: 2500 });
  await page.goto(URL + '/', { waitUntil: 'domcontentloaded' });
  if (!(await waitFor(page, 'Continue', 60000))) throw new Error('no continue');
  await sleep(4000);
  await realClick(page, 'Continue', { wait: 6000 });
  if (!(await waitFor(page, 'Next week', 40000))) throw new Error('continue failed');
  await sleep(5000);
  await clearPopups(page);
  await chewLifeMoments(page);

  // ---- Decisions: photograph one, resolve them all
  await resolveDecisions(page, true);

  // ---- Home
  await goTab(page, 'Home');
  await shot(page, 'home');

  // ---- Computer
  await goTab(page, 'Life');
  await roleTab(page, 'Market'); await sleep(2500);
  for (let k = 0; k < 12; k++) {
    if (await page.evaluate(() => /desktop apps/i.test(document.body.textContent || ''))) break;
    await scrollMain(page, 600);
  }
  console.log('computer:', await page.evaluate(() => {
    const rows = [...document.querySelectorAll('div')].filter(d => {
      const t = d.textContent || '';
      return /computer/i.test(t) && /desktop apps/i.test(t) && t.includes('Buy') && t.length < 400;
    });
    rows.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
    const btn = rows[0] && [...rows[0].querySelectorAll('div,span')].find(e => (e.textContent || '').trim() === 'Buy');
    if (!btn) return 'no-btn';
    btn.click();
    return 'clicked';
  }));
  await sleep(1800);
  await page.evaluate(() => {
    const cancel = [...document.querySelectorAll('div,span')].filter(e => (e.textContent || '').trim() === 'Cancel').pop();
    let box = cancel;
    for (let i = 0; i < 6 && box; i++) { box = box.parentElement; if (box && /Buy/.test(box.textContent || '')) break; }
    const buy = box && [...box.querySelectorAll('div,span')].filter(e => (e.textContent || '').trim() === 'Buy').pop();
    if (buy) buy.click();
  });
  await sleep(2500);

  // ---- Business, love, money, risk
  if (want('company') && await openApp(page, 'Hustle')) { await shot(page, 'company'); await back(page); }
  if (want('spark') && await openApp(page, 'Spark')) { await shot(page, 'spark'); await back(page); }
  if (want('stocks') && await openApp(page, 'Stocks')) { await shot(page, 'stocks'); await back(page); }
  if (want('darkweb') && await openApp(page, 'Dark Web')) { await shot(page, 'darkweb'); await back(page); }

  // ---- Streaming: go live, let it run, stop, photograph the recap
  if (want('stream') && await openApp(page, 'Streaming')) {
    await roleTab(page, 'Go Live'); await sleep(1500);
    await realClick(page, 'Go live', { wait: 2000 });
    await sleep(22000);
    await shot(page, 'stream-live');
    await realClick(page, 'Stop stream', { wait: 2500 });
    let ok = false;
    for (let i = 0; i < 8 && !ok; i++) { await sleep(700); ok = /Peak viewers/.test(await allText(page)); }
    await sleep(1500);
    if (ok) await shot(page, 'stream-recap'); else console.log('  NO STREAM RECAP');
    await realClick(page, 'Nice!', { wait: 1200 });
    await back(page);
  }

  // ---- YouVideo: shuffle a title, upload, photograph the recap
  if (want('video') && await openApp(page, 'YouVideo')) {
    await roleTab(page, 'Record'); await sleep(1200);
    await page.locator('[aria-label="Suggest a title"]').last().click({ timeout: 3000 }).catch(() => {});
    await sleep(900);
    await realClick(page, 'Record & upload', { wait: 2500 });
    let ok = false;
    for (let i = 0; i < 8 && !ok; i++) { await sleep(700); ok = /New subs/.test(await allText(page)); }
    await sleep(1500);
    if (ok) await shot(page, 'video-recap'); else console.log('  NO VIDEO RECAP');
    await realClick(page, 'Nice!', { wait: 1200 });
    await back(page);
  }

  // ---- Ownership: buy through the apps' own buttons, then photograph
  const confirmBuy = async () => {
    for (let k = 0; k < 3; k++) {
      let hit = false;
      for (const l of ['Buy with Cash', 'Purchase', 'Confirm', 'Buy']) {
        if (await realClick(page, l, { wait: 1800 })) { hit = true; break; }
      }
      await realClick(page, 'OK', { wait: 900 });
      const t = await allText(page);
      if (!hit || !/Buy with Cash|Cash after purchase/.test(t)) break;
    }
  };
  if (want('realestate') && await openApp(page, 'Real Estate')) {
    // The Browse tab - the listings with their artwork - is the stronger
    // store frame, and buying opens a multi-step mortgage sheet.
    await roleTab(page, 'Browse'); await sleep(2500); await scrollMain(page, 0);
    await shot(page, 'realestate');
    await back(page);
  }
  if (want('garage') && await openApp(page, 'Garage')) {
    try { await buyVehicleAndShowGarage(page); } catch (e) { console.log('  garage:', e.message); }
    await roleTab(page, 'Garage'); await sleep(1500); await scrollMain(page, 0);
    await shot(page, 'garage');
    await back(page);
  }
  if (want('luxury') && await openApp(page, 'Luxury')) {
    const buy = page.getByText(/^Buy \$/).first();
    if (await buy.count()) { try { await buy.click({ timeout: 2500 }); await sleep(1500); await confirmBuy(); } catch { } }
    await page.evaluate(() => {
      const t = [...document.querySelectorAll('[role="tab"]')].find(e => /Collection/.test(e.textContent || ''));
      if (t) t.click();
    });
    await sleep(1800);
    await shot(page, 'luxury');
    await back(page);
  }

  // ---- Life Skills: the tree, then a real unlock and its celebration
  if (want('skills')) {
  await goTab(page, 'Profile');
  await scrollMain(page, 1500);
  if (!(await allText(page)).includes('Life Skills')) {
    await page.evaluate(() => {
      const el = [...document.querySelectorAll('div,span')].filter(e => /tools\s*&\s*more/i.test((e.textContent || '').trim()) && (e.textContent || '').length < 40).pop();
      if (el) el.click();
    });
    await sleep(1500);
  }
  if (await realClick(page, 'Life Skills', { wait: 2800 })) {
    await shot(page, 'skills-tree');
    await realClick(page, 'Networking', { wait: 1500 });
    const unlocked = await page.evaluate(() => {
      const el = [...document.querySelectorAll('div,span')].filter(e => /^Unlock ·/.test((e.textContent || '').trim())).pop();
      if (!el) return false;
      el.click();
      return true;
    });
    await sleep(2200);
    if (unlocked && (await allText(page)).includes('SKILL UNLOCKED')) await shot(page, 'skill-unlocked');
    else console.log('  NO SKILL CELEBRATION', unlocked);
  }
  }

  await browser.close();
  console.log('STORE CAPTURE DONE', SHOT_N);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
