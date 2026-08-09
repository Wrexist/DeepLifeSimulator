import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, copyFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { seedDemoSaves, loadDemoBundle } from './support/demoSave';

/**
 * App Preview capture run.
 *
 * Boots the web build on a seeded demo save and walks a fixed shot list,
 * dwelling on each beat long enough to read, while Playwright records video.
 *
 * What this is for: locking the edit — shot order, dwell times, caption
 * timing — cheaply and repeatably. It is NOT the submitted asset. Apple
 * Guideline 2.3.3 wants footage captured from the shipping app, and
 * react-native-web renders differ from native, so the locked run gets re-shot
 * on the iOS build with `xcrun simctl io booted recordVideo`.
 *
 * Every beat also writes a still, so a beat that silently failed to navigate
 * shows up as a duplicate frame instead of being discovered in the edit.
 */

const OUT_DIR = resolve(__dirname, '../marketing/videos/app-preview');

/** One beat of the shot list. `dwellMs` is how long the shot holds on camera. */
interface Beat {
  name: string;
  caption: string;
  dwellMs: number;
  run: (page: Page) => Promise<void>;
}

/** Settle time after a navigation before the shot is considered framed. */
const SETTLE_MS = 1_200;

/**
 * Leave any fullscreen in-game app so the tab bar is reachable again.
 *
 * `app/(tabs)/_layout.tsx` hides the whole tab bar while a sub-app is open
 * (`fullscreenApp`), so a beat that opened Stocks cannot simply tap the next
 * tab — it has to back out first.
 */
async function exitFullscreenApp(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) {
    if (await page.getByRole('tab', { name: 'Home', exact: true }).isVisible().catch(() => false)) return;
    const back = page.locator('[aria-label="Back"], [data-testid="back-button"]').first();
    if ((await back.count()) > 0) {
      await back.click({ timeout: 5_000 }).catch(() => {});
    } else {
      await page.goBack().catch(() => {});
    }
    await page.waitForTimeout(SETTLE_MS);
  }
}

async function tapTab(page: Page, name: string): Promise<void> {
  const tab = page.getByRole('tab', { name, exact: true });
  if (!(await tab.isVisible().catch(() => false))) await exitFullscreenApp(page);
  await expect(tab, `tab "${name}" should be in the tab bar`).toBeVisible({ timeout: 20_000 });
  await tab.click();
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * Tap something by its visible label. Returns false instead of throwing when
 * the target is absent — a missing in-app icon should cost one beat, not the
 * whole capture run.
 */
async function tapLabel(page: Page, label: string): Promise<boolean> {
  const target = page.getByText(label, { exact: true }).first();
  if ((await target.count()) === 0) return false;
  try {
    await target.click({ timeout: 8_000 });
    await page.waitForTimeout(SETTLE_MS);
    return true;
  } catch {
    return false;
  }
}

/** Slow, readable scroll — a jump cut reads as a glitch at 30fps. */
async function easeScroll(page: Page, distance: number, steps = 18): Promise<void> {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, distance / steps);
    await page.waitForTimeout(45);
  }
}

const BEATS: Beat[] = [
  {
    name: '01-identity',
    caption: 'Age 40. Net worth $17.8M. Started with $250.',
    dwellMs: 3_200,
    run: async () => {
      // Already on Home after entering the game — this beat is the hold.
    },
  },
  {
    name: '02-networth',
    caption: 'Every number is simulated, not scripted.',
    dwellMs: 2_800,
    run: async (page) => {
      await easeScroll(page, 620);
    },
  },
  {
    name: '03-work',
    caption: 'CEO. Two companies on the payroll.',
    dwellMs: 3_000,
    run: async (page) => {
      await tapTab(page, 'Work');
    },
  },
  {
    name: '04-apps',
    caption: 'A whole phone inside the game.',
    dwellMs: 2_400,
    run: async (page) => {
      await tapTab(page, 'Apps');
    },
  },
  {
    name: '05-stocks',
    caption: 'A market that moves whether you watch it or not.',
    dwellMs: 3_400,
    run: async (page) => {
      if (!(await tapLabel(page, 'Stocks'))) await easeScroll(page, 300);
    },
  },
  {
    name: '06-portfolio',
    caption: 'Buy. Hold. Compound.',
    dwellMs: 2_800,
    run: async (page) => {
      await easeScroll(page, 500);
    },
  },
  {
    name: '07-life',
    caption: 'A family that outlives you.',
    dwellMs: 3_000,
    run: async (page) => {
      await tapTab(page, 'Life');
      // The Life tab opens on Health; Family is a sub-tab within it.
      await tapLabel(page, 'Family');
    },
  },
  {
    name: '08-dynasty',
    caption: 'Two kids. One heir. Thirteen inherited traits.',
    dwellMs: 3_200,
    run: async (page) => {
      await easeScroll(page, 480);
    },
  },
];

test('capture: app preview hero run', async ({ page }, testInfo) => {
  test.setTimeout(300_000);

  const bundle = loadDemoBundle();
  const hero = bundle.chapters[bundle.chapters.length - 1];

  const pageErrors: string[] = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await seedDemoSaves(page, hero.slot);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // Enter the game. Everything before this is boot, not footage.
  const cont = page.getByText('Continue', { exact: true });
  await expect(cont).toBeVisible({ timeout: 150_000 });
  await cont.click();
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(6_000);

  mkdirSync(OUT_DIR, { recursive: true });

  const timeline: { beat: string; caption: string; startMs: number; endMs: number }[] = [];
  const t0 = Date.now();

  for (const beat of BEATS) {
    const startMs = Date.now() - t0;
    await beat.run(page);
    await page.waitForTimeout(beat.dwellMs);
    await page.screenshot({ path: resolve(OUT_DIR, `${beat.name}.png`) });
    timeline.push({ beat: beat.name, caption: beat.caption, startMs, endMs: Date.now() - t0 });
    console.log(`  ${beat.name.padEnd(14)} ${String(startMs).padStart(6)}ms  ${beat.caption}`);
  }

  // The beat sheet is the actual handoff to the native re-shoot: shot order and
  // the caption each shot has to carry, with the timings this run measured.
  writeFileSync(
    resolve(OUT_DIR, 'beat-sheet.json'),
    JSON.stringify(
      { character: 'Ava Moreno', slot: hero.slot, netWorth: hero.netWorth, totalMs: Date.now() - t0, beats: timeline },
      null,
      2
    ) + '\n',
    'utf8'
  );

  expect(pageErrors, `page errors during capture:\n${pageErrors.join('\n')}`).toEqual([]);

  // Video is finalised on context close; copy it out in teardown.
  const videoPath = await page.video()?.path();
  if (videoPath) {
    testInfo.attach('preview', { path: videoPath, contentType: 'video/webm' }).catch(() => {});
    process.env.DEMO_VIDEO_SRC = videoPath;
  }
});

test.afterAll(async () => {
  const src = process.env.DEMO_VIDEO_SRC;
  if (!src) return;
  mkdirSync(OUT_DIR, { recursive: true });
  const dest = resolve(OUT_DIR, 'hero-run.webm');
  try {
    copyFileSync(src, dest);
    console.log(`\nVideo -> ${dest}`);
  } catch (e) {
    console.log(`\nCould not copy video from ${src}: ${(e as Error).message}`);
  }
});
