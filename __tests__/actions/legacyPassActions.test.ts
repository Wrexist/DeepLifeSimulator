import { createTestGameState } from '../helpers/createTestGameState';
import {
  applyLegacyPassReward,
  awardLegacyPassXp,
  claimLegacyPassReward,
  unlockLegacyPassPremium,
} from '@/contexts/game/actions/LegacyPassActions';
import {
  getCurrentSeasonId,
  getLegacyPassReward,
  MAX_TIER,
  XP_PER_TIER,
} from '@/lib/legacyPass/legacyPass';

// Fixed clock so season math is deterministic across the suite.
const NOW = Date.UTC(2026, 3, 1);
const SEASON = getCurrentSeasonId(NOW);

describe('LegacyPassActions', () => {
  describe('applyLegacyPassReward', () => {
    it('grants gems to stats.gems', () => {
      const s = createTestGameState({ stats: { gems: 10 } as any });
      const next = applyLegacyPassReward(s, { kind: 'gems', amount: 50, label: '50 Gems' });
      expect(next.stats.gems).toBe(60);
    });

    it('grants youth pills to the top-level counter', () => {
      const s = createTestGameState({ youthPills: 2 });
      const next = applyLegacyPassReward(s, { kind: 'youthPills', amount: 1, label: '1 Youth Pill' });
      expect(next.youthPills).toBe(3);
    });

    it('adds a cosmetic id to the pass (deduped)', () => {
      const s = createTestGameState();
      const once = applyLegacyPassReward(s, { kind: 'cosmetic', id: 'theme_x', label: 'Theme' });
      const twice = applyLegacyPassReward(once, { kind: 'cosmetic', id: 'theme_x', label: 'Theme' });
      expect(twice.legacyPass?.ownedCosmetics).toEqual(['theme_x']);
    });

    it('adds a trait to activeTraits (heritable, deduped)', () => {
      const s = createTestGameState({ activeTraits: ['existing'] });
      const next = applyLegacyPassReward(s, { kind: 'trait', id: 'legacy_trait_s', label: 'Trait' });
      expect(next.activeTraits).toEqual(['existing', 'legacy_trait_s']);
    });

    it('ignores invalid amounts (no negative grants)', () => {
      const s = createTestGameState({ stats: { gems: 5 } as any });
      const next = applyLegacyPassReward(s, { kind: 'gems', amount: -100, label: 'x' });
      expect(next.stats.gems).toBe(5);
    });

    it('does not mutate the input state', () => {
      const s = createTestGameState({ youthPills: 0 });
      applyLegacyPassReward(s, { kind: 'youthPills', amount: 1, label: 'x' });
      expect(s.youthPills).toBe(0);
    });
  });

  describe('awardLegacyPassXp', () => {
    it('adds XP under the current season', () => {
      const s = createTestGameState();
      const next = awardLegacyPassXp(s, 120, NOW);
      expect(next.legacyPass?.seasonId).toBe(SEASON);
      expect(next.legacyPass?.xp).toBe(120);
    });

    it('accumulates across calls within a season', () => {
      const s = awardLegacyPassXp(createTestGameState(), 50, NOW);
      const s2 = awardLegacyPassXp(s, 70, NOW);
      expect(s2.legacyPass?.xp).toBe(120);
    });
  });

  describe('claimLegacyPassReward', () => {
    it('claims an unlocked free tier and grants its reward', () => {
      // Tier 1 reward is gems; give enough XP to unlock tier 1.
      const base = createTestGameState({ stats: { gems: 0 } as any });
      const withXp = awardLegacyPassXp(base, XP_PER_TIER, NOW);
      const { state, result } = claimLegacyPassReward(withXp, 'free', 1, NOW);
      expect(result.ok).toBe(true);
      const reward = getLegacyPassReward('free', 1)!;
      expect(reward.kind).toBe('gems');
      expect(state.stats.gems).toBe(reward.amount);
      expect(state.legacyPass?.claimedFreeTiers).toContain(1);
    });

    it('refuses a locked tier and leaves rewards untouched', () => {
      const base = createTestGameState({ stats: { gems: 0 } as any });
      const { state, result } = claimLegacyPassReward(base, 'free', 5, NOW);
      expect(result).toMatchObject({ ok: false, reason: 'locked' });
      expect(state.stats.gems).toBe(0);
    });

    it('refuses premium claims until premium is owned, then succeeds', () => {
      const base = awardLegacyPassXp(createTestGameState(), XP_PER_TIER, NOW);
      const denied = claimLegacyPassReward(base, 'premium', 1, NOW);
      expect(denied.result).toMatchObject({ ok: false, reason: 'premium-required' });

      const owned = unlockLegacyPassPremium(denied.state, NOW);
      const granted = claimLegacyPassReward(owned, 'premium', 1, NOW);
      expect(granted.result.ok).toBe(true);
    });

    it('grants the marquee heritable trait at the premium finale', () => {
      let s = createTestGameState();
      s = unlockLegacyPassPremium(s, NOW);
      s = awardLegacyPassXp(s, XP_PER_TIER * MAX_TIER, NOW);
      const { state, result } = claimLegacyPassReward(s, 'premium', MAX_TIER, NOW);
      expect(result.ok).toBe(true);
      const trait = getLegacyPassReward('premium', MAX_TIER)!;
      expect(trait.kind).toBe('trait');
      expect(state.activeTraits).toContain(trait.id);
    });
  });

  describe('unlockLegacyPassPremium', () => {
    it('sets premiumOwned without altering XP/claims', () => {
      const s = awardLegacyPassXp(createTestGameState(), 200, NOW);
      const next = unlockLegacyPassPremium(s, NOW);
      expect(next.legacyPass?.premiumOwned).toBe(true);
      expect(next.legacyPass?.xp).toBe(200);
    });
  });
});
