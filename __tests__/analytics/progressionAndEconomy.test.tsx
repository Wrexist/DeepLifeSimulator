/**
 * The progression and economy edges, asserted on the wire.
 *
 * WHY THESE ARE PINNED. Both events are EDGE-triggered from a component that
 * re-renders constantly, which is the shape that most easily degrades into
 * either silence or a flood — and neither failure is visible from the source.
 * A stage event that fires every week looks like healthy instrumentation until
 * someone tries to compute time-in-stage from it; a rollup that fires on every
 * render inflates the economy dashboard by whatever the render count happens to
 * be. These tests assert the edges, not the wording.
 */
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { AnalyticsTracker } from '@/lib/analytics/AnalyticsTracker';
import { GameStoreContext } from '@/contexts/game/useGameSelector';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';

const mockTrack = jest.fn();
jest.mock('@/lib/analytics', () => ({
  track: (...args: unknown[]) => mockTrack(...args),
  analytics: { flush: jest.fn(), track: jest.fn() },
}));

// The tracker gates every transition on hydration being finished; the real
// provider starts `isLoading: true`, which would make all of these no-ops.
jest.mock('@/contexts/game/GameUIContext', () => ({
  useGameUI: () => ({ isLoading: false }),
}));

jest.mock('@/services/subscriptionHealthMonitor', () => ({
  checkSubscriptionHealth: jest.fn(),
}));

/** A store whose snapshot can be swapped, so week advances are real re-renders. */
function mountWith(initial: Partial<GameState>) {
  let snapshot = createTestGameState(initial);
  const listeners = new Set<() => void>();
  const store = {
    subscribe: (fn: () => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getSnapshot: () => snapshot,
    setGameState: () => {},
  };

  act(() => {
    TestRenderer.create(
      <GameStoreContext.Provider value={store as never}>
        <AnalyticsTracker />
      </GameStoreContext.Provider>,
    );
  });

  return (next: Partial<GameState>) => {
    snapshot = createTestGameState({ ...initial, ...next });
    act(() => listeners.forEach((fn) => fn()));
  };
}

const calls = (name: string) => mockTrack.mock.calls.filter(([n]) => n === name);

beforeEach(() => mockTrack.mockClear());

describe('progression_stage', () => {
  it('fires on the EDGE between stages, not every week', () => {
    // lifeStartWeek pins the life clock, so weeksThisLife = weeksLived - 104.
    const advance = mountWith({ weeksLived: 104, lifeStartWeek: 104 });
    mockTrack.mockClear();

    advance({ weeksLived: 105 }); // week 1 — still `new`
    advance({ weeksLived: 106 }); // week 2 — still `new`
    expect(calls('progression_stage')).toHaveLength(0);

    advance({ weeksLived: 108 }); // week 4 — crosses into `early`
    expect(calls('progression_stage')).toHaveLength(1);

    advance({ weeksLived: 109 }); // week 5 — still `early`
    advance({ weeksLived: 120 }); // week 16 — still `early`
    expect(calls('progression_stage')).toHaveLength(1);
  });

  it('carries where it came from and how long that stage took', () => {
    // Without `weeksInPreviousStage` a drop-off is a number; with it, a stage
    // taking several times as long as the one before it is a difficulty spike.
    const advance = mountWith({ weeksLived: 104, lifeStartWeek: 104 });
    mockTrack.mockClear();

    advance({ weeksLived: 108 }); // → early at week 4
    advance({ weeksLived: 156 }); // → mid at week 52

    const [, props] = calls('progression_stage')[1];
    expect(props).toEqual(
      expect.objectContaining({
        stage: 'mid',
        fromStage: 'early',
        weeksThisLife: 52,
        weeksInPreviousStage: 48,
        direction: 'forward',
      }),
    );
  });

  it('a prestige moves the player to endgame even at week 1 of the new life', () => {
    // Classifying a prestiged player as `new` would push experienced players
    // into the new-player funnel and flatter onboarding drop-off.
    const prestige = createTestGameState({}).prestige!;
    const advance = mountWith({ weeksLived: 400, lifeStartWeek: 104 });
    mockTrack.mockClear();

    advance({ weeksLived: 400, lifeStartWeek: 400, prestige: { ...prestige, totalPrestiges: 1 } });

    const emitted = calls('progression_stage');
    expect(emitted).toHaveLength(1);
    expect(emitted[0][1]).toEqual(expect.objectContaining({ stage: 'endgame', totalPrestiges: 1 }));
  });

  it('emits nothing at mount for a returning player mid-ladder', () => {
    // The refs arm from the loaded values; a mount is not a transition.
    mountWith({ weeksLived: 500, lifeStartWeek: 104 });
    expect(calls('progression_stage')).toHaveLength(0);
  });
});

describe('economy_week', () => {
  it('samples one in-game MONTH apart, not every week', () => {
    const advance = mountWith({ weeksLived: 104, lifeStartWeek: 104 });
    // Week 0 is itself a sample boundary and emits the baseline at mount.
    const atMount = calls('economy_week').length;

    advance({ weeksLived: 105 });
    advance({ weeksLived: 106 });
    advance({ weeksLived: 107 });
    expect(calls('economy_week')).toHaveLength(atMount);

    advance({ weeksLived: 108 }); // week 4
    expect(calls('economy_week')).toHaveLength(atMount + 1);
  });

  it('does not re-emit for the same week across re-renders', () => {
    // The component re-renders on every state change; a rollup per render
    // would inflate the economy dashboard by the render count.
    const advance = mountWith({ weeksLived: 104, lifeStartWeek: 104 });
    advance({ weeksLived: 108 });
    const after = calls('economy_week').length;
    advance({ weeksLived: 108, stats: { ...createTestGameState({}).stats, health: 50 } });
    advance({ weeksLived: 108, stats: { ...createTestGameState({}).stats, health: 40 } });
    expect(calls('economy_week')).toHaveLength(after);
  });

  it('reports the money flow since the previous sample, as per-week rates', () => {
    const base = createTestGameState({ weeksLived: 104, lifeStartWeek: 104 });
    const advance = mountWith({
      weeksLived: 104,
      lifeStartWeek: 104,
      lifetimeStatistics: { ...base.lifetimeStatistics!, totalMoneyEarned: 0, totalMoneySpent: 0 },
    });

    advance({
      weeksLived: 108,
      lifetimeStatistics: { ...base.lifetimeStatistics!, totalMoneyEarned: 4000, totalMoneySpent: 1200 },
    });

    const [, props] = calls('economy_week')[calls('economy_week').length - 1];
    expect(props).toEqual(
      expect.objectContaining({
        earned: 4000,
        spent: 1200,
        netFlow: 2800,
        spanWeeks: 4,
        earnedPerWeek: 1000,
        weeksThisLife: 4,
      }),
    );
  });

  it('emits no NaN, whatever the state holds', () => {
    // A NaN in a rate column poisons every aggregate computed over it.
    const advance = mountWith({ weeksLived: 104, lifeStartWeek: 104 });
    advance({ weeksLived: 108 });
    for (const [, props] of calls('economy_week')) {
      for (const value of Object.values(props as Record<string, unknown>)) {
        if (typeof value === 'number') expect(Number.isFinite(value)).toBe(true);
      }
    }
  });
});

describe('screen_view stays on route edges', () => {
  it('does not re-fire on a week advance', () => {
    // The adoption hook reads `weeksLived` through a ref precisely so that this
    // effect keeps depending on the route alone. Making it a dependency would
    // emit a screen_view per week for a screen the player never left, inflating
    // the most-used event in the catalogue with rows that describe nothing.
    const advance = mountWith({ weeksLived: 104, lifeStartWeek: 104 });
    const atMount = calls('screen_view').length;
    advance({ weeksLived: 105 });
    advance({ weeksLived: 106 });
    advance({ weeksLived: 107 });
    expect(calls('screen_view')).toHaveLength(atMount);
  });
});
