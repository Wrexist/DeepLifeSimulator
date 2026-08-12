/**
 * The colour choices offered in the creator.
 *
 * Plain hex, not shading ramps. An earlier pass authored every colour as a
 * base/shadow/light triple because the renderer had to shade its own geometry;
 * the art now carries its own shading, so a single colour per entry is all
 * that is needed and all that should exist.
 *
 * ORDER IS PART OF THE SAVE FORMAT — `AvatarConfig` stores indices into these.
 * Appending is safe; reordering repaints every character already using them.
 */

/**
 * 10 skin tones, light → deep. The pool this replaces had almost no range,
 * which was one of the loudest complaints about it, so the span here is
 * deliberate and pinned by a test.
 */
export const SKIN_TONES: string[] = [
  '#FFDBB4',
  '#F8D9C0',
  '#EDB98A',
  '#E0A272',
  '#D08B5B',
  '#C07A4A',
  '#AE5D29',
  '#8D5524',
  '#71401B',
  '#4A2B15',
];

/** 16 hair colours: naturals first (0-11), then dyed. */
export const HAIR_COLORS: string[] = [
  '#2C1B18',
  '#4A312C',
  '#724133',
  '#8D5524',
  '#A55728',
  '#B58143',
  '#C93305',
  '#D6B370',
  '#E6CEA8',
  '#ECDCBF',
  '#B7B7B7',
  '#E8E1E1',
  '#E56AA6',
  '#4A7FD4',
  '#3E9C6E',
  '#7A4FBF',
];

/**
 * How many entries random generation may pick from.
 *
 * This stops at 10, BEFORE grey (#B7B7B7) and white (#E8E1E1). Those two are
 * offered to the player — someone may want a silver-haired character — but a
 * generator that can reach them hands grey hair to six-year-olds, which is
 * exactly what the first render of this system did. Greying is age's job, and
 * `greyedHairHex` gets there from any starting colour.
 */
export const NATURAL_HAIR_COUNT = 10;

/** 12 clothing colours. Also used for headwear. */
export const CLOTHING_COLORS: string[] = [
  '#262E33',
  '#3C4F5C',
  '#65C9FF',
  '#5199E4',
  '#25557C',
  '#929598',
  '#A7FFC4',
  '#249B6B',
  '#B1E2FF',
  '#FF5C5C',
  '#FFAFB9',
  '#FFDEB5',
];
