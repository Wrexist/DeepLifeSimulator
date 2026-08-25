/**
 * Catalogue invariants.
 *
 * The `movable progress` test below is the reason this module exists. The
 * deleted `utils/goalSystem.ts` shipped six goals whose progress was pinned at
 * zero for the entire region in which they were visible, because each one's
 * `shouldShow` was the exact negation of its completion check — so the bar
 * could never move while the player was looking at it and the reward behind it
 * was unreachable code. Nothing caught that for the system's whole life. This
 * asserts the property structurally so it cannot ship a second time.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { GOAL_CATALOGUE } from '@/lib/goals/catalogue';

/**
 * A spread of states wide enough that every goal in the catalogue is eligible
 * in several of them, with the underlying quantity at different values.
 */
function probeStates(): GameState[] {
  return [
    createTestGameState(),
    createTestGameState({ stats: { money: 0, health: 20, happiness: 10 } }),
    createTestGameState({ stats: { money: 900, health: 55, happiness: 40 } }),
    createTestGameState({ stats: { money: 50_000 }, currentJob: 'tech' }),
    createTestGameState({ stats: { money: 5_000_000 }, currentJob: 'tech' }),
    // Passive-income probes. Without one, any goal measured against what the
    // player's ASSETS earn is eligible in zero states - which this file's own
    // movement invariant calls a gap in the probes, not a pass. Three levels:
    // two still climbing (so progress MOVES) and one already covering its
    // costs (so the achieved/ineligible branch is exercised too).
    createTestGameState({
      stats: { money: 20_000 },
      companies: [
        {
          id: 'probe-co-small', name: 'Probe Co', type: 'restaurant',
          weeklyIncome: 120, baseWeeklyIncome: 120, upgrades: [], employees: 1,
          workerSalary: 100, workerMultiplier: 1, marketingLevel: 0,
          miners: {}, warehouseLevel: 0,
        },
      ],
    }),
    createTestGameState({
      stats: { money: 400_000 },
      companies: [
        {
          id: 'probe-co-mid', name: 'Probe Holdings', type: 'factory',
          weeklyIncome: 250, baseWeeklyIncome: 250, upgrades: [], employees: 6,
          workerSalary: 200, workerMultiplier: 1, marketingLevel: 0,
          miners: {}, warehouseLevel: 0,
        },
      ],
    }),
    createTestGameState({
      stats: { money: 900_000 },
      companies: [
        {
          id: 'probe-co-fi', name: 'Probe Group', type: 'factory',
          weeklyIncome: 9_000, baseWeeklyIncome: 9_000, upgrades: [], employees: 8,
          workerSalary: 200, workerMultiplier: 1, marketingLevel: 0,
          miners: {}, warehouseLevel: 0,
        },
      ],
    }),
    createTestGameState({ overdueBalance: 500, stats: { money: 100 } }),
    createTestGameState({ overdueBalance: 500, stats: { money: 400 } }),
    createTestGameState({
      weeksLived: 200,
      lifeStartWeek: 100,
      stats: { money: 250_000 },
    }),
    createTestGameState({
      careers: [
        {
          id: 'tech',
          levels: [{ name: 'Junior', salary: 900 }, { name: 'Senior', salary: 2000 }],
          level: 0,
          description: '',
          requirements: {} as never,
          progress: 10,
          applied: true,
          accepted: true,
        },
      ],
      currentJob: 'tech',
    }),
    createTestGameState({
      careers: [
        {
          id: 'tech',
          levels: [{ name: 'Junior', salary: 900 }, { name: 'Senior', salary: 2000 }],
          level: 0,
          description: '',
          requirements: {} as never,
          progress: 80,
          applied: true,
          accepted: true,
        },
      ],
      currentJob: 'tech',
    }),
    createTestGameState({
      careers: [
        {
          id: 'tech',
          levels: [{ name: 'Junior', salary: 900 }],
          level: 0,
          description: '',
          requirements: {} as never,
          progress: 0,
          applied: true,
          accepted: false,
        },
      ],
      currentJob: undefined,
    }),
    createTestGameState({
      weeksLived: 500,
      lifeStartWeek: 100,
      relationships: [
        {
          id: 'r1',
          name: 'Alex',
          type: 'partner',
          relationshipScore: 40,
          personality: 'kind',
          age: 30,
          datesCount: 3,
        } as never,
      ],
    }),
    createTestGameState({
      weeksLived: 500,
      lifeStartWeek: 100,
      relationships: [
        {
          id: 'r1',
          name: 'Alex',
          type: 'partner',
          relationshipScore: 95,
          personality: 'kind',
          age: 30,
          datesCount: 9,
        } as never,
      ],
    }),
    // Mid-degree, and nearly finished — two points on the study bar.
    createTestGameState({
      educations: [
        { id: 'cs', name: 'Computer Science', description: '', cost: 20_000,
          duration: 40, completed: false, weeksRemaining: 36 },
      ],
    }),
    createTestGameState({
      educations: [
        { id: 'cs', name: 'Computer Science', description: '', cost: 20_000,
          duration: 40, completed: false, weeksRemaining: 4 },
      ],
    }),
    // Enough cash to start a business, but not the full target.
    createTestGameState({ stats: { money: 8_000 }, currentJob: 'tech' }),
    // One and then three doors — the portfolio bar between its endpoints.
    createTestGameState({
      realEstate: [
        { id: 'p1', name: 'Studio', price: 90_000, weeklyHappiness: 1,
          weeklyEnergy: 0, owned: true, interior: [], upgradeLevel: 0 },
      ] as never,
    }),
    createTestGameState({
      realEstate: [
        { id: 'p1', name: 'Studio', price: 90_000, weeklyHappiness: 1,
          weeklyEnergy: 0, owned: true, interior: [], upgradeLevel: 0 },
        { id: 'p2', name: 'Flat', price: 180_000, weeklyHappiness: 2,
          weeklyEnergy: 0, owned: true, interior: [], upgradeLevel: 0 },
        { id: 'p3', name: 'House', price: 400_000, weeklyHappiness: 3,
          weeklyEnergy: 0, owned: true, interior: [], upgradeLevel: 0 },
      ] as never,
    }),
    // Wealthy enough for the dynasty goal, at two very different distances.
    createTestGameState({ stats: { money: 60_000_000 } }),
    // One child — the family bar off its floor.
    createTestGameState({
      family: {
        children: [
          { id: 'c1', name: 'Sam', type: 'child', relationshipScore: 70,
            personality: 'curious', age: 4, datesCount: 0 } as never,
        ],
      },
    }),
    // One and then three companies — the empire bar between its endpoints.
    createTestGameState({
      companies: [
        { id: 'co1', name: 'A', type: 'factory', weeklyIncome: 1500, level: 1 } as never,
      ],
    }),
    createTestGameState({
      companies: [
        { id: 'co1', name: 'A', type: 'factory', weeklyIncome: 1500, level: 1 } as never,
        { id: 'co2', name: 'B', type: 'ai', weeklyIncome: 2200, level: 1 } as never,
        { id: 'co3', name: 'C', type: 'restaurant', weeklyIncome: 2600, level: 1 } as never,
      ],
    }),
    // A small and a mid-sized market portfolio — the investor bar between
    // rungs, at two distinct values.
    createTestGameState({
      stocks: { holdings: [{ symbol: 'AAA', shares: 100, currentPrice: 20 }] } as never,
    }),
    createTestGameState({
      stocks: { holdings: [{ symbol: 'AAA', shares: 1000, currentPrice: 30 }] } as never,
    }),
    // One entry-tier luxury item, then a finished entry set with a premium
    // piece — the collection bar on two different sets at two values.
    createTestGameState({ luxuryItems: ['rare_watch_collection'] }),
    createTestGameState({
      luxuryItems: ['rare_watch_collection', 'museum_diamond', 'fine_art_collection'],
    }),
    // A prestiged dynasty with nothing claimed, then with two contracts in —
    // the legacy-contracts bar off its floor.
    createTestGameState({
      prestige: { ...(createTestGameState().prestige as object), totalPrestiges: 2 } as never,
    }),
    createTestGameState({
      prestige: { ...(createTestGameState().prestige as object), totalPrestiges: 2 } as never,
      legacyContracts: { claimedIds: ['first_dynasty', 'first_million_total'] },
    }),
  ];
}

describe('goal catalogue invariants', () => {
  it('has unique ids', () => {
    const ids = GOAL_CATALOGUE.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('covers every horizon', () => {
    for (const horizon of ['now', 'soon', 'dream'] as const) {
      expect(GOAL_CATALOGUE.some((g) => g.horizon === horizon)).toBe(true);
    }
  });

  it('states its rationale and destination for every goal', () => {
    for (const goal of GOAL_CATALOGUE) {
      expect(goal.title.length).toBeGreaterThan(0);
      expect(goal.rationale.length).toBeGreaterThan(0);
      expect(goal.route.startsWith('/(tabs)/')).toBe(true);
    }
  });

  it('never derives a zero, negative or non-finite target', () => {
    // A non-positive target divides into NaN/Infinity progress, which renders
    // as an empty or overflowing bar rather than as a visible error.
    for (const state of probeStates()) {
      for (const goal of GOAL_CATALOGUE) {
        if (!goal.isEligible(state)) continue;
        const { target } = goal.measure(state);
        expect(Number.isFinite(target)).toBe(true);
        expect(target).toBeGreaterThan(0);
      }
    }
  });

  it('gives every goal progress that can MOVE while the goal is visible', () => {
    // THE INVARIANT. A goal whose progress takes exactly one value across its
    // whole eligible region is a goal the player can never see themselves
    // approaching — the defect that killed the previous goal system. Each goal
    // must show at least two distinct progress values across the probe set.
    const states = probeStates();
    const stuck: string[] = [];

    for (const goal of GOAL_CATALOGUE) {
      const values = new Set<number>();
      for (const state of states) {
        if (!goal.isEligible(state)) continue;
        const { current, target } = goal.measure(state);
        values.add(Math.max(0, Math.min(1, current / target)));
      }
      // A goal eligible in no probe state is a gap in the probes, not a pass.
      if (values.size < 2) stuck.push(`${goal.id} (${values.size} distinct value(s))`);
    }

    expect(stuck).toEqual([]);
  });
});
