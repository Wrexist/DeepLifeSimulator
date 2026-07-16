/**
 * Audit-fix regressions driven through the REAL production `nextWeek()` tick
 * (contexts/game/GameActionsContext.tsx), mounting the actual GameProvider —
 * the fixed logic lives inside that ~2000-line updater, so we inject state and
 * advance rather than unit-testing pure functions.
 *
 * FIX 2 — anniversary grant now runs in the tick (not a ContactsApp effect), so
 *          it lands for every married player regardless of which screen is open,
 *          exactly once per year.
 * FIX 3 — a weekly challenge first completed on its exact rotation week still
 *          pays out (the reward used to be lost when rotation replaced it before
 *          the completion/reward block ran).
 *
 * React.createElement (not JSX) so the file stays .ts — matches the sibling
 * weeklyChallengeReward.test.ts harness.
 */

// Bypass the heavy SaveQueue pipeline (HMAC over ~100KB) — irrelevant here.
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

import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState, Relationship } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { getWeeklyChallengeDefinition } from '@/lib/challenges/weeklyChallenges';

const { act } = TestRenderer;
const h = React.createElement;

const MARRIAGE_BOUNDARY = 200 + WEEKS_PER_YEAR; // 252 — first 1-year anniversary week

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

function anniversaryMilestones(s: GameState) {
  return (s.lifeMilestones ?? []).filter((m) => m.type === 'anniversary');
}

describe('Audit fixes through the real nextWeek() tick', () => {
  jest.setTimeout(120_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  // ── FIX 2: anniversary grant in the tick, no Contacts screen ──────────────
  it('grants the marriage anniversary in the tick (no Contacts open) exactly once', async () => {
    mounted = mountGame();

    // weeksLived 251 → nextWeeksLived 252; marriageWeek 200 → 252-200 = 52 = 1yr.
    await apply((prev) => ({
      ...prev,
      weeksLived: MARRIAGE_BOUNDARY - 1,
      stats: { ...prev.stats, happiness: 50, energy: 100 },
      lifeMilestones: [],
      relationships: [
        {
          id: 'sp',
          name: 'Robin',
          type: 'spouse',
          relationshipScore: 85,
          marriageWeek: 200,
          anniversaryWeek: 200,
        } as Relationship,
      ],
    }));

    expect(anniversaryMilestones(captured!.state).length).toBe(0);
    const happinessBefore = captured!.state.stats.happiness;

    // ── Tick that crosses the 52-week boundary ──
    await tick();

    const anniv1 = anniversaryMilestones(captured!.state);
    expect(anniv1.length).toBe(1);
    expect((anniv1[0].details as { yearsMarried: number }).yearsMarried).toBe(1);
    // +11 happiness dwarfs the small weekly decay, so happiness rises.
    expect(captured!.state.stats.happiness).toBeGreaterThan(happinessBefore);

    // ── Next tick: past the boundary + idempotent guard → no second grant ──
    await tick();
    expect(anniversaryMilestones(captured!.state).length).toBe(1);
  });

  // ── FIX 3: challenge completed on its exact rotation week keeps its reward ──
  it('pays out a weekly challenge first completed on its rotation week (not lost to rotation)', async () => {
    mounted = mountGame();
    const scholarReward = getWeeklyChallengeDefinition('wc_scholar')!.reward;
    expect(scholarReward).toBeGreaterThan(0);

    // weeksLived 15 → nextWeeksLived 16. startedWeek 12 → 16-12 = 4 → rotates.
    // Objectives (2 educations, $10K, 40 rep, 60 health) are ALL satisfied only
    // on this rotation tick. The incoming challenge for week 16 is wc_tycoon
    // (2 companies / $1M / 10 employees) — unsatisfiable here, so only the
    // OUTGOING wc_scholar reward should land.
    await apply((prev) => ({
      ...prev,
      weeksLived: 15,
      stats: { ...prev.stats, money: 250_000, reputation: 80, health: 100, gems: 100 },
      educations: [
        { id: 'edu_a', name: 'A', description: '', cost: 0, duration: 0, completed: true } as any,
        { id: 'edu_b', name: 'B', description: '', cost: 0, duration: 0, completed: true } as any,
      ],
      weeklyChallenge: {
        challengeId: 'wc_scholar',
        startedAt: Date.now(),
        startedWeek: 12,
        progress: [],
        completed: false,
        rewardClaimed: false,
      },
    }));

    const gemsBefore = captured!.state.stats.gems ?? 0;
    expect(captured!.state.weeklyChallenge!.challengeId).toBe('wc_scholar');
    expect(captured!.state.weeklyChallenge!.completed).toBe(false);

    // ── Tick on the rotation week: challenge both completes AND rotates ──
    await tick();

    // The challenge rotated away …
    expect(captured!.state.weeklyChallenge!.challengeId).not.toBe('wc_scholar');
    // … but the outgoing wc_scholar reward was granted (exactly its value, so the
    // freshly-rotated challenge did not also pay out).
    expect(captured!.state.stats.gems).toBe(gemsBefore + scholarReward);
  });
});
