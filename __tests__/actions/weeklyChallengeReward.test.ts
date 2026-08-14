/**
 * Weekly Challenge Reward Pipeline
 *
 * Verifies the auto-grant of a weekly challenge's reward on first completion,
 * driven through the REAL production `nextWeek()` tick in
 * contexts/game/GameActionsContext.tsx (the reward logic lives inside that
 * ~1900-line updater, so we mount the actual GameProvider and inject state
 * rather than unit-testing a pure function).
 *
 * Guarantees under test:
 *  (a) Completing a weekly challenge grants its gem reward to stats.gems,
 *      sets weeklyChallenge.rewardClaimed = true, and awards exactly
 *      LEGACY_PASS_XP.weeklyChallenge (50) Legacy Pass XP.
 *  (b) Repeat ticks never double-grant — the persisted rewardClaimed flag
 *      makes the grant idempotent.
 *
 * Uses React.createElement (not JSX) so the file stays .ts, matching the
 * existing realProviderLoop.stress.test.ts pattern.
 */

// Bypass the heavy SaveQueue pipeline (HMAC over ~100KB) — irrelevant here and
// far too slow. The save path is covered elsewhere.
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { LEGACY_PASS_XP } from '@/lib/legacyPass/legacyPass';
import { getWeeklyChallengeDefinition } from '@/lib/challenges/weeklyChallenges';

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
  captured = {
    state: gameState,
    setGameState,
    nextWeek: actions.nextWeek as () => Promise<void> | void,
  };
  return null;
}

function mountGame(): { root: any } {
  captured = null;
  let root: any;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as any, null, h(GameProvider as any, null, h(ProbeComponent)))
    );
  });
  return { root };
}

async function apply(mutate: (prev: GameState) => GameState) {
  await act(async () => {
    captured!.setGameState(mutate);
    await Promise.resolve();
  });
}

async function tick() {
  if (!captured) throw new Error('Probe not initialized');
  await act(async () => {
    await captured!.nextWeek();
    await Promise.resolve();
  });
}

// The 'wc_scholar' challenge: 2 completed educations, $10K+, 40+ reputation,
// 60+ health. We craft state comfortably above every threshold so the in-tick
// stat decay / income never drops an objective below target. startedAt = now so
// getOrRotateWeeklyChallenge keeps our injected challenge (no rotation).
function injectCompletableScholarChallenge(prev: GameState): GameState {
  return {
    ...prev,
    stats: { ...prev.stats, money: 250_000, reputation: 80, health: 100, gems: 100 },
    educations: [
      { id: 'edu_a', name: 'A', description: '', cost: 0, duration: 0, completed: true } as any,
      { id: 'edu_b', name: 'B', description: '', cost: 0, duration: 0, completed: true } as any,
    ],
    weeklyChallenge: {
      challengeId: 'wc_scholar',
      startedAt: Date.now(),
      progress: [],
      completed: false,
      rewardClaimed: false,
    },
  };
}

describe('Weekly Challenge Reward Pipeline (real nextWeek)', () => {
  jest.setTimeout(120_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  it('grants gems + sets rewardClaimed + awards weekly XP exactly once, idempotent on repeat ticks', async () => {
    mounted = mountGame();

    // Sanity: the factory-built fixture satisfies the helper's invariants.
    expect(createTestGameState().weeklyChallenge).toBeUndefined();

    const reward = getWeeklyChallengeDefinition('wc_scholar')!.reward;
    expect(reward).toBeGreaterThan(0);

    await apply(injectCompletableScholarChallenge);

    const gemsBefore = captured!.state.stats.gems ?? 0;
    const xpBefore = captured!.state.legacyPass?.xp ?? 0;

    // ── First tick: challenge completes, reward auto-grants ──
    await tick();

    const wcAfter1 = captured!.state.weeklyChallenge!;
    expect(wcAfter1.challengeId).toBe('wc_scholar');
    expect(wcAfter1.completed).toBe(true);
    expect(wcAfter1.rewardClaimed).toBe(true);

    // Gems credited by exactly the challenge reward.
    expect(captured!.state.stats.gems).toBe(gemsBefore + reward);
    // Legacy Pass XP credited by exactly the weekly-challenge XP source.
    expect(captured!.state.legacyPass?.xp).toBe(xpBefore + LEGACY_PASS_XP.weeklyChallenge);

    const gemsAfter1 = captured!.state.stats.gems ?? 0;
    const xpAfter1 = captured!.state.legacyPass?.xp ?? 0;

    // ── Second tick: must NOT re-grant (rewardClaimed guards it) ──
    await tick();

    expect(captured!.state.weeklyChallenge!.rewardClaimed).toBe(true);
    expect(captured!.state.stats.gems).toBe(gemsAfter1);
    expect(captured!.state.legacyPass?.xp).toBe(xpAfter1);

    // ── Third tick: still idempotent ──
    await tick();
    expect(captured!.state.stats.gems).toBe(gemsAfter1);
    expect(captured!.state.legacyPass?.xp).toBe(xpAfter1);
  });
});
