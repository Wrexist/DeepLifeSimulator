/**
 * Player avatar — layered, customizable, ages by swapping layers.
 *
 * The player's face is a DiceBear "adventurer" avatar described by a tiny
 * config (skin tone, hair style, hair color, glasses) that the player builds
 * in character creation. Because the avatar is parameters — not a pre-rendered
 * portrait — aging is a pure layer swap: hair greys at 50, goes white with
 * reading glasses at 65, while every choice the player made persists.
 *
 * The config is serialized into the existing `userProfile.avatarId` string
 * slot with a `dl1:` prefix, so legacy saves holding a face-pool id
 * (`m3`, `f7`, …) keep rendering through utils/facePool untouched.
 */
import { createAvatar } from '@dicebear/core';
import { adventurer } from '@dicebear/collection';

export interface PlayerAvatarConfig {
  /** Schema version. */
  v: 1;
  /** Resolved sex — drives name generation and gameplay sex for "Random". */
  sex: 'male' | 'female';
  /** Skin tone, hex without '#'. */
  skin: string;
  /** Adventurer hair variant id (e.g. 'short07', 'long12'). */
  hair: string;
  /** Hair color, hex without '#'. */
  hairColor: string;
  /** Player-chosen glasses (age 65+ adds them regardless). */
  glasses?: boolean;
}

const PREFIX = 'dl1:';

// ── Palettes (curated subsets of the adventurer defaults) ────────────────────

export const AVATAR_SKIN_TONES: string[] = [
  'ffdfc4', 'f2d3b1', 'ecad80', 'c26450', '9e5622', '763900',
];

export const AVATAR_HAIR_COLORS: string[] = [
  '0e0e0e', '562306', '6a4e35', 'ac6511', 'cb6820', 'ab2a18', 'e5d7a3', 'afafaf',
  'dba3be', '85c2c6',
];

/**
 * All hair variants the adventurer style ships (spelled out — stable for the
 * locked @dicebear version, and keeps this module's logic independent of the
 * style's runtime schema).
 */
export const AVATAR_LONG_HAIRS: string[] = [
  'long01', 'long02', 'long03', 'long04', 'long05', 'long06', 'long07', 'long08', 'long09',
  'long10', 'long11', 'long12', 'long13', 'long14', 'long15', 'long16', 'long17', 'long18',
  'long19', 'long20', 'long21', 'long22', 'long23', 'long24', 'long25', 'long26',
];
export const AVATAR_SHORT_HAIRS: string[] = [
  'short01', 'short02', 'short03', 'short04', 'short05', 'short06', 'short07', 'short08',
  'short09', 'short10', 'short11', 'short12', 'short13', 'short14', 'short15', 'short16',
  'short17', 'short18', 'short19',
];
/** The full pickable list — long first, then short (mirrors the sex defaults). */
export const AVATAR_HAIRS: string[] = [...AVATAR_LONG_HAIRS, ...AVATAR_SHORT_HAIRS];

// ── Config (de)serialization ─────────────────────────────────────────────────

/** Serialize a config into the avatarId string slot. */
export function encodePlayerAvatarConfig(cfg: PlayerAvatarConfig): string {
  return PREFIX + JSON.stringify(cfg);
}

/** Parse an avatarId; null for legacy face-pool ids / garbage (callers fall back). */
export function decodePlayerAvatarConfig(avatarId: string | undefined | null): PlayerAvatarConfig | null {
  if (!avatarId || !avatarId.startsWith(PREFIX)) return null;
  try {
    const raw = JSON.parse(avatarId.slice(PREFIX.length));
    if (
      raw &&
      raw.v === 1 &&
      (raw.sex === 'male' || raw.sex === 'female') &&
      typeof raw.skin === 'string' &&
      typeof raw.hair === 'string' &&
      typeof raw.hairColor === 'string'
    ) {
      return {
        v: 1,
        sex: raw.sex,
        skin: raw.skin,
        hair: raw.hair,
        hairColor: raw.hairColor,
        glasses: raw.glasses === true,
      };
    }
  } catch {
    // Fall through — treat as legacy id.
  }
  return null;
}

/** The sex carried in a layered-avatar id (undefined for legacy ids). */
export function playerAvatarSexFromId(avatarId: string | undefined | null): 'male' | 'female' | undefined {
  return decodePlayerAvatarConfig(avatarId)?.sex;
}

// ── Random generation ────────────────────────────────────────────────────────

const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

/** A fresh random config. 'random' resolves sex with a fair flip. */
export function randomPlayerAvatarConfig(sex: 'male' | 'female' | 'random'): PlayerAvatarConfig {
  const resolvedSex = sex === 'random' ? (Math.random() < 0.5 ? 'female' : 'male') : sex;
  // Defaults follow the sex (long vs short silhouettes) but the player can
  // step through every style in the builder afterwards.
  const hairs = resolvedSex === 'female' ? AVATAR_LONG_HAIRS : AVATAR_SHORT_HAIRS;
  return {
    v: 1,
    sex: resolvedSex,
    skin: pick(AVATAR_SKIN_TONES),
    hair: pick(hairs.length ? hairs : AVATAR_HAIRS),
    hairColor: pick(AVATAR_HAIR_COLORS.slice(0, 7)), // natural colors for random
    glasses: false,
  };
}

// ── Aging + rendering ────────────────────────────────────────────────────────

/** FNV-1a — stable per-config pick for the glasses variant. */
function stableHash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const GLASSES_VARIANTS = ['variant01', 'variant02', 'variant03', 'variant04', 'variant05'];

/**
 * DiceBear options for a config at a given age — the aging layer swap:
 *  - < 18: a touch of blush (younger read)
 *  - 50+:  hair greys
 *  - 65+:  hair goes white and reading glasses appear
 * The player's own choices (skin, style, chosen glasses) persist throughout.
 */
export function playerAvatarOptions(cfg: PlayerAvatarConfig, age: number): Record<string, unknown> {
  let hairColor = cfg.hairColor;
  let glasses = cfg.glasses === true;
  if (Number.isFinite(age)) {
    if (age >= 65) {
      hairColor = 'e8e6e1';
      glasses = true;
    } else if (age >= 50) {
      hairColor = 'afafaf';
    }
  }
  const youthful = Number.isFinite(age) && age < 18;
  return {
    seed: `${cfg.skin}-${cfg.hair}`,
    skinColor: [cfg.skin],
    hair: [cfg.hair],
    hairColor: [hairColor],
    glasses: [GLASSES_VARIANTS[stableHash(cfg.skin + cfg.hair + cfg.hairColor) % GLASSES_VARIANTS.length]],
    glassesProbability: glasses ? 100 : 0,
    features: youthful ? ['blush'] : [],
    featuresProbability: youthful ? 100 : 0,
    earringsProbability: 0,
  };
}

/** Render a config at an age to an SVG string (deterministic). */
export function buildPlayerAvatarSvg(cfg: PlayerAvatarConfig, age: number, size = 96): string {
  return createAvatar(adventurer, { ...playerAvatarOptions(cfg, age), size } as any).toString();
}
