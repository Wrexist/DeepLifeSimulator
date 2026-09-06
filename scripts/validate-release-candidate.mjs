/**
 * Program 17 — drive the 2.13.0 release candidate in a real browser and ASSERT.
 *
 * This is NOT an iOS device pass and must never be reported as one. It runs the
 * static WEB export through Chromium/react-native-web at iPhone viewport sizes,
 * so it proves layout, navigation, the save pipeline and the life-transition
 * state machine. It cannot prove UIKit Modal presentation, StoreKit, VoiceOver
 * or AdMob — those stay HUMAN.
 *
 *   export EXPO_PUBLIC_SAVE_HMAC_KEY=<throwaway>
 *   export EXPO_PUBLIC_ENABLE_DEVTOOLS=true EXPO_PUBLIC_BORING_BUILD=true
 *   npx expo export --platform web --output-dir /tmp/p17web --clear
 *   node scripts/serve-web-export.mjs /tmp/p17web 8090 &
 *   node scripts/validate-release-candidate.mjs
 *
 * Every check either PASSES with the evidence it read, or FAILS loudly. A
 * check that cannot reach its subject reports UNREACHED rather than passing —
 * the silent-staleness failure `capture-rich-state.mjs` documents at length.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

const OUT = process.env.OUT || '/tmp/p17-shots';
const BASE = 'http://localhost:8090';
const DSF = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function record(id, status, detail) {
  results.push({ id, status, detail });
  const mark = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '·';
  console.log(`${mark} [${status}] ${id} — ${detail}`);
}

const allText = (p) => p.evaluate(() => document.body?.textContent || '').catch(() => '');

async function waitFor(page, needle, timeout = 60000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if ((await allText(page)).includes(needle)) { await sleep(400); return true; }
    await sleep(500);
  }
  return false;
}

async function clickText(page, t, { exact = false, wait = 1300 } = {}) {
  try {
    const loc = page.getByText(t, { exact }).first();
    await loc.scrollIntoViewIfNeeded({ timeout: 2000 });
    await loc.click({ timeout: 2000 });
    await sleep(wait);
    return true;
  } catch { /* DOM walk */ }
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
  return ok;
}

async function clickAria(page, label, { wait = 1400 } = {}) {
  const loc = page.locator(`[aria-label="${label}"]`).locator('visible=true');
  if (!(await loc.count())) return false;
  await loc.last().click({ timeout: 3000 }).catch(() => {});
  await sleep(wait);
  return true;
}

async function closeModal(page) {
  const before = (await allText(page)).length;
  const vis = page.locator('[aria-label="Close"]').locator('visible=true');
  if (await vis.count()) { await vis.first().click({ timeout: 3000 }).catch(() => {}); await sleep(1000); }
  if ((await allText(page)).length >= before) { await page.keyboard.press('Escape').catch(() => {}); await sleep(800); }
}

async function tab(page, index, vp, wait = 2200) {
  await page.mouse.click(Math.round((vp.width * (index + 0.5)) / 4), vp.height - 25);
  await sleep(wait);
}

async function shot(page, name) {
  await mkdir(OUT, { recursive: true });
  await page.screenshot({ path: join(OUT, `${name}.png`) });
  const t = (await page.evaluate(() => document.body?.innerText || '')).slice(0, 4000);
  await writeFile(join(OUT, `${name}.txt`), t);
}

/** Read the numbers the HUD shows, so continuity can be compared not eyeballed. */
async function readHud(page) {
  const t = await page.evaluate(() => document.body?.innerText || '');
  return {
    age: (/Age\s+(\d+)/.exec(t) || [])[1] ?? null,
    week: (/Week\s+(\d+)/.exec(t) || [])[1] ?? null,
    money: (/\$[\d,]+(?:\.\d+)?[KMB]?/.exec(t) || [])[0] ?? null,
    len: t.length,
  };
}

/**
 * Clear whatever the tick or the tutorial has put over the screen.
 *
 * A resumed life opens on the first-session coach card ("Start playing"), and
 * the week loop can raise a result sheet or the ad orb. Any of them swallows
 * the Settings tap, and the failure is silent - the dev-tools open just does
 * not happen and every check after it reports UNREACHED for the wrong reason.
 */
async function clearOverlays(page) {
  for (const label of ['Start playing', 'Got it', 'Continue', 'Close', 'Dismiss']) {
    if ((await allText(page)).includes(label)) {
      await clickText(page, label, { wait: 1200 });
    }
  }
  await closeModal(page);
}

/** Open dev tools and press one labelled button. Returns false if unreached. */
async function devTool(page, label) {
  for (let attempt = 0; attempt < 3; attempt++) {
    await clearOverlays(page);
    if (!(await clickAria(page, 'Open Settings', { wait: 2600 }))) continue;
    if (!(await waitFor(page, 'Game Dev Tools', 12000))) { await closeModal(page); continue; }
    await clickText(page, 'Game Dev Tools', { wait: 2600 });
    if (!(await waitFor(page, 'Max All Stats', 12000))) { await closeModal(page); continue; }
    if (await clickText(page, label, { exact: true, wait: 2000 })) return true;
    await closeModal(page); await closeModal(page);
  }
  return false;
}

/**
 * The menu's "Play" button starts a life immediately ("Start a life right
 * now"); "Custom life" is the long path. Markers read off the real export:
 * the menu says SIMULATOR, the playable screen says "Next week".
 */
const MENU_MARKER = 'SIMULATOR';
const PLAYING_MARKER = 'Next week';

async function startLife(page) {
  await waitFor(page, MENU_MARKER, 60000);
  if ((await allText(page)).includes(PLAYING_MARKER)) return true;
  for (const label of ['Play', 'Continue', 'New Game']) {
    if (await clickText(page, label, { wait: 2500 })) break;
  }
  return waitFor(page, PLAYING_MARKER, 45000);
}

async function main() {
  const browser = await chromium.launch();
  const consoleErrors = [];
  const pageErrors = [];

  // ---- A. startup + first run, at the primary viewport --------------------
  const VP = { width: 430, height: 932 };
  const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: DSF });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
  page.on('pageerror', (e) => pageErrors.push(String(e).slice(0, 300)));

  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const menuUp = await waitFor(page, MENU_MARKER, 60000);
  record('A1-startup', menuUp ? 'PASS' : 'FAIL', menuUp ? 'main menu rendered' : 'menu never appeared');
  await shot(page, 'A1-menu');

  const cfgError = (await allText(page)).includes('Build Configuration Error');
  record('A2-save-config', cfgError ? 'FAIL' : 'PASS',
    cfgError ? 'HMAC key missing — build refuses to start a life' : 'no build-configuration dialog');

  const inGame = await startLife(page);
  record('A3-fresh-life', inGame ? 'PASS' : 'FAIL', inGame ? 'reached a playable week' : `never reached ${PLAYING_MARKER}`);
  await shot(page, 'A3-first-week');

  if (!inGame) { await finish(browser, consoleErrors, pageErrors); return; }

  const hud0 = await readHud(page);
  record('A4-coherent-state', hud0.age && hud0.money ? 'PASS' : 'FAIL',
    `age=${hud0.age} week=${hud0.week} money=${hud0.money}`);

  // Tab navigation: all four must actually change the screen.
  // Check the ROUTE, not the text: react-native-web keeps every mounted screen
  // in the DOM, so all four tabs share the same innerText prefix and a
  // text-diff check reports three false failures (the same trap
  // capture-rich-state.mjs documents for `[aria-label="Close"]`).
  const wantRoutes = ['/home', '/work', '/apps', '/life'];
  const gotRoutes = [];
  for (let i = 0; i < 4; i++) {
    await tab(page, i, VP);
    gotRoutes.push(new URL(page.url()).pathname);
  }
  const tabsOk = wantRoutes.filter((r, i) => gotRoutes[i] === r).length;
  record('A5-tabs', tabsOk === 4 ? 'PASS' : 'FAIL', `routes reached: ${gotRoutes.join(' ')}`);

  // Apps grid.
  await tab(page, 2, VP);
  await shot(page, 'A6-apps');
  const appsText = await page.evaluate(() => document.body?.innerText || '');
  const appCount = (appsText.match(/\n/g) || []).length;
  record('A6-apps-grid', appsText.length > 100 ? 'PASS' : 'FAIL',
    `apps screen rendered ${appsText.length} chars (${appCount} lines)`);

  // ---- B. save / load continuity -----------------------------------------
  await tab(page, 0, VP);
  const before = await readHud(page);
  const advanced = await devTool(page, '+4 Weeks');
  await closeModal(page); await closeModal(page); await sleep(2500);
  const mid = await readHud(page);
  record('B1-advance', advanced ? 'PASS' : 'UNREACHED',
    advanced ? `age ${before.age}→${mid.age}, week ${before.week}→${mid.week}` : 'dev tools not reachable');

  const saved = await devTool(page, 'Save Game');
  await closeModal(page); await closeModal(page); await sleep(2000);
  record('B2-save', saved ? 'PASS' : 'UNREACHED', saved ? 'explicit save issued' : 'save button not reached');

  // A force-close and relaunch is a COLD LAUNCH AT THE APP ROOT, not
  // `page.reload()`. expo-router mirrors the route into the web URL, so
  // reloading lands on `/home` and deep-links straight past the menu - which
  // is a browser-only path (iOS has no URL to restore) and reports a fresh
  // default life as if the save had been lost. Going to `/` is the honest
  // equivalent of relaunching the app.
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const menuAfter = await allText(page);
  const offersContinue = menuAfter.includes('Continue');
  record('B3a-continue-offered', offersContinue ? 'PASS' : 'FAIL',
    offersContinue ? 'cold launch offers Continue with the saved character' : 'no Continue affordance on the menu after a save');
  for (const label of ['Continue', 'Resume']) {
    if (await clickText(page, label, { wait: 3000 })) break;
  }
  const resumed = await waitFor(page, PLAYING_MARKER, 30000);
  const after = await readHud(page);
  await shot(page, 'B3-after-relaunch');
  const continuity = resumed && after.age === mid.age && after.money === mid.money;
  record('B3-relaunch-continuity', continuity ? 'PASS' : (resumed ? 'FAIL' : 'UNREACHED'),
    `pre-relaunch age=${mid.age} money=${mid.money} · post-relaunch age=${after.age} money=${after.money}`);

  // ---- C. death → life length → start new life ----------------------------
  const died = await devTool(page, 'Trigger Death');
  await sleep(2500);
  const deathText = await allText(page);
  const deathUp = deathText.includes('You Died') || deathText.includes('Died');
  record('C1-death-screen', deathUp ? 'PASS' : (died ? 'FAIL' : 'UNREACHED'),
    deathUp ? 'death screen rendered' : 'death screen never appeared');
  await shot(page, 'C1-death');

  if (deathUp) {
    // The Program 15 P1: "N yrs lived" must count THIS life, not the absolute
    // age-seeded counter. A life a few weeks old must not claim years.
    const lifeLen = /(\d+)\s+(yrs|wks)\s+lived/.exec(await page.evaluate(() => document.body?.innerText || ''));
    const okLen = lifeLen && (lifeLen[2] === 'wks' || Number(lifeLen[1]) <= 2);
    record('C2-life-length', okLen ? 'PASS' : 'FAIL',
      lifeLen ? `death screen reads "${lifeLen[0]}" for a weeks-old life` : 'no life-length string found');

    if (!(await clickText(page, 'Start New Life', { wait: 4000 }))) {
      await clickText(page, 'Start New Game', { wait: 4000 });
    }
    await sleep(3500);
    const afterDeath = await allText(page);
    const escaped = !afterDeath.includes('You Died');
    record('C3-escape-death', escaped ? 'PASS' : 'FAIL',
      escaped ? 'death screen dismissed, player is not trapped' : 'still on the death screen after Start New Life');
    await shot(page, 'C3-after-death');
    record('C4-lands-somewhere', afterDeath.length > 200 ? 'PASS' : 'FAIL',
      `post-death screen has ${afterDeath.length} chars of content`);

    // C5: a relaunch straight after the transition must not strand the player
    // back on a death screen, and must not resume the buried life.
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await sleep(5000);
    const relaunched = await allText(page);
    const strandedDead = relaunched.includes('You Died');
    record('C5-relaunch-after-death', strandedDead ? 'FAIL' : 'PASS',
      strandedDead ? 'relaunch put the player back on the death screen'
                   : `relaunch after a life transition lands clean (${relaunched.length} chars)`);
    await shot(page, 'C5-relaunch-after-death');
  }

  // ---- D. revival: death → Revive → playable, no stuck modal --------------
  {
    const started = await startLife(page) || (await allText(page)).includes(PLAYING_MARKER);
    if (started) {
      const d2 = await devTool(page, 'Trigger Death');
      await closeModal(page); await sleep(2500);
      const onDeath = (await allText(page)).includes('Died');
      if (onDeath) {
        // Revive lives in dev tools, behind the death screen's own modal.
        await devTool(page, 'Revive');
        await closeModal(page); await closeModal(page); await sleep(3000);
        const t = await allText(page);
        const playable = t.includes(PLAYING_MARKER) && !t.includes('You Died');
        record('D1-revive', playable ? 'PASS' : 'FAIL',
          playable ? 'revive returns the player to a playable week with no death modal left up'
                   : 'after revive the screen is not a playable week');
        await shot(page, 'D1-after-revive');
      } else {
        record('D1-revive', 'UNREACHED', d2 ? 'death did not render' : 'dev tools not reachable');
      }
    } else {
      record('D1-revive', 'UNREACHED', 'no playable life to kill');
    }
  }

  await ctx.close();

  // ---- E. UI at three widths ---------------------------------------------
  for (const width of [430, 390, 360]) {
    const c = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2 });
    const p = await c.newPage();
    p.on('pageerror', (e) => pageErrors.push(`[${width}] ${String(e).slice(0, 200)}`));
    await p.goto(BASE, { waitUntil: 'domcontentloaded' });
    await waitFor(p, MENU_MARKER, 60000);
    const ok = await startLife(p);
    if (!ok) { record(`E-${width}`, 'UNREACHED', 'could not reach a playable week'); await c.close(); continue; }
    let worst = 0;
    const vp = { width, height: 844 };
    for (let i = 0; i < 4; i++) {
      await tab(p, i, vp, 1800);
      const over = await p.evaluate(() => Math.max(0, document.documentElement.scrollWidth - window.innerWidth));
      worst = Math.max(worst, over);
      await shot(p, `E-${width}-tab${i}`);
    }
    record(`E-${width}-overflow`, worst === 0 ? 'PASS' : 'FAIL',
      `worst horizontal overflow across four tabs: ${worst}px`);
    await c.close();
  }

  // ---- F. red team: rapid taps and rapid modal churn ----------------------
  const rc = await browser.newContext({ viewport: VP, deviceScaleFactor: 1 });
  const rp = await rc.newPage();
  rp.on('pageerror', (e) => pageErrors.push(`[redteam] ${String(e).slice(0, 200)}`));
  await rp.goto(BASE, { waitUntil: 'domcontentloaded' });
  await waitFor(rp, MENU_MARKER, 60000);
  if (await startLife(rp)) {
    const h0 = await readHud(rp);
    // 12 rapid taps on Advance Week with no waiting between them.
    for (let i = 0; i < 12; i++) {
      await clickText(rp, PLAYING_MARKER, { wait: 60 }).catch(() => {});
    }
    await sleep(6000);
    const h1 = await readHud(rp);
    const alive = (await allText(rp)).length > 200;
    record('F1-rapid-advance', alive ? 'PASS' : 'FAIL',
      `12 rapid week taps: age ${h0.age}→${h1.age}, screen still renders ${alive}`);
    await shot(rp, 'F1-rapid-advance');

    // Rapid modal churn: open and close settings ten times.
    for (let i = 0; i < 10; i++) {
      await clickAria(rp, 'Open Settings', { wait: 250 });
      await closeModal(rp);
    }
    await sleep(2000);
    const responsive = await clickText(rp, PLAYING_MARKER, { wait: 2500 });
    record('F2-modal-churn', responsive ? 'PASS' : 'FAIL',
      responsive ? 'input still accepted after 10 open/close cycles' : 'input blocked after modal churn');
    await shot(rp, 'F2-after-churn');

    // Reload immediately after an action — the "kill during save" shape.
    await clickText(rp, PLAYING_MARKER, { wait: 120 });
    await rp.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await sleep(5000);
    for (const l of ['Continue', 'Resume']) { if (await clickText(rp, l, { wait: 3000 })) break; }
    const back = await waitFor(rp, PLAYING_MARKER, 25000);
    record('F3-kill-during-save', back ? 'PASS' : 'FAIL',
      back ? 'cold launch immediately after a week tap resumes a playable life' : 'could not resume after a kill mid-action');
    await shot(rp, 'F3-after-kill');
  } else {
    record('F-redteam', 'UNREACHED', 'could not reach a playable week');
  }
  await rc.close();

  await finish(browser, consoleErrors, pageErrors);
}

async function finish(browser, consoleErrors, pageErrors) {
  record('G1-page-errors', pageErrors.length === 0 ? 'PASS' : 'FAIL',
    pageErrors.length ? `${pageErrors.length} uncaught error(s): ${pageErrors.slice(0, 3).join(' | ')}` : 'no uncaught JS errors');
  const realConsole = consoleErrors.filter((e) => !/Download the React DevTools|favicon|net::ERR/i.test(e));
  record('G2-console-errors', realConsole.length === 0 ? 'PASS' : 'WARN',
    realConsole.length ? `${realConsole.length}: ${realConsole.slice(0, 3).join(' | ')}` : 'clean console');

  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
  const fails = results.filter((r) => r.status === 'FAIL');
  console.log(`\n=== ${results.length} checks · ${results.filter(r=>r.status==='PASS').length} pass · ${fails.length} fail · ${results.filter(r=>r.status==='UNREACHED').length} unreached ===`);
  await browser.close();
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(2); });
