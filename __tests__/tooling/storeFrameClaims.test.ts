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
  act: string;
  mode: 'solo' | 'trio' | 'edge';
  art: string;
  head: string;
  sub: string;
  num: string;
  label: string;
  hue: string;
  pick: string;
  evidence: string;
  assert: string[];
  support: string[];
  items?: string[] | null;
  byKind?: Partial<Record<'phone' | 'tablet', { num: string; label: string; items?: string[] }>>;
};

type Loaded = {
  frames: Frame[];
  captures: Record<string, string>;
  art: Record<string, { file: string }>;
  acts: { id: string; title: string; size: number }[];
  minScreenShare: number;
  layouts: Record<string, { H: number; devH: number; edgeH: number }>;
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
function loadModule(): Loaded {
  const src = join(ROOT, 'scripts', 'lib', 'storeFrameSystem.mjs');
  const out = execFileSync(
    process.execPath,
    ['--input-type=module', '-e',
      `import { FRAMES, CAPTURES, ART, ACTS, MIN_SCREEN_SHARE, layoutFor } from ${JSON.stringify(src)};`
      + ' process.stdout.write(JSON.stringify({ frames: FRAMES, captures: CAPTURES, art: ART, acts: ACTS,'
      + ' minScreenShare: MIN_SCREEN_SHARE, layouts: {'
      + " 'iphone-6.9': layoutFor(1320, 2868, 'phone'),"
      + " 'iphone-6.5': layoutFor(1284, 2778, 'phone'),"
      + " 'ipad-13': layoutFor(2064, 2752, 'tablet') } }));"],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 },
  );
  return JSON.parse(out) as Loaded;
}


const { frames, captures: CAPTURES, art: ART, acts: ACTS, minScreenShare: MIN_SCREEN_SHARE, layouts: LAYOUTS }
  = loadModule();

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

    // Resolved from the SAME table the generators render from, so a new capture
    // key cannot pass there and fail here (which is exactly what a duplicated
    // copy of this map did).
    const base = CAPTURES[frame.pick]?.replace(/\.png$/, '');
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
      const pill = { num: frame.num, items: frame.items ?? undefined, ...(frame.byKind?.[set.kind] ?? {}) };
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

  it('gives every composition mode the flanks it is supposed to have', () => {
    // The set used to run ONE composition ten times over, which is most of why
    // it read as a template rather than a series. There are three now, and each
    // means something: `solo` for the frames whose argument is small text that
    // has to survive a 141px thumbnail, `trio` where breadth is the point, and
    // `edge` where the scene should out-argue the screen. A frame that silently
    // loses or gains a flank breaks that reading and nothing else would say so.
    for (const f of frames) {
      expect(['solo', 'trio', 'edge']).toContain(f.mode);
      expect(f.support).toHaveLength(f.mode === 'trio' ? 2 : 0);
      for (const k of f.support) expect(CAPTURES[k]).toBeDefined();
      expect(f.support).not.toContain(f.pick);
      expect(new Set(f.support).size).toBe(f.support.length);
    }
    // …and that all three are actually used. A "mode" system with one mode in
    // practice is the template problem wearing a type annotation.
    expect(new Set(frames.map((f) => f.mode)).size).toBe(3);
  });

  it('gives every frame a scene that ships in the app', () => {
    // The art is read out of `assets/images/` — the same plates the game
    // renders — so a frame cannot advertise art the product does not contain.
    // A missing file means a plate was moved or deleted in the app, and the
    // right fix is to update ART, never to let the generator fall back to
    // nothing.
    for (const f of frames) {
      expect(ART[f.art]).toBeDefined();
      const p = join(ROOT, 'assets', 'images', ART[f.art].file);
      if (!existsSync(p)) {
        throw new Error(`${f.id} uses assets/images/${ART[f.art].file}, which is not in the repo.`);
      }
    }
  });

  it('keeps the real screenshot the largest thing in every frame', () => {
    // Guideline 2.3.3 asks that a screenshot represent the app in use, and the
    // failure mode of an art-led set is shrinking the capture until the frame
    // is an advert with a phone in the corner. This is the floor that stops
    // that by construction, checked on every shelf because each derives its own
    // numbers from its own canvas.
    for (const [dir, L] of Object.entries(LAYOUTS)) {
      expect(`${dir} solo/trio ${(L.devH / L.H).toFixed(3)}`)
        .toBe(`${dir} solo/trio ${(L.devH / L.H).toFixed(3)}`);
      expect(L.devH / L.H).toBeGreaterThanOrEqual(MIN_SCREEN_SHARE);
      expect(L.edgeH / L.H).toBeGreaterThanOrEqual(MIN_SCREEN_SHARE);
    }
  });

  it('runs three acts whose sizes match the frame list', () => {
    // The acts are not decoration: the panorama is continuous WITHIN an act and
    // cut between them, so a mismatch here does not fail loudly — it produces a
    // carousel whose background sweep lands in the wrong place.
    expect(ACTS.reduce((n, a) => n + a.size, 0)).toBe(frames.length);
    for (const act of ACTS) {
      expect(frames.filter((f) => f.act === act.id)).toHaveLength(act.size);
    }
    // Contiguous, and in the order ACTS declares. Interleaved acts would slice
    // one act's panorama across another act's frames.
    expect(frames.map((f) => f.act))
      .toEqual(ACTS.flatMap((a) => Array.from({ length: a.size }, () => a.id)));
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
