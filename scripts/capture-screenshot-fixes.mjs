/**
 * Photograph the four screens fixed on 2026-09-04, so the fixes can be checked
 * against the player's original screenshots rather than against a description.
 *
 * Runs against the static web export on :8090, the same harness
 * `capture-rich-state.mjs` uses:
 *
 *   npx expo export --platform web --output-dir /tmp/webshots
 *   node scripts/serve-web-export.mjs /tmp/webshots 8090 &
 *   node scripts/capture-screenshot-fixes.mjs
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

/** The four-tab bar along the bottom: Home, Work, Apps, Life. */
async function tab(page, index, wait = 2600) {
  await page.mouse.click(Math.round((VIEWPORT.width * (index + 0.5)) / 4), VIEWPORT.height - 25);
  await sleep(wait);
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
  let inGame = false;
  for (let i = 0; i < 8 && !inGame; i++) {
    inGame = await waitFor(page, 'Next week', 10000);
    if (!inGame) { await clickText(page, 'Play', { exact: true, wait: 3000 }); }
  }
  if (!inGame) throw new Error('never reached the game');
  await sleep(2500);

  // ---- 1. The HUD season badge, in January.
  // Was a green Spring leaf in January; must now read Winter.
  await shot(page, '1-home-hud');
  const badge = page.locator('[aria-label*="season" i], [aria-label*="Season"]');
  if (await badge.count()) {
    await badge.first().click({ timeout: 3000 });
    await sleep(1800);
    await shot(page, '2-season-modal', ['Season', 'Week in Season', 'Next Season']);
    await clickText(page, 'Close', { wait: 1200 });
    const closeBtn = page.locator('[aria-label="Close"]');
    if (await closeBtn.count()) { await closeBtn.first().click({ timeout: 2000 }).catch(() => {}); }
    await sleep(1200);
  } else {
    console.log('  x season badge has no accessibility label - skipping the modal');
  }

  // ---- 2. The Apps grid: tile heights + DeepMail's tinted icon.
  await tab(page, 2);
  await shot(page, '3-apps-grid', ['Spark', 'DeepMail', 'Pulse']);

  // ---- 3. Bank Pro: the segmented control that used to eat half the screen.
  await clickText(page, 'Bank', { exact: true, wait: 3500 });
  await shot(page, '4-bank-pro', ['Bank Pro', 'Statement', 'Accounts', 'Borrow']);
  const back = page.locator('[aria-label*="Back" i]');
  if (await back.count()) { await back.first().click({ timeout: 2500 }).catch(() => {}); }
  await sleep(2000);

  // ---- 4. The market: satiety-scaled chips and one collapsed toast.
  await tab(page, 3);
  await clickText(page, 'Market', { exact: true, wait: 2500 });
  // The food list may sit inside a collapsed section on a fresh save.
  if (!(await allText(page)).includes(FOOD)) {
    await clickText(page, 'Food', { wait: 1600 });
  }
  if (!(await waitFor(page, FOOD, 15000))) throw new Error('never found the food list');
  await scrollToFood(page);
  await shot(page, '5-market-fresh', [FOOD, 'RESTORES']);
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
  await shot(page, '6-market-after-7-meals', [FOOD, 'RESTORES']);

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
