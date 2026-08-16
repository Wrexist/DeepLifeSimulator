/**
 * A corrupt enrolment must cost the education tick, NOT the week.
 *
 * `applyEducationProgression` ran bare inside the week updater. The only thing
 * catching a throw from it was the updater's own outer catch, which returns
 * `prevState` — so one malformed education record did not degrade, it rolled the
 * ENTIRE tick back: no advance, no income, no aging, no error the player can
 * see. And because the bad record is part of the save, it recurs on every
 * attempt: "Next Week" is dead forever. `CLAUDE.md` §4.3.
 *
 * That is the class this file pins, end to end, through the REAL provider — the
 * guard now lives at the call site (`guardTick('educationProgression', …)`), so a
 * subsystem-level unit test could not observe it.
 *
 * The poison is a completing program whose `enrolledClasses` is an object rather
 * than an array: the completion path does `for (const cls of edu.enrolledClasses)`
 * on a truthy non-iterable, which throws. Exactly the shape a partially-repaired
 * or hand-edited save produces.
 */
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { Education, GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';

// Same reason as realProviderLoop.stress.test.ts: the production save pipeline
// (HMAC over a ~100KB payload) costs seconds per tick and is covered elsewhere.
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

function mountGame(): { root: unknown } {
  captured = null;
  let root: unknown;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as any, null, h(GameProvider as any, null, h(ProbeComponent))),
    );
  });
  return { root: root! };
}

async function tick() {
  if (!captured) throw new Error('Probe not initialized');
  await act(async () => {
    await captured!.nextWeek();
    await Promise.resolve();
  });
}

/** A program that finishes THIS tick and throws on the completion path. */
function poisonedEducation(): Education {
  return {
    id: 'corrupt-degree',
    name: 'Corrupt Degree',
    description: 'A degree record a save repair left half-written.',
    cost: 0,
    duration: 52,
    completed: false,
    paused: false,
    weeksRemaining: 1,
    // Not an array — `for (const cls of …)` throws on it. A repaired/edited save
    // can genuinely carry this shape; the type says otherwise, which is the
    // point: the tick must survive data its types say cannot exist.
    enrolledClasses: {} as unknown as Education['enrolledClasses'],
  };
}

/** Install a state through the provider so the tick reads it as `prevState`. */
async function installState(state: GameState) {
  await act(async () => {
    captured!.setGameState(() => state);
    await Promise.resolve();
  });
}

describe('a throwing education record does not cost the player the week', () => {
  jest.setTimeout(120_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  it('the poison really does throw the subsystem (the premise)', () => {
    // If this ever stops throwing, the test below passes for the wrong reason.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { applyEducationProgression } = require('@/contexts/game/actions/weekly/applyEducationProgression');
    expect(() =>
      applyEducationProgression(
        {
          prevEducations: [poisonedEducation()],
          nextWeeksLived: 10,
          goldFastLearner: false,
          perkFastLearner: false,
          experienceMultiplier: 1,
        },
        {
          newStats: { ...createTestGameState().stats },
          notifications: [],
          nextWeeksLived: 10,
          preRolls: undefined,
        },
      ),
    ).toThrow();
  });

  it('weeksLived still advances', async () => {
    mounted = mountGame();
    await installState(
      createTestGameState({
        weeksLived: 40,
        educations: [poisonedEducation()],
      }),
    );

    const before = captured!.state.weeksLived;
    await tick();

    // Pre-fix this stayed put — the outer catch returned prevState — and stayed
    // put on every subsequent tap, permanently.
    expect(captured!.state.weeksLived).toBe(before + 1);
  });

  it('the rest of the tick still runs: the week is not silently rolled back', async () => {
    mounted = mountGame();
    await installState(
      createTestGameState({
        weeksLived: 40,
        educations: [poisonedEducation()],
      }),
    );

    const beforeAge = captured!.state.date.age;
    await tick();

    // Aging is applied late in the same updater, so it only moves if the tick
    // got past the education block and actually committed.
    expect(captured!.state.date.age).toBeGreaterThan(beforeAge);
    expect(Number.isFinite(captured!.state.stats.money)).toBe(true);
  });

  it('the education is left exactly as it was — skipped, not half-applied', async () => {
    mounted = mountGame();
    await installState(
      createTestGameState({
        weeksLived: 40,
        educations: [poisonedEducation()],
      }),
    );

    await tick();

    const edu = captured!.state.educations?.[0];
    expect(edu?.id).toBe('corrupt-degree');
    // The fallback is the pre-call array: progression did not happen, and did
    // not invent a completion either.
    expect(edu?.completed).toBe(false);
    expect(edu?.weeksRemaining).toBe(1);
  });

  it('a healthy education still progresses (the control)', async () => {
    mounted = mountGame();
    await installState(
      createTestGameState({
        weeksLived: 40,
        educations: [{ ...poisonedEducation(), id: 'ok-degree', weeksRemaining: 10, enrolledClasses: [] }],
      }),
    );

    await tick();

    // The guard must not have turned the subsystem into a no-op.
    expect(captured!.state.educations?.[0]?.weeksRemaining).toBeLessThan(10);
  });
});
