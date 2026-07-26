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
