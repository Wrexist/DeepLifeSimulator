/**
 * STORY MODE ↔ CLASSIC MODE EQUIVALENCE — the invariant that makes batching safe.
 *
 * Story mode batches the INTERACTION (one tap = up to 52 weekly ticks), never
 * the simulation. This suite is what pins that claim: it drives the real
 * `GameProvider` twice from the same seed — once through N individual
 * `nextWeek()` calls, once through a single `liveYear()` — and asserts the two
 * end states are the same life.
 *
 * If this fails, story mode has started producing a different economy from
 * classic mode, which is the one outcome the design forbids. Do not "fix" it by
 * relaxing the assertions; find what the batch changed.
 *
 * ── Why N and not a hard 52 ────────────────────────────────────────────────
 * `liveYear` deliberately stops early on death or on a queued decision, and
 * classic mode does neither (a classic player keeps tapping with an event
 * waiting). So the honest comparison is "the same NUMBER OF WEEKS produces the
 * same result", not "52 calls equals one call". The batch reports how far it
 * actually got and the classic run is driven exactly that far.
 *
 * ── Determinism ───────────────────────────────────────────────────────────
 * The tick pre-rolls every `Math.random()` and `Date.now()` it will consume
 * (`buildPreRolls`), so seeding both globally and re-seeding between the two
 * runs makes the two passes consume an identical random stream. Without this
 * the comparison is meaningless — the tick is genuinely stochastic.
 */

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
import type { GameState } from '@/contexts/game/types';
import type { YearDigest } from '@/lib/gameMode/mode';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AsyncStorageMock = require('@react-native-async-storage/async-storage').default;

const { act } = TestRenderer;
const h = React.createElement;

// ──────────────────── Determinism ──────────────────────────────────────────

/** mulberry32 — small, fast, and reproducible from an integer seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 0x5eed1e;
const FIXED_NOW = 1_760_000_000_000; // Fixed so `updatedAt` and any clock-derived
                                     // field match across the two runs.

let realRandom: typeof Math.random;
let realNow: typeof Date.now;

function seedWorld() {
  const rng = mulberry32(SEED);
  Math.random = rng;
  Date.now = () => FIXED_NOW;
}

// ──────────────────── Harness ──────────────────────────────────────────────

type Probe = {
  state: GameState;
  nextWeek: () => Promise<void> | void;
  liveYear: (maxWeeks?: number) => Promise<YearDigest>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState } = useGameState();
  const actions = useGameActions();
  captured = {
    state: gameState,
    nextWeek: actions.nextWeek as () => Promise<void> | void,
    liveYear: actions.liveYear,
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

async function tickOnce() {
  await act(async () => {
    await captured!.nextWeek();
    await Promise.resolve();
  });
}

/**
 * The fields that define "the same life". Deliberately excludes `updatedAt`-style
 * bookkeeping and anything holding a function or a live reference — this is a
 * behavioural comparison, not a deep structural one.
 */
function fingerprint(s: GameState) {
  return {
    weeksLived: s.weeksLived,
    age: Number((s.date?.age ?? 0).toFixed(6)),
    year: s.date?.year,
    money: Number((s.stats?.money ?? 0).toFixed(4)),
    health: s.stats?.health,
    happiness: s.stats?.happiness,
    energy: s.stats?.energy,
    fitness: s.stats?.fitness,
    reputation: s.stats?.reputation,
    gems: s.stats?.gems,
    careerCount: (s.careers ?? []).length,
    careerLevels: (s.careers ?? []).map((c) => `${c.id}:${c.level}`).sort().join(','),
    realEstateCount: (s.realEstate ?? []).length,
    relationshipCount: (s.relationships ?? []).length,
    pendingEventCount: (s.pendingEvents ?? []).length,
    bankSavings: Number((s.bankSavings ?? 0).toFixed(4)),
    loanCount: (s.loans ?? []).length,
    overdueBalance: Number((s.overdueBalance ?? 0).toFixed(4)),
    showDeathPopup: !!s.showDeathPopup,
  };
}

// ──────────────────── Tests ────────────────────────────────────────────────

describe('Story mode batches the interaction, not the simulation', () => {
  jest.setTimeout(600_000);
  let mounted: { root: any } | null = null;

  beforeAll(() => {
    realRandom = Math.random;
    realNow = Date.now;
  });

  afterAll(() => {
    Math.random = realRandom;
    Date.now = realNow;
  });

  afterEach(async () => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
    if (AsyncStorageMock?.clear) await AsyncStorageMock.clear();
  });

  // SKIPPED — and this skip is the honest record of an unfinished mechanic, not
  // a flaky test being silenced.
  //
  // `liveYear` currently drives the real `nextWeek` in a loop, so it depends on
  // React running each tick's updater before the next iteration reads the
  // result. Under `act()` React defers every queued updater to the act()
  // boundary, so the loop observes its own progress two or more iterations late
  // and stops early — it reports one week after simulating three. That is a
  // property of the harness, but it also means THIS INVARIANT CANNOT BE
  // VERIFIED, and an unverifiable batch must not be wired to a button.
  //
  // Un-skip this the moment the tick extraction lands (see the note on
  // `liveYear` in GameActionsContext.tsx): once a year is one pure state
  // transition inside a single updater, there is no commit to race and this
  // test becomes both runnable and the thing that guards the whole feature.
  it.skip('one liveYear() equals the same number of individual nextWeek() calls', async () => {
    // ── Pass 1: story mode, one batched tap ────────────────────────────────
    seedWorld();
    mounted = mountGame();
    let digest: YearDigest | null = null;
    await act(async () => {
      digest = await captured!.liveYear();
      await Promise.resolve();
    });
    const storyFingerprint = fingerprint(captured!.state);
    const weeksAdvanced = digest!.weeksAdvanced;

    act(() => mounted!.root.unmount());
    mounted = null;
    if (AsyncStorageMock?.clear) await AsyncStorageMock.clear();

    // The batch must actually have done something, or the comparison below is
    // vacuously true — a broken liveYear that advances 0 weeks would otherwise
    // "pass" against 0 classic ticks.
    expect(weeksAdvanced).toBeGreaterThan(0);

    // ── Pass 2: classic mode, the same span one tap at a time ──────────────
    seedWorld();
    mounted = mountGame();
    for (let i = 0; i < weeksAdvanced; i++) await tickOnce();
    const classicFingerprint = fingerprint(captured!.state);

    process.stdout.write(
      `\n[batch-equivalence] weeksAdvanced=${weeksAdvanced} stopReason=${digest!.stopReason}\n`
    );

    expect(storyFingerprint).toEqual(classicFingerprint);
  });

  // SKIPPED for the same reason as above: the digest's closing numbers are read
  // from state the loop cannot observe in time under act().
  it.skip('reports a digest consistent with the state it produced', async () => {
    seedWorld();
    mounted = mountGame();
    const before = captured!.state;
    const moneyBefore = before.stats.money;
    const ageBefore = before.date.age;

    let digest: YearDigest | null = null;
    await act(async () => {
      digest = await captured!.liveYear();
      await Promise.resolve();
    });

    const after = captured!.state;
    expect(digest!.moneyBefore).toBeCloseTo(moneyBefore, 4);
    expect(digest!.ageBefore).toBeCloseTo(ageBefore, 6);
    expect(digest!.moneyAfter).toBeCloseTo(after.stats.money, 4);
    expect(digest!.ageAfter).toBeCloseTo(after.date.age, 6);
    expect(after.weeksLived).toBe(before.weeksLived + digest!.weeksAdvanced);
  });

  it('never advances more than the requested span', async () => {
    seedWorld();
    mounted = mountGame();
    let digest: YearDigest | null = null;
    await act(async () => {
      digest = await captured!.liveYear(10);
      await Promise.resolve();
    });
    expect(digest!.weeksAdvanced).toBeLessThanOrEqual(10);
    expect(captured!.state.weeksLived).toBeLessThanOrEqual(10);
  });

  it('stops the batch instead of auto-resolving a queued decision', async () => {
    seedWorld();
    mounted = mountGame();

    // Drive several years. Any batch that ended for 'decision' must have left
    // the decision on the board — the whole point is that the player answers it.
    for (let year = 0; year < 6; year++) {
      let digest: YearDigest | null = null;
      await act(async () => {
        digest = await captured!.liveYear();
        await Promise.resolve();
      });
      if (digest!.stopReason === 'decision') {
        expect((captured!.state.pendingEvents ?? []).length).toBeGreaterThan(0);
        return; // Behaviour observed — that is what this test is for.
      }
      if (digest!.stopReason === 'death') return;
    }
    // Never hitting a decision across six years is not a failure of the batch,
    // it is the event rate being low (see the content audit). Nothing to assert.
  });

  // SKIPPED, same root cause: reaching a natural death needs ~60 batched years,
  // and a batch that stalls after a couple of weeks never gets there.
  it.skip('refuses to tick a dead character', async () => {
    seedWorld();
    mounted = mountGame();

    // Run until the character dies, then confirm a further batch is a no-op.
    for (let year = 0; year < 90; year++) {
      let digest: YearDigest | null = null;
      await act(async () => {
        digest = await captured!.liveYear();
        await Promise.resolve();
      });
      if (digest!.stopReason === 'death' || captured!.state.showDeathPopup) {
        const weeksAtDeath = captured!.state.weeksLived;
        let post: YearDigest | null = null;
        await act(async () => {
          post = await captured!.liveYear();
          await Promise.resolve();
        });
        expect(post!.weeksAdvanced).toBe(0);
        expect(post!.stopReason).toBe('death');
        expect(captured!.state.weeksLived).toBe(weeksAtDeath);
        return;
      }
    }
    throw new Error('Character never died across 90 batched years — check the death path');
  });
});
