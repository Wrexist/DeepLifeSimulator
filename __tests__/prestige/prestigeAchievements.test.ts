/**
 * Prestige-achievement reward layer (task #68 wiring).
 *
 * Before this wiring PRESTIGE_ACHIEVEMENTS + evaluatePrestigeAchievement were
 * pure dead logic: nothing evaluated them, nothing awarded their 1k–50k
 * prestige-point rewards, and the "unlocked" readers pointed at a store never
 * written in normal play. These tests cover:
 *   - the award pass runs inside executePrestige (points + claimed store)
 *   - the claimed store makes each award one-time (idempotent) and survives the
 *     prestige rebuild
 *   - the speed-achievement UNIT fix (weeks-vs-weeks via weeksLivedAtEnd)
 *   - the bonuses_all threshold tracks the real PRESTIGE_BONUSES list
 *   - the readers consult state.prestige.claimedPrestigeAchievements
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { executePrestige } from '@/lib/prestige/prestigeExecution';
import { getPrestigeThreshold, defaultPrestigeData } from '@/lib/prestige/prestigeTypes';
import { PRESTIGE_BONUSES } from '@/lib/prestige/prestigeBonuses';
import {
  collectNewlyEarnedPrestigeAchievements,
  getUnlockedPrestigeAchievements,
  getAvailablePrestigeAchievements,
} from '@/lib/prestige/prestigeAchievements';

describe('collectNewlyEarnedPrestigeAchievements', () => {
  it('awards milestone + condition achievements that are satisfied', () => {
    // R3-P11: "Clean Slate" means debt PAID OFF, not debt never taken. This
    // fixture used `loans: []` with the comment "no loans", which encoded the
    // free-mint bug — the achievement fired on the first prestige for a player
    // who had simply never borrowed. It now needs a loan that was cleared.
    const state = createTestGameState({
      prestige: { ...defaultPrestigeData, totalPrestiges: 1 }, // prestiged once
      loans: [{ id: 'l1', name: 'Paid off', principal: 5000, remaining: 0, rateAPR: 0.1 }],
      progress: { ...createTestGameState().progress, hasBeenInDebt: true },
    } as never);
    const { newlyAwarded, pointsAwarded } = collectNewlyEarnedPrestigeAchievements(state);
    const ids = newlyAwarded.map(a => a.id);
    expect(ids).toContain('prestige_first'); // totalPrestiges >= 1
    expect(ids).toContain('prestige_no_debt'); // borrowed and repaid
    // Reward magnitudes are as designed (1000 + 2000 here).
    expect(pointsAwarded).toBe(
      newlyAwarded.reduce((s, a) => s + (a.reward?.prestigePoints ?? 0), 0),
    );
    expect(pointsAwarded).toBeGreaterThanOrEqual(3000);
  });

  it('is idempotent — already-claimed achievements are never re-collected', () => {
    const state = createTestGameState({
      prestige: {
        ...defaultPrestigeData,
        totalPrestiges: 1,
        claimedPrestigeAchievements: ['prestige_first', 'prestige_no_debt'],
      },
      loans: [],
    });
    const { newlyAwarded } = collectNewlyEarnedPrestigeAchievements(state);
    const ids = newlyAwarded.map(a => a.id);
    expect(ids).not.toContain('prestige_first');
    expect(ids).not.toContain('prestige_no_debt');
  });

  it('speed achievements compare WEEKS lived (not the old years-vs-days mismatch)', () => {
    const base = {
      generation: 1,
      netWorth: 5000,
      ageAtDeath: 20,
    };
    const state = createTestGameState({
      prestige: { ...defaultPrestigeData, totalPrestiges: 1 },
      previousLives: [{ ...base, weeksLivedAtEnd: 4 }],
    });
    const ids = collectNewlyEarnedPrestigeAchievements(state).newlyAwarded.map(a => a.id);
    expect(ids).toContain('prestige_speed_week_10'); // 4 <= 10
    expect(ids).toContain('prestige_speed_week_5'); // 4 <= 5
    expect(ids).not.toContain('prestige_speed_week_3'); // 4 > 3
  });

  it('speed achievements skip legacy previousLives entries lacking weeksLivedAtEnd', () => {
    const state = createTestGameState({
      prestige: { ...defaultPrestigeData, totalPrestiges: 1 },
      // Old-save entry: no weeksLivedAtEnd field at all.
      previousLives: [{ generation: 1, netWorth: 5000, ageAtDeath: 20 }],
    });
    const ids = collectNewlyEarnedPrestigeAchievements(state).newlyAwarded.map(a => a.id);
    expect(ids).not.toContain('prestige_speed_week_10');
    expect(ids).not.toContain('prestige_speed_week_5');
    expect(ids).not.toContain('prestige_speed_week_3');
  });

  it('prestige_bonuses_all tracks the real PRESTIGE_BONUSES count', () => {
    const allBonusIds = PRESTIGE_BONUSES.map(b => b.id);
    const withAll = createTestGameState({
      prestige: { ...defaultPrestigeData, totalPrestiges: 1, unlockedBonuses: allBonusIds },
    });
    expect(
      collectNewlyEarnedPrestigeAchievements(withAll).newlyAwarded.map(a => a.id),
    ).toContain('prestige_bonuses_all');

    const withAllButOne = createTestGameState({
      prestige: { ...defaultPrestigeData, totalPrestiges: 1, unlockedBonuses: allBonusIds.slice(1) },
    });
    expect(
      collectNewlyEarnedPrestigeAchievements(withAllButOne).newlyAwarded.map(a => a.id),
    ).not.toContain('prestige_bonuses_all');
  });
});

describe('executePrestige — prestige-achievement award pass', () => {
  // R3-P11: `loans: []` no longer satisfies "Clean Slate" — it means the
  // player never borrowed, not that they cleared their debt.
  const aboveThreshold = () =>
    createTestGameState({
      stats: { money: getPrestigeThreshold(0) + 5_000_000 },
      weeksLived: 4,
      loans: [{ id: 'l1', name: 'Paid off', principal: 5000, remaining: 0, rateAPR: 0.1 }],
      progress: { ...createTestGameState().progress, hasBeenInDebt: true },
    } as never);

  it('awards points + records the claimed store on a real prestige', () => {
    const result = executePrestige(aboveThreshold(), 'reset');
    const claimed = result.prestige?.claimedPrestigeAchievements ?? [];
    expect(claimed).toContain('prestige_first');
    expect(claimed).toContain('prestige_no_debt');
    // weeksLived = 4 → the two looser speed tiers, not the 3-week tier.
    expect(claimed).toContain('prestige_speed_week_5');
    expect(claimed).not.toContain('prestige_speed_week_3');
    expect(result.prestige?.prestigePoints ?? 0).toBeGreaterThan(0);
  });

  it('stamps weeksLivedAtEnd on the appended previousLives entry', () => {
    const result = executePrestige(aboveThreshold(), 'reset');
    const lives = result.previousLives ?? [];
    expect(lives.length).toBeGreaterThan(0);
    expect(lives[lives.length - 1].weeksLivedAtEnd).toBe(4);
  });

  it('does not re-award the same achievement on a subsequent prestige (idempotent)', () => {
    const first = executePrestige(aboveThreshold(), 'reset');
    // Hand the reset life enough net worth to prestige again, keeping the
    // carried-over claimed store intact.
    const ready = {
      ...first,
      stats: { ...first.stats, money: getPrestigeThreshold(first.prestige!.prestigeLevel) + 5_000_000 },
      loans: [],
    };
    const second = executePrestige(ready, 'reset');
    const claimed = second.prestige?.claimedPrestigeAchievements ?? [];
    // Each milestone id appears exactly once across both prestiges.
    expect(claimed.filter(id => id === 'prestige_first')).toHaveLength(1);
    expect(claimed.filter(id => id === 'prestige_no_debt')).toHaveLength(1);
  });
});

describe('prestige-achievement readers use the claimed store', () => {
  it('getUnlockedPrestigeAchievements reads state.prestige.claimedPrestigeAchievements', () => {
    const state = createTestGameState({
      prestige: { ...defaultPrestigeData, claimedPrestigeAchievements: ['prestige_first'] },
    });
    const unlocked = getUnlockedPrestigeAchievements(state).map(a => a.id);
    expect(unlocked).toEqual(['prestige_first']);
  });

  it('getAvailablePrestigeAchievements excludes already-claimed satisfied achievements', () => {
    const state = createTestGameState({
      prestige: {
        ...defaultPrestigeData,
        totalPrestiges: 1,
        claimedPrestigeAchievements: ['prestige_first'],
      },
      loans: [{ id: 'l1', name: 'Paid off', principal: 5000, remaining: 0, rateAPR: 0.1 }],
      progress: { ...createTestGameState().progress, hasBeenInDebt: true },
    } as never);
    const available = getAvailablePrestigeAchievements(state).map(a => a.id);
    expect(available).not.toContain('prestige_first'); // claimed
    expect(available).toContain('prestige_no_debt'); // satisfied, not yet claimed
  });
});
