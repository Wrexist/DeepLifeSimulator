/**
 * Every colour in every palette has a name.
 *
 * A swatch is a button with no text in it. Without a name a screen reader
 * announces twenty-four identical "button, selected" controls, which does not
 * make choosing a skin tone awkward — it makes it impossible. The names live
 * beside the palettes so they cannot drift, and this fails the moment a colour
 * is added without one.
 */

import {
  SKIN_TONES, SKIN_TONE_NAMES,
  HAIR_COLORS, HAIR_COLOR_NAMES,
  EYE_COLORS, EYE_COLOR_NAMES,
  swatchName,
} from '@/lib/identity';

const PALETTES = [
  { what: 'skin tones', colors: SKIN_TONES, names: SKIN_TONE_NAMES },
  { what: 'hair colours', colors: HAIR_COLORS, names: HAIR_COLOR_NAMES },
  { what: 'eye colours', colors: EYE_COLORS, names: EYE_COLOR_NAMES },
];

describe.each(PALETTES)('$what', ({ colors, names }) => {
  it('names every swatch', () => {
    expect(names).toHaveLength(colors.length);
    for (const name of names) expect(name.trim().length).toBeGreaterThan(0);
  });

  it('uses each name once, so two swatches never read the same', () => {
    expect(new Set(names).size).toBe(names.length);
  });

  it('is a valid hex palette', () => {
    for (const c of colors) expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
  });
});

describe('swatchName', () => {
  it('returns the name at an index', () => {
    expect(swatchName(SKIN_TONE_NAMES, 0)).toBe(SKIN_TONE_NAMES[0]);
  });

  it('never goes silent for an index past the names', () => {
    // The degradation matters more than the wording: an unlabelled swatch is
    // exactly the failure this whole file exists to prevent.
    expect(swatchName(SKIN_TONE_NAMES, 999)).toBe('Colour 1000');
  });
});
