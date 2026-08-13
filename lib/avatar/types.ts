/**
 * The parameters a face is built from.
 *
 * Every field is a non-negative index into a catalog in `./style` or a palette
 * in `./palette`. Keeping the whole config numeric buys three things:
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
  /** Index into HAIR_STYLES. 0 is bald. */
  hairStyle: number;
  hairColor: number;
  /** 0 = none. Only rendered on masculine faces. */
  facialHair: number;
  eyeShape: number;
  browShape: number;
  mouthShape: number;
  clothing: number;
  clothingColor: number;
  /** Glasses. 0 = none. */
  accessory: number;
  /** Hats, hijab, turban. 0 = none. */
  headwear: number;
}

/** The sex a face is drawn for. Gates facial hair and biases generation. */
export type AvatarSex = 'male' | 'female';

/**
 * What ageing does to a face, derived from age rather than stored.
 * See `./aging` for how each is applied.
 */
export interface AvatarAgeEffects {
  /** 0 = the chosen hair colour, 1 = fully white. */
  greying: number;
  /** Probability (0-100) that the hair layer renders at all. */
  hairProbability: number;
  /** Probability (0-100) that glasses render when none were chosen. */
  glassesProbability: number;
  /** True below the age facial hair should appear. */
  suppressFacialHair: boolean;
}
