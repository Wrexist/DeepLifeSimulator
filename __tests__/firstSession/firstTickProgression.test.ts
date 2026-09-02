/**
 * Master Program 6 - progressive discovery on the REAL tick.
 *
 * Measured in the browser: a Quick Start showed "Locked (6)" on the Apps grid
 * at week 0 and "Locked (1)" after ONE Next Week, with $1,642 in cash and
 * padlocks reading "Finish Chapter 2: Settling In". The tick stamped
 * `lifetimeStatistics.peakNetWorth` from preTick's private net worth, which
 * counts owned Market items (bike + smartphone = $1,050), and `wealthMark`
 * ratchets on that peak. This runs the real provider loop on the real
 * onboarding seed and pins the ladder.
 */
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { buildNewGameState } from '@/src/features/onboarding/gameStateBuilder';
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import * as scenarioData from '@/src/features/onboarding/scenarioData';
import { unlockTier, unlockRequirement, isFeatureUnlocked } from '@/lib/progress/featureUnlocks';
import { netWorth } from '@/lib/progress/achievements';

// The production save pipeline (HMAC over a ~100KB payload) costs seconds per
// tick and is covered elsewhere - same stub as the other real-loop tests.
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

function mountGame(): { root: any } {
  captured = null;
  let root: any;
  act(() => {
    root = TestRenderer.create(h(UIUXProvider as any, null, h(GameProvider as any, null, h(ProbeComponent))));
  });
  return { root };
}

async function tick() {
  await act(async () => {
    await captured!.nextWeek();
    await Promise.resolve();
  });
}

async function installState(state: GameState) {
  await act(async () => {
    captured!.setGameState(() => state);
    await Promise.resolve();
  });
}

/** The state "Play" actually seeds: the food_courier quick start. */
function quickStart(): GameState {
  const lists = Object.values(scenarioData).filter((v): v is any[] => Array.isArray(v));
  const scenario = lists.flat().find((s) => s?.id === 'food_courier');
  expect(scenario).toBeTruthy();
  return buildNewGameState({
    initialGameState,
    stateVersion: STATE_VERSION,
    firstName: 'New',
    lastName: 'Player',
    sex: 'male',
    sexuality: 'straight',
    scenario,
    selectedPerks: [],
    permanentPerks: [],
    selectedMindset: null,
  }) as GameState;
}

describe('the first tick of a quick start does not open the mid-game', () => {
  jest.setTimeout(120_000);
  let mounted: { root: any } | null = null;
  afterEach(() => {
    if (mounted) act(() => mounted!.root.unmount());
    mounted = null;
    captured = null;
  });

  it('seeds tier 1 with the padlocks the grid shows, and one Next Week keeps them', async () => {
    mounted = mountGame();
    const seed = quickStart();
    expect(seed.stats.money).toBe(1_500);
    expect(unlockTier(seed)).toBe(1);
    expect(isFeatureUnlocked(seed, 'app:tinder')).toBe(false);
    expect(unlockRequirement(seed, 'app:tinder')).toMatch(/Chapter 2/);

    await installState(seed);
    await tick();
    const after = captured!.state;
    expect(after.weeksLived).toBe(seed.weeksLived + 1);

    // The peak records the number the HUD shows, not cash plus owned items.
    const peak = after.lifetimeStatistics?.peakNetWorth ?? 0;
    expect(peak).toBeLessThanOrEqual(netWorth(after) + 1);
    expect(peak).toBeLessThan(2_000);

    // So the ladder holds: still tier 1, Spark still behind Chapter 2.
    expect(unlockTier(after)).toBe(1);
    expect(isFeatureUnlocked(after, 'app:tinder')).toBe(false);
  });
});
