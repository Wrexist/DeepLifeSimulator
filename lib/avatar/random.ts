/**
 * Generating faces — randomly for the player, deterministically for everyone else.
 *
 * Every NPC in the game (family, dates, contacts, rivals) needs a face without
 * anyone choosing one, so `avatarFromSeed` derives a stable config from a
 * string. Same seed always yields the same face, which is what lets a face be
 * recomputed on demand instead of stored on every NPC in the save.
 */
import { CATALOG_SIZES, FACIAL_HAIR, HAIR_STYLES } from './features';
import { EYE_COLORS, HAIR_COLORS, SKIN_TONES } from './palette';
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
function makeRng(seedNum: number): () => number {
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

/**
 * Natural hair colours are the first 13 entries; the dyed ones after that
 * should be rare for NPCs but freely available to the player in the picker.
 */
const NATURAL_HAIR_COUNT = 13;

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
    faceShape: pick(CATALOG_SIZES.faceShape),
    hairStyle: pick(CATALOG_SIZES.hairStyle),
    hairColor,
    browShape: pick(CATALOG_SIZES.browShape),
    eyeShape: pick(CATALOG_SIZES.eyeShape),
    eyeColor: pick(EYE_COLORS.length),
    noseShape: pick(CATALOG_SIZES.noseShape),
    mouthShape: pick(CATALOG_SIZES.mouthShape),
    // Facial hair only on masculine faces, and only about half the time.
    facialHair: sex === 'male' && rng() < 0.5 ? 1 + pick(FACIAL_HAIR.length - 1) : 0,
    // Glasses on about one face in five, matching roughly how common they are.
    accessory: rng() < 0.2 ? 1 + pick(CATALOG_SIZES.accessory - 1) : 0,
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
    skinTone: idx(c.skinTone, SKIN_TONES.length),
    faceShape: idx(c.faceShape, CATALOG_SIZES.faceShape),
    hairStyle: idx(c.hairStyle, CATALOG_SIZES.hairStyle),
    hairColor: idx(c.hairColor, HAIR_COLORS.length),
    browShape: idx(c.browShape, CATALOG_SIZES.browShape),
    eyeShape: idx(c.eyeShape, CATALOG_SIZES.eyeShape),
    eyeColor: idx(c.eyeColor, EYE_COLORS.length),
    noseShape: idx(c.noseShape, CATALOG_SIZES.noseShape),
    mouthShape: idx(c.mouthShape, CATALOG_SIZES.mouthShape),
    facialHair: idx(c.facialHair, FACIAL_HAIR.length),
    accessory: idx(c.accessory, CATALOG_SIZES.accessory),
  };
}

/** The catalog a picker field maps to, for building the customization UI. */
export const PICKER_LENGTHS: Record<keyof AvatarConfig, number> = {
  skinTone: SKIN_TONES.length,
  faceShape: CATALOG_SIZES.faceShape,
  hairStyle: CATALOG_SIZES.hairStyle,
  hairColor: HAIR_COLORS.length,
  browShape: CATALOG_SIZES.browShape,
  eyeShape: CATALOG_SIZES.eyeShape,
  eyeColor: EYE_COLORS.length,
  noseShape: CATALOG_SIZES.noseShape,
  mouthShape: CATALOG_SIZES.mouthShape,
  facialHair: FACIAL_HAIR.length,
  accessory: CATALOG_SIZES.accessory,
};

/** Steps a field by `delta`, wrapping at both ends. Used by the arrow pickers. */
export function cycleField(config: AvatarConfig, field: keyof AvatarConfig, delta: number): AvatarConfig {
  const len = PICKER_LENGTHS[field];
  const next = (((config[field] + delta) % len) + len) % len;
  return { ...config, [field]: next };
}

export { HAIR_STYLES, NATURAL_HAIR_COUNT };
