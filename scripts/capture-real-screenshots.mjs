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

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-web-security'] });
  const page = await browser.newPage({
    viewport: { width: 430, height: 932 },
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

  console.log('Loading', URL, '… (first web bundle can take a minute)');
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  await waitFor('New Game', 90000);   // through splash → main menu
  let t = await text(page);
  console.log('Menu text:', JSON.stringify(t.slice(0, 160)));
  await shot(page, 'menu', 0);

  const step = async (label, wait = 2600, opts = {}) => {
    const ok = await clickText(page, label, opts);
    await sleep(wait);
    console.log(ok ? `→ ${label}` : `✗ ${label} (not found)`);
    return ok;
  };

  // MainMenu → New Game
  await step('New Game', 1500);
  await waitFor('Choose Scenario');
  // Scenarios: select the recommended scenario card (by its name), then continue
  await step('Food Courier', 1500);
  await step('Continue To Identity', 2500);
  if (!await waitFor('Create Identity', 8000)) {
    // selection may not have taken — try the recommended badge then continue again
    await step('RECOMMENDED FOR BEGINNERS', 1200);
    await step('Continue To Identity', 2500);
    await waitFor('Create Identity', 10000);
  }
  // Customize: random name, then continue
  await step('Shuffle', 1000);
  await step('Continue To Perks', 1500);
  await waitFor('Start Your Life', 30000);
  // Perks: start the life — the page also CONTAINS the phrase in its hint text,
  // so click the LAST occurrence (the green CTA button at the bottom).
  await step('Start Your Life', 3500, { last: true });
  // In-game once the home identity / stats show up
  await waitFor('Energy', 30000) || await waitFor('Happiness', 8000);
  await sleep(3000);

  t = await text(page);
  console.log('In-game text:', JSON.stringify(t.slice(0, 260)));

  // Core gameplay tabs (visible labels: Home, Work, Health, Market, Computer, Phone, Progress)
  await shot(page, 'life-home', 1);
  const tabs = [
    ['Work', 'work'],
    ['Health', 'health'],
    ['Market', 'market'],
    ['Computer', 'computer-bitcoin'],
    ['Phone', 'phone'],
    ['Progress', 'progression'],
  ];
  let i = 2;
  for (const [label, name] of tabs) {
    const clicked = await clickText(page, label);
    await sleep(2400);
    await shot(page, name, i++);
    console.log(clicked ? `tab ${label} ✓` : `tab ${label} not found`);
  }
  // return to Home for a clean hero shot
  await clickText(page, 'Home'); await sleep(2000);
  await shot(page, 'life-home-final', i++);

  await browser.close();
  console.log('Done →', OUT);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
