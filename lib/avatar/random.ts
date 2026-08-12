/**
 * Generating faces — randomly for the player, deterministically for everyone else.
 *
 * Every NPC in the game (family, dates, contacts, rivals) needs a face without
 * anyone choosing one, so `avatarFromSeed` derives a stable config from a
 * string. Same seed always yields the same face, which is what lets a face be
 * recomputed on demand instead of stored on every NPC in the save.
 */
import { CATALOG_SIZES, FACIAL_HAIR, HAIR_STYLES } from './style';
import { CLOTHING_COLORS, HAIR_COLORS, NATURAL_HAIR_COUNT, SKIN_TONES } from './palette';
import type { AvatarConfig, AvatarSex } from './types';

/** FNV-1a. Stable across platforms and JS engines, unlike anything using `Math.random`. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    // >>> 0 keeps this in unsigned 32-bit space; the multiply is the FNV prime.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

/** A small deterministic PRNG seeded from a hash. */
export function makeRng(seedNum: number): () => number {
  let s = seedNum || 1;
  return () => {
    // xorshift32
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0x100000000;
  };
}

function buildConfig(rng: () => number, sex: AvatarSex): AvatarConfig {
  const pick = (n: number) => Math.floor(rng() * n) % Math.max(1, n);

  // Dyed hair on roughly one face in twelve keeps it a statement rather than
  // noise — a crowd where a third of people have blue hair reads as random
  // output, which is the impression this whole system exists to avoid.
  const hairColor =
    rng() < 0.08
      ? NATURAL_HAIR_COUNT + pick(HAIR_COLORS.length - NATURAL_HAIR_COUNT)
      : pick(NATURAL_HAIR_COUNT);

  return {
    skinTone: pick(SKIN_TONES.length),
    // Index 0 is bald; only reach it deliberately, or a twelfth of every crowd
    // is bald regardless of age.
    hairStyle: 1 + pick(HAIR_STYLES.length - 1),
    hairColor,
    facialHair: sex === 'male' && rng() < 0.45 ? 1 + pick(FACIAL_HAIR.length - 1) : 0,
    eyeShape: pick(CATALOG_SIZES.eyeShape),
    browShape: pick(CATALOG_SIZES.browShape),
    // A flat roll is safe here only because the catalog itself is curated down
    // to neutral-and-up; an earlier version needed weighting to stop half of
    // every crowd looking miserable. See MOUTH_SHAPES.
    mouthShape: pick(CATALOG_SIZES.mouthShape),
    clothing: pick(CATALOG_SIZES.clothing),
    clothingColor: pick(CLOTHING_COLORS.length),
    // Glasses on about one face in five, matching roughly how common they are.
    accessory: rng() < 0.2 ? 1 + pick(CATALOG_SIZES.accessory - 1) : 0,
    // Headwear is rare — it is a statement, and it hides the hair underneath.
    headwear: rng() < 0.06 ? 1 + pick(CATALOG_SIZES.headwear - 1) : 0,
  };
}

/** A stable face for a seed — the same NPC always looks the same. */
export function avatarFromSeed(seed: string, sex: AvatarSex): AvatarConfig {
  return buildConfig(makeRng(hashSeed(seed || 'anon')), sex);
}

/** A fresh random face. Used by the Randomize button. */
export function randomAvatar(sex: AvatarSex): AvatarConfig {
  return buildConfig(() => Math.random(), sex);
}

/** The catalog each field indexes into, for building the customization UI. */
export const PICKER_LENGTHS: Record<keyof AvatarConfig, number> = {
  skinTone: CATALOG_SIZES.skinTone,
  hairStyle: CATALOG_SIZES.hairStyle,
  hairColor: CATALOG_SIZES.hairColor,
  facialHair: CATALOG_SIZES.facialHair,
  eyeShape: CATALOG_SIZES.eyeShape,
  browShape: CATALOG_SIZES.browShape,
  mouthShape: CATALOG_SIZES.mouthShape,
  clothing: CATALOG_SIZES.clothing,
  clothingColor: CATALOG_SIZES.clothingColor,
  accessory: CATALOG_SIZES.accessory,
  headwear: CATALOG_SIZES.headwear,
};

/**
 * Clamps every field into its catalog. A save written when a catalog was
 * longer, or hand-edited, must render a face rather than throw inside a
 * screen — so this never rejects, it only corrects.
 */
export function normalizeAvatar(config: Partial<AvatarConfig> | null | undefined): AvatarConfig {
  const c = config ?? {};
  const idx = (value: unknown, len: number): number => {
    const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
    if (n < 0) return 0;
    return n >= len ? len - 1 : n;
  };
  return {
    skinTone: idx(c.skinTone, PICKER_LENGTHS.skinTone),
    hairStyle: idx(c.hairStyle, PICKER_LENGTHS.hairStyle),
    hairColor: idx(c.hairColor, PICKER_LENGTHS.hairColor),
    facialHair: idx(c.facialHair, PICKER_LENGTHS.facialHair),
    eyeShape: idx(c.eyeShape, PICKER_LENGTHS.eyeShape),
    browShape: idx(c.browShape, PICKER_LENGTHS.browShape),
    mouthShape: idx(c.mouthShape, PICKER_LENGTHS.mouthShape),
    clothing: idx(c.clothing, PICKER_LENGTHS.clothing),
    clothingColor: idx(c.clothingColor, PICKER_LENGTHS.clothingColor),
    accessory: idx(c.accessory, PICKER_LENGTHS.accessory),
    headwear: idx(c.headwear, PICKER_LENGTHS.headwear),
  };
}

/** Steps a field by `delta`, wrapping at both ends. */
export function cycleField(
  config: AvatarConfig,
  field: keyof AvatarConfig,
  delta: number
): AvatarConfig {
  const len = PICKER_LENGTHS[field];
  const next = (((config[field] + delta) % len) + len) % len;
  return { ...config, [field]: next };
}
