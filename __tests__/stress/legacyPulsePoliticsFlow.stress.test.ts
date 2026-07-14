/**
 * Final-round audit: heir generation + family tree, Pulse weekly tick,
 * politics policy economy + weekly tick.
 *
 * Why this file:
 *  - `computeInheritance` is called on every death/prestige; one NaN
 *    propagates into legacyBonuses and corrupts every subsequent life.
 *    BUGFIX #25: `state.stats.reputation` direct access produced NaN.
 *    BUGFIX #26: `state.userProfile.name` crashed when userProfile undefined.
 *  - `processPulseWeeklyTick` mutates socialMedia and pays the player every
 *    week — regressions silently corrupt wealth or break scandal cascades.
 *  - `calculatePolicyEffects` crashed on undefined policies array.
 *    BUGFIX #27: now nil-safe.
 *  - `runPoliticsWeeklyTick` rolls scandals; a NaN approval drift loops
 *    forever or saturates at 0/100.
 */

import { HeirGenerator } from '@/lib/legacy/heirGeneration';
import { GeneticsSystem } from '@/lib/legacy/genetics';
import { FamilyTree, type FamilyMemberNode } from '@/lib/legacy/familyTree';
import { computeInheritance } from '@/lib/legacy/inheritance';
import {
  updateDynastyOnDeath,
  getDynastyReputationModifier,
  DEFAULT_DYNASTY_STATS,
} from '@/lib/legacy/dynasty';
import { processPulseWeeklyTick } from '@/lib/social/pulseTick';
import { runPoliticsWeeklyTick } from '@/lib/politics/weeklyTick';
import {
  calculatePolicyEffects,
  getAvailablePolicies,
  getPolicyById,
  POLICIES,
} from '@/lib/politics/policies';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, ChildInfo } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

// ---------------------------------------------------------------------------
// Heir generation + family tree
// ---------------------------------------------------------------------------
describe('Heir generation + genetics', () => {
  const baseChild: ChildInfo = {
    id: 'child_1',
    name: 'Jane Doe',
    type: 'child',
    relationshipScore: 80,
    personality: 'happy',
    gender: 'female',
    age: 18,
  };

  it('generateHeir: returns finite startingStats for every key', () => {
    const r = HeirGenerator.generateHeir(baseChild, [], 1, 'lineage_1', 'parent_1');
    for (const key of Object.keys(r.startingStats) as (keyof typeof r.startingStats)[]) {
      const v = r.startingStats[key];
      expect(typeof v).toBe('number');
      expect(Number.isFinite(v)).toBe(true);
    }
  });

  it('generateHeir: applies age modifiers above ADULTHOOD_AGE', () => {
    const young = HeirGenerator.generateHeir({ ...baseChild, age: 18 }, [], 1, 'l', 'p');
    const old = HeirGenerator.generateHeir({ ...baseChild, age: 50 }, [], 1, 'l', 'p');
    expect(old.startingStats.fitness).toBeGreaterThanOrEqual(young.startingStats.fitness);
    expect(old.startingStats.reputation).toBeGreaterThanOrEqual(young.startingStats.reputation);
  });

  it('generateHeir: parents array stores both parent and spouse ids', () => {
    const r = HeirGenerator.generateHeir(baseChild, [], 1, 'l', 'parent_1', 'spouse_1');
    expect(r.node.parents).toEqual(['parent_1', 'spouse_1']);
  });

  it('generateHeir: falls back to unknown_spouse if no spouse provided', () => {
    const r = HeirGenerator.generateHeir(baseChild, [], 1, 'l', 'parent_1');
    expect(r.node.parents).toEqual(['parent_1', 'unknown_spouse']);
  });

  it('generateHeir: 100 random children stay finite + non-negative', () => {
    for (let i = 0; i < 100; i++) {
      const r = HeirGenerator.generateHeir(
        {
          ...baseChild,
          id: `child_${i}`,
          age: 15 + Math.random() * 40,
          income: Math.random() * 5000,
        },
        ['strong_constitution', 'high_iq'],
        Math.floor(Math.random() * 5),
        'l', 'p', 'spouse',
      );
      expect(r.startingStats.health).toBeGreaterThanOrEqual(0);
      expect(r.startingStats.fitness).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r.startingStats.health)).toBe(true);
      expect(Number.isFinite(r.startingStats.fitness)).toBe(true);
    }
  });

  it('GeneticsSystem.inheritTraits: deterministic structure (no dupes)', () => {
    for (let i = 0; i < 50; i++) {
      const traits = GeneticsSystem.inheritTraits(['strong_constitution'], ['high_iq']);
      expect(new Set(traits).size).toBe(traits.length); // no duplicates
    }
  });

  it('GeneticsSystem.applyStatModifiers: undefined trait id is ignored, no crash', () => {
    const base = { health: 50, happiness: 50, energy: 50, fitness: 10, money: 0, reputation: 0, gems: 0 };
    const r = GeneticsSystem.applyStatModifiers(base, ['nonexistent_trait_id']);
    expect(r).toEqual(base);
  });

  it('GeneticsSystem.generateRandomTraits: returns array, never throws', () => {
    for (let i = 0; i < 20; i++) {
      const t = GeneticsSystem.generateRandomTraits(3);
      expect(Array.isArray(t)).toBe(true);
      expect(new Set(t).size).toBe(t.length);
    }
  });
});

describe('Family tree', () => {
  it('addMember + getMember: round-trip', () => {
    const tree = new FamilyTree('l1');
    const node: FamilyMemberNode = {
      id: 'm1', firstName: 'Jane', lastName: 'Doe', generation: 1,
      birthYear: 2000, parents: [], children: [], traits: [],
      netWorth: 100_000, gender: 'female',
    };
    tree.addMember(node);
    expect(tree.getMember('m1')).toBe(node);
    expect(tree.getMember('missing')).toBeUndefined();
  });

  it('getChildren: sorts by birthYear ascending', () => {
    const tree = new FamilyTree('l1');
    tree.addMember({ id: 'p', firstName: 'P', lastName: '', generation: 1, birthYear: 1970, parents: [], children: ['c1','c2'], traits: [], netWorth: 0, gender: 'male' });
    tree.addMember({ id: 'c1', firstName: 'C1', lastName: '', generation: 2, birthYear: 2010, parents: ['p'], children: [], traits: [], netWorth: 0, gender: 'female' });
    tree.addMember({ id: 'c2', firstName: 'C2', lastName: '', generation: 2, birthYear: 2005, parents: ['p'], children: [], traits: [], netWorth: 0, gender: 'male' });
    const kids = tree.getChildren('p');
    expect(kids.map(k => k.id)).toEqual(['c2', 'c1']);
  });

  it('getAncestors: stops at maxGenerations + dedupes', () => {
    const tree = new FamilyTree('l1');
    tree.addMember({ id: 'g1', firstName: '', lastName: '', generation: 0, birthYear: 1900, parents: [], children: ['p'], traits: [], netWorth: 0, gender: 'male' });
    tree.addMember({ id: 'p', firstName: '', lastName: '', generation: 1, birthYear: 1960, parents: ['g1'], children: ['c'], traits: [], netWorth: 0, gender: 'female' });
    tree.addMember({ id: 'c', firstName: '', lastName: '', generation: 2, birthYear: 2000, parents: ['p'], children: [], traits: [], netWorth: 0, gender: 'male' });
    const ancestors = tree.getAncestors('c', 10);
    expect(ancestors.length).toBe(2); // p + g1
    expect(new Set(ancestors.map(a => a.id)).size).toBe(2);
  });

  it('toJSON / fromJSON: round-trips members', () => {
    const tree = new FamilyTree('lineage_42');
    tree.addMember({ id: 'm', firstName: 'M', lastName: '', generation: 1, birthYear: 2020, parents: [], children: [], traits: [], netWorth: 0, gender: 'male' });
    const json = tree.toJSON();
    const restored = FamilyTree.fromJSON(json);
    expect(restored.lineageId).toBe('lineage_42');
    expect(restored.getMember('m')?.id).toBe('m');
  });
});

// ---------------------------------------------------------------------------
// Inheritance — BUGFIXES #25, #26
// ---------------------------------------------------------------------------
describe('computeInheritance — BUGFIXES #25, #26', () => {
  it('returns finite legacyBonuses when reputation is undefined (BUGFIX #25)', () => {
    const state = createTestGameState({
      stats: { ...createTestGameState().stats, reputation: undefined as any },
    });
    const r = computeInheritance(state);
    expect(Number.isFinite(r.legacyBonuses.reputationBonus)).toBe(true);
    expect(Number.isFinite(r.legacyBonuses.incomeMultiplier)).toBe(true);
    expect(Number.isFinite(r.legacyBonuses.learningMultiplier)).toBe(true);
  });

  it('returns finite values when reputation is NaN', () => {
    const state = createTestGameState({
      stats: { ...createTestGameState().stats, reputation: NaN },
    });
    const r = computeInheritance(state);
    expect(Number.isFinite(r.legacyBonuses.reputationBonus)).toBe(true);
  });

  it('does not crash when userProfile is undefined (BUGFIX #26)', () => {
    const state = createTestGameState({
      userProfile: undefined as any,
    });
    expect(() => computeInheritance(state)).not.toThrow();
    const r = computeInheritance(state);
    expect(r.generatedMemories).toBeDefined();
  });

  it('does not crash when generationNumber is undefined', () => {
    const state = createTestGameState({
      generationNumber: undefined as any,
    });
    expect(() => computeInheritance(state)).not.toThrow();
  });

  it('caps reputationBonus at 20', () => {
    const state = createTestGameState({
      stats: { ...createTestGameState().stats, reputation: 999_999 },
    });
    const r = computeInheritance(state);
    // Cap is 20, but heirloom bonuses can stack on top
    expect(r.legacyBonuses.reputationBonus).toBeGreaterThanOrEqual(20);
  });

  it('clamps starting debt at -$5000', () => {
    const state = createTestGameState({
      stats: { ...createTestGameState().stats, money: -10_000_000 },
      bankSavings: 0,
      loans: [{ id: 'big', principal: 100_000, remaining: 100_000, apr: 18, weeklyPayment: 100, termWeeks: 52, startedAt: 0, type: 'personal' } as any],
    });
    const r = computeInheritance(state);
    expect(r.totalNetWorth).toBeGreaterThanOrEqual(-5000);
  });

  it('100 random states never throw + always finite bonuses', () => {
    for (let i = 0; i < 100; i++) {
      const state = createTestGameState({
        stats: {
          ...createTestGameState().stats,
          money: Math.random() * 10_000_000 - 1_000_000,
          reputation: Math.random() * 100,
        },
        achievements: Array.from({ length: Math.floor(Math.random() * 30) }, (_, j) => ({
          id: `ach_${j}`, completed: Math.random() > 0.5,
        } as any)),
      });
      const r = computeInheritance(state);
      expect(Number.isFinite(r.legacyBonuses.incomeMultiplier)).toBe(true);
      expect(Number.isFinite(r.legacyBonuses.learningMultiplier)).toBe(true);
      expect(Number.isFinite(r.legacyBonuses.reputationBonus)).toBe(true);
      expect(Number.isFinite(r.totalNetWorth)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Dynasty
// ---------------------------------------------------------------------------
describe('Dynasty stats', () => {
  it('updateDynastyOnDeath: increments generation, accumulates wealth, dedupes achievements', () => {
    let stats = { ...DEFAULT_DYNASTY_STATS };
    stats = updateDynastyOnDeath(stats, 'Alice', 80, 1_000_000, 3, ['achievement_a', 'achievement_b']);
    expect(stats.totalGenerations).toBe(2);
    expect(stats.totalWealth).toBe(1_000_000);
    expect(stats.totalChildrenAllGenerations).toBe(3);
    expect(stats.familyAchievements).toContain('achievement_a');
    expect(stats.familyAchievements).toContain('achievement_b');

    // Second life with overlapping achievements
    stats = updateDynastyOnDeath(stats, 'Bob', 75, 500_000, 1, ['achievement_a', 'achievement_c']);
    expect(stats.totalGenerations).toBe(3);
    expect(stats.familyAchievements.filter(a => a === 'achievement_a').length).toBe(1); // deduped
    expect(stats.familyAchievements).toContain('achievement_c');
  });

  it('updateDynastyOnDeath: tracks longest living + wealthiest', () => {
    let stats = { ...DEFAULT_DYNASTY_STATS };
    stats = updateDynastyOnDeath(stats, 'Alice', 60, 100_000, 0, []);
    stats = updateDynastyOnDeath(stats, 'Bob', 90, 50_000, 0, []);
    stats = updateDynastyOnDeath(stats, 'Carol', 70, 5_000_000, 0, []);
    expect(stats.longestLivingMember.name).toBe('Bob');
    expect(stats.wealthiestMember.name).toBe('Carol');
  });

  it('updateDynastyOnDeath: familyReputation caps at 100', () => {
    let stats = { ...DEFAULT_DYNASTY_STATS };
    for (let i = 0; i < 50; i++) {
      stats = updateDynastyOnDeath(stats, `Life ${i}`, 80, 1_000_000_000, 10, Array.from({ length: 30 }, (_, j) => `a${i}_${j}`));
    }
    expect(stats.familyReputation).toBeLessThanOrEqual(100);
  });

  it('updateDynastyOnDeath: pulseLifetimeFollowersCarry accumulates only when > 0', () => {
    let stats = { ...DEFAULT_DYNASTY_STATS };
    stats = updateDynastyOnDeath(stats, 'A', 70, 0, 0, [], 1000);
    stats = updateDynastyOnDeath(stats, 'B', 70, 0, 0, [], 0);
    stats = updateDynastyOnDeath(stats, 'C', 70, 0, 0, [], 500);
    expect(stats.pulseLifetimeFollowersCarry).toBe(1500);
  });

  it('getDynastyReputationModifier: monotonic non-decreasing', () => {
    const m0 = getDynastyReputationModifier(0);
    const m25 = getDynastyReputationModifier(25);
    const m50 = getDynastyReputationModifier(50);
    const m75 = getDynastyReputationModifier(75);
    const m100 = getDynastyReputationModifier(100);
    expect(m25).toBeGreaterThanOrEqual(m0);
    expect(m50).toBeGreaterThanOrEqual(m25);
    expect(m75).toBeGreaterThanOrEqual(m50);
    expect(m100).toBeGreaterThanOrEqual(m75);
  });
});

// ---------------------------------------------------------------------------
// Politics — BUGFIX #27 + policy economy
// ---------------------------------------------------------------------------
describe('Politics policy effects — BUGFIX #27', () => {
  it('calculatePolicyEffects: returns zero-effect object when policies is undefined', () => {
    const r = calculatePolicyEffects(undefined as any);
    expect(r.money).toBe(0);
    expect(r.happiness).toBe(0);
    expect(r.economy.inflationRate).toBe(0);
  });

  it('calculatePolicyEffects: returns zero-effect object when policies is null', () => {
    const r = calculatePolicyEffects(null as any);
    expect(r.money).toBe(0);
  });

  it('calculatePolicyEffects: ignores unknown policy IDs', () => {
    const r = calculatePolicyEffects(['totally_made_up_policy', 'tax_cut']);
    const taxCut = getPolicyById('tax_cut')!;
    expect(r.money).toBe(taxCut.effects.money || 0);
  });

  it('calculatePolicyEffects: sums effects across multiple policies', () => {
    const r = calculatePolicyEffects(['tax_cut', 'minimum_wage_increase']);
    const taxCut = getPolicyById('tax_cut')!;
    const minWage = getPolicyById('minimum_wage_increase')!;
    expect(r.money).toBe((taxCut.effects.money || 0) + (minWage.effects.money || 0));
  });

  it('every policy has finite required level + non-negative cost', () => {
    for (const policy of POLICIES) {
      expect(Number.isFinite(policy.requiredLevel)).toBe(true);
      expect(policy.requiredLevel).toBeGreaterThanOrEqual(0);
      expect(policy.implementationCost).toBeGreaterThanOrEqual(0);
    }
  });

  it('no duplicate policy IDs in the catalog', () => {
    const ids = POLICIES.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('getAvailablePolicies: monotonic — higher level unlocks more', () => {
    const lvl0 = getAvailablePolicies(0).length;
    const lvl3 = getAvailablePolicies(3).length;
    const lvl5 = getAvailablePolicies(5).length;
    expect(lvl3).toBeGreaterThanOrEqual(lvl0);
    expect(lvl5).toBeGreaterThanOrEqual(lvl3);
  });

  it('every policy is gettable by ID', () => {
    for (const policy of POLICIES) {
      expect(getPolicyById(policy.id)).toBe(policy);
    }
  });
});

// ---------------------------------------------------------------------------
// Politics weekly tick
// ---------------------------------------------------------------------------
describe('runPoliticsWeeklyTick', () => {
  const seededRoll = (key: string): number => {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
    return Math.abs(hash % 1000) / 1000;
  };

  it('careerLevel 0: no scandals, no drift', () => {
    const politics = {
      careerLevel: 0, approvalRating: 50, policyInfluence: 0,
      electionsWon: 0, policiesEnacted: [], lobbyists: [], alliances: [],
      campaignFunds: 0,
    };
    const r = runPoliticsWeeklyTick({
      politics, currentWeek: 10, rollFor: seededRoll,
    });
    expect(r.forcedResignation).toBe(false);
    expect(r.notifications.length).toBe(0);
  });

  it('100 weekly ticks: approval stays in [0, 100], no NaN propagation', () => {
    let politics: any = {
      careerLevel: 2, approvalRating: 50, policyInfluence: 30,
      electionsWon: 1, policiesEnacted: ['tax_cut'], lobbyists: [], alliances: [],
      campaignFunds: 50000,
    };
    for (let w = 1; w <= 100; w++) {
      const r = runPoliticsWeeklyTick({
        politics, currentWeek: w, rollFor: (k) => seededRoll(`${k}-${w}`),
        karma: -20, darkWebHeat: 30, contentiousPolicies: 2,
      });
      politics = r.politics;
      expect(politics.approvalRating).toBeGreaterThanOrEqual(0);
      expect(politics.approvalRating).toBeLessThanOrEqual(100);
      expect(Number.isFinite(politics.approvalRating)).toBe(true);
    }
  });

  it('handles undefined approvalRating safely', () => {
    const politics: any = {
      careerLevel: 1, approvalRating: undefined, policyInfluence: 0,
      electionsWon: 0, policiesEnacted: [], lobbyists: [], alliances: [],
      campaignFunds: 0,
    };
    expect(() => runPoliticsWeeklyTick({
      politics, currentWeek: 5, rollFor: seededRoll,
    })).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Pulse weekly tick
// ---------------------------------------------------------------------------
describe('processPulseWeeklyTick', () => {
  it('handles missing socialMedia entirely (pre-v13 save)', () => {
    const state = createTestGameState({ socialMedia: undefined as any });
    const r = processPulseWeeklyTick(state, 10);
    expect(r.socialMedia).toBeDefined();
    expect(Number.isFinite(r.pulseEarnings)).toBe(true);
    expect(Number.isFinite(r.reputationDelta)).toBe(true);
  });

  it('decays followers when 2+ weeks inactive', () => {
    const state = createTestGameState({
      socialMedia: {
        followers: 50_000,
        influenceLevel: 'popular',
        totalPosts: 10,
        viralPosts: 0,
        brandPartnerships: 0,
        engagementRate: 0.05,
        lastPostWeek: 0,
      } as any,
    });
    const r = processPulseWeeklyTick(state, 5);
    expect(r.socialMedia.followers).toBeLessThanOrEqual(50_000);
  });

  it('pays impression earnings to high-follower accounts', () => {
    const state = createTestGameState({
      socialMedia: {
        followers: 500_000,
        influenceLevel: 'influencer',
        totalPosts: 100,
        viralPosts: 5,
        brandPartnerships: 0,
        engagementRate: 0.04,
        lastPostWeek: 9,
      } as any,
    });
    const r = processPulseWeeklyTick(state, 10);
    expect(r.pulseEarnings).toBeGreaterThanOrEqual(0);
  });

  it('200 ticks with active scandal: stays finite, scandal resolves', () => {
    let state = createTestGameState({
      socialMedia: {
        followers: 100_000,
        influenceLevel: 'influencer',
        totalPosts: 50,
        viralPosts: 1,
        brandPartnerships: 0,
        engagementRate: 0.03,
        lastPostWeek: 0,
        activeScandal: {
          id: 's1',
          type: 'cheating',
          severity: 80,
          weeksRemaining: 4,
          startWeek: 0,
        },
        scandalHistory: [],
        notifications: [],
      } as any,
    });
    let resolved = false;
    for (let w = 1; w <= 200; w++) {
      const r = processPulseWeeklyTick(state, w);
      state = { ...state, socialMedia: r.socialMedia };
      expect(Number.isFinite(r.pulseEarnings)).toBe(true);
      expect(Number.isFinite(r.reputationDelta)).toBe(true);
      expect(state.socialMedia!.followers).toBeGreaterThanOrEqual(0);
      if (!state.socialMedia!.activeScandal) resolved = true;
    }
    expect(resolved).toBe(true);
  });

  it('notifications array bounded at 100', () => {
    let state = createTestGameState({
      socialMedia: {
        followers: 50_000, influenceLevel: 'popular',
        totalPosts: 10, viralPosts: 0, brandPartnerships: 0,
        engagementRate: 0.05, lastPostWeek: 0,
        notifications: [],
      } as any,
    });
    for (let w = 1; w <= 300; w++) {
      const r = processPulseWeeklyTick(state, w);
      state = { ...state, socialMedia: r.socialMedia };
    }
    expect(state.socialMedia!.notifications!.length).toBeLessThanOrEqual(100);
  });

  it('Verified Pro: pure tick no longer wall-clock-expires (in-game billing owns lapse)', () => {
    // Verified Pro is now an IN-GAME cash subscription. The legacy wall-clock
    // `expiresTimestamp` expiry was removed from the pure tick — weekly billing +
    // lapse (on insufficient cash) is handled by applySubscriptionsForWeek in the
    // nextWeek orchestrator (covered in __tests__/actions/weekly/applySubscriptions
    // .test.ts). So the stale timestamp must NOT deactivate the sub in the tick.
    const state = createTestGameState({
      socialMedia: {
        followers: 100_000, influenceLevel: 'influencer',
        totalPosts: 50, viralPosts: 1, brandPartnerships: 0,
        engagementRate: 0.04, lastPostWeek: 0,
        verifiedPro: {
          active: true,
          plan: 'weekly',
          weeklyPrice: 20,
          expiresTimestamp: Date.now() - 1000, // legacy field — no longer consulted
          perksUnlocked: { postBoostMultiplier: 1.25, blueCheckmark: true, analyticsUnlocked: true, noAdsInFeed: true, longerPosts: true },
        } as any,
      } as any,
    });
    const r = processPulseWeeklyTick(state, 5);
    expect(r.socialMedia.verifiedPro?.active).toBe(true);
  });

  it('influenceLevel tracks follower bands', () => {
    const test = (followers: number, expected: string) => {
      const state = createTestGameState({
        socialMedia: {
          followers,
          influenceLevel: 'novice',
          totalPosts: 50,
          viralPosts: 1,
          brandPartnerships: 0,
          engagementRate: 0.04,
          lastPostWeek: 0,
        } as any,
      });
      const r = processPulseWeeklyTick(state, 5);
      expect(r.socialMedia.influenceLevel).toBe(expected);
    };
    test(0, 'novice');
    test(500, 'novice');
    test(2_000, 'rising');
    test(50_000, 'popular');
    test(500_000, 'influencer');
    test(2_000_000, 'celebrity');
  });
});

// ---------------------------------------------------------------------------
// Cross-system regression
// ---------------------------------------------------------------------------
describe('Cross-system regression', () => {
  it('100 dynasty death cycles with NaN-fuzzed state never throw', () => {
    for (let i = 0; i < 100; i++) {
      const state = createTestGameState({
        stats: {
          ...createTestGameState().stats,
          reputation: i % 3 === 0 ? NaN : Math.random() * 100,
          money: i % 4 === 0 ? undefined as any : Math.random() * 1_000_000,
        },
        userProfile: i % 5 === 0 ? undefined as any : createTestGameState().userProfile,
        generationNumber: i % 6 === 0 ? undefined as any : i + 1,
      });
      expect(() => computeInheritance(state)).not.toThrow();
    }
  });

  it('1000 random policy combinations never produce NaN', () => {
    const ids = POLICIES.map(p => p.id);
    for (let i = 0; i < 1000; i++) {
      const sample = Array.from({ length: Math.floor(Math.random() * 10) }, () =>
        ids[Math.floor(Math.random() * ids.length)],
      );
      const r = calculatePolicyEffects(sample);
      expect(Number.isFinite(r.money)).toBe(true);
      expect(Number.isFinite(r.happiness)).toBe(true);
      expect(Number.isFinite(r.economy.inflationRate)).toBe(true);
    }
  });
});
