/**
 * Creator Level & Perks (v22) — the shared curve that finally unfreezes the
 * "Lv N" badge in YouVideo + Streamly. Pins the thresholds, monotonicity, and
 * perk-tier gating.
 */
import {
  experienceForLevel,
  creatorLevelFromExperience,
  creatorPerkTier,
  creatorLevelProgress,
  PERK_TIER_LEVELS,
} from '../creatorLevel';

describe('experienceForLevel', () => {
  it('matches the documented cumulative thresholds', () => {
    expect(experienceForLevel(1)).toBe(0);
    expect(experienceForLevel(2)).toBe(100);
    expect(experienceForLevel(3)).toBe(300);
    expect(experienceForLevel(5)).toBe(1000);
    expect(experienceForLevel(10)).toBe(4500);
  });
});

describe('creatorLevelFromExperience', () => {
  it('is level 1 at zero / negative / garbage XP', () => {
    expect(creatorLevelFromExperience(0)).toBe(1);
    expect(creatorLevelFromExperience(-50)).toBe(1);
    expect(creatorLevelFromExperience(NaN)).toBe(1);
  });

  it('lands exactly on level boundaries', () => {
    expect(creatorLevelFromExperience(100)).toBe(2);
    expect(creatorLevelFromExperience(300)).toBe(3);
    expect(creatorLevelFromExperience(1000)).toBe(5);
    expect(creatorLevelFromExperience(4500)).toBe(10);
  });

  it('does not advance until the threshold is reached', () => {
    expect(creatorLevelFromExperience(99)).toBe(1);
    expect(creatorLevelFromExperience(299)).toBe(2);
    expect(creatorLevelFromExperience(4499)).toBe(9);
  });

  it('is monotonic non-decreasing across a wide XP range', () => {
    let prev = 1;
    for (let xp = 0; xp <= 60000; xp += 137) {
      const lvl = creatorLevelFromExperience(xp);
      expect(lvl).toBeGreaterThanOrEqual(prev);
      prev = lvl;
    }
  });

  it('round-trips: level at experienceForLevel(L) is L', () => {
    for (let L = 1; L <= 40; L++) {
      expect(creatorLevelFromExperience(experienceForLevel(L))).toBe(L);
      // One XP short is the previous level.
      if (L > 1) expect(creatorLevelFromExperience(experienceForLevel(L) - 1)).toBe(L - 1);
    }
  });
});

describe('creatorPerkTier', () => {
  it('unlocks tiers at the documented levels', () => {
    expect(creatorPerkTier(1)).toBe(0);
    expect(creatorPerkTier(4)).toBe(0);
    expect(creatorPerkTier(5)).toBe(1);
    expect(creatorPerkTier(10)).toBe(2);
    expect(creatorPerkTier(20)).toBe(3);
    expect(creatorPerkTier(50)).toBe(PERK_TIER_LEVELS.length - 1);
    expect(creatorPerkTier(999)).toBe(PERK_TIER_LEVELS.length - 1);
  });
});

describe('creatorLevelProgress', () => {
  it('reports fractional progress between levels', () => {
    // Halfway between level 2 (100) and level 3 (300) is 200 XP.
    const p = creatorLevelProgress(200);
    expect(p.level).toBe(2);
    expect(p.currentLevelXp).toBe(100);
    expect(p.nextLevelXp).toBe(300);
    expect(p.pct).toBeCloseTo(0.5, 5);
  });

  it('clamps pct to [0,1] and exposes perk tier', () => {
    const p = creatorLevelProgress(0);
    expect(p.pct).toBeGreaterThanOrEqual(0);
    expect(p.pct).toBeLessThanOrEqual(1);
    expect(p.perkTier).toBe(0);
  });
});
