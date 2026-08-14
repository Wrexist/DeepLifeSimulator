/**
 * Child proportions.
 *
 * Two kinds of test here, and the second kind is the one that matters:
 *
 *   1. The maths — the ramp, monotonicity, the no-op above 16, and degrading
 *      to the input rather than to a broken face.
 *   2. The COUPLING. `applyChildProportions` works by wrapping the art's own
 *      layer groups, identified by their exact transform strings. Those come
 *      from `@dicebear/avataaars`, so a package upgrade could rename them and
 *      the only symptom would be children silently going back to looking like
 *      small adults — no crash, no log, nothing red. The last section imports
 *      the REAL art and asserts the groups are still there.
 */
import { createAvatar } from '@dicebear/core';
import * as avataaars from '@dicebear/avataaars';
import { HEAD_CENTER_Y } from '@/lib/avatar/depth';
import {
  ADULT_EYE_Y,
  ADULT_PROPORTION_AGE,
  applyChildProportions,
  INFANT_EYE_Y,
  youthFactor,
} from '@/lib/avatar/proportions';

const SVG = '<svg viewBox="0 0 280 280">'
  + '<g transform="translate(0 170)"><path d="M0 0"/></g>'
  + '<g transform="translate(78 134)"><path d="M0 0"/></g>'
  + '<g transform="translate(104 122)"><path d="M0 0"/></g>'
  + '<g transform="translate(76 90)"><path d="M0 0"/></g>'
  + '<g transform="translate(76 82)"><path d="M0 0"/></g>'
  + '</svg>';

/** Where the transform sends the adult eye line. */
function eyeLineOf(svg: string): number {
  const m = /translate\(140 ([\d.]+)\) scale\(([\d.]+)\) translate\(-140 -104.5\)/.exec(svg);
  return m ? Number(m[1]) : ADULT_EYE_Y;
}

describe('youthFactor', () => {
  it('is 1 at birth and 0 from the adult age on', () => {
    expect(youthFactor(0)).toBe(1);
    expect(youthFactor(ADULT_PROPORTION_AGE)).toBe(0);
    expect(youthFactor(40)).toBe(0);
  });

  it('never increases with age', () => {
    // A non-monotonic ramp would let a character visibly get YOUNGER on a
    // birthday, which is the same class of bug the portrait pool had.
    let previous = Infinity;
    for (let age = 0; age <= 30; age += 0.5) {
      const value = youthFactor(age);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  it('is a fair ladder through childhood', () => {
    expect(youthFactor(4)).toBeCloseTo(0.75, 5);
    expect(youthFactor(8)).toBeCloseTo(0.5, 5);
    expect(youthFactor(12)).toBeCloseTo(0.25, 5);
  });

  it('survives junk and negative ages', () => {
    expect(youthFactor(NaN)).toBe(0);
    expect(youthFactor(Infinity)).toBe(0);
    expect(youthFactor(-5)).toBe(1);
  });
});

describe('applyChildProportions', () => {
  it('is a no-op at and above the adult age', () => {
    expect(applyChildProportions(SVG, ADULT_PROPORTION_AGE)).toBe(SVG);
    expect(applyChildProportions(SVG, 30)).toBe(SVG);
  });

  it('drops the eye line toward the infant position as age falls', () => {
    const baby = eyeLineOf(applyChildProportions(SVG, 0));
    const child = eyeLineOf(applyChildProportions(SVG, 8));
    expect(baby).toBeCloseTo(INFANT_EYE_Y, 3);
    expect(child).toBeGreaterThan(ADULT_EYE_Y);
    expect(child).toBeLessThan(baby);
  });

  it('shrinks the feature cluster, opening forehead above it', () => {
    const out = applyChildProportions(SVG, 0);
    const scale = Number(/scale\(([\d.]+)\)/.exec(out)![1]);
    expect(scale).toBeLessThan(1);
    expect(scale).toBeGreaterThan(0.6);
  });

  it('moves mouth, nose, eyes and brows as one cluster', () => {
    // Moving them independently pulls the face apart — the mouth drifts off
    // the nose. Every feature group must carry the SAME cluster transform.
    const out = applyChildProportions(SVG, 2);
    const cluster = /(translate\(140 [\d.]+\) scale\([\d.]+\) translate\(-140 -104\.5\))/.exec(out)![1];
    for (const group of ['translate(78 134)', 'translate(104 122)', 'translate(76 90)', 'translate(76 82)']) {
      const before = out.slice(0, out.indexOf(`<g transform="${group}">`));
      expect(before.lastIndexOf(cluster)).toBeGreaterThan(-1);
    }
  });

  it('gives the eyes extra size on top of the cluster', () => {
    const out = applyChildProportions(SVG, 0);
    // The eye group ends up wrapped twice; the inner wrapper scales UP.
    const scales = [...out.matchAll(/scale\(([\d.]+)\)/g)].map((m) => Number(m[1]));
    expect(scales.some((s) => s > 1)).toBe(true);
  });

  it('leaves the body alone', () => {
    // At the shipped crop the shoulders are outside the circle anyway, so
    // touching them would be cost with no visible benefit.
    const out = applyChildProportions(SVG, 0);
    const at = out.indexOf('<g transform="translate(0 170)">');
    expect(out.slice(Math.max(0, at - 60), at)).not.toContain('scale(');
  });

  it('degrades to the input rather than to a broken face', () => {
    expect(applyChildProportions('not an svg', 2)).toBe('not an svg');
    expect(applyChildProportions('', 2)).toBe('');
    // A future art package with different group names: no effect, no damage.
    const renamed = '<svg viewBox="0 0 280 280"><g transform="translate(9 9)"/></svg>';
    expect(applyChildProportions(renamed, 2)).toBe(renamed);
  });

  it('produces balanced markup', () => {
    const out = applyChildProportions(SVG, 3);
    expect((out.match(/<g\b/g) ?? []).length).toBe((out.match(/<\/g>/g) ?? []).length);
  });
});

describe('the art still exposes the layer groups this depends on', () => {
  /**
   * If this fails after a `@dicebear/avataaars` bump, the art changed its
   * internals. Re-derive the offsets (render one avatar, list the top-level
   * groups) and update `FEATURE_GROUPS` — do NOT delete this test, it is the
   * only thing standing between an upgrade and children silently reverting.
   */
  const REQUIRED = {
    mouth: 'translate(78 134)',
    nose: 'translate(104 122)',
    eyes: 'translate(76 90)',
    eyebrows: 'translate(76 82)',
  };

  const render = (options: Record<string, unknown>) =>
    createAvatar(avataaars, {
      seed: 'proportions', size: 280, backgroundColor: ['transparent'], ...options,
    }).toString();

  it.each(Object.entries(REQUIRED))('still emits the %s group at %s', (_name, transform) => {
    expect(render({})).toContain(`<g transform="${transform}">`);
  });

  it('emits them for every kind of face, not just the default', () => {
    // The offsets have to be configuration-independent, since one transform
    // table is applied to every avatar in the game.
    const cases: Record<string, unknown>[] = [
      { top: ['bigHair'], topProbability: 100 },
      { top: ['winterHat02'], topProbability: 100 },
      { topProbability: 0 },
      { clothing: ['blazerAndShirt'] },
      { facialHair: ['beardMajestic'], facialHairProbability: 100 },
      { accessories: ['prescription02'], accessoriesProbability: 100 },
    ];
    for (const options of cases) {
      const svg = render(options);
      for (const transform of Object.values(REQUIRED)) {
        expect(svg).toContain(`<g transform="${transform}">`);
      }
    }
  });

  it('actually changes the real art when the face is a child', () => {
    // The end-to-end claim: not just that the groups exist, but that applying
    // the transform to genuine generated art produces a different drawing.
    const art = render({ top: ['shortWaved'], topProbability: 100 });
    expect(applyChildProportions(art, 4)).not.toBe(art);
    expect(applyChildProportions(art, 30)).toBe(art);
  });

  it('keeps the adult eye line where `depth.ts` measured the head', () => {
    // The two files share one measurement of the art — skull top 36, chin 173.
    // If the head is ever re-measured, both have to move together.
    expect(ADULT_EYE_Y).toBe(HEAD_CENTER_Y);
  });
});
