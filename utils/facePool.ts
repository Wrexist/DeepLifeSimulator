/**
 * Face pool — seeded, age-correlated portrait assignment.
 *
 * The game ships 5 base faces (assets/images/Face/*.png) plus an expanded pool
 * of rendered 3D/Pixar faces (assets/images/Face/pool/*.png), grouped by sex +
 * age band. `getPortrait(seed, age, sex)` picks a STABLE, unique face for a
 * person from the matching bucket:
 *   - same person (seed) + same age  → always the same face
 *   - as a person AGES, the band changes, so the face follows their age
 *   - a stable seed keeps a consistent *slot* across bands, so aging is smooth
 * Empty buckets fall back to the original 5, so nothing ever renders blank.
 *
 * Mom & Dad get their own portraits while middle-aged, then age into the senior
 * pool — see getParentPortrait. The other hero faces are folded into the pools
 * as extra variety. Metro requires static literal paths, so assets are listed.
 */
import type { ImageSourcePropType } from 'react-native';
import { playerAvatarSexFromId } from '@/utils/playerAvatar';

// The original 5 — guaranteed fallbacks.
const BASE = {
  baby: require('@/assets/images/Face/Baby.png') as ImageSourcePropType,
  male: require('@/assets/images/Face/Male.png') as ImageSourcePropType,
  female: require('@/assets/images/Face/Female.png') as ImageSourcePropType,
  oldMale: require('@/assets/images/Face/Old_Male.png') as ImageSourcePropType,
  oldFemale: require('@/assets/images/Face/Old_Female.png') as ImageSourcePropType,
};

// Expanded pool, keyed by `${sex}_${band}` (babies are sex-neutral). The hero
// faces that aren't Mom/Dad are folded in here so every asset is in rotation.
const POOL: Record<string, ImageSourcePropType[]> = {
  f_ya: [
    require('@/assets/images/Face/pool/f_ya_01.png'), require('@/assets/images/Face/pool/f_ya_02.png'),
    require('@/assets/images/Face/pool/f_ya_03.png'), require('@/assets/images/Face/pool/f_ya_04.png'),
    require('@/assets/images/Face/pool/f_ya_05.png'), require('@/assets/images/Face/pool/f_ya_06.png'),
    require('@/assets/images/Face/pool/f_ya_07.png'), require('@/assets/images/Face/pool/f_ya_08.png'),
    require('@/assets/images/Face/pool/f_ya_09.png'), require('@/assets/images/Face/pool/f_ya_10.png'),
    require('@/assets/images/Face/pool/hero_bestfriend_f.png'), require('@/assets/images/Face/pool/hero_sibling_f.png'),
  ],
  m_ya: [
    require('@/assets/images/Face/pool/m_ya_01.png'), require('@/assets/images/Face/pool/m_ya_02.png'),
    require('@/assets/images/Face/pool/m_ya_03.png'), require('@/assets/images/Face/pool/m_ya_04.png'),
    require('@/assets/images/Face/pool/m_ya_05.png'), require('@/assets/images/Face/pool/m_ya_06.png'),
    require('@/assets/images/Face/pool/m_ya_07.png'), require('@/assets/images/Face/pool/m_ya_08.png'),
    require('@/assets/images/Face/pool/m_ya_09.png'), require('@/assets/images/Face/pool/m_ya_10.png'),
    require('@/assets/images/Face/pool/hero_bestfriend_m.png'), require('@/assets/images/Face/pool/hero_sibling_m.png'),
    require('@/assets/images/Face/pool/hero_rival.png'),
  ],
  f_ad: [
    require('@/assets/images/Face/pool/f_ad_01.png'), require('@/assets/images/Face/pool/f_ad_02.png'),
    require('@/assets/images/Face/pool/f_ad_03.png'), require('@/assets/images/Face/pool/f_ad_04.png'),
    require('@/assets/images/Face/pool/f_ad_05.png'), require('@/assets/images/Face/pool/f_ad_06.png'),
  ],
  m_ad: [
    require('@/assets/images/Face/pool/m_ad_01.png'), require('@/assets/images/Face/pool/m_ad_02.png'),
    require('@/assets/images/Face/pool/m_ad_03.png'), require('@/assets/images/Face/pool/m_ad_04.png'),
    require('@/assets/images/Face/pool/m_ad_05.png'), require('@/assets/images/Face/pool/m_ad_06.png'),
  ],
  f_mid: [
    require('@/assets/images/Face/pool/f_mid_01.png'), require('@/assets/images/Face/pool/f_mid_02.png'),
    require('@/assets/images/Face/pool/f_mid_03.png'), require('@/assets/images/Face/pool/f_mid_04.png'),
    require('@/assets/images/Face/pool/f_mid_05.png'),
  ],
  m_mid: [
    require('@/assets/images/Face/pool/m_mid_01.png'), require('@/assets/images/Face/pool/m_mid_02.png'),
    require('@/assets/images/Face/pool/m_mid_03.png'), require('@/assets/images/Face/pool/m_mid_04.png'),
    require('@/assets/images/Face/pool/m_mid_05.png'), require('@/assets/images/Face/pool/hero_boss.png'),
  ],
  f_sr: [
    require('@/assets/images/Face/pool/f_sr_01.png'), require('@/assets/images/Face/pool/f_sr_02.png'),
    require('@/assets/images/Face/pool/f_sr_03.png'), require('@/assets/images/Face/pool/f_sr_04.png'),
    require('@/assets/images/Face/pool/hero_grandparent.png'),
  ],
  m_sr: [
    require('@/assets/images/Face/pool/m_sr_01.png'), require('@/assets/images/Face/pool/m_sr_02.png'),
    require('@/assets/images/Face/pool/m_sr_03.png'), require('@/assets/images/Face/pool/m_sr_04.png'),
    require('@/assets/images/Face/pool/hero_mentor.png'),
  ],
  f_tn: [
    require('@/assets/images/Face/pool/f_tn_01.png'), require('@/assets/images/Face/pool/f_tn_02.png'),
    require('@/assets/images/Face/pool/f_tn_03.png'),
  ],
  m_tn: [
    require('@/assets/images/Face/pool/m_tn_01.png'), require('@/assets/images/Face/pool/m_tn_02.png'),
    require('@/assets/images/Face/pool/m_tn_03.png'),
  ],
  f_kid: [
    require('@/assets/images/Face/pool/f_kid_01.png'), require('@/assets/images/Face/pool/f_kid_02.png'),
    require('@/assets/images/Face/pool/f_kid_03.png'),
  ],
  m_kid: [
    require('@/assets/images/Face/pool/m_kid_01.png'), require('@/assets/images/Face/pool/m_kid_02.png'),
    require('@/assets/images/Face/pool/m_kid_03.png'),
  ],
  baby: [
    require('@/assets/images/Face/pool/baby_01.png'), require('@/assets/images/Face/pool/baby_02.png'),
    require('@/assets/images/Face/pool/baby_03.png'),
  ],
};

// Mom & Dad — used as their own face while middle-aged (see getParentPortrait).
const PARENTS = {
  mom: require('@/assets/images/Face/pool/hero_mom.png') as ImageSourcePropType,
  dad: require('@/assets/images/Face/pool/hero_dad.png') as ImageSourcePropType,
};

type Band = 'baby' | 'kid' | 'tn' | 'ya' | 'ad' | 'mid' | 'sr';

/** FNV-1a 32-bit — a stable, well-spread hash of the seed string. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function bandForAge(age: number): Band {
  // A non-finite age (NaN/undefined coerced) would fall through every `<`
  // comparison to 'sr'; default such callers to young-adult instead.
  if (!Number.isFinite(age)) return 'ya';
  if (age < 5) return 'baby';
  if (age < 13) return 'kid';
  if (age < 18) return 'tn';
  if (age < 30) return 'ya';
  if (age < 40) return 'ad';
  if (age <= 55) return 'mid';
  return 'sr';
}

/** female → 'f', male → 'm', anything else (random/unknown) → stable from seed. */
function normalizeSex(sex: string, seed: string): 'm' | 'f' {
  if (sex === 'female' || sex === 'f') return 'f';
  if (sex === 'male' || sex === 'm') return 'm';
  return hashSeed(seed) & 1 ? 'f' : 'm';
}

/** The original 5-face behavior — used whenever there is no seed or no bucket. */
export function legacyFace(age: number, sex: string): ImageSourcePropType {
  const female = sex === 'female';
  if (age < 13) return BASE.baby;
  if (age >= 40) return female ? BASE.oldFemale : BASE.oldMale;
  return female ? BASE.female : BASE.male;
}

/**
 * Which bucket + index a person maps to (null → use legacyFace). Stable per
 * person within a band; as a person ages into a new band the face follows their
 * age. (Modulo of the FNV hash — it spreads people evenly across the bucket.)
 * Exposed for tests.
 */
export function _portraitSlot(seed: string, age: number, sex: string): { key: string; index: number } | null {
  const band = bandForAge(age);
  const key = band === 'baby' ? 'baby' : `${normalizeSex(sex, seed)}_${band}`;
  const bucket = POOL[key];
  if (!bucket || bucket.length === 0) return null;
  return { key, index: hashSeed(seed) % bucket.length };
}

/**
 * Stable, unique, age-correct face for a person. `seed` is any stable id
 * (profile.id, relationship.id, player name…). As the person's `age` changes the
 * face follows their age band. Falls back to the original 5 with no seed/bucket.
 */
export function getPortrait(seed: string | undefined | null, age: number, sex: string): ImageSourcePropType {
  if (!seed) return legacyFace(age, sex);
  const slot = _portraitSlot(seed, age, sex);
  if (!slot) return legacyFace(age, sex);
  return POOL[slot.key][slot.index];
}

/** Whether a parent shows their fixed Mom/Dad portrait (true) or ages via the pool. */
export function _parentUsesHero(age: number): boolean {
  return bandForAge(age) === 'mid';
}

/**
 * Parent (Mom/Dad) face. Recognizably Mom/Dad while middle-aged; as they age
 * they move into the seeded senior pool, and if they're younger they use the
 * adult pool — so parents age instead of freezing.
 */
export function getParentPortrait(sex: string, seed: string | undefined | null, age = 65): ImageSourcePropType {
  if (_parentUsesHero(age)) {
    return sex === 'female' ? PARENTS.mom : PARENTS.dad;
  }
  return getPortrait(seed, age, sex);
}

/** Mom / Dad portrait (their canonical middle-aged face). */
export function getHeroPortrait(role: 'mom' | 'dad'): ImageSourcePropType {
  return PARENTS[role];
}

/** Bucket sizes — exposed for tests / diagnostics. */
export const POOL_SIZES: Record<string, number> = Object.fromEntries(
  Object.entries(POOL).map(([k, v]) => [k, v.length]),
);

// ── Player avatar picker ─────────────────────────────────────────────────────
// The player chooses their starting face in character creation. We store a
// compact id `<m|f><index>` (sex + index into the young-adult bucket) on the
// user profile, then resolve it age-aware so the chosen character keeps a
// consistent slot as the player ages.

function parseAvatarId(avatarId: string): { letter: 'm' | 'f'; index: number } | null {
  const m = /^([mf])(\d+)$/.exec(avatarId);
  if (!m) return null;
  return { letter: m[1] as 'm' | 'f', index: parseInt(m[2], 10) };
}

/**
 * The starter faces the player picks from — matched to their sex AND the
 * scenario's starting age band (e.g. a scenario that begins at 30 shows adult
 * faces, not young-adult). `age` defaults to adulthood.
 */
export function listStarterAvatars(sex: string, age = 18): { id: string; source: ImageSourcePropType }[] {
  const band = bandForAge(age);
  const build = (letter: 'm' | 'f') => {
    const key = band === 'baby' ? 'baby' : `${letter}_${band}`;
    return (POOL[key] ?? []).map((source, i) => ({ id: `${letter}${i}`, source }));
  };
  if (sex === 'male') return build('m');
  if (sex === 'female') return build('f');
  // random → interleave so the row shows a mix of women and men
  const f = build('f');
  const m = build('m');
  const out: { id: string; source: ImageSourcePropType }[] = [];
  for (let i = 0; i < Math.max(f.length, m.length); i++) {
    if (i < f.length) out.push(f[i]);
    if (i < m.length) out.push(m[i]);
  }
  return out;
}

/** The sex encoded in a chosen avatar id (so appearance and gameplay sex agree). */
export function avatarSexFromId(avatarId: string | undefined | null): 'male' | 'female' | undefined {
  // Layered avatar configs (utils/playerAvatar `dl1:` ids) carry their sex.
  const layered = playerAvatarSexFromId(avatarId);
  if (layered) return layered;
  const p = avatarId ? parseAvatarId(avatarId) : null;
  if (!p) return undefined;
  return p.letter === 'f' ? 'female' : 'male';
}

/**
 * The player's face. If they picked an avatar, keep that pick's sex + slot and
 * follow their age band; otherwise fall back to the seeded portrait by name.
 */
export function getAvatarPortrait(
  avatarId: string | undefined | null,
  age: number,
  fallbackSeed: string | undefined | null,
  fallbackSex: string,
): ImageSourcePropType {
  const p = avatarId ? parseAvatarId(avatarId) : null;
  if (!p) return getPortrait(fallbackSeed, age, fallbackSex);
  const band = bandForAge(age);
  const bucket = POOL[band === 'baby' ? 'baby' : `${p.letter}_${band}`];
  if (!bucket || bucket.length === 0) return legacyFace(age, p.letter === 'f' ? 'female' : 'male');
  return bucket[Math.min(p.index, bucket.length - 1)];
}
