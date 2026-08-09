import { test, expect, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { seedDemoSaves } from './support/demoSave';
import { installShortsOverlay, installHiDpi, sx } from './support/shortsOverlay';

/**
 * YouTube Shorts capture.
 *
 * Each test produces one finished Short: real captured gameplay with the
 * caption layer and 3D scene composited live in the page (see
 * `support/shortsOverlay.ts` and `support/shortsScene.ts`), recorded at
 * 2160x3840. `scripts/demo/encodeShorts.mjs` trims the boot sequence off the
 * front and encodes to H.264 MP4.
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
 *
 * Beats are scheduled on an ABSOLUTE timeline (`at()`), not with relative
 * sleeps. At a 4K viewport a Playwright round-trip costs a meaningful fraction
 * of a second and a tab switch costs more, so relative holds made the finished
 * length a function of machine speed — the same script produced an 18s cut and
 * a 35s one. Absolute marks make the runtime deterministic and put any slowness
 * into the slack between beats instead of into the duration.
 */

const OUT = resolve(__dirname, '../marketing/videos/shorts');
const ACCENT = '#4F8EF7';

/** Wait until `ms` after the clip's t0. Warns if a beat has already overrun. */
async function at(page: Page, t0: number, ms: number): Promise<void> {
  const remaining = ms - (Date.now() - t0);
  if (remaining < -250) {
    console.warn(`    ! beat at ${ms}ms overran by ${Math.round(-remaining)}ms`);
  }
  if (remaining > 0) await page.waitForTimeout(remaining);
}

const hold = (page: Page, ms: number) => page.waitForTimeout(ms);

/**
 * Click the visible instance of a label, and fail loudly if it isn't there.
 *
 * This used to return false on a miss. It hid a real bug: the Family sub-tab
 * had not rendered yet when the click fired, so Short 03 quietly filmed the
 * Health tab instead of the family tree.
 */
async function tap(page: Page, label: string, expectAfter?: string): Promise<void> {
  // Playwright's own click. An earlier version dispatched synthetic pointer
  // events from inside the page to dodge a suspected zoom/coordinate problem;
  // that turned out to be unnecessary for these targets and caused its own
  // failures, so this is back to the boring path that works.
  const target = page.getByText(label, { exact: true }).filter({ visible: true }).first();
  await expect(target, `"${label}" should be on screen`).toBeVisible({ timeout: 15_000 });
  await target.click({ timeout: 10_000 });
  await page.waitForTimeout(900);

  if (!expectAfter) return;
  // Prove the screen actually changed. A tap that silently does nothing is how
  // a Short ends up captioned for one screen and filmed on another — which is
  // exactly what happened to Short 03 before this assertion existed.
  await expect(
    page.getByText(expectAfter, { exact: false }).filter({ visible: true }).first(),
    `tapping "${label}" should reveal "${expectAfter}"`
  ).toBeVisible({ timeout: 15_000 });
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

/** Boot the app on a demo slot with the cover held over the whole setup. */
async function boot(page: Page, slot: number): Promise<void> {
  await installHiDpi(page, 4); // 2160x3840 viewport, 540x960 layout space
  await installShortsOverlay(page, { accent: ACCENT });
  await seedDemoSaves(page, slot);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const cont = page.getByText('Continue', { exact: true });
  await expect(cont).toBeVisible({ timeout: 180_000 });
  await cont.click();
  await expect(page.getByRole('tab', { name: 'Home', exact: true })).toBeVisible({ timeout: 60_000 });
  await page.waitForTimeout(8_000);
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
  // Generous on purpose: at 4K the recorder finishes behind the wall clock, and
  // a 1.2s hold could end up as less than the 0.35s of black that blackdetect
  // needs to report a tail marker — which silently drops the encoder onto its
  // wall-clock fallback.
  await hold(page, 3_000);
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

  // Arm the opening frame BEFORE lifting the cover. Each round-trip costs a
  // few hundred ms at a 4K viewport, so setting the caption after the reveal
  // left the first second of the clip empty — the worst second to waste.
  await sx(page, 'counter', 250, 250, 1, 'NET WORTH');
  await sx(page, 'caption', 'I started with $250.', { eyebrow: 'DEEP LIFE SIMULATOR' });
  await sx(page, 'camera', { scale: 1.03, ms: 9_000 });
  const t0 = Date.now();
  await sx(page, 'cover', false);
  // Re-assert after the reveal. The overlay re-creates itself if the app
  // replaces the body's children during boot, and a caption armed before that
  // happens is lost with the old layer — which cost Short 01 its opening
  // second more than once.
  await sx(page, 'counter', 250, 250, 1, 'NET WORTH');
  await sx(page, 'caption', 'I started with $250.', { eyebrow: 'DEEP LIFE SIMULATOR' });

  // Let the viewer read $250 before it moves — the jump is the hook, and it
  // only lands if the starting number registered first.
  await at(page, t0, 800);
  await sx(page, 'counter', 250, 17_760_000, 2_800, 'NET WORTH');

  await at(page, t0, 4_100);
  await sx(page, 'hideCounter');
  await sx(page, 'caption', '22 years later.', { eyebrow: 'AGE 18 → 40', sub: 'Every number simulated.' });

  await at(page, t0, 6_300);
  await sx(page, 'caption', 'No script.', { eyebrow: 'NET WORTH $17.76M', sub: 'Just the economy.' });
  await sx(page, 'scroll', 520, 900);

  await at(page, t0, 8_700);
  await sx(page, 'caption', 'Two companies.', { sub: 'Both on the payroll.' });
  await sx(page, 'camera', { scale: 1, ms: 1_400 });
  await tapTab(page, 'Work');

  await at(page, t0, 11_600);
  await sx(page, 'clearCaption');
  await tapTab(page, 'Apps');
  await hold(page, 700);
  await tap(page, 'Stocks', 'Sector rotation');

  await at(page, t0, 13_600);
  // Pull the app back into the 3D scene: the running game becomes an object in
  // a lit space rather than the whole frame.
  await sx(page, 'camera', { scale: 0.76, rotY: -15, rotX: 6, y: 58, ms: 1_600 });
  await sx(page, 'caption', 'A live market.', { sub: 'It moves without you.', scrim: false });

  await at(page, t0, 16_800);
  await sx(page, 'clearCaption');
  await sx(page, 'endCard', 'Deep Life Simulator', 'Start with nothing. Free on the App Store.');

  await at(page, t0, 19_400);
  await expect(page.locator('.sx-end.on'), 'end card should be showing').toBeVisible();
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
  await hold(page, 700);
  await tap(page, 'Stocks', 'Sector rotation');
  await hold(page, 2_500);

  await sx(page, 'caption', 'Most life sims fake\nthe economy.', { eyebrow: 'DEEP LIFE SIMULATOR' });
  await sx(page, 'camera', { scale: 1.025, ms: 8_000 });
  const t0 = Date.now();
  await sx(page, 'cover', false);
  await sx(page, 'caption', 'Most life sims fake\nthe economy.', { eyebrow: 'DEEP LIFE SIMULATOR' });

  await at(page, t0, 2_700);
  await sx(page, 'caption', '14 up. 11 down.', { sub: 'Sectors rotate on their own.' });

  await at(page, t0, 5_300);
  await sx(page, 'clearCaption');
  await sx(page, 'scroll', 470, 900);

  await at(page, t0, 6_700);
  await sx(page, 'caption', 'Real tickers.', { sub: 'Real spreads.' });

  await at(page, t0, 9_200);
  await sx(page, 'clearCaption');
  await sx(page, 'camera', { scale: 1, ms: 900 });
  await tapTab(page, 'Apps');
  await hold(page, 700);
  await tap(page, 'Bank', 'Net worth composition');

  await at(page, t0, 13_100);
  await sx(page, 'caption', 'Loans. Interest.', { sub: 'A credit score that actually drops.' });

  await at(page, t0, 15_500);
  await sx(page, 'camera', { scale: 0.76, rotY: 14, rotX: 5, y: 58, ms: 1_600 });
  await sx(page, 'caption', 'This one does the math.', { eyebrow: 'DEEP LIFE SIMULATOR', scrim: false });

  await at(page, t0, 18_100);
  await sx(page, 'clearCaption');
  await sx(page, 'endCard', 'Deep Life Simulator', 'A life sim with a real economy.');

  await at(page, t0, 20_700);
  await expect(page.locator('.sx-end.on'), 'end card should be showing').toBeVisible();
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

  // Contacts, not the Life > Family sheet. That sheet is a modal that would
  // not stay open under automation — it opened and closed again on the same
  // synthetic activation — and Contacts shows the same cast (spouse, both
  // children, bond scores) through the reliable Apps route that Shorts 01 and
  // 02 already use.
  await tapTab(page, 'Apps');
  await hold(page, 700);
  await tap(page, 'Contacts', 'inner circle');
  await hold(page, 2_500);

  await sx(page, 'caption', 'You die. They don’t.', { eyebrow: 'DEEP LIFE SIMULATOR' });
  await sx(page, 'camera', { scale: 1.028, ms: 9_000 });
  const t0 = Date.now();
  await sx(page, 'cover', false);
  await sx(page, 'caption', 'You die. They don’t.', { eyebrow: 'DEEP LIFE SIMULATOR' });

  await at(page, t0, 2_800);
  await sx(page, 'caption', 'Two kids. One heir.', { sub: '13 genetic traits carry forward.' });

  await at(page, t0, 5_500);
  await sx(page, 'clearCaption');
  await sx(page, 'scroll', 340, 800);

  await at(page, t0, 6_600);
  await sx(page, 'caption', 'Every bond is tracked.', { sub: 'Neglect one and it decays.' });

  await at(page, t0, 9_000);
  await sx(page, 'caption', 'Raise them well.', { sub: 'They inherit all of it.' });

  await at(page, t0, 11_400);
  // Deliberately stays on the Family sheet to the end. It is a modal whose
  // close control has no accessible name, so leaving it reliably is fiddly —
  // and holding the subject is the better cut anyway.
  await sx(page, 'camera', { scale: 0.78, rotY: -13, rotX: 6, y: 52, ms: 1_600 });
  await sx(page, 'caption', 'Generation 2 starts here.', { eyebrow: 'GENERATION 1 → 2', scrim: false });

  await at(page, t0, 14_600);
  await sx(page, 'clearCaption');
  await sx(page, 'endCard', 'Deep Life Simulator', 'Build a dynasty. Free on the App Store.');

  await at(page, t0, 17_200);
  await expect(page.locator('.sx-end.on'), 'end card should be showing').toBeVisible();
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
