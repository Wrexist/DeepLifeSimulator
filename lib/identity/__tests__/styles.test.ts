/**
 * The style catalogues, and the guarantee that a saved style stays valid.
 *
 * `hairStyle` and `facialHair` are stored in the genome, so the lists are part
 * of the save contract: values may be ADDED, but removing or renaming one turns
 * every save carrying it into a normalization fallback and silently changes a
 * player's character.
 */

import { HAIR_STYLES, FACIAL_HAIR_STYLES, normalizeGenome, randomizeFace } from '@/lib/identity';

/** Present before the scanned head shipped. None may ever disappear. */
const ORIGINAL_HAIR = ['bald', 'buzz', 'short', 'medium', 'long', 'ponytail', 'afro', 'bun'];

describe('style catalogues', () => {
  it('keeps every hair style that already existed in saves', () => {
    for (const style of ORIGINAL_HAIR) expect(HAIR_STYLES).toContain(style);
  });

  it('offers the added styles', () => {
    for (const style of ['crew', 'fringe', 'curls', 'mohawk', 'undercut', 'quiff', 'receding']) {
      expect(HAIR_STYLES).toContain(style);
    }
  });

  it('has no duplicates', () => {
    expect(new Set(HAIR_STYLES).size).toBe(HAIR_STYLES.length);
    expect(new Set(FACIAL_HAIR_STYLES).size).toBe(FACIAL_HAIR_STYLES.length);
  });

  it('round-trips every style through normalization', () => {
    // A style the normalizer rejects would be silently swapped for a default,
    // which is a character changing under the player between sessions.
    for (const hairStyle of HAIR_STYLES) {
      for (const facialHair of FACIAL_HAIR_STYLES) {
        const genome = { ...randomizeFace('styles'), hairStyle, facialHair };
        const out = normalizeGenome(genome, 'styles');
        expect(out.hairStyle).toBe(hairStyle);
        expect(out.facialHair).toBe(facialHair);
      }
    }
  });
});

describe('the randomiser reaches its own content', () => {
  it('can roll every hair style that is not deliberately excluded', () => {
    // `randomizeFace` picks from pools that name styles LITERALLY, so a style
    // added to HAIR_STYLES and not added to a pool can never be rolled — it
    // ships, and no NPC or first-roll character ever wears it. Twenty of the
    // thirty-five were in exactly that position.
    const rolled = new Set<string>();
    for (const sex of ['male', 'female']) {
      for (let i = 0; i < 400; i++) {
        rolled.add(randomizeFace(`reach-${sex}-${i}`, { sex }).hairStyle);
      }
    }
    // `bald` is male-only and `receding` is an aging outcome; everything else
    // should be reachable by somebody.
    const unreachable = HAIR_STYLES.filter((s) => !rolled.has(s));
    expect(unreachable).toEqual([]);
  });

  it('never gives a newborn grey or white hair', () => {
    // Indexes 9 and 10 are the AGE colours — `applyAging` moves a character
    // onto them from 40 — and 11-13 are dyes, which are a choice. A birth roll
    // that included them handed one character in six white hair at twenty.
    for (let i = 0; i < 400; i++) {
      expect(randomizeFace(`birth-${i}`).hairColor).toBeLessThan(9);
    }
  });

  it('biases the face by sex without partitioning it', () => {
    // A tendency, not two fixed faces: the MEANS must separate while the ranges
    // still overlap. If every male jaw were wider than every female one this
    // would be a partition, which is the thing the design explicitly avoids.
    const jawOf = (sex: string, i: number) => randomizeFace(`dim-${i}`, { sex, spread: 0.6 }).morphs.jawWidth;
    const males = Array.from({ length: 200 }, (_, i) => jawOf('male', i));
    const females = Array.from({ length: 200 }, (_, i) => jawOf('female', i));
    const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
    expect(mean(males)).toBeGreaterThan(mean(females) + 0.15);
    expect(Math.max(...females)).toBeGreaterThan(Math.min(...males));
  });

  it('keeps every biased morph in range', () => {
    for (const sex of ['male', 'female']) {
      for (let i = 0; i < 200; i++) {
        const g = randomizeFace(`range-${sex}-${i}`, { sex, spread: 1 });
        for (const v of Object.values(g.morphs)) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
