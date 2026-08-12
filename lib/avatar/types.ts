/**
 * The parameters a face is built from.
 *
 * Every field is a non-negative index into a catalog in `./features` or a ramp
 * in `./palette`. Keeping the whole config numeric buys three things that a
 * richer shape would not:
 *
 *   - it encodes to a very short string for the save (`./encode`)
 *   - inheritance is arithmetic on the parents' values (`./inherit`)
 *   - an out-of-range value from an older save is clamped, never a crash
 *
 * Nothing here is age-dependent. Ageing is applied on top at render time
 * (`./aging`) so the player's choices survive every birthday underneath.
 */
export interface AvatarConfig {
  skinTone: number;
  faceShape: number;
  hairStyle: number;
  hairColor: number;
  browShape: number;
  eyeShape: number;
  eyeColor: number;
  noseShape: number;
  mouthShape: number;
  /** 0 = clean-shaven. Only rendered for masculine faces. */
  facialHair: number;
  /** 0 = none. Glasses and similar. */
  accessory: number;
}

/** The sex a face is drawn for. Drives jaw width, brow weight and facial hair. */
export type AvatarSex = 'male' | 'female';

/**
 * What ageing does to a face, derived from age rather than stored.
 * See `./aging` for how each is applied.
 */
export interface AvatarAgeEffects {
  /** 0 = the chosen hair colour, 1 = fully white. */
  greying: number;
  /** 0 = the chosen hairline, 1 = fully receded. Masculine faces only. */
  recession: number;
  /** 0 = smooth, 1 = the deepest authored wrinkle set. */
  wrinkles: number;
  /** Scales the whole head against the shoulders — children read young. */
  headScale: number;
  /** 0 = adult proportions, 1 = infant proportions (high forehead, low eyes). */
  babyness: number;
}

/** A three-stop shading ramp. Every surface colour in the avatar is one of these. */
export interface Ramp {
  /** The lit mid-tone — the colour a viewer would name. */
  base: string;
  /** Core shadow, used on the terminator and in contact shadows. */
  shadow: string;
  /** Direct highlight, used toward the upper-left light. */
  light: string;
}
