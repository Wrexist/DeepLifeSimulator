import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { seedDemoSaves } from './support/demoSave';
import { installShortsOverlay, installHiDpi, sx } from './support/shortsOverlay';

/**
 * YouTube Shorts capture.
 *
 * Each test produces one finished Short: real captured gameplay with the
 * caption layer composited live in the page (see `support/shortsOverlay.ts`),
 * recorded at 1080x1920. `scripts/demo/encodeShorts.mjs` then trims the boot
 * sequence off the front and encodes to H.264 MP4.
 *
 * Design constraints, from `marketing/youtube-shorts-playbook.md`:
 *   - 18-24s. Distribution gates on ~65% average view duration for sub-30s
 *     Shorts, and that bar is much easier to clear at 20s than at 45s.
 *   - The hook owns the first 1-2 seconds. Every Short here opens on motion or
 *     a claim, never on a static menu.
 *   - Captions sit in the upper band. The bottom 195 CSS px (390px at 1080)
 *     disappears under YouTube's title, channel name and buttons.
 *   - Sound-off by default, so captions carry the whole message.
 *   - The app name appears in every Short: Shorts descriptions have no
 *     clickable links, so branded search is the main organic install path.
 */

const OUT = resolve(__dirname, '../marketing/videos/shorts');
const ACCENT = '#4F8EF7';

const hold = (page: Page, ms: number) => page.waitForTimeout(ms);

/** Click the visible instance of a label. */
async function tap(page: Page, label: string, exact = true): Promise<boolean> {
  // React Navigation keeps inactive tab screens mounted, so a plain text match
  // can resolve to a hidden copy on another screen and click nothing.
  const target = page.getByText(label, { exact }).filter({ visible: true }).first();
  if ((await target.count()) === 0) return false;
  try {
    await target.click({ timeout: 8_000 });
    return true;
  } catch {
    return false;
  }
}

async function tapTab(page: Page, name: string): Promise<void> {
  const tab = page.getByRole('tab', { name, exact: true });
  if (!(await tab.isVisible().catch(() => false))) {
    // Back out of any fullscreen sub-app, which hides the whole tab bar.
    // Sub-apps are inconsistent about how you leave: Stocks has a back arrow,
    // the Family sheet has an X, so try both before falling back to history.
    for (let i = 0; i < 4 && !(await tab.isVisible().catch(() => false)); i++) {
      const dismiss = page
        .locator('[aria-label="Back"], [aria-label="Close"], [aria-label="close"]')
        .filter({ visible: true })
        .first();
      if (await dismiss.count()) {
        await dismiss.click({ timeout: 5_000 }).catch(() => {});
      } else {
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(400);
        if (!(await tab.isVisible().catch(() => false))) await page.goBack().catch(() => {});
      }
      await page.waitForTimeout(900);
    }
  }
  await expect(tab).toBeVisible({ timeout: 20_000 });
  await tab.click();
}

/** Slow scroll — a jump reads as a glitch at 30fps. */
async function glide(page: Page, distance: number, ms = 900): Promise<void> {
  const steps = Math.max(12, Math.round(ms / 40));
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, distance / steps);
    await page.waitForTimeout(ms / steps);
  }
}

/** Boot the app on a demo slot with the cover held over the whole setup. */
async function boot(page: Page, slot: number): Promise<void> {
  await installHiDpi(page);
  await installShortsOverlay(page, { accent: ACCENT });
  await seedDemoSaves(page, slot);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const cont = page.getByText('Continue', { exact: true });
  await expect(cont).toBeVisible({ timeout: 180_000 });
  await cont.click();
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(7_000);
  await sx(page, 'bottomScrim', true);
}

interface Sidecar {
  id: string;
  title: string;
  description: string;
  startSec: number;
  durSec: number;
  video: string;
}

/**
 * Close a Short by dropping the cover back on.
 *
 * The encoder finds the clip boundaries with ffmpeg blackdetect rather than
 * wall-clock arithmetic: Playwright records variable-rate, and during boot the
 * page is busy enough that frames are dropped, so video time and wall time
 * diverge by seconds. A black head and a black tail are unambiguous in video
 * time. The wall-clock numbers in the sidecar are kept only as a fallback.
 */
async function seal(page: Page): Promise<void> {
  await sx(page, 'cover', true);
  await hold(page, 1_200);
}

const REPO_ROOT = resolve(__dirname, '..');

function writeSidecar(s: Sidecar): void {
  // Repo-relative so the committed sidecar isn't stamped with whatever absolute
  // path the capturing machine happened to use.
  s = { ...s, video: relative(REPO_ROOT, s.video) };
  mkdirSync(OUT, { recursive: true });
  writeFileSync(resolve(OUT, `${s.id}.json`), JSON.stringify(s, null, 2) + '\n', 'utf8');
  console.log(`  ${s.id}: start ${s.startSec.toFixed(2)}s  dur ${s.durSec.toFixed(2)}s`);
}

// ---------------------------------------------------------------------------

test('short 01 — the climb', async ({ page }, testInfo) => {
  test.setTimeout(400_000);
  const pageBorn = Date.now();
  await boot(page, 3);

  const t0 = Date.now();
  await sx(page, 'cover', false);
  // Hook: the starting number is on screen from frame one.
  await sx(page, 'counter', 250, 250, 1, 'NET WORTH');
  await sx(page, 'caption', 'I started with $250.', { eyebrow: 'DEEP LIFE SIMULATOR' });
  // Let the viewer actually read $250 before it moves — the jump is the hook,
  // and it only lands if the starting number registered first.
  await hold(page, 700);
  await sx(page, 'counter', 250, 17_760_000, 2_800, 'NET WORTH');
  await hold(page, 3_000);

  await sx(page, 'hideCounter');
  await sx(page, 'caption', '22 years later.', { eyebrow: 'AGE 18 → 40', sub: 'Every number simulated.' });
  await hold(page, 2_100);

  await sx(page, 'caption', 'No script.', { eyebrow: 'NET WORTH $17.76M', sub: 'Just the economy.' });
  await glide(page, 520, 800);
  await hold(page, 1_900);

  await sx(page, 'caption', 'Two companies.', { sub: 'Both on the payroll.' });
  await tapTab(page, 'Work');
  await hold(page, 2_300);

  await sx(page, 'clearCaption');
  await tapTab(page, 'Apps');
  await hold(page, 350);
  await tap(page, 'Stocks');
  await hold(page, 800);
  await sx(page, 'caption', 'A live market.', { sub: 'It moves without you.' });
  await hold(page, 2_100);

  await sx(page, 'clearCaption');
  await sx(page, 'endCard', 'Deep Life Simulator', 'Start with nothing. Free on the App Store.');
  await hold(page, 1_600);
  const t1 = Date.now();
  await seal(page);

  writeSidecar({
    id: '01-the-climb',
    title: 'I turned $250 into $17.8 million',
    description:
      'One life, 22 years, no script — just loans, a job, the stock market and compound interest. Deep Life Simulator.',
    startSec: (t0 - pageBorn) / 1000,
    durSec: (t1 - t0) / 1000,
    video: testInfo.outputDir,
  });
});

test('short 02 — real economics', async ({ page }, testInfo) => {
  test.setTimeout(400_000);
  const pageBorn = Date.now();
  await boot(page, 3);

  // Open ON the market, not on the way to it.
  await tapTab(page, 'Apps');
  await hold(page, 900);
  await tap(page, 'Stocks');
  await hold(page, 2_500);

  const t0 = Date.now();
  await sx(page, 'cover', false);
  await sx(page, 'caption', 'Most life sims fake\nthe economy.', { eyebrow: 'DEEP LIFE SIMULATOR' });
  await hold(page, 2_500);

  await sx(page, 'caption', '14 up. 11 down.', { sub: 'Sectors rotate on their own.' });
  await hold(page, 2_400);

  await sx(page, 'clearCaption');
  await glide(page, 460, 800);
  await hold(page, 500);
  await sx(page, 'caption', 'Real tickers.', { sub: 'Real spreads.', scrim: true });
  await hold(page, 2_000);

  await sx(page, 'clearCaption');
  await tapTab(page, 'Apps');
  await hold(page, 350);
  await tap(page, 'Bank');
  await hold(page, 700);
  await sx(page, 'caption', 'Loans. Interest.', { sub: 'A credit score that actually drops.' });
  await hold(page, 2_300);

  await sx(page, 'caption', 'This one does the math.', { eyebrow: 'DEEP LIFE SIMULATOR' });
  await hold(page, 2_000);

  await sx(page, 'clearCaption');
  await sx(page, 'endCard', 'Deep Life Simulator', 'A life sim with a real economy.');
  await hold(page, 1_600);
  const t1 = Date.now();
  await seal(page);

  writeSidecar({
    id: '02-real-economics',
    title: 'Most life sims fake the economy. This one does the math.',
    description:
      'Live stock market, sector rotation, loans, interest and a credit score that actually drops. Deep Life Simulator.',
    startSec: (t0 - pageBorn) / 1000,
    durSec: (t1 - t0) / 1000,
    video: testInfo.outputDir,
  });
});

test('short 03 — the dynasty', async ({ page }, testInfo) => {
  test.setTimeout(400_000);
  const pageBorn = Date.now();
  await boot(page, 3);

  await tapTab(page, 'Life');
  await hold(page, 900);
  await tap(page, 'Family');
  await hold(page, 2_500);

  const t0 = Date.now();
  await sx(page, 'cover', false);
  await sx(page, 'caption', 'You die. They don’t.', { eyebrow: 'DEEP LIFE SIMULATOR' });
  await hold(page, 2_600);

  await sx(page, 'caption', 'Two kids. One heir.', { sub: '13 genetic traits carry forward.' });
  await hold(page, 2_600);

  await sx(page, 'clearCaption');
  await glide(page, 340, 700);
  await hold(page, 400);
  await sx(page, 'caption', 'Raise them well.', { sub: 'They inherit all of it.' });
  await hold(page, 2_200);

  await sx(page, 'caption', 'Raise them badly.', { sub: 'They inherit that too.' });
  await hold(page, 2_300);

  // Deliberately stays on the Family sheet to the end. It is a modal whose
  // close control has no accessible name, so leaving it reliably is fiddly —
  // and holding the subject is the better cut anyway.
  await sx(page, 'caption', 'Generation 2 starts here.', { eyebrow: 'GENERATION 1 → 2' });
  await glide(page, 260, 600);
  await hold(page, 2_000);

  await sx(page, 'clearCaption');
  await sx(page, 'endCard', 'Deep Life Simulator', 'Build a dynasty. Free on the App Store.');
  await hold(page, 1_600);
  const t1 = Date.now();
  await seal(page);

  writeSidecar({
    id: '03-the-dynasty',
    title: 'Your kids inherit everything — including your mistakes',
    description:
      'Thirteen genetic traits, nurture stats and a family tree that outlives you. Deep Life Simulator.',
    startSec: (t0 - pageBorn) / 1000,
    durSec: (t1 - t0) / 1000,
    video: testInfo.outputDir,
  });
});
