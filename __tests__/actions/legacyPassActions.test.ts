import { createTestGameState } from '../helpers/createTestGameState';
import {
  applyLegacyPassReward,
  awardLegacyPassXp,
  claimLegacyPassReward,
  claimAllLegacyPassRewards,
  unlockLegacyPassPremium,
  reconcileLegacyPassSeason,
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
      const s = createTestGameState({ stats: { gems: 10 } });
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
      const s = createTestGameState({ stats: { gems: 5 } });
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
      const base = createTestGameState({ stats: { gems: 0 } });
      const withXp = awardLegacyPassXp(base, XP_PER_TIER, NOW);
      const { state, result } = claimLegacyPassReward(withXp, 'free', 1, NOW);
      expect(result.ok).toBe(true);
      const reward = getLegacyPassReward('free', 1)!;
      expect(reward.kind).toBe('gems');
      expect(state.stats.gems).toBe(reward.amount);
      expect(state.legacyPass?.claimedFreeTiers).toContain(1);
    });

    it('refuses a locked tier and leaves rewards untouched', () => {
      const base = createTestGameState({ stats: { gems: 0 } });
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

  // A pass stuck in a clearly-different ("old") season forces a rollover when we
  // award XP / reconcile with the NOW clock.
  const oldSeasonPass = (over: Record<string, unknown> = {}) =>
    createTestGameState({
      stats: { gems: 0 },
      youthPills: 0,
      legacyPass: {
        seasonId: 'old-season',
        xp: XP_PER_TIER * 3, // tiers 1-3 earned
        premiumOwned: false,
        claimedFreeTiers: [],
        claimedPremiumTiers: [],
        ownedCosmetics: [],
        ...over,
      },
    });

  describe('season rollover auto-collects unclaimed rewards (no silent loss)', () => {
    it('awardLegacyPassXp collects free rewards, resets, then adds XP, and stamps a summary', () => {
      const next = awardLegacyPassXp(oldSeasonPass(), 50, NOW);
      // 3 free tier rewards (all gems at low tiers) were collected.
      const expectedGems =
        (getLegacyPassReward('free', 1)!.amount ?? 0) +
        (getLegacyPassReward('free', 2)!.amount ?? 0) +
        (getLegacyPassReward('free', 3)!.amount ?? 0);
      expect(next.stats.gems).toBe(expectedGems);
      expect(next.legacyPass?.seasonId).toBe(SEASON); // rolled to live season
      expect(next.legacyPass?.xp).toBe(50); // fresh season + awarded XP
      expect(next.legacyPassSeasonSummary?.collectedCount).toBe(3);
      expect(next.legacyPassSeasonSummary?.collectedGems).toBe(expectedGems);
    });

    it('carries owned cosmetics forward across the rollover', () => {
      const next = awardLegacyPassXp(oldSeasonPass({ xp: 0, ownedCosmetics: ['theme_a'] }), 10, NOW);
      expect(next.legacyPass?.ownedCosmetics).toEqual(['theme_a']);
    });

    it('collects premium rewards too when premium was owned', () => {
      const next = awardLegacyPassXp(oldSeasonPass({ premiumOwned: true }), 0, NOW);
      // 3 free + 3 premium earned-unclaimed; premium tier 3 is a youth pill.
      expect(next.legacyPassSeasonSummary?.collectedCount).toBe(6);
      expect(next.youthPills).toBeGreaterThan(0);
    });
  });

  describe('claimAllLegacyPassRewards', () => {
    it('claims every earned free tier in one call and reports the totals', () => {
      const s = awardLegacyPassXp(createTestGameState({ stats: { gems: 0 } }), XP_PER_TIER * 3, NOW);
      const { state, claimedCount, gemsGained } = claimAllLegacyPassRewards(s, NOW);
      expect(claimedCount).toBe(3); // tiers 1-3 free
      const expectedGems =
        (getLegacyPassReward('free', 1)!.amount ?? 0) +
        (getLegacyPassReward('free', 2)!.amount ?? 0) +
        (getLegacyPassReward('free', 3)!.amount ?? 0);
      expect(gemsGained).toBe(expectedGems);
      expect(state.stats.gems).toBe(expectedGems);
      expect(state.legacyPass?.claimedFreeTiers).toEqual([1, 2, 3]);
    });

    it('includes premium tiers when premium is owned', () => {
      let s = unlockLegacyPassPremium(createTestGameState({ stats: { gems: 0 } }), NOW);
      s = awardLegacyPassXp(s, XP_PER_TIER * 2, NOW);
      const { claimedCount } = claimAllLegacyPassRewards(s, NOW);
      expect(claimedCount).toBe(4); // free 1,2 + premium 1,2
    });

    it('is a no-op when nothing is claimable', () => {
      const s = createTestGameState();
      const { claimedCount } = claimAllLegacyPassRewards(s, NOW);
      expect(claimedCount).toBe(0);
    });

    it('auto-collects (never drops) unclaimed rewards when the season rolled over mid-open', () => {
      // The modal reconciles on open, but the season boundary can be crossed while
      // it sits open; the claim must roll over + collect, not reset to an empty pass.
      const { state, claimedCount } = claimAllLegacyPassRewards(oldSeasonPass(), NOW);
      const expectedGems =
        (getLegacyPassReward('free', 1)!.amount ?? 0) +
        (getLegacyPassReward('free', 2)!.amount ?? 0) +
        (getLegacyPassReward('free', 3)!.amount ?? 0);
      // Rewards land on the account via rollover collection (not as new-season claims).
      expect(state.stats.gems).toBe(expectedGems);
      expect(state.legacyPass?.seasonId).toBe(SEASON);
      expect(state.legacyPassSeasonSummary?.collectedCount).toBe(3);
      expect(state.legacyPassSeasonSummary?.collectedGems).toBe(expectedGems);
      // The fresh season has no claimable tiers, so the claim loop itself adds none.
      expect(claimedCount).toBe(0);
    });
  });

  describe('claimLegacyPassReward across a season rollover (no silent loss)', () => {
    it('auto-collects the old season instead of resetting to an empty pass', () => {
      const { state, result } = claimLegacyPassReward(oldSeasonPass(), 'free', 1, NOW);
      // The requested tier is locked in the fresh season, but the old season's
      // earned rewards are collected to the account rather than discarded.
      expect(result.ok).toBe(false);
      const expectedGems =
        (getLegacyPassReward('free', 1)!.amount ?? 0) +
        (getLegacyPassReward('free', 2)!.amount ?? 0) +
        (getLegacyPassReward('free', 3)!.amount ?? 0);
      expect(state.stats.gems).toBe(expectedGems);
      expect(state.legacyPass?.seasonId).toBe(SEASON);
      expect(state.legacyPassSeasonSummary?.collectedCount).toBe(3);
    });
  });

  describe('reconcileLegacyPassSeason', () => {
    it('rolls over with collection and sets new-season premium from the subscription', () => {
      const next = reconcileLegacyPassSeason(oldSeasonPass(), /*premiumActiveNow*/ true, NOW);
      expect(next.legacyPass?.seasonId).toBe(SEASON);
      expect(next.legacyPass?.premiumOwned).toBe(true);
      expect(next.legacyPassSeasonSummary?.collectedCount).toBe(3);
    });

    it('within the same season: re-derives premium without resetting progress', () => {
      const s = awardLegacyPassXp(createTestGameState({ stats: { gems: 0 } }), XP_PER_TIER * 2, NOW);
      expect(s.legacyPass?.premiumOwned).toBe(false);
      const next = reconcileLegacyPassSeason(s, true, NOW);
      expect(next.legacyPass?.premiumOwned).toBe(true);
      expect(next.legacyPass?.xp).toBe(XP_PER_TIER * 2); // progress intact
    });

    it('downgrades premium when the subscription lapses mid-season', () => {
      // A premium subscriber this season, then the subscription lapses.
      let s = awardLegacyPassXp(createTestGameState(), XP_PER_TIER * 2, NOW);
      s = reconcileLegacyPassSeason(s, true, NOW); // premium granted
      expect(s.legacyPass?.premiumOwned).toBe(true);
      const lapsed = reconcileLegacyPassSeason(s, false, NOW);
      expect(lapsed.legacyPass?.premiumOwned).toBe(false); // revoked, not held until rollover
      expect(lapsed.legacyPass?.xp).toBe(XP_PER_TIER * 2); // free progress intact
    });

    /**
     * R4-MON-4. `hasPremiumAccess()` falls through to `hasLifetimePremium()` →
     * `iapService.hasPurchased(...)`, which reads the purchase ledger — empty on
     * a cold start until `loadPurchases()` runs, and `SubscriptionReconciler`
     * read it BEFORE that load. So `premiumActiveNow` was structurally false on
     * first launch for a lifetime-premium owner, and this function stripped the
     * paid premium track with no guard. MON-1 fixed exactly this hazard for
     * `adsRemoved`; this call site never got it.
     *
     * The loss is not cosmetic: `premiumOwned` gates `getClaimableTiers(pass,
     * 'premium')`, which `getUnclaimedEarnedRewards` uses — so crossing a season
     * boundary in that window drops every unclaimed premium reward and resets
     * the pass. Permanent, for a paying player.
     */
    it('does NOT downgrade premium when the entitlement check could not run', () => {
      let s = awardLegacyPassXp(createTestGameState(), XP_PER_TIER * 2, NOW);
      s = reconcileLegacyPassSeason(s, true, NOW);
      expect(s.legacyPass?.premiumOwned).toBe(true);

      const unknown = reconcileLegacyPassSeason(s, false, NOW, /*authoritative*/ false);

      expect(unknown.legacyPass?.premiumOwned).toBe(true);
      expect(unknown.legacyPass?.xp).toBe(XP_PER_TIER * 2);
    });

    it('still upgrades on an unknown check that says the player IS premium', () => {
      // "Unknown" only ever holds the current value — it must not block a
      // positive answer, which can only come from a source that saw something.
      const s = awardLegacyPassXp(createTestGameState(), XP_PER_TIER, NOW);
      expect(s.legacyPass?.premiumOwned).toBe(false);

      expect(reconcileLegacyPassSeason(s, true, NOW, false).legacyPass?.premiumOwned).toBe(true);
    });

    it('an unknown check does not start a NEW season downgraded either', () => {
      // The rollover path had the same hole: a season boundary crossed during
      // the cold-start window would have minted the new pass with premium off.
      const rolled = reconcileLegacyPassSeason(
        oldSeasonPass({ premiumOwned: true }), false, NOW, /*authoritative*/ false,
      );

      expect(rolled.legacyPass?.seasonId).toBe(SEASON);
      expect(rolled.legacyPass?.premiumOwned).toBe(true);
    });

    it('an AUTHORITATIVE lapse still downgrades a rollover (not over-held)', () => {
      // The control. Holding the flag on "unknown" must not make the downgrade
      // unreachable — a genuinely lapsed subscriber loses the track.
      const rolled = reconcileLegacyPassSeason(
        oldSeasonPass({ premiumOwned: true }), false, NOW, /*authoritative*/ true,
      );

      expect(rolled.legacyPass?.premiumOwned).toBe(false);
    });

    it('the reconciler reads the entitlement AFTER loading the purchase ledger', () => {
      // The ordering half of MON-4, which no pure test of this function can
      // reach: `plusActive` was computed above the `loadPurchases()` await.
      const fs = require('fs') as typeof import('fs');
      const path = require('path') as typeof import('path');
      const src = fs.readFileSync(
        path.join(__dirname, '..', '..', 'components', 'SubscriptionReconciler.tsx'), 'utf8',
      );

      expect(src.indexOf('loadPurchases()')).toBeLessThan(src.indexOf('const plusActive'));
      expect(src).toMatch(/reconcileLegacyPassSeason\(afterSub, plusActive, Date\.now\(\), authoritative\)/);
    });

    it('is idempotent within a season (no spurious rollover/summary)', () => {
      const s = awardLegacyPassXp(createTestGameState(), 120, NOW);
      const once = reconcileLegacyPassSeason(s, false, NOW);
      const twice = reconcileLegacyPassSeason(once, false, NOW);
      expect(twice.legacyPass?.xp).toBe(120);
      expect(twice.legacyPassSeasonSummary).toBeUndefined();
    });
  });
});
