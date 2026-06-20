import {
  SEASON_LENGTH_WEEKS,
  MAX_TIER,
  XP_PER_TIER,
  getCurrentSeasonId,
  getTierForXp,
  getXpForTier,
  xpIntoCurrentTier,
  xpToNextTier,
  getDefaultLegacyPass,
  ensureCurrentSeason,
  addLegacyPassXp,
  getLegacyPassReward,
  getClaimableTiers,
  claimLegacyPassTier,
  FREE_REWARDS,
  PREMIUM_REWARDS,
  getUnclaimedEarnedRewards,
  getClaimableCount,
} from '../legacyPass';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

describe('Legacy Pass engine', () => {
  describe('season clock', () => {
    it('is deterministic for a given time', () => {
      const t = Date.UTC(2026, 2, 1);
      expect(getCurrentSeasonId(t)).toBe(getCurrentSeasonId(t));
    });

    it('advances exactly once per season length', () => {
      const base = Date.UTC(2026, 0, 5); // epoch
      const s0 = getCurrentSeasonId(base);
      const sameSeason = getCurrentSeasonId(base + (SEASON_LENGTH_WEEKS - 1) * WEEK_MS);
      const nextSeason = getCurrentSeasonId(base + SEASON_LENGTH_WEEKS * WEEK_MS);
      expect(sameSeason).toBe(s0);
      expect(nextSeason).not.toBe(s0);
    });

    it('never returns a negative season before the epoch', () => {
      expect(getCurrentSeasonId(0)).toBe('season-0');
    });
  });

  describe('tier math', () => {
    it('maps XP to tiers and caps at MAX_TIER', () => {
      expect(getTierForXp(0)).toBe(0);
      expect(getTierForXp(XP_PER_TIER - 1)).toBe(0);
      expect(getTierForXp(XP_PER_TIER)).toBe(1);
      expect(getTierForXp(XP_PER_TIER * 3 + 10)).toBe(3);
      expect(getTierForXp(XP_PER_TIER * (MAX_TIER + 50))).toBe(MAX_TIER);
    });

    it('handles invalid XP defensively', () => {
      expect(getTierForXp(NaN)).toBe(0);
      expect(getTierForXp(-100)).toBe(0);
    });

    it('reports progress within a tier', () => {
      expect(getXpForTier(3)).toBe(3 * XP_PER_TIER);
      expect(xpIntoCurrentTier(XP_PER_TIER + 40)).toBe(40);
      expect(xpToNextTier(XP_PER_TIER + 40)).toBe(XP_PER_TIER - 40);
    });

    it('clamps progress at the max tier', () => {
      const maxedXp = XP_PER_TIER * MAX_TIER + 999;
      expect(xpIntoCurrentTier(maxedXp)).toBe(XP_PER_TIER);
      expect(xpToNextTier(maxedXp)).toBe(0);
    });
  });

  describe('default + season reconciliation', () => {
    it('builds a clean default', () => {
      const p = getDefaultLegacyPass('season-7');
      expect(p).toEqual({
        seasonId: 'season-7',
        xp: 0,
        premiumOwned: false,
        claimedFreeTiers: [],
        claimedPremiumTiers: [],
        ownedCosmetics: [],
      });
    });

    it('resets progress when the season rolls over (incl. premium)', () => {
      const old = {
        seasonId: 'season-1',
        xp: 900,
        premiumOwned: true,
        claimedFreeTiers: [1, 2],
        claimedPremiumTiers: [1],
        ownedCosmetics: ['old_theme'],
      };
      const reconciled = ensureCurrentSeason(old, 'season-2');
      expect(reconciled.seasonId).toBe('season-2');
      expect(reconciled.xp).toBe(0);
      expect(reconciled.premiumOwned).toBe(false);
      expect(reconciled.claimedFreeTiers).toEqual([]);
    });

    it('preserves progress within the same season', () => {
      const cur = { seasonId: 'season-2', xp: 250, premiumOwned: true, claimedFreeTiers: [1], claimedPremiumTiers: [], ownedCosmetics: [] };
      expect(ensureCurrentSeason(cur, 'season-2')).toBe(cur);
    });

    it('treats undefined pass as a fresh default', () => {
      expect(ensureCurrentSeason(undefined, 'season-3').seasonId).toBe('season-3');
    });
  });

  describe('addLegacyPassXp', () => {
    it('adds XP within a season', () => {
      const p = addLegacyPassXp(getDefaultLegacyPass('s'), 150, 's');
      expect(p.xp).toBe(150);
    });

    it('ignores negative / NaN amounts', () => {
      const p0 = getDefaultLegacyPass('s');
      expect(addLegacyPassXp(p0, -50, 's').xp).toBe(0);
      expect(addLegacyPassXp(p0, NaN, 's').xp).toBe(0);
    });

    it('rolls the season over before adding', () => {
      const old = { seasonId: 's1', xp: 500, premiumOwned: true, claimedFreeTiers: [1], claimedPremiumTiers: [], ownedCosmetics: [] };
      const p = addLegacyPassXp(old, 30, 's2');
      expect(p.seasonId).toBe('s2');
      expect(p.xp).toBe(30); // reset then added, not 530
    });

    it('does not mutate the input', () => {
      const p0 = getDefaultLegacyPass('s');
      addLegacyPassXp(p0, 100, 's');
      expect(p0.xp).toBe(0);
    });
  });

  describe('reward tables', () => {
    it('have one reward per tier', () => {
      expect(FREE_REWARDS).toHaveLength(MAX_TIER);
      expect(PREMIUM_REWARDS).toHaveLength(MAX_TIER);
    });

    it('cap the premium track with a heritable trait', () => {
      const top = getLegacyPassReward('premium', MAX_TIER);
      expect(top?.kind).toBe('trait');
    });

    it('return null out of range', () => {
      expect(getLegacyPassReward('free', 0)).toBeNull();
      expect(getLegacyPassReward('free', MAX_TIER + 1)).toBeNull();
    });

    it('never grant raw money/stats (no pay-to-win)', () => {
      const allKinds = [...FREE_REWARDS, ...PREMIUM_REWARDS].map(r => r.kind);
      for (const k of allKinds) {
        expect(['gems', 'youthPills', 'cosmetic', 'trait']).toContain(k);
      }
    });
  });

  describe('getClaimableTiers', () => {
    it('lists unlocked-but-unclaimed free tiers', () => {
      const pass = { seasonId: 's', xp: XP_PER_TIER * 3, premiumOwned: false, claimedFreeTiers: [1], claimedPremiumTiers: [], ownedCosmetics: [] };
      expect(getClaimableTiers(pass, 'free')).toEqual([2, 3]);
    });

    it('returns nothing on premium track without ownership', () => {
      const pass = { seasonId: 's', xp: XP_PER_TIER * 3, premiumOwned: false, claimedFreeTiers: [], claimedPremiumTiers: [], ownedCosmetics: [] };
      expect(getClaimableTiers(pass, 'premium')).toEqual([]);
    });

    it('lists premium tiers once owned', () => {
      const pass = { seasonId: 's', xp: XP_PER_TIER * 2, premiumOwned: true, claimedFreeTiers: [], claimedPremiumTiers: [], ownedCosmetics: [] };
      expect(getClaimableTiers(pass, 'premium')).toEqual([1, 2]);
    });
  });

  describe('getUnclaimedEarnedRewards', () => {
    it('returns earned-but-unclaimed free rewards', () => {
      const pass = { seasonId: 's', xp: XP_PER_TIER * 3, premiumOwned: false, claimedFreeTiers: [1], claimedPremiumTiers: [], ownedCosmetics: [] };
      const rewards = getUnclaimedEarnedRewards(pass);
      // tiers 2 and 3 unclaimed on free; premium excluded (not owned)
      expect(rewards).toHaveLength(2);
    });

    it('includes premium rewards only when premium is owned', () => {
      const base = { seasonId: 's', xp: XP_PER_TIER * 2, claimedFreeTiers: [], claimedPremiumTiers: [], ownedCosmetics: [] };
      expect(getUnclaimedEarnedRewards({ ...base, premiumOwned: false })).toHaveLength(2); // free 1,2
      expect(getUnclaimedEarnedRewards({ ...base, premiumOwned: true })).toHaveLength(4); // free 1,2 + premium 1,2
    });

    it('returns nothing when no tiers are earned', () => {
      const pass = { seasonId: 's', xp: 0, premiumOwned: true, claimedFreeTiers: [], claimedPremiumTiers: [], ownedCosmetics: [] };
      expect(getUnclaimedEarnedRewards(pass)).toEqual([]);
    });
  });

  describe('getClaimableCount', () => {
    it('counts unclaimed earned tiers across tracks', () => {
      const pass = { seasonId: 's', xp: XP_PER_TIER * 3, premiumOwned: true, claimedFreeTiers: [1], claimedPremiumTiers: [], ownedCosmetics: [] };
      expect(getClaimableCount(pass)).toBe(5); // free 2,3 + premium 1,2,3
    });
    it('is 0 for undefined or empty', () => {
      expect(getClaimableCount(undefined)).toBe(0);
      expect(getClaimableCount({ seasonId: 's', xp: 0, premiumOwned: false, claimedFreeTiers: [], claimedPremiumTiers: [], ownedCosmetics: [] })).toBe(0);
    });
  });

  describe('claimLegacyPassTier', () => {
    const baseFree = { seasonId: 's', xp: XP_PER_TIER * 2, premiumOwned: false, claimedFreeTiers: [], claimedPremiumTiers: [], ownedCosmetics: [] };

    it('claims an unlocked free tier and returns the reward', () => {
      const res = claimLegacyPassTier(baseFree, 'free', 1);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.pass.claimedFreeTiers).toContain(1);
        expect(res.reward).toBeTruthy();
      }
    });

    it('rejects a locked tier', () => {
      const res = claimLegacyPassTier(baseFree, 'free', 5);
      expect(res).toEqual({ ok: false, reason: 'locked' });
    });

    it('rejects double-claims', () => {
      const claimed = { ...baseFree, claimedFreeTiers: [1] };
      expect(claimLegacyPassTier(claimed, 'free', 1)).toEqual({ ok: false, reason: 'already-claimed' });
    });

    it('rejects premium claims without ownership', () => {
      expect(claimLegacyPassTier(baseFree, 'premium', 1)).toEqual({ ok: false, reason: 'premium-required' });
    });

    it('rejects out-of-range tiers', () => {
      expect(claimLegacyPassTier(baseFree, 'free', 0)).toEqual({ ok: false, reason: 'no-reward' });
    });

    it('does not mutate the input pass', () => {
      claimLegacyPassTier(baseFree, 'free', 1);
      expect(baseFree.claimedFreeTiers).toEqual([]);
    });
  });
});
