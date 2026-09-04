/**
 * Photograph the four screens fixed on 2026-09-04, so the fixes can be checked
 * against the player's original screenshots rather than against a description.
 *
 * Runs against the static web export on :8090, the same harness
 * `capture-rich-state.mjs` uses:
 *
 *   export EXPO_PUBLIC_SAVE_HMAC_KEY=<any throwaway string>
 *   export EXPO_PUBLIC_ENABLE_DEVTOOLS=true EXPO_PUBLIC_BORING_BUILD=true
 *   npx expo export --platform web --output-dir /tmp/webshots --clear
 *   node scripts/serve-web-export.mjs /tmp/webshots 8090 &
 *   node scripts/capture-screenshot-fixes.mjs
 *
 * Two things that each cost a full rebuild to learn:
 *
 * 1. WITHOUT `EXPO_PUBLIC_SAVE_HMAC_KEY` the build refuses to start a life at
 *    all - "Build Configuration Error: this app build is missing required save
 *    security configuration". It says so in a dialog OVER the main menu, so the
 *    menu text is still present and a naive wait-for-the-game just times out
 *    without ever saying why. The script names that case explicitly.
 *    Any throwaway value works; these captures are local and disposable, and
 *    the key must NOT be the production one - rotating that invalidates every
 *    real save (tasks/OWNER-CHECKLIST-v2.8.0.md).
 *
 * 2. `--clear` is REQUIRED when you change one of these variables. Metro caches
 *    transforms, and `EXPO_PUBLIC_*` values are inlined AT TRANSFORM TIME - so
 *    a re-export with the variable newly set reuses the cached module and
 *    compiles `process.env.EXPO_PUBLIC_SAVE_HMAC_KEY` to `void 0` again. The
 *    tell is the output bundle hash coming back byte-identical to the run
 *    before it.
 *
 * Every shot writes its on-screen TEXT beside it, and the script ASSERTS the
 * thing it is meant to show is actually on screen before it writes the file.
 * Without that this is the silent-staleness failure `capture-rich-state.mjs`
 * documents at length: a click that misses still leaves a renderable screen,
 * and the capture quietly becomes a photograph of the bug.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const OUT = process.env.OUT || 'screenshots/fixes-2026-09-04';
const URL = 'http://localhost:8090';
const VIEWPORT = { width: 430, height: 932 };
const DSF = Number(process.env.DSF) || 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const text = (page) => page.evaluate(() => document.body?.innerText || '').catch(() => '');
const allText = (page) => page.evaluate(() => document.body?.textContent || '').catch(() => '');

async function waitFor(page, needle, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if ((await allText(page)).includes(needle)) { await sleep(500); return true; }
    await sleep(700);
  }
  console.log(`   (timed out waiting for ${JSON.stringify(needle)})`);
  return false;
}

async function clickText(page, t, { exact = false, wait = 1400, last = false } = {}) {
  try {
    let loc = page.getByText(t, { exact });
    loc = last ? loc.last() : loc.first();
    await loc.scrollIntoViewIfNeeded({ timeout: 2500 });
    await loc.click({ timeout: 2500 });
    await sleep(wait);
    console.log('  -> clicked', JSON.stringify(t));
    return true;
  } catch { /* fall through to the DOM walk */ }
  const ok = await page.evaluate((needle) => {
    const els = [...document.querySelectorAll('div,span,button,a,[role="button"],[tabindex]')];
    let best = null;
    for (const el of els) {
      const txt = (el.textContent || '').trim();
      if (!txt) continue;
      if (txt === needle || txt.includes(needle)) {
        if (!best || el.textContent.length < best.textContent.length) best = el;
      }
    }
    if (best) { best.click(); return true; }
    return false;
  }, t);
  await sleep(ok ? wait : 200);
  console.log(ok ? `  -> dom-clicked ${JSON.stringify(t)}` : `  x not found ${JSON.stringify(t)}`);
  return ok;
}

/**
 * Buy a shop item through its own card's Buy button.
 *
 * Same targeting problem as `clickFoodBuy`: the Market lists many rows and a
 * bare "Buy" click buys whichever one happens to be first.
 */
async function buyItem(page, name) {
  const ok = await page.evaluate((wanted) => {
    let card = null;
    for (const el of document.querySelectorAll('div')) {
      const t = el.textContent || '';
      if (t.includes(wanted) && /Buy/.test(t)) {
        if (!card || t.length < (card.textContent || '').length) card = el;
      }
    }
    if (!card) return false;
    const buy = [...card.querySelectorAll('div,span,button,[role="button"],[tabindex]')]
      .filter((e) => (e.textContent || '').trim() === 'Buy')
      .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
    if (!buy) return false;
    buy.click();
    return true;
  }, name);
  await sleep(2000);
  // A purchase this size may ask first.
  for (const confirm of ['Confirm', 'Buy', 'Yes']) {
    const loc = page.locator(`[aria-label="${confirm}"]`).locator('visible=true');
    if (await loc.count()) { await loc.last().click({ timeout: 2000 }).catch(() => {}); await sleep(1500); break; }
  }
  console.log(ok ? `  -> bought ${JSON.stringify(name)}` : `  x could not buy ${JSON.stringify(name)}`);
  return ok;
}

/** Click by accessibility label, preferring the one actually on screen. */
async function clickAria(page, label, { wait = 1500 } = {}) {
  const loc = page.locator(`[aria-label="${label}"]`).locator('visible=true');
  if (!(await loc.count())) { console.log(`  x no visible [aria-label="${label}"]`); return false; }
  await loc.last().click({ timeout: 3000 }).catch(() => {});
  await sleep(wait);
  return true;
}

/**
 * Raise the unlock tier through the game's own dev tools, so the grid this
 * capture is about actually has apps in it.
 *
 * Progressive disclosure (lib/progress/featureUnlocks.ts) derives the tier from
 * chapter progress and a wealth mark, so a FRESH save shows almost nothing:
 * Spark, Pulse, Stocks and Bank are all still behind the "Locked" shelf, and
 * Bank Pro does not exist to open. Without this the capture succeeds, writes a
 * near-empty grid, and looks like the tile fix did nothing.
 */
async function grantProgress(page) {
  await clickAria(page, 'Open Settings', { wait: 2600 });
  if (!(await waitFor(page, 'Game Dev Tools', 15000))) throw new Error('settings never opened');
  await clickText(page, 'Game Dev Tools', { wait: 2600 });
  if (!(await waitFor(page, 'Max All Stats', 15000))) throw new Error('devtools never opened');
  for (const grant of ['+$1M', 'Grant Top Career', 'Max All Stats']) {
    await clickText(page, grant, { exact: true, wait: 1100 });
  }
  await closeModal(page);
  await closeModal(page);
  await sleep(1500);
}

/**
 * Close whatever modal is open, and PROVE it closed.
 *
 * `page.locator('[aria-label="Close"]').first()` is the trap: react-native-web
 * keeps every mounted screen and modal in the DOM, so that selector matches a
 * dozen hidden close buttons and `.first()` picks one of those. Playwright then
 * waits for a hidden element to become clickable, times out, and the catch
 * swallows it - leaving the modal open. Every subsequent `page.mouse.click` on
 * the tab bar lands on the modal's backdrop instead, so the capture walks the
 * whole script and photographs the same screen six times. `visible=true` is
 * what makes the selector mean what it reads as.
 */
async function closeModal(page) {
  const before = (await allText(page)).length;
  const visibleClose = page.locator('[aria-label="Close"]').locator('visible=true');
  if (await visibleClose.count()) {
    await visibleClose.first().click({ timeout: 3000 }).catch(() => {});
    await sleep(1200);
  }
  if ((await allText(page)).length >= before) {
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(1000);
  }
}

/**
 * Switch tabs and CONFIRM the switch, because a blocked click is silent.
 */
async function tabTo(page, index, marker) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await tab(page, index);
    if ((await allText(page)).includes(marker)) return true;
    await closeModal(page);
  }
  throw new Error(`tab ${index} never showed ${JSON.stringify(marker)} - something is covering the tab bar`);
}

/** The four-tab bar along the bottom: Home, Work, Apps, Life. */
async function tab(page, index, wait = 2600) {
  await page.mouse.click(Math.round((VIEWPORT.width * (index + 0.5)) / 4), VIEWPORT.height - 25);
  await sleep(wait);
}

/**
 * Clear whatever is sitting over the screen before a shot.
 *
 * A fresh life opens with a welcome popup and can spawn the ad-reward orb; both
 * are legitimate UI and both would be the subject of the photograph instead of
 * the screen it is meant to show.
 */
async function dismissOverlays(page) {
  for (const label of ['Dismiss', 'Close', 'Got it', 'Continue', 'Skip']) {
    try {
      const loc = page.locator(`[aria-label="${label}"]`);
      if (await loc.count()) { await loc.last().click({ timeout: 1500 }); await sleep(800); }
    } catch { /* nothing to dismiss */ }
  }
  for (const t of ['Got it', "Let's go", 'Start playing']) {
    if ((await allText(page)).includes(t)) await clickText(page, t, { exact: true, wait: 1000 });
  }
}

/** The food row this capture is about. */
const FOOD = 'Instant Ramen';

/**
 * Click the Buy button INSIDE the food card, not the first Buy on the screen.
 *
 * The Market tab lists items before food on a fresh save (food only leads when
 * energy is critical), so `clickText(page, 'Buy')` buys a jacket and the whole
 * capture silently photographs an unchanged food card.
 */
async function clickFoodBuy(page) {
  const ok = await page.evaluate((name) => {
    const els = [...document.querySelectorAll('div')];
    // The smallest element containing BOTH the food name and a Buy control is
    // that food's card.
    let card = null;
    for (const el of els) {
      const t = el.textContent || '';
      if (t.includes(name) && /Buy/.test(t)) {
        if (!card || t.length < (card.textContent || '').length) card = el;
      }
    }
    if (!card) return false;
    const buy = [...card.querySelectorAll('div,span,button,[role="button"],[tabindex]')]
      .filter((e) => (e.textContent || '').trim() === 'Buy')
      .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
    if (!buy) return false;
    buy.click();
    return true;
  }, FOOD);
  await sleep(ok ? 700 : 150);
  return ok;
}

/** The food card's advertised restores, as rendered. */
async function foodChips(page) {
  return page.evaluate((name) => {
    const els = [...document.querySelectorAll('div')];
    let card = null;
    for (const el of els) {
      const t = el.textContent || '';
      if (t.includes(name) && /Buy/.test(t)) {
        if (!card || t.length < (card.textContent || '').length) card = el;
      }
    }
    if (!card) return null;
    const m = (card.textContent || '').match(/[+-]\d+\s*(Health|Energy|Happiness)/g);
    return m ? m.join(' ') : null;
  }, FOOD);
}

/** Park the list so the food card is on screen for the shot. */
async function scrollToFood(page) {
  await page.evaluate((name) => {
    const el = [...document.querySelectorAll('div')]
      .filter((e) => (e.textContent || '').trim() === name)
      .sort((a, b) => (a.textContent || '').length - (b.textContent || '').length)[0];
    if (el) el.scrollIntoView({ block: 'center' });
  }, FOOD);
  await sleep(900);
}

const shots = [];
async function shot(page, name, mustContain = []) {
  const missing = [];
  const onScreen = await allText(page);
  for (const needle of mustContain) if (!onScreen.includes(needle)) missing.push(needle);
  const file = join(OUT, `${name}.png`);
  await page.screenshot({ path: file });
  await writeFile(file.replace(/\.png$/, '.txt'), (await text(page)) + '\n');
  shots.push({ name, file, missing });
  console.log(missing.length ? `  !! ${name} MISSING ${JSON.stringify(missing)}` : `  [camera] ${name}`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: DSF, isMobile: true, hasTouch: true });
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));

  console.log('Loading', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  if (!(await waitFor(page, 'Custom life', 150000))) throw new Error('main menu never appeared');
  await sleep(1500);

  // "Play" is the quick start - it skips the setup flow and drops straight in.
  await clickText(page, 'Play', { exact: true, wait: 4000 });
  // A web export with no EXPO_PUBLIC_SAVE_HMAC_KEY refuses to start a life at
  // all ("Build Configuration Error ... missing required save security
  // configuration") - and does it in a dialog OVER the menu, so the menu text
  // is still there and a naive wait just times out eight times. Name it.
  if ((await allText(page)).includes('Build Configuration Error')) {
    throw new Error('export is missing EXPO_PUBLIC_SAVE_HMAC_KEY - re-export with it set');
  }
  let inGame = false;
  for (let i = 0; i < 8 && !inGame; i++) {
    for (const marker of ['Next week', 'Next Week', 'Your Life', 'Net Worth']) {
      if ((await allText(page)).includes(marker)) { inGame = true; break; }
    }
    if (!inGame) { await sleep(4000); await clickText(page, 'Play', { exact: true, wait: 3000 }); }
  }
  if (!inGame) {
    await shot(page, 'debug-stuck-at-menu');
    throw new Error('never reached the game');
  }
  await sleep(2500);
  await dismissOverlays(page);

  // ---- 1. The HUD season badge, in January.
  // Was a green Spring leaf in January; must now read Winter.
  await shot(page, '1-home-hud');
  const badge = page.locator('[aria-label*="season" i], [aria-label*="Season"]');
  if (await badge.count()) {
    await badge.first().click({ timeout: 3000 });
    await sleep(1800);
    await shot(page, '2-season-modal', ['Season', 'Week in Season', 'Next Season']);
    await closeModal(page);
  } else {
    console.log('  x season badge has no accessibility label - skipping the modal');
  }

  // ---- 2. Unlock the grid.
  //
  // Progressive disclosure (lib/progress/featureUnlocks.ts) derives the unlock
  // tier from chapter progress and a wealth mark, so a FRESH save shows almost
  // no apps - Spark, Pulse, Stocks and Bank are all still behind the "Locked"
  // shelf, and the two screens this capture is about (the full grid, and Bank
  // Pro) do not exist yet. The player who reported these was well past that.
  // Devtools is baked in by EXPO_PUBLIC_ENABLE_DEVTOOLS.
  await grantProgress(page);

  // Bank Pro is the DESKTOP Bank, and app/(tabs)/apps.tsx only renders the
  // desktop launcher when a computer is actually OWNED - money alone is not
  // enough. Buy the $5,000 item through the shop's own Buy button.
  await tabTo(page, 3, 'Market');
  await clickText(page, 'Market', { exact: true, wait: 2200 });
  await buyItem(page, 'Computer');

  // ---- 3. The Apps grid: tile heights + DeepMail's tinted icon.
  await tabTo(page, 2, 'DeepMail');
  await shot(page, '3-apps-grid', ['Spark', 'DeepMail', 'Pulse']);

  // ---- 3. Bank Pro: the segmented control that used to eat half the screen.
  await clickText(page, 'Bank', { exact: true, wait: 3500 });
  await shot(page, '4-bank-pro', ['Bank Pro', 'Statement', 'Accounts', 'Borrow']);
  const back = page.locator('[aria-label*="Back" i]');
  if (await back.count()) { await back.first().click({ timeout: 2500 }).catch(() => {}); }
  await sleep(2000);

  // ---- 4. The market: satiety-scaled chips and one collapsed toast.
  await tabTo(page, 3, 'Market');
  await clickText(page, 'Market', { exact: true, wait: 2500 });
  // The food list may sit inside a collapsed section on a fresh save.
  if (!(await allText(page)).includes(FOOD)) {
    await clickText(page, 'Food', { wait: 1600 });
  }
  if (!(await waitFor(page, FOOD, 15000))) throw new Error('never found the food list');
  await scrollToFood(page);
  await shot(page, '5-market-fresh', [FOOD, 'Restores']);
  const before = await foodChips(page);
  console.log('  chips before eating:', JSON.stringify(before));

  // Seven meals walks the whole curve: 1-3 full strength, 4-6 half, 7+ a
  // quarter - which is the "Completely full" state the player photographed.
  // Seven taps is also what used to stack seven identical toasts.
  for (let i = 0; i < 7; i++) {
    if (!(await clickFoodBuy(page))) { console.log('  x Buy missed on meal', i + 1); break; }
  }
  await sleep(900);
  await scrollToFood(page);
  const after = await foodChips(page);
  console.log('  chips after 7 meals:', JSON.stringify(after));
  await shot(page, '6-market-after-7-meals', [FOOD, 'Restores']);

  // The point of the capture: the advertised numbers actually moved.
  if (before && after && before === after) {
    throw new Error(`food chips did not change after 7 meals (still ${before}) - the capture would show the bug, not the fix`);
  }

  const summary = shots.map((s) => `${s.missing.length ? 'MISSING' : 'ok'}  ${s.name}  ${s.missing.join(', ')}`).join('\n');
  await writeFile(join(OUT, 'SUMMARY.txt'), summary + '\n');
  console.log('\n' + summary);
  await browser.close();

  const bad = shots.filter((s) => s.missing.length);
  if (bad.length) {
    throw new Error(`captures missing expected content: ${bad.map((b) => b.name).join(', ')}`);
  }
}

main().catch((e) => { console.error('CAPTURE FAILED:', e.message); process.exit(1); });
