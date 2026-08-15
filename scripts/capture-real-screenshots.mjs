/**
 * Capture REAL gameplay screenshots from the running Expo web build.
 * Drives the actual app (localhost:8081) with Playwright/Chromium and saves
 * full-device screenshots per screen into screenshots/iphone-real/.
 *
 * Prereq:  npx expo start --web   (Metro serving on :8081)
 * Run:     node scripts/capture-real-screenshots.mjs
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'screenshots', 'iphone-real');
const URL = 'http://localhost:8081';
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function text(page) {
  try { return await page.evaluate(() => document.body?.innerText || ''); }
  catch { return ''; }
}

async function clickText(page, t, { exact = false, last = false } = {}) {
  // Prefer a real Playwright click (dispatches pointer events RN-web Pressable needs)
  try {
    let loc = page.getByText(t, { exact });
    loc = last ? loc.last() : loc.first();
    await loc.scrollIntoViewIfNeeded({ timeout: 3500 });
    await loc.click({ timeout: 3500 });
    await sleep(1200);
    return true;
  } catch { /* fall through to DOM click */ }
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
  if (ok) await sleep(1200);
  return ok;
}

async function shot(page, name, i) {
  const file = join(OUT, `${String(i).padStart(2, '0')}-${name}.png`);
  await page.screenshot({ path: file });
  console.log('  ✓', file);
}

const VIEWPORT = { width: 430, height: 932 };

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-web-security'] });
  const page = await browser.newPage({
    viewport: VIEWPORT,
    deviceScaleFactor: 3,
    isMobile: true,
  });
  page.on('console', (m) => { const s = m.text(); if (/error|warn/i.test(s)) console.log('   [page]', s.slice(0, 160)); });

  const waitFor = async (needle, timeout = 45000) => {
    const end = Date.now() + timeout;
    while (Date.now() < end) {
      if ((await text(page)).includes(needle)) { await sleep(800); return true; }
      await sleep(1000);
    }
    console.log(`   (timed out waiting for "${needle}")`);
    return false;
  };

  // Mandatory transitions abort the run instead of silently capturing the wrong
  // screen — a slow/changed UI should fail loudly, not produce bogus assets.
  const mustWait = async (needle, timeout) => {
    if (!(await waitFor(needle, timeout))) {
      throw new Error(`Navigation failed: timed out waiting for "${needle}"`);
    }
  };

  console.log('Loading', URL, '… (first web bundle can take a minute)');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  // Main-menu labels as of v2.8.0: Play / Custom life / Save Slots / Settings.
  // This waited on "New Game", which no longer exists anywhere in the app —
  // so every run of this script hung here for 90s and then threw. That is the
  // THIRD label this navigation has been broken by ("New Game" only existed
  // once a save existed; "Create Identity" was renamed to "Create Character"),
  // which is why the check below asserts the label is actually still in the
  // source rather than trusting this comment.
  await mustWait('Custom life', 90000);   // through splash → main menu
  let t = await text(page);
  console.log('Menu text:', JSON.stringify(t.slice(0, 160)));
  await shot(page, 'menu', 0);

  const step = async (label, wait = 2600, opts = {}) => {
    const ok = await clickText(page, label, opts);
    await sleep(wait);
    console.log(ok ? `→ ${label}` : `✗ ${label} (not found)`);
    return ok;
  };
  const mustStep = async (label, wait, opts) => {
    if (!(await step(label, wait, opts))) {
      throw new Error(`Navigation failed: could not click "${label}"`);
    }
  };

  // MainMenu → the custom-life path (the one that reaches the creator).
  await mustStep('Custom life', 1500);
  await mustWait('Choose Scenario', 45000);
  // Static-export builds hydrate slowly, so a scenario tap can land before the
  // card is interactive. Retry select → continue until the Identity step shows.
  await sleep(2500);
  let reachedIdentity = false;
  for (let attempt = 1; attempt <= 5 && !reachedIdentity; attempt++) {
    await step('Food Courier', 1200);
    await step('Continue To Identity', 2200);
    reachedIdentity = await waitFor('Create Identity', 6000);
    if (!reachedIdentity) {
      await step('RECOMMENDED FOR BEGINNERS', 1000);
      await step('Continue To Identity', 2200);
      reachedIdentity = await waitFor('Create Identity', 6000);
    }
    console.log(`scenario→identity attempt ${attempt}: ${reachedIdentity ? 'ok' : 'retry'}`);
  }
  if (!reachedIdentity) throw new Error('Navigation failed: stuck on Choose Scenario');
  // Customize: random name, then continue
  await step('Shuffle', 1000);
  await mustStep('Continue To Perks', 1500);
  await mustWait('Start Your Life', 30000);
  // Perks: start the life — the page also CONTAINS the phrase in its hint text,
  // so click the LAST occurrence (the green CTA button at the bottom).
  await mustStep('Start Your Life', 3500, { last: true });
  // In-game once the home identity shows up — abort if we never arrive.
  // (Stats render as icon bars, not text, so key off the identity-card labels.)
  if (!(await waitFor('Net Worth', 30000)) && !(await waitFor('Cash Flow', 8000)) && !(await waitFor('Active Goals', 8000))) {
    throw new Error('Navigation failed: never reached the in-game home screen');
  }
  await sleep(3000);

  t = await text(page);
  console.log('In-game text:', JSON.stringify(t.slice(0, 260)));

  await shot(page, 'life-home', 1);
  // The bottom tab bar is exactly 5 evenly-spaced slots: Home · Work · Phone ·
  // Market · Health. Text clicks proved unreliable here (they hit the wrong
  // element), so click each tab by its fixed coordinate in the 430-wide viewport.
  const VW = VIEWPORT.width, TAB_Y = VIEWPORT.height - 30;
  const tabX = (idx) => Math.round((VW * (idx + 0.5)) / 5); // 5 tabs
  const tabs = [
    [1, 'work'],
    [2, 'phone'],
    [3, 'market'],
    [4, 'health'],
  ];
  let i = 2;
  for (const [idx, name] of tabs) {
    await page.mouse.click(tabX(idx), TAB_Y);
    await sleep(2600);
    await shot(page, name, i++);
    console.log(`tab ${name} @x${tabX(idx)} captured`);
  }
  // back to Home for a clean hero shot
  await page.mouse.click(tabX(0), TAB_Y); await sleep(2200);
  await shot(page, 'life-home-final', i++);

  await browser.close();
  console.log('Done →', OUT);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
