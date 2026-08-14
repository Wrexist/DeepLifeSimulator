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
    const el = scrollers[0];
    el.scrollTop = amount === 0 ? 0 : el.scrollTop + amount;
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
  // A FRESH profile has no save, so the menu reads "Play" (primary, skips
  // setup) + "Custom life" (secondary, the full flow we want). "New Game" is
  // the label the secondary card takes only once a save EXISTS — waiting for
  // it here hung until the 120s timeout on every run.
  if (!(await waitFor(page, 'Custom life', 120000))) throw new Error('menu never appeared');
  await sleep(2000);

  // ---- Onboarding
  await clickText(page, 'Custom life', { wait: 2000 });
  await waitFor(page, 'Choose Scenario', 45000);
  await sleep(2500);
  let inIdentity = false;
  for (let i = 0; i < 5 && !inIdentity; i++) {
    await clickText(page, 'Food Courier');
    await clickText(page, 'Continue To Identity', { wait: 2000 });
    // The screen's title, which the rebuilt creator shortened from
    // "Create Your Character" (the shared header clamps to one line).
    inIdentity = await waitFor(page, 'Create Character', 6000);
  }
  if (!inIdentity) throw new Error('stuck on scenario');
  // Rebuilt creator: the dice button is "Randomize" and it rolls the whole
  // face, not just the name. "New name" is the name-only shuffle.
  await clickText(page, 'Randomize');
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
  // The badge on the Continue card. A better signal than any menu label: it
  // only renders once the menu has actually READ the save, which is the thing
  // the next click depends on.
  if (!(await waitFor(page, 'SAVED PROGRESS', 60000))) throw new Error('menu never saw the save');
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

  // Empty the decision inbox before anything is photographed — see
  // `clearDecisions`. Must run BEFORE the first shot, not after.
  await clearDecisions(page);

  // Dismiss the ad-reward orb and let toasts/reward chips fade
  await clickAriaLast(page, 'Dismiss', { wait: 800 });
  await sleep(6000);

  // ---- Captures — 4 tabs: Home Work Apps Life, click by coordinates
  const VW = VIEWPORT.width, TAB_Y = VIEWPORT.height - 25;
  // Scrolls back to the top after switching. Without this a tab is
  // photographed wherever the PREVIOUS interaction left it — emptying the
  // decision inbox scrolled Home past the identity card, so the hero shot of
  // an avatar release contained no face at all.
  const goTab = async (idx) => {
    await page.mouse.click(Math.round((VW * (idx + 0.5)) / 4), TAB_Y);
    await sleep(2600);
    await scrollMain(page, 0);
    await chewLifeMoments(page);
  };

  await goTab(0); await shot(page, 'home');
  // scroll down on home for goals/ambition card
  await scrollMain(page, 900); await sleep(1200); await shot(page, 'home-goals');
  await goTab(1); await shot(page, 'work');
  await goTab(2); await shot(page, 'apps');
  console.log('APPS FULL:', JSON.stringify((await text(page)).slice(0, 2000)));
  // second page of the apps grid
  await scrollMain(page, 1000); await sleep(1200); await shot(page, 'apps-2');
  console.log('APPS2:', JSON.stringify((await text(page)).slice(0, 1600)));
  await scrollMain(page, -2000); await sleep(1000);
  // Enter key phone apps
  const apps = ['Spark', 'Pulse', 'Stocks', 'Bank', 'Contacts', 'Education'];
  for (const app of apps) {
    await goTab(2);
    await scrollMain(page, -2400); await sleep(900);
    let opened = await clickText(page, app, { exact: true, wait: 2800 });
    if (!opened) { // maybe on the grid's second page
      await scrollMain(page, 1000); await sleep(800);
      opened = await clickText(page, app, { exact: true, wait: 2800 });
    }
    if (opened) {
      await shot(page, 'app-' + app.toLowerCase());
      // leave the app via its top-left back arrow (apps cover the tab bar)
      await page.mouse.click(Math.round(VIEWPORT.width*0.05)+22, 36); await sleep(1800);
    }
  }
  await goTab(3); await shot(page, 'life');
  await scrollMain(page, 900); await sleep(1200); await shot(page, 'life-2');

  // ---- Life tab sections: Market (buy a Computer → unlocks desktop launcher),
  // Family, Stats
  await goTab(3);
  await scrollMain(page, -3000); await sleep(800);
  await clickText(page, 'Market', { exact: true, wait: 2500 });
  await shot(page, 'life-market');
  console.log('MARKET:', JSON.stringify((await text(page)).slice(0, 1200)));
  // Buy the computer: find its market row and click the Buy button inside it.
  //
  // Matched on the DESCRIPTION, case-insensitively, and never on the price.
  // The original matcher looked for "$5000", the item's BASE price — but the
  // market applies inflation, so by this point in a rich-state run the card
  // reads $5,300 and nothing matches. The whole desktop-launcher half of the
  // capture then silently fell back to photographing the phone's app grid.
  //
  // The row reads: "Recommended Unlocks Features Computer Unlocks Desktop
  // Apps, Crypto, Real Estate, Gaming $5000 Buy" — note the capitals, which
  // cost a second run on their own.
  const bought = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('div')].filter(d => {
      const t = d.textContent || '';
      return /computer/i.test(t) && /unlocks desktop apps/i.test(t)
        && t.includes('Buy') && t.length < 400;
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
  await scrollMain(page, -3000); await sleep(800);
  await shot(page, 'desktop');
  console.log('DESKTOP:', JSON.stringify((await text(page)).slice(0, 1600)));

  // Fail loudly if the launcher never appeared.
  //
  // Without this the run "succeeds": every desktop-only app logs NOT FOUND, the
  // six shots that need them are simply never written, and the PREVIOUS run's
  // files stay on disk — so the marketing set is rebuilt from a mix of new and
  // stale captures with nothing red anywhere. That is precisely the Guideline
  // 2.3.3 problem the recapture exists to fix, reintroduced by the tool meant
  // to fix it. `Dark Web` is the check because it is desktop-only; Hustle and
  // Crypto also exist on the phone, so finding them proves nothing.
  await scrollMain(page, 1100); await sleep(700);
  const launcherUp = (await allText(page)).includes('Dark Web');
  await scrollMain(page, -3000); await sleep(700);
  if (!launcherUp) {
    throw new Error(
      'Desktop launcher missing — the computer purchase did not land, so 6 shots '
      + 'would silently keep their stale files. Check the market row matcher.'
    );
  }
  const desktopApps = [
    ['Hustle', 'company'], ['Dark Web', 'darkweb'], ['Crypto', 'crypto'],
    ['Real Estate', 'realestate'], ['Garage', 'garage'], ['Luxury', 'luxury'],
    ['Political Office', 'politics'], ['Travel', 'travel'],
    ['Streaming', 'streaming'], ['YouVideo', 'youvideo'],
  ];
  for (const [label, name] of desktopApps) {
    await goTab(2);
    await scrollMain(page, -3000); await sleep(700);
    let ok = await clickText(page, label, { exact: true, wait: 3200 });
    if (!ok) { await scrollMain(page, 1100); await sleep(700); ok = await clickText(page, label, { exact: true, wait: 3200 }); }
    if (!ok) { await scrollMain(page, 1100); await sleep(700); ok = await clickText(page, label, { exact: true, wait: 3200 }); }
    if (ok) {
      await shot(page, 'x-' + name);
      // leave via back arrow (top-left) then fall back to tab bar
      await page.mouse.click(Math.round(VIEWPORT.width*0.05)+22, 36); await sleep(1500);
    } else {
      throw new Error(`Desktop app "${label}" could not be opened — required UI state unavailable for capture`);
    }
  }
  await goTab(0); await shot(page, 'home-final');

  await browser.close();
  console.log('Done →', OUT);
}

main().catch(e => { console.error('FATAL', e); process.exit(1); });
