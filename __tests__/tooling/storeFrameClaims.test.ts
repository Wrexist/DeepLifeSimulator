/**
 * Every claim printed on an App Store frame must appear in the screenshot it
 * is printed over.
 *
 * The 2026-07 set failed this on half its frames, and the failures were the
 * kind anyone can check in two seconds once they think to look:
 *
 *   - "PhD unlocked" sat over the Education **Catalog** — a list of courses
 *     NOT taken, every row carrying a price and an Enroll button.
 *   - "Rare collection" sat over a Luxury screen reading `Collection (0)` and
 *     `0 / 6 collectibles`, i.e. the player owned nothing.
 *   - "Every app unlocked" sat over a grid of six apps.
 *
 * Nobody was being careless: the captions were written as marketing copy first
 * and matched to captures afterwards, which is exactly the order that produces
 * this. Apple's Guideline 2.3.3 ("accurately represent the app experience") is
 * the outside version of the same rule, and 2.3.3 rejections cost a review
 * cycle and take every attached IAP down with them.
 *
 * So the check is mechanical. `capture-rich-state.mjs` writes each capture's
 * on-screen text beside the PNG, and every frame declares the literal strings
 * that must be in it. A re-capture that lands in a different game state, or a
 * UI reword, fails HERE — loudly, in CI — instead of on the product page.
 */
import { execFileSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '..', '..');
/**
 * Both shelves, because the two layouts show different content. The iPad app
 * grid is three columns wide and fits nine tiles where the phone fits six, so
 * a single shared "6 apps" pill would be false on one of them — which is why
 * `byKind` exists and why this check cannot look at the phone captures alone.
 */
const CAPTURE_SETS = [
  { kind: 'phone' as const, dir: join(ROOT, 'screenshots', 'appstore-2026', 'rich-captures') },
  { kind: 'tablet' as const, dir: join(ROOT, 'screenshots', 'appstore-2026', 'rich-captures-ipad') },
];

type Frame = {
  id: string;
  head: string;
  sub: string;
  num: string;
  label: string;
  hue: string;
  pick: string;
  evidence: string;
  assert: string[];
  support: string[];
  items?: string[];
  byKind?: Partial<Record<'phone' | 'tablet', { num: string; label: string; items?: string[] }>>;
};

/**
 * Reads the frame list out of the ESM design module.
 *
 * A subprocess rather than an import: `storeFrameSystem.mjs` is ESM with a
 * top-level `readFileSync` of a font, and this suite is ts-jest/CJS. Shelling
 * out keeps ONE source of truth — duplicating the frame table into a JSON
 * sidecar for the test's benefit would let the copy under test drift from the
 * copy that renders, which is the whole bug class this file exists to catch.
 */
function loadFrames(): Frame[] {
  const src = join(ROOT, 'scripts', 'lib', 'storeFrameSystem.mjs');
  const out = execFileSync(
    process.execPath,
    ['--input-type=module', '-e', `import { FRAMES } from ${JSON.stringify(src)}; process.stdout.write(JSON.stringify(FRAMES));`],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  return JSON.parse(out) as Frame[];
}

/** Frame key → capture basename. Mirrors `SHOTS` in both generators. */
const PICKS: Record<string, string> = {
  home: '00-home',
  spark: '05-app-spark',
  stocks: '07-app-stocks',
  contacts: '09-app-contacts',
  apps: '03-apps',
  company: '17-x-company',
  darkweb: '18-x-darkweb',
  crypto: '19-x-crypto',
  education: '28-app-education-earned',
  luxury: '29-x-luxury-collection',
};

const frames = loadFrames();

/**
 * Collapse whitespace, normalise the dashes/quotes the UI renders, and fold
 * case — several headers ("CURRENT JOB", "EMPIRE SNAPSHOT") are uppercased in
 * CSS, so the DOM text and the pixels disagree on case and a caption is not
 * wrong for picking one.
 */
const norm = (s: string) =>
  s.replace(/\s+/g, ' ').replace(/[‐-―]/g, '-').replace(/[‘’]/g, "'").trim().toLowerCase();

/**
 * Whitespace-free variant, checked as well as the spaced one.
 *
 * React Native Web splits a styled run into separate text nodes, so the wallet
 * chip that reads `$11M` on screen comes back as two nodes and joins as
 * `"$ 11M"`. Matching only the spaced form would fail a caption that is
 * verbatim correct, and "loosen the claim until it passes" is the move this
 * whole file exists to prevent — so the comparison absorbs the split instead.
 */
const tight = (s: string) => norm(s).replace(/\s+/g, '');

function assertClaim(screen: string, claim: string, where: string) {
  if (norm(screen).includes(norm(claim))) return;
  if (tight(screen).includes(tight(claim))) return;
  throw new Error(
    `${where}: the frame claims ${JSON.stringify(claim)}, but that text is not visible in the `
    + `screenshot it is printed over.\n  Screen shows: ${norm(screen).slice(0, 400)}`,
  );
}

describe('store frames only claim what their screenshot shows', () => {
  it('exports exactly ten frames, which is Apple’s per-shelf maximum', () => {
    expect(frames).toHaveLength(10);
  });

  it('numbers every frame in upload order', () => {
    expect(frames.map((f) => f.id.slice(0, 2))).toEqual([
      '01', '02', '03', '04', '05', '06', '07', '08', '09', '10',
    ]);
  });

  it.each(frames.map((f) => [f.id, f] as const))('%s', (_id, frame) => {
    // Structural: the accent word is marked with a `|word|` pair, and a frame
    // with no proof is a frame making an unbacked claim.
    expect(frame.head.match(/\|/g)).toHaveLength(2);
    expect(frame.num.length).toBeGreaterThan(0);
    expect(frame.evidence.length).toBeGreaterThan(0);
    expect(frame.assert.length).toBeGreaterThan(0);

    const base = PICKS[frame.pick];
    expect(base).toBeDefined();

    for (const set of CAPTURE_SETS) {
      const txt = join(set.dir, `${base}.txt`);
      if (!existsSync(txt)) {
        throw new Error(
          `No captured text for ${base} in ${set.kind} captures. Re-run `
          + `scripts/capture-rich-state.mjs — it writes a .txt of the VISIBLE text `
          + `beside every .png. Without it this frame's caption is unverifiable, which `
          + `is the state the whole check exists to end.`,
        );
      }
      const screen = readFileSync(txt, 'utf8');
      for (const claim of frame.assert) {
        assertClaim(screen, claim, `${frame.id} [${set.kind}]`);
      }
      // The pill's own number has to be in the picture too, not just the
      // supporting `assert` strings. Digits only: "2.000 BTC" renders as
      // "2.000 ₿" on one screen and "2.000 BTC" on another, and a caption is
      // not wrong for spelling out the ticker.
      const pill = { num: frame.num, items: frame.items, ...(frame.byKind?.[set.kind] ?? {}) };
      const digits = pill.num.match(/[\d][\d.,]*/)?.[0];

      if (pill.items) {
        // A count of things in the picture. Nothing prints "6", so checking for
        // the digit would be checking nothing — instead every counted thing has
        // to be visible, and there have to be exactly as many as the pill says.
        for (const item of pill.items) {
          assertClaim(screen, item, `${frame.id} [${set.kind}] counted item`);
        }
        expect(`${frame.id} [${set.kind}] counts ${pill.items.length}`)
          .toBe(`${frame.id} [${set.kind}] counts ${Number(digits)}`);
      } else if (digits) {
        // Every other frame quotes a number the UI prints, so look for it.
        assertClaim(screen, digits, `${frame.id} [${set.kind}] pill number`);
      }
    }
  });

  it('gives every frame two flanking screens, neither of them the hero', () => {
    // The flanks carry no claim, but they are the composition: a frame that
    // silently loses one renders as a lone device among nine trios, and
    // nothing else in the pipeline would say so.
    for (const f of frames) {
      expect(f.support).toHaveLength(2);
      expect(f.support).not.toContain(f.pick);
      expect(new Set(f.support).size).toBe(2);
    }
  });

  it('gives no two adjacent frames the same accent hue', () => {
    // One hue per frame, drawn from the app's own theme; adjacent repeats make
    // the carousel look like a rendering mistake rather than a series.
    for (let i = 1; i < frames.length; i++) {
      expect(frames[i].hue).not.toBe(frames[i - 1].hue);
    }
  });

  it('keeps every headline short enough to read as a search-result thumbnail', () => {
    for (const f of frames) {
      const words = f.head.replace(/\|/g, '').trim().split(/\s+/);
      expect(words.length).toBeLessThanOrEqual(5);
    }
  });
});
