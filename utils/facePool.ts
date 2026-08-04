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

// The original 5 — guaranteed fallbacks.
const BASE = {
  baby: require('@/assets/images/Face/Baby.webp') as ImageSourcePropType,
  male: require('@/assets/images/Face/Male.webp') as ImageSourcePropType,
  female: require('@/assets/images/Face/Female.webp') as ImageSourcePropType,
  oldMale: require('@/assets/images/Face/Old_Male.webp') as ImageSourcePropType,
  oldFemale: require('@/assets/images/Face/Old_Female.webp') as ImageSourcePropType,
};

// Expanded pool, keyed by `${sex}_${band}` (babies are sex-neutral). The hero
// faces that aren't Mom/Dad are folded in here so every asset is in rotation.
const POOL: Record<string, ImageSourcePropType[]> = {
  f_ya: [
    require('@/assets/images/Face/pool/f_ya_01.webp'), require('@/assets/images/Face/pool/f_ya_02.webp'),
    require('@/assets/images/Face/pool/f_ya_03.webp'), require('@/assets/images/Face/pool/f_ya_04.webp'),
    require('@/assets/images/Face/pool/f_ya_05.webp'), require('@/assets/images/Face/pool/f_ya_06.webp'),
    require('@/assets/images/Face/pool/f_ya_07.webp'), require('@/assets/images/Face/pool/f_ya_08.webp'),
    require('@/assets/images/Face/pool/f_ya_09.webp'), require('@/assets/images/Face/pool/f_ya_10.webp'),
    require('@/assets/images/Face/pool/hero_bestfriend_f.webp'), require('@/assets/images/Face/pool/hero_sibling_f.webp'),
  ],
  m_ya: [
    require('@/assets/images/Face/pool/m_ya_01.webp'), require('@/assets/images/Face/pool/m_ya_02.webp'),
    require('@/assets/images/Face/pool/m_ya_03.webp'), require('@/assets/images/Face/pool/m_ya_04.webp'),
    require('@/assets/images/Face/pool/m_ya_05.webp'), require('@/assets/images/Face/pool/m_ya_06.webp'),
    require('@/assets/images/Face/pool/m_ya_07.webp'), require('@/assets/images/Face/pool/m_ya_08.webp'),
    require('@/assets/images/Face/pool/m_ya_09.webp'), require('@/assets/images/Face/pool/m_ya_10.webp'),
    require('@/assets/images/Face/pool/hero_bestfriend_m.webp'), require('@/assets/images/Face/pool/hero_sibling_m.webp'),
    require('@/assets/images/Face/pool/hero_rival.webp'),
  ],
  f_ad: [
    require('@/assets/images/Face/pool/f_ad_01.webp'), require('@/assets/images/Face/pool/f_ad_02.webp'),
    require('@/assets/images/Face/pool/f_ad_03.webp'), require('@/assets/images/Face/pool/f_ad_04.webp'),
    require('@/assets/images/Face/pool/f_ad_05.webp'), require('@/assets/images/Face/pool/f_ad_06.webp'),
  ],
  m_ad: [
    require('@/assets/images/Face/pool/m_ad_01.webp'), require('@/assets/images/Face/pool/m_ad_02.webp'),
    require('@/assets/images/Face/pool/m_ad_03.webp'), require('@/assets/images/Face/pool/m_ad_04.webp'),
    require('@/assets/images/Face/pool/m_ad_05.webp'), require('@/assets/images/Face/pool/m_ad_06.webp'),
  ],
  f_mid: [
    require('@/assets/images/Face/pool/f_mid_01.webp'), require('@/assets/images/Face/pool/f_mid_02.webp'),
    require('@/assets/images/Face/pool/f_mid_03.webp'), require('@/assets/images/Face/pool/f_mid_04.webp'),
    require('@/assets/images/Face/pool/f_mid_05.webp'),
  ],
  m_mid: [
    require('@/assets/images/Face/pool/m_mid_01.webp'), require('@/assets/images/Face/pool/m_mid_02.webp'),
    require('@/assets/images/Face/pool/m_mid_03.webp'), require('@/assets/images/Face/pool/m_mid_04.webp'),
    require('@/assets/images/Face/pool/m_mid_05.webp'), require('@/assets/images/Face/pool/hero_boss.webp'),
  ],
  f_sr: [
    require('@/assets/images/Face/pool/f_sr_01.webp'), require('@/assets/images/Face/pool/f_sr_02.webp'),
    require('@/assets/images/Face/pool/f_sr_03.webp'), require('@/assets/images/Face/pool/f_sr_04.webp'),
  ],
  m_sr: [
    require('@/assets/images/Face/pool/m_sr_01.webp'), require('@/assets/images/Face/pool/m_sr_02.webp'),
    require('@/assets/images/Face/pool/m_sr_03.webp'), require('@/assets/images/Face/pool/m_sr_04.webp'),
    require('@/assets/images/Face/pool/hero_mentor.webp'),
    // `hero_grandparent` is a neutral FILENAME for a portrait of an elderly
    // MAN. It sat in `f_sr` until a player reported "parents age into different
    // genders": Mom's seed hashes straight onto that slot, so every save
    // watched her turn into a grandfather the week she turned 56. It also hit
    // the player directly — `getAvatarPortrait` clamps to the last slot, so a
    // woman who picked one of the later starter faces became him too.
    // The name is the trap; see HERO_FACE_SEX below.
    require('@/assets/images/Face/pool/hero_grandparent.webp'),
  ],
  f_tn: [
    require('@/assets/images/Face/pool/f_tn_01.webp'), require('@/assets/images/Face/pool/f_tn_02.webp'),
    require('@/assets/images/Face/pool/f_tn_03.webp'),
  ],
  m_tn: [
    require('@/assets/images/Face/pool/m_tn_01.webp'), require('@/assets/images/Face/pool/m_tn_02.webp'),
    require('@/assets/images/Face/pool/m_tn_03.webp'),
  ],
  f_kid: [
    require('@/assets/images/Face/pool/f_kid_01.webp'), require('@/assets/images/Face/pool/f_kid_02.webp'),
    require('@/assets/images/Face/pool/f_kid_03.webp'),
  ],
  m_kid: [
    require('@/assets/images/Face/pool/m_kid_01.webp'), require('@/assets/images/Face/pool/m_kid_02.webp'),
    require('@/assets/images/Face/pool/m_kid_03.webp'),
  ],
  baby: [
    require('@/assets/images/Face/pool/baby_01.webp'), require('@/assets/images/Face/pool/baby_02.webp'),
    require('@/assets/images/Face/pool/baby_03.webp'),
  ],
};

/**
 * The sex each hero portrait actually DEPICTS, as opposed to what its filename
 * suggests.
 *
 * Most pool assets encode their bucket in the name (`f_sr_01`, `m_ya_03`), so
 * a file in the wrong bucket is obvious on sight. The hero faces do not: they
 * are named for a ROLE. `hero_rival`, `hero_boss`, `hero_mentor` and
 * `hero_grandparent` say nothing about who is in the picture, and one of them
 * spent its life in the wrong bucket because of it.
 *
 * This table is the answer, written down once after looking at every file, and
 * `__tests__/utils/facePool.test.ts` asserts the POOL buckets agree with it.
 * Moving a hero face now means contradicting a stated claim rather than
 * quietly editing a list of paths.
 */
export const HERO_FACE_SEX: Record<string, 'm' | 'f'> = {
  hero_bestfriend_f: 'f',
  hero_sibling_f: 'f',
  hero_bestfriend_m: 'm',
  hero_sibling_m: 'm',
  hero_rival: 'm',
  hero_boss: 'm',
  hero_mentor: 'm',
  hero_grandparent: 'm', // elderly man — the name is not a gender
};

// Mom & Dad — used as their own face while middle-aged (see getParentPortrait).
const PARENTS = {
  mom: require('@/assets/images/Face/pool/hero_mom.webp') as ImageSourcePropType,
  dad: require('@/assets/images/Face/pool/hero_dad.webp') as ImageSourcePropType,
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
  const p = avatarId ? parseAvatarId(avatarId) : null;
  if (!p) return undefined;
  return p.letter === 'f' ? 'female' : 'male';
}

/**
 * The player's face. If they picked an avatar, keep that pick's sex + slot and
 * follow their age band; otherwise fall back to the seeded portrait by name.
 *
 * ── How the slot maps across bands ────────────────────────────────────────
 *
 * The starter buckets are much bigger than the later ones — 12 young-adult
 * female faces against 6 adult, 5 middle-aged, 4 senior, and only 3 as a teen.
 *
 * This has now been wrong twice, in opposite directions:
 *
 * 1. `Math.min(index, len - 1)` CLAMPED, so every pick from 5 upward landed on
 *    the same last slot from age 30 on — seven of the twelve women who chose a
 *    starter face aged into one identical stranger, and into each other.
 *
 * 2. `index % len` WRAPPED, which spread them out but scrambled the order:
 *    `f7` resolved to slot 1 as a teen, 7 as a young adult, 1 again as an
 *    adult, then 2, then 3. Nine of the twelve starter faces changed slot at
 *    every band boundary with no relationship between one band and the next.
 *    That is the player report — "my character turns into someone else" —
 *    surviving the fix for (1).
 *
 * Now it maps PROPORTIONALLY: a pick sits at the same relative position in
 * every bucket, so ordering is preserved end to end. Someone who picked the
 * third face of twelve stays an early face at every age instead of jumping
 * around, and two players who picked adjacent faces stay adjacent.
 *
 * ── What this deliberately does NOT try to fix ────────────────────────────
 *
 * Two different picks can land on the same face in a small band — 12 picks
 * through a 3-face teen bucket must collide. That is arithmetic, not a defect,
 * and it is worth being clear about why it does not matter:
 *
 *   - This is single-player. Two PLAYERS sharing a face is unobservable.
 *   - NPCs already share the same finite buckets by `hashSeed(seed) % len`
 *     (`_portraitSlot`), so any five seniors in one save collide regardless.
 *     That predates all of this and is inherent to a fixed pool.
 *
 * The property that IS player-visible — one character staying coherent as they
 * age — is what the proportional mapping delivers, and what
 * `__tests__/utils/facePool.test.ts` pins. An earlier version of this comment
 * called the collisions an asset gap needing a product decision; that
 * over-graded them.
 */
export function getAvatarPortrait(
  avatarId: string | undefined | null,
  age: number,
  fallbackSeed: string | undefined | null,
  fallbackSex: string,
): ImageSourcePropType {
  const slot = _avatarSlot(avatarId, age);
  if (!slot) {
    const p = avatarId ? parseAvatarId(avatarId) : null;
    if (!p) return getPortrait(fallbackSeed, age, fallbackSex);
    return legacyFace(age, p.letter === 'f' ? 'female' : 'male');
  }
  return POOL[slot.key][slot.index];
}

/**
 * Which bucket + index a chosen avatar resolves to (null → no pick, or an empty
 * bucket). The counterpart of `_portraitSlot`, and exposed for the same reason:
 * under jest every `require`d PNG maps to one shared file mock, so the returned
 * image is literally the same object for every character. Comparing portraits
 * in a test proves nothing — the slot is the only observable part of this.
 */
export function _avatarSlot(
  avatarId: string | undefined | null,
  age: number,
): { key: string; index: number } | null {
  const p = avatarId ? parseAvatarId(avatarId) : null;
  if (!p) return null;
  const band = bandForAge(age);
  const key = band === 'baby' ? 'baby' : `${p.letter}_${band}`;
  const bucket = POOL[key];
  if (!bucket || bucket.length === 0) return null;

  // Proportional, not modular. `parseAvatarId` only matches \d+, so the index
  // is already non-negative.
  //
  // The pick space is the LARGEST bucket for this sex — the young-adult one,
  // which is where the starter picker offers its faces. Scaling through that
  // keeps a pick at the same relative position in every band, so ordering
  // survives the band change instead of being scrambled by a modulus.
  //
  // A pick beyond the space (a legacy id, or a scenario that started the player
  // in a smaller band) clamps to the end rather than wrapping around to the
  // front, which is what made `%` jump `f7` from slot 7 back to slot 1.
  const space = pickSpaceFor(p.letter);
  const ratio = Math.min(p.index, space - 1) / space;
  const index = Math.min(bucket.length - 1, Math.floor(ratio * bucket.length));
  return { key, index };
}

/**
 * The size of the bucket a starter pick is chosen FROM, per sex.
 *
 * Computed from the pool rather than hardcoded, so adding art to the
 * young-adult bucket cannot silently desync this from `listStarterAvatars`.
 */
function pickSpaceFor(letter: 'm' | 'f'): number {
  const SEXED_BANDS: Band[] = ['kid', 'tn', 'ya', 'ad', 'mid', 'sr'];
  return Math.max(1, ...SEXED_BANDS.map((b) => POOL[`${letter}_${b}`]?.length ?? 0));
}
