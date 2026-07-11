/**
 * Creator Level & Perks (STATE_VERSION 22, shared by YouVideo + Streamly).
 *
 * Both creator apps accrued `experience` but never recomputed `level`, so the
 * "Lv N" badge was frozen forever. This module is the single source of truth for
 * turning accumulated experience into a level, a perk tier, and progress-to-next
 * so the badge finally advances in both apps identically.
 *
 * Curve: cumulative XP to REACH level L is `50 * L * (L - 1)` (level 1 = 0 XP,
 * level 2 = 100, level 3 = 300, level 5 = 1,000, level 10 = 4,500, …). Escalating
 * but bounded — pure progression, prints no money.
 *
 * Pure functions. No React, no state, no wall-clock.
 */

const safe = (n: number | undefined, fb: number): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

/** Cumulative experience required to reach `level` (level 1 = 0). */
export function experienceForLevel(level: number): number {
  const L = Math.max(1, Math.floor(safe(level, 1)));
  return 50 * L * (L - 1);
}

/**
 * Level from accumulated experience (min 1). Closed-form inverse of
 * `experienceForLevel`, corrected for floating-point boundary error so the
 * exact threshold (e.g. 100 XP → level 2) is deterministic.
 */
export function creatorLevelFromExperience(experience: number): number {
  const xp = Math.max(0, safe(experience, 0));
  let level = Math.floor(0.5 + Math.sqrt(2500 + 200 * xp) / 100);
  if (level < 1) level = 1;
  // Defensive correction against float rounding at exact boundaries.
  while (experienceForLevel(level + 1) <= xp) level++;
  while (level > 1 && experienceForLevel(level) > xp) level--;
  return level;
}

/** Levels at which each successive perk tier unlocks (tier index = array index). */
export const PERK_TIER_LEVELS = [1, 5, 10, 20, 35, 50] as const;

/** Perk tier (0-based) unlocked at a given creator level. */
export function creatorPerkTier(level: number): number {
  const L = Math.max(1, Math.floor(safe(level, 1)));
  let tier = 0;
  for (let i = 0; i < PERK_TIER_LEVELS.length; i++) {
    if (L >= PERK_TIER_LEVELS[i]) tier = i;
  }
  return tier;
}

export interface CreatorLevelProgress {
  level: number;
  perkTier: number;
  /** Cumulative XP threshold for the current level. */
  currentLevelXp: number;
  /** Cumulative XP threshold for the next level. */
  nextLevelXp: number;
  /** XP accumulated into the current level. */
  intoLevel: number;
  /** XP span of the current level (nextLevelXp − currentLevelXp). */
  span: number;
  /** Fraction 0..1 of progress toward the next level. */
  pct: number;
}

/** Full progress readout for the level badge / progress bar. */
export function creatorLevelProgress(experience: number): CreatorLevelProgress {
  const xp = Math.max(0, safe(experience, 0));
  const level = creatorLevelFromExperience(xp);
  const currentLevelXp = experienceForLevel(level);
  const nextLevelXp = experienceForLevel(level + 1);
  const span = Math.max(1, nextLevelXp - currentLevelXp);
  const intoLevel = Math.max(0, xp - currentLevelXp);
  const pct = Math.max(0, Math.min(1, intoLevel / span));
  return {
    level,
    perkTier: creatorPerkTier(level),
    currentLevelXp,
    nextLevelXp,
    intoLevel,
    span,
    pct,
  };
}
