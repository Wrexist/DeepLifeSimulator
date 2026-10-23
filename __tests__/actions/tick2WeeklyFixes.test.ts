/**
 * Second weekly-tick audit (2026-10-23) - driven through the REAL `nextWeek()`.
 *
 *  TICK2-1  Mid-tick energy reducers capped at 100 as they went, so the regen
 *           surplus was discarded at the first one and every later drain was
 *           charged from 100. The HUD projection (a plain sum, capped once)
 *           said a homeless farmhand resting at full energy stays at 100; the
 *           tick gave 95.
 *  TICK2-3  Owned items' weekly happiness (the bed's +5) was added before the
 *           decay baseline, so the diminishing-returns curve never saw it.
 *  TICK2-4  A weekly challenge whose id the catalogue no longer defines
 *           evaluated to zero objectives, `[].every(...)` is true, and it was
 *           marked complete and paid its Legacy Pass XP.
 */
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { projectWeeklyVitalDrift } from '@/lib/economy/vitalDrift';
import { RENTAL_TIERS } from '@/lib/realEstate/rentals';

jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');

const { act } = TestRenderer;
const h = React.createElement;

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  nextWeek: () => Promise<void> | void;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const actions = useGameActions();
  captured = { state: gameState, setGameState, nextWeek: actions.nextWeek as () => Promise<void> | void };
  return null;
}

let mounted: { root: any } | null = null;

function mountGame(): void {
  captured = null;
  act(() => {
    mounted = { root: TestRenderer.create(h(UIUXProvider as any, null, h(GameProvider as any, null, h(ProbeComponent)))) };
  });
}

async function load(state: GameState): Promise<void> {
  await act(async () => {
    captured!.setGameState(() => state);
    await Promise.resolve();
  });
}

async function tick(): Promise<GameState> {
  await act(async () => {
    await captured!.nextWeek();
    await Promise.resolve();
  });
  return captured!.state;
}

/** A quiet, healthy life: no job, no courses, nothing owned. */
function quietLife(): GameState {
  const base = createTestGameState();
  return {
    ...base,
    lineageId: 'tick2-fixture',
    currentJob: undefined,
    educations: [],
    pets: [],
    vehicles: [],
    diseases: [],
    pendingEvents: [],
    items: (base.items ?? []).map((i) => ({ ...i, owned: false })),
    stats: { ...base.stats, health: 90, happiness: 60, energy: 100, fitness: 60, money: 50_000 },
  };
}

afterEach(() => {
  if (mounted) {
    const root = mounted.root;
    act(() => root.unmount());
    mounted = null;
  }
  captured = null;
});

describe('second weekly-tick audit (real nextWeek)', () => {
  jest.setTimeout(120_000);

  it('TICK2-1: a homeless farmhand resting at full energy ends where the HUD projection says', async () => {
    mountGame();
    const life = quietLife();
    const state: GameState = {
      ...life,
      rental: undefined,
      currentJob: 'farmer',
      careers: (life.careers ?? []).map((c) => (c.id === 'farmer' ? { ...c, accepted: true, applied: true, level: 0 } : c)),
    };
    const drift = projectWeeklyVitalDrift(state);
    // The case the bug lived in: a job drain AND a housing drain after regen.
    expect(drift.causes.find((c) => c.id === 'job')?.energy).toBeLessThan(0);
    expect(drift.causes.find((c) => c.id === 'home')?.energy).toBeLessThan(0);
    const projected = Math.max(0, Math.min(100, state.stats.energy + drift.energy));

    await load(state);
    const after = await tick();
    expect(after.weeksLived).toBe(state.weeksLived + 1);
    // 100 + 40 - 18 - 5 = 117 -> 100. Capping at the job first gave 95.
    expect(after.stats.energy).toBe(projected);
  });

  it('TICK2-3: the bed\'s weekly happiness goes through the diminishing-returns curve', async () => {
    mountGame();
    // Homeless and alone, so every OTHER happiness movement this week is a
    // loss: without the bed the week is net-negative and passes through
    // unscaled. With it the week nets +1, so the curve applies - but only if
    // the bed's +5 is counted as part of the week's gain.
    const life: GameState = {
      ...quietLife(),
      rental: undefined,
      relationships: [],
      stats: { ...quietLife().stats, happiness: 90 },
    };
    const withBed: GameState = {
      ...life,
      items: life.items.map((i) => (i.id === 'basic_bed' ? { ...i, owned: true } : i)),
    };
    const bedHappiness = withBed.items.find((i) => i.id === 'basic_bed')?.dailyBonus?.happiness ?? 0;
    expect(bedHappiness).toBeGreaterThan(0);

    await load(life);
    const without = await tick();
    await load(withBed);
    const withIt = await tick();
    // Measured from after natural decay (the curve's baseline): homelessness
    // costs 4, the bed adds 5, so only the bed week has a net gain to scale.
    expect(withIt.stats.happiness).toBeGreaterThan(without.stats.happiness);

    // At 90 the curve tapers a gain hard, so the bed adds visibly LESS than its
    // face value. Folded in before the baseline it bypassed the curve and the
    // two lives differed by exactly +5.
    expect(withIt.stats.happiness - without.stats.happiness).toBeLessThan(bedHappiness - 0.25);
  });

  it('TICK2-4: a challenge the catalogue no longer defines is not completed or paid', async () => {
    mountGame();
    const life = quietLife();
    const state: GameState = {
      ...life,
      weeklyChallenge: {
        challengeId: 'wc_retired_challenge',
        startedAt: 0,
        startedWeek: life.weeksLived,
        progress: [],
        completed: false,
        rewardClaimed: false,
      },
    };
    const xpBefore = state.legacyPass?.xp ?? 0;
    const gemsBefore = state.stats.gems ?? 0;

    await load(state);
    const after = await tick();
    expect(after.weeklyChallenge?.completed).not.toBe(true);
    expect(after.weeklyChallenge?.rewardClaimed).not.toBe(true);
    expect(after.legacyPass?.xp ?? 0).toBe(xpBefore);
    expect(after.stats.gems ?? 0).toBe(gemsBefore);
  });
});
