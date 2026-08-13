/**
 * A child's face, derived from its parents'.
 *
 * The save has tracked 13 genetic traits on children since v13 and on
 * grandchildren since v34, but none of it was ever visible — every child got
 * an unrelated face from the portrait pool. Because the avatar is now
 * parameters, inheritance is arithmetic, and a player can actually see their
 * own jaw on their kid.
 *
 * Deterministic in the child's id, so a child looks the same on every load and
 * nothing has to be stored per child.
 */
import { NATURAL_HAIR_COUNT, SKIN_TONES } from './palette';
import { avatarFromSeed, hashSeed, makeRng, normalizeAvatar } from './random';
import { CATALOG_SIZES, FACIAL_HAIR } from './style';
import type { AvatarConfig, AvatarSex } from './types';

/**
 * Blends two parent faces into a child's.
 *
 * Continuous traits (skin, and to a lesser extent hair and eye colour) blend
 * toward the midpoint; discrete traits (face shape, nose, mouth, brows, eyes)
 * are inherited whole from one parent or the other, because averaging two
 * index positions in a catalog is meaningless — halfway between "square" and
 * "heart" is not a face, it is whichever shape happens to sit between them.
 */
export function inheritAvatar(
  motherConfig: AvatarConfig | undefined,
  fatherConfig: AvatarConfig | undefined,
  childSeed: string,
  childSex: AvatarSex
): AvatarConfig {
  // With no parent on record there is nothing to inherit from; a seeded face
  // is the honest answer and still stable for that child.
  if (!motherConfig && !fatherConfig) {
    const seededOnly = avatarFromSeed(childSeed, childSex);
    // `avatarFromSeed` rolls a dyed colour on ~8% of faces, which is right for
    // an adult picking a look and wrong for a five-year-old. Folding it back
    // into the naturals keeps the face deterministic in the same seed.
    if (seededOnly.hairColor >= NATURAL_HAIR_COUNT) {
      seededOnly.hairColor %= NATURAL_HAIR_COUNT;
    }
    return seededOnly;
  }

  const mother = motherConfig ?? fatherConfig!;
  const father = fatherConfig ?? motherConfig!;

  const rng = makeRng(hashSeed(childSeed));

  /** Picks one parent's value outright. */
  const either = (a: number, b: number) => (rng() < 0.5 ? a : b);

  /**
   * Blends toward the midpoint with a little drift, then clamps. Used for the
   * ramps where neighbouring indices really are neighbouring colours.
   */
  const blend = (a: number, b: number, len: number, drift: number) => {
    const mid = (a + b) / 2;
    const jitter = (rng() * 2 - 1) * drift;
    return Math.min(len - 1, Math.max(0, Math.round(mid + jitter)));
  };

  // Darker hair and eyes are dominant, so pull the blend toward the darker
  // parent (lower indices are darker in both ramps) rather than sitting on the
  // midpoint. Two dark-haired parents rarely produce a blond child.
  const dominantDark = (a: number, b: number, len: number) => {
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    // 70% of the time land at or near the darker parent.
    const t = rng() < 0.7 ? rng() * 0.35 : 0.5 + rng() * 0.5;
    return Math.min(len - 1, Math.max(0, Math.round(lo + (hi - lo) * t)));
  };

  const seeded = avatarFromSeed(childSeed, childSex);

  const child: AvatarConfig = {
    skinTone: blend(mother.skinTone, father.skinTone, SKIN_TONES.length, 1),
    // Hair STYLE is a haircut, not a trait — a child does not inherit their
    // parent's bob. Colour is the heritable half.
    hairStyle: seeded.hairStyle,
    hairColor: inheritHairColor(mother.hairColor, father.hairColor, seeded.hairColor, rng, dominantDark),
    browShape: either(mother.browShape, father.browShape),
    eyeShape: either(mother.eyeShape, father.eyeShape),
    mouthShape: either(mother.mouthShape, father.mouthShape),
    // Facial hair is a grooming choice, not a trait — never inherited. It is
    // also suppressed on feminine faces and on children by the renderer.
    facialHair: childSex === 'male' && rng() < 0.4 ? 1 + Math.floor(rng() * (FACIAL_HAIR.length - 1)) : 0,
    // Clothing is not heritable either; it belongs to the character's own life.
    clothing: seeded.clothing,
    clothingColor: seeded.clothingColor,
    // Glasses likewise are not inherited, but short-sightedness is heritable
    // enough that a child of two glasses-wearers wearing them reads as right.
    accessory: inheritAccessory(mother.accessory, father.accessory, rng),
    headwear: seeded.headwear,
  };

  return normalizeAvatar(child);
}

/**
 * Hair colour, kept inside the NATURAL half of the palette.
 *
 * Dye is not heritable — it is a grooming choice, like the facial hair and the
 * clothing this file already refuses to pass down. But the bug this actually
 * closes is worse than a dyed baby.
 *
 * `HAIR_COLORS` runs naturals 0-8, then GREY (9) and WHITE (10), then four
 * dyed colours. Blending an index toward the midpoint is only meaningful while
 * both ends are on the same ramp, and this one crossed it: a brown-haired
 * parent (3) and a green-haired parent (13) blended to a "dominant dark"
 * midpoint land on 9 or 10 — grey or white hair on a NEWBORN. That is the same
 * image this repo has already shipped twice from two different causes
 * (`tasks/lessons.md`), arriving here through a third door.
 *
 * So: read only the parents' natural colours, and blend only between those.
 */
function inheritHairColor(
  motherHair: number,
  fatherHair: number,
  seededHair: number,
  rng: () => number,
  dominantDark: (a: number, b: number, len: number) => number
): number {
  const natural = [motherHair, fatherHair].filter((index) => index < NATURAL_HAIR_COUNT);

  // Both ends on the ramp — the blend means what it says.
  if (natural.length === 2) return dominantDark(natural[0], natural[1], NATURAL_HAIR_COUNT);

  // One dyed parent carries no heritable colour, so the other parent's is the
  // whole of the evidence. Taking it outright beats inventing a midpoint.
  if (natural.length === 1) return natural[0];

  // Both dyed: nothing to read at all. Fall back to the child's own seed so
  // the face stays deterministic, folded into the naturals.
  return seededHair < NATURAL_HAIR_COUNT
    ? seededHair
    : Math.floor(rng() * NATURAL_HAIR_COUNT) % NATURAL_HAIR_COUNT;
}

function inheritAccessory(a: number, b: number, rng: () => number): number {
  const both = a > 0 && b > 0;
  const one = a > 0 || b > 0;
  const chance = both ? 0.55 : one ? 0.3 : 0.12;
  if (rng() >= chance) return 0;
  return 1 + Math.floor(rng() * (CATALOG_SIZES.accessory - 1));
}
