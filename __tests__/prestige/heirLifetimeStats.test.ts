/**
 * The death → heir path must feed the LIFETIME ledger (2026-08-25 round 2).
 *
 * `continueAsChild` preserved prestige data verbatim - right for points and
 * the prestige count (an heir is not a prestige), wrong for `lifetimeStats`:
 * a dynasty played through deaths, never prestiging, accrued NOTHING toward
 * the weeks/peak-net-worth Legacy Contracts, and `maxNetWorth` under-reported
 * forever. The prestige path and this path are disjoint (a life ends through
 * exactly one), so accumulating here cannot double-count.
 */
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { continueAsChild } from '@/lib/prestige/prestigeExecution';
import { netWorth } from '@/lib/progress/achievements';

function dyingParentState(): GameState {
  const base = createTestGameState();
  return {
    ...base,
    weeksLived: 2_600,
    lifeStartWeek: 0,
    stats: { ...base.stats, money: 3_000_000 },
    family: {
      ...base.family,
      children: [
        {
          id: 'kid1', name: 'Sam', type: 'child', relationshipScore: 80,
          personality: 'curious', age: 20, datesCount: 0,
        } as never,
      ],
    },
  };
}

describe('continueAsChild lifetime stats', () => {
  it('accumulates the ended life into lifetimeStats without touching the prestige count', () => {
    const oldState = dyingParentState();
    const before = oldState.prestige?.lifetimeStats;
    const next = continueAsChild(oldState, 'kid1');
    const after = next.prestige?.lifetimeStats;

    expect(after?.totalWeeksLived).toBe((before?.totalWeeksLived ?? 0) + 2_600);
    expect(after?.maxNetWorth ?? 0).toBeGreaterThanOrEqual(netWorth(oldState));
    // NOT a prestige: no points, no count increment.
    expect(next.prestige?.totalPrestiges).toBe(oldState.prestige?.totalPrestiges ?? 0);
    expect(next.prestige?.prestigePoints).toBe(oldState.prestige?.prestigePoints ?? 0);
  });
});
