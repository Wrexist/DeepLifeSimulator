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
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { summarizeYear, type YearDigest } from '@/lib/gameMode/mode';

// Below the imports on purpose: a `require` between two `import` statements
// makes every import after it "in body of module" to eslint, which is 6
// warnings for one misplaced line.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
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

/** The "after" half of a summary, read from committed state. */
function afterOf(s: GameState) {
  return {
    weeksLived: s.weeksLived ?? 0,
    age: s.date?.age ?? 0,
    money: s.stats?.money ?? 0,
    netWorth: 0, // not asserted here; the money/age axes are the ones that matter
    died: !!s.showDeathPopup,
    pendingDecisions: (s.pendingEvents ?? []).length,
  };
}

describe('Story mode batches the interaction, not the simulation', () => {
  jest.setTimeout(900_000);
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

  /**
   * THE INVARIANT. If this fails, story mode has started producing a different
   * economy from classic mode — the one outcome the design forbids. Do not
   * relax the assertions; find what the batch changed.
   */
  it('one liveYear() equals the same number of individual nextWeek() calls', async () => {
    // ── Pass 1: story mode, one batched tap ────────────────────────────────
    seedWorld();
    mounted = mountGame();
    await act(async () => {
      await captured!.liveYear();
      await Promise.resolve();
    });
    // Read AFTER the act() block: that is when React has committed, and the
    // committed state is the only thing either mode can be judged on.
    const storyFingerprint = fingerprint(captured!.state);
    const weeksAdvanced = captured!.state.weeksLived ?? 0;

    act(() => mounted!.root.unmount());
    mounted = null;
    if (AsyncStorageMock?.clear) await AsyncStorageMock.clear();

    // A batch that advanced nothing would make the comparison vacuously true.
    expect(weeksAdvanced).toBeGreaterThan(0);

    // ── Pass 2: classic mode, the same span one tap at a time ──────────────
    seedWorld();
    mounted = mountGame();
    for (let i = 0; i < weeksAdvanced; i++) await tickOnce();
    const classicFingerprint = fingerprint(captured!.state);

    process.stdout.write(`\n[batch-equivalence] weeks=${weeksAdvanced}\n`);
    expect(storyFingerprint).toEqual(classicFingerprint);
  });

  it('summarizes the year against live state', async () => {
    seedWorld();
    mounted = mountGame();
    const before = captured!.state;
    const moneyBefore = before.stats.money;
    const weeksBefore = before.weeksLived ?? 0;

    let digest: YearDigest | null = null;
    await act(async () => {
      digest = await captured!.liveYear();
      await Promise.resolve();
    });

    const after = captured!.state;
    const summary = summarizeYear(digest!, afterOf(after));

    expect(digest!.before.money).toBeCloseTo(moneyBefore, 4);
    expect(digest!.before.weeksLived).toBe(weeksBefore);
    expect(summary.weeksAdvanced).toBe((after.weeksLived ?? 0) - weeksBefore);
    expect(summary.moneyAfter).toBeCloseTo(after.stats.money, 4);
    expect(summary.moneyDelta).toBeCloseTo(after.stats.money - moneyBefore, 4);
    expect(summary.ageAfter).toBeCloseTo(after.date.age, 6);
  });

  it('never advances more weeks than it was asked for', async () => {
    seedWorld();
    mounted = mountGame();
    await act(async () => {
      await captured!.liveYear(10);
      await Promise.resolve();
    });
    expect(captured!.state.weeksLived).toBeLessThanOrEqual(10);
    expect(captured!.state.weeksLived).toBeGreaterThan(0);
  });

  it('refuses to tick a dead character', async () => {
    seedWorld();
    mounted = mountGame();

    // Batch years until the character dies, then confirm a further tap is inert.
    for (let year = 0; year < 90; year++) {
      await act(async () => {
        await captured!.liveYear();
        await Promise.resolve();
      });
      if (captured!.state.showDeathPopup) {
        const weeksAtDeath = captured!.state.weeksLived;
        await act(async () => {
          await captured!.liveYear();
          await Promise.resolve();
        });
        expect(captured!.state.weeksLived).toBe(weeksAtDeath);
        return;
      }
    }
    throw new Error('Character never died across 90 batched years — check the death path');
  });

  it('leaves queued decisions for the player rather than resolving them', async () => {
    seedWorld();
    mounted = mountGame();

    for (let year = 0; year < 8; year++) {
      let digest: YearDigest | null = null;
      await act(async () => {
        digest = await captured!.liveYear();
        await Promise.resolve();
      });
      const summary = summarizeYear(digest!, afterOf(captured!.state));
      if (summary.outcome === 'decision') {
        // The events are still on the board, unanswered — nothing auto-resolved.
        expect((captured!.state.pendingEvents ?? []).length).toBeGreaterThan(0);
        return;
      }
      if (summary.outcome === 'death') return;
    }
    // Never queueing a decision across eight years is the low event rate the
    // content audit measured, not a batch failure. Nothing to assert.
  });
});
