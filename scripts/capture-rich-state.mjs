/**
 * Capture rich real gameplay screenshots for App Store marketing.
 * Static prod-mode build on :8090 (devtools flag baked in), 430x932 @3x.
 */
import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const OUT = process.env.OUT || 'screenshots/appstore-2026/rich-captures';
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
];
async function shot(page, name) {
  await chewLifeMoments(page);
  // dismiss the ad-reward orb if it floated back in
  try {
    const d = page.locator('[aria-label="Dismiss"]');
    if (await d.count()) { await d.last().click({ timeout: 1500 }); await new Promise(r => setTimeout(r, 900)); }
  } catch { }
  const idx = SHOT_ORDER.indexOf(name);
  // Named shots get their fixed NN- prefix; off-manifest shots (e.g. debug
  // artifacts) are written without one so they never claim a canonical slot.
  const file = join(OUT, idx >= 0 ? `${String(idx).padStart(2, '0')}-${name}.png` : `dbg-${name}.png`);
  await page.screenshot({ path: file });
  console.log('  📸', name, idx >= 0 ? `(#${idx})` : '(debug)');
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

async function main() {
  await mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: DSF, isMobile: true, hasTouch: true });

  page.on('console', m => { const t = m.text(); if (/ERROR|corrupt|invalid|signature|hmac|breaker|circuit|Failed/i.test(t)) console.log('[c]', t.slice(0, 200)); });
  page.on('requestfailed', r => console.log('[reqfail]', r.url().slice(-80), r.failure()?.errorText));
  page.on('response', r => { if (r.status() >= 400) console.log('[http', r.status() + ']', r.url().slice(-80)); });
  page.on('pageerror', e => console.log('[pageerror]', String(e).slice(0, 250)));
  console.log('Loading', URL);
  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 180000 });
  if (!(await waitFor(page, 'New Game', 120000))) throw new Error('menu never appeared');
  await sleep(2000);

  // ---- Onboarding
  await clickText(page, 'New Game', { wait: 2000 });
  await waitFor(page, 'Choose Scenario', 45000);
  await sleep(2500);
  let inIdentity = false;
  for (let i = 0; i < 5 && !inIdentity; i++) {
    await clickText(page, 'Food Courier');
    await clickText(page, 'Continue To Identity', { wait: 2000 });
    inIdentity = await waitFor(page, 'Create Identity', 6000);
  }
  if (!inIdentity) throw new Error('stuck on scenario');
  await clickText(page, 'Shuffle');
  await clickText(page, 'Continue To Ambitions', { wait: 2200 });
  await clickText(page, 'Build a Business Empire', { wait: 1000 });
  await clickText(page, 'Continue To Perks', { wait: 2200 });
  await waitFor(page, 'Start Your Life', 30000);
  await sleep(2500); // static builds hydrate slowly
  let inGame = false;
  for (let i = 0; i < 6 && !inGame; i++) {
    await clickText(page, 'Start Your Life', { last: true, wait: 3500 });
    inGame = (await waitFor(page, 'Net Worth', 8000)) || (await waitFor(page, 'Cash Flow', 3000));
    console.log('  start attempt', i + 1, inGame ? 'ok' : 'retry');
  }
  if (!inGame) throw new Error('never reached home');
  await sleep(1500);
  for (let i = 0; i < 3 && (await text(page)).includes('First Week Guide'); i++) {
    await clickText(page, 'Skip Guide', { wait: 1200 });
  }

  // ---- Dev tools: build the rich state
  await clickAriaLast(page, 'Open Settings', { wait: 3000 });
  await sleep(2500);
  console.log('settings open?', (await allText(page)).includes('Sound Effects'));
  await clickText(page, 'Game Dev Tools', { wait: 3000 });
  if (!(await allText(page)).includes('Max All Stats')) {
    console.log('MODAL TEXT:', JSON.stringify((await allText(page)).slice(-900)));
    await shot(page, 'debug-settings-fail');
    throw new Error('devtools did not open');
  }

  // God mode: lock stats at 100 during the year skips (otherwise the drained
  // happiness weeks poison the will-to-live counter and the life dies on load)
  const godOk = await page.evaluate(() => {
    const label = [...document.querySelectorAll('div')].find(e => (e.textContent || '').trim() === 'God Mode (no stat drain)');
    if (!label) return 'no-label';
    let node = label;
    for (let up = 0; up < 6; up++) {
      node = node.parentElement;
      if (!node) return 'no-parent';
      const sw = node.querySelector('[role="switch"]');
      if (sw) { sw.click(); return 'clicked'; }
    }
    return 'no-switch';
  });
  console.log('god mode:', godOk);
  await sleep(1000);

  // Time first (simulates history), then grants, stats LAST so nothing drains after.
  for (let i = 0; i < 2; i++) {
    await clickText(page, '+52 Weeks', { exact: true, wait: 2000 });
    await waitStable(page, 120000);
    console.log('  … 52w skip', i + 1, 'done');
  }
  const grants = [
    'Grant Top Career', 'Give a Company', 'Add All Education', 'Give Spouse + Kids',
    '+$1M', 'Net Worth +$10M', '+1000 Gems', '+1000 Prestige Pts', 'Unlock All Life Skills',
    'Max All Stats',
  ];
  for (const c of grants) await clickText(page, c, { exact: true, wait: 900 });
  // Feature setups (Setups tab): darkweb access + BTC so the Onion terminal is alive
  await clickText(page, 'Setups', { exact: true, wait: 1200 });
  await clickText(page, 'Darkweb (BTC + opsec)', { exact: true, wait: 1500 });
  await clickText(page, 'Cheats', { exact: true, wait: 1200 });
  await clickText(page, 'Save Game', { exact: true, wait: 1500 });
  // Wait until the save actually lands in localStorage with the rich money value
  let saved = false;
  for (let i = 0; i < 30 && !saved; i++) {
    const info = await page.evaluate(() => {
      const lens = {};
      for (const k of ['save_slot_1', 'save_slot_1_A', 'save_slot_1_B']) {
        const raw = localStorage.getItem(k);
        lens[k] = raw ? raw.length : 0;
      }
      return lens;
    });
    console.log('save lens:', JSON.stringify(info));
    saved = Math.max(info['save_slot_1'], info['save_slot_1_A'], info['save_slot_1_B']) > 50000;
    if (!saved) { await clickText(page, 'Save Game', { exact: true, wait: 1000 }); await sleep(2000); }
  }
  console.log('save persisted?', saved);

  // Clean exit from all modals: reload and continue from the saved slot
  await page.goto(URL + '/', { waitUntil: 'domcontentloaded' });
  await waitFor(page, 'New Game', 60000);
  await sleep(2500);
  console.log('MENU:', JSON.stringify((await text(page)).slice(0, 300)));
  await clickText(page, 'Continue', { exact: true, wait: 5000 });
  if (!(await waitFor(page, 'Net Worth', 40000))) throw new Error('continue failed');
  await sleep(8000);
  console.log('AFTER LOAD SETTLE:', JSON.stringify((await text(page)).slice(0, 250)));
  if ((await allText(page)).includes('You Died')) console.log('!! DEATH POPUP PRESENT');

  await chewLifeMoments(page);
  for (let i = 0; i < 3 && (await text(page)).includes('First Week Guide'); i++) {
    await clickText(page, 'Skip Guide', { wait: 1200 });
  }
  await dismissPopups(page);
  console.log('STATE:', JSON.stringify((await text(page)).slice(0, 300)));

  // Dismiss the ad-reward orb and let toasts/reward chips fade
  await clickAriaLast(page, 'Dismiss', { wait: 800 });
  await sleep(6000);

  // ---- Captures — 4 tabs: Home Work Apps Life, click by coordinates
  const VW = VIEWPORT.width, TAB_Y = VIEWPORT.height - 25;
  const goTab = async (idx) => { await page.mouse.click(Math.round((VW * (idx + 0.5)) / 4), TAB_Y); await sleep(2600); await chewLifeMoments(page); };

  await goTab(0); await shot(page, 'home');
  // scroll down on home for goals/ambition card
  await page.mouse.wheel(0, 900); await sleep(1200); await shot(page, 'home-goals');
  await goTab(1); await shot(page, 'work');
  await goTab(2); await shot(page, 'apps');
  console.log('APPS FULL:', JSON.stringify((await text(page)).slice(0, 2000)));
  // second page of the apps grid
  await page.mouse.wheel(0, 1000); await sleep(1200); await shot(page, 'apps-2');
  console.log('APPS2:', JSON.stringify((await text(page)).slice(0, 1600)));
  await page.mouse.wheel(0, -2000); await sleep(1000);
  // Enter key phone apps
  const apps = ['Spark', 'Pulse', 'Stocks', 'Bank', 'Contacts', 'Education'];
  for (const app of apps) {
    await goTab(2);
    await page.mouse.wheel(0, -2400); await sleep(900);
    let opened = await clickText(page, app, { exact: true, wait: 2800 });
    if (!opened) { // maybe on the grid's second page
      await page.mouse.wheel(0, 1000); await sleep(800);
      opened = await clickText(page, app, { exact: true, wait: 2800 });
    }
    if (opened) {
      await shot(page, 'app-' + app.toLowerCase());
      // leave the app via its top-left back arrow (apps cover the tab bar)
      await page.mouse.click(Math.round(VIEWPORT.width*0.05)+22, 36); await sleep(1800);
    }
  }
  await goTab(3); await shot(page, 'life');
  await page.mouse.wheel(0, 900); await sleep(1200); await shot(page, 'life-2');

  // ---- Life tab sections: Market (buy a Computer → unlocks desktop launcher),
  // Family, Stats
  await goTab(3);
  await page.mouse.wheel(0, -3000); await sleep(800);
  await clickText(page, 'Market', { exact: true, wait: 2500 });
  await shot(page, 'life-market');
  console.log('MARKET:', JSON.stringify((await text(page)).slice(0, 1200)));
  // buy the computer: find the market row containing "Computer" + "$5000" and
  // click the Buy button inside that row
  const bought = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('div')].filter(d => {
      const t = d.textContent || '';
      return t.includes('Computer') && t.includes('$5000') && t.includes('Buy') && t.length < 400;
    });
    // smallest matching container = the row card
    rows.sort((a, b) => (a.textContent || '').length - (b.textContent || '').length);
    const row = rows[0];
    if (!row) return 'no-row';
    const btn = [...row.querySelectorAll('div,span')].find(e => (e.textContent || '').trim() === 'Buy');
    if (!btn) return 'no-buy-btn';
    btn.click();
    return 'clicked-buy';
  });
  console.log('computer purchase:', bought);
  await sleep(2000);
  await clickText(page, 'Purchase', { exact: true, wait: 2500 });
  console.log('dialog gone?', !(await allText(page)).includes('Purchase Computer?'));
  const closeModal = async () => {
    await clickAriaLast(page, 'Close', { wait: 1000 });
    await page.mouse.click(VIEWPORT.width-39, 35); await sleep(1200); // top-right X fallback
  };
  await clickText(page, 'Family', { exact: true, wait: 2500 });
  await shot(page, 'life-family');
  await closeModal();
  await clickText(page, 'Stats', { exact: true, wait: 2500 });
  await shot(page, 'life-stats');
  await closeModal();

  // ---- Desktop launcher (Apps tab after owning a computer)
  await goTab(2); await sleep(1500);
  await page.mouse.wheel(0, -3000); await sleep(800);
  await shot(page, 'desktop');
  console.log('DESKTOP:', JSON.stringify((await text(page)).slice(0, 1600)));
  const desktopApps = [
    ['Hustle', 'company'], ['Dark Web', 'darkweb'], ['Crypto', 'crypto'],
    ['Real Estate', 'realestate'], ['Garage', 'garage'], ['Luxury', 'luxury'],
    ['Political Office', 'politics'], ['Travel', 'travel'],
    ['Streaming', 'streaming'], ['YouVideo', 'youvideo'],
  ];
  for (const [label, name] of desktopApps) {
    await goTab(2);
    await page.mouse.wheel(0, -3000); await sleep(700);
    let ok = await clickText(page, label, { exact: true, wait: 3200 });
    if (!ok) { await page.mouse.wheel(0, 1100); await sleep(700); ok = await clickText(page, label, { exact: true, wait: 3200 }); }
    if (!ok) { await page.mouse.wheel(0, 1100); await sleep(700); ok = await clickText(page, label, { exact: true, wait: 3200 }); }
    if (ok) {
      await shot(page, 'x-' + name);
      // leave via back arrow (top-left) then fall back to tab bar
      await page.mouse.click(Math.round(VIEWPORT.width*0.05)+22, 36); await sleep(1500);
    } else {
      console.log(name, 'NOT FOUND on desktop grid');
    }
  }
  await goTab(0); await shot(page, 'home-final');

  await browser.close();
  console.log('Done →', OUT);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
