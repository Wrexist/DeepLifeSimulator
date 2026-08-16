/**
 * F-14: `utils/stateInvariants.ts` is wired into the load boundary.
 *
 * The module claimed in its header that "the game never enters an impossible
 * state" while enforcing nothing — `validateStateInvariants` had one caller
 * (dev tooling) and half the module had none at all. It now runs as the LAST
 * step of `loadGame`, after migrations → `repairGameState` →
 * `validateGameState(autoFix)` → `repairRelationshipState`, on the merged state
 * the app will actually run.
 *
 * These tests pin the three things that wiring has to be true for:
 *
 *   (a) violations are LOGGED, under one grep-able tag (`[INVARIANT]`);
 *   (b) the safely-repairable ones are REPAIRED (stats clamped, week
 *       normalised, `weeksLived` derived back from `date.age`);
 *   (c) the save still LOADS — the pipeline never rejects a player's save.
 *
 * The corruption used by the end-to-end case is chosen deliberately: a
 * `date.week` of 9 and a negative `weeksLived` are the two fields NOTHING
 * earlier in the pipeline touches (`validateGameState` only rejects a NEGATIVE
 * week, and no stage checks `weeksLived` at all), so if they come back sane the
 * invariants pass is what did it.
 */

import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { STATE_VERSION } from '@/contexts/game/initialState';
import { createSaveEnvelope, doubleBufferSave } from '@/utils/saveValidation';
import { logger } from '@/utils/logger';
import {
  enforceStateInvariants,
  validateStateInvariants,
  validateTimeInvariants,
  MIN_VALID_AGE,
} from '@/utils/stateInvariants';
import { createTestGameState } from '../helpers/createTestGameState';

// The shared jest.setup AsyncStorage mock is a NO-OP (getItem always returns
// null), which cannot round-trip a seeded save. Override it per-file with a
// stateful in-memory store so the real double-buffer load path runs.
jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  const mock = {
    getItem: jest.fn((k: string) => Promise.resolve(store.has(k) ? store.get(k)! : null)),
    setItem: jest.fn((k: string, v: string) => {
      store.set(k, String(v));
      return Promise.resolve();
    }),
    removeItem: jest.fn((k: string) => {
      store.delete(k);
      return Promise.resolve();
    }),
    clear: jest.fn(() => {
      store.clear();
      return Promise.resolve();
    }),
    getAllKeys: jest.fn(() => Promise.resolve([...store.keys()])),
    multiGet: jest.fn((ks: string[]) =>
      Promise.resolve(ks.map((k) => [k, store.has(k) ? store.get(k)! : null]))
    ),
    multiSet: jest.fn((pairs: [string, string][]) => {
      pairs.forEach(([k, v]) => store.set(k, String(v)));
      return Promise.resolve();
    }),
    multiRemove: jest.fn((ks: string[]) => {
      ks.forEach((k) => store.delete(k));
      return Promise.resolve();
    }),
  };
  return { __esModule: true, default: mock, ...mock };
});

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

// Keep the fire-and-forget pre-save backup out of the way (real IO, non-critical).
jest.mock('@/utils/saveBackup', () => ({
  ...jest.requireActual('@/utils/saveBackup'),
  createBackupFromState: jest.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AsyncStorageMock = require('@react-native-async-storage/async-storage').default;

const { act } = TestRenderer;
const h = React.createElement;

// ─── Unit: the enforcement wrapper itself ──────────────────────────────────

describe('enforceStateInvariants', () => {
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('is a no-op on a healthy state — same reference, nothing logged', () => {
    const state = createTestGameState();
    const result = enforceStateInvariants(state, 'test');

    expect(result.clean).toBe(true);
    expect(result.violations).toEqual([]);
    expect(result.repairs).toEqual([]);
    // Same object reference: the cheap path allocates nothing.
    expect(result.state).toBe(state);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('clamps out-of-range stats and logs under the [INVARIANT] tag', () => {
    const state = createTestGameState({
      stats: { health: 250, happiness: -40, money: -500, gems: -3 },
    });

    const result = enforceStateInvariants(state, 'test');

    expect(result.clean).toBe(false);
    expect(result.state.stats.health).toBe(100);
    expect(result.state.stats.happiness).toBe(0);
    expect(result.state.stats.money).toBe(0);
    expect(result.state.stats.gems).toBe(0);

    // The violations were reported before being repaired.
    expect(result.violations.join(' ')).toContain('health');
    expect(result.repairs.join(' ')).toContain('stats.health');

    const tagged = errorSpy.mock.calls.map((c) => String(c[0]));
    expect(tagged.some((m) => m.includes('[INVARIANT]'))).toBe(true);
  });

  it('normalises date.week back into 1-4', () => {
    expect(enforceStateInvariants(createTestGameState({ date: { week: 9 } }), 't').state.date.week).toBe(4);
    expect(enforceStateInvariants(createTestGameState({ date: { week: 0 } }), 't').state.date.week).toBe(1);
    expect(enforceStateInvariants(createTestGameState({ date: { week: -2 } }), 't').state.date.week).toBe(1);
  });

  it('derives weeksLived from date.age when the counter is negative', () => {
    // weeksLived is the ABSOLUTE counter (CLAUDE.md §4.2) and is seeded from the
    // starting age, so age 25 implies (25 - 18) * 52.
    const state = createTestGameState({ weeksLived: -10, date: { age: 25 } });
    const result = enforceStateInvariants(state, 'test');

    expect(result.state.weeksLived).toBe(364);
    expect(result.repairs.join(' ')).toContain('weeksLived');
  });

  it('derives date.age from weeksLived when the age is non-finite', () => {
    const state = createTestGameState({ weeksLived: 520 });
    (state.date as { age: number }).age = NaN;

    const result = enforceStateInvariants(state, 'test');

    expect(result.state.date.age).toBe(28); // 18 + floor(520 / 52)
  });

  it('reports relationship corruption but never deletes a relationship', () => {
    const base = createTestGameState();
    const person = {
      ...(base.relationships[0] ?? {
        id: 'x',
        name: 'X',
        type: 'friend' as const,
        relationshipScore: 50,
        personality: 'kind',
        gender: 'female' as const,
        age: 30,
      }),
    };
    const state = createTestGameState({
      relationships: [
        { ...person, id: 'dup-1' },
        { ...person, id: 'dup-1' },
      ],
      family: { spouse: undefined, children: [] },
    });

    const result = enforceStateInvariants(state, 'test');

    expect(result.violations.join(' ')).toContain('Duplicate relationship id');
    // Non-destructive: both rows survive. Removing a person from a save is a
    // worse outcome than the duplicate the log now surfaces.
    expect(result.state.relationships).toHaveLength(2);
  });

  it('does not fire on a state the game legitimately produces', () => {
    // The `athletes_journey` scenario starts at 16 with weeksLived 0. The old
    // validator raised a hard error below 18, i.e. on every load of a valid save.
    const teen = createTestGameState({ weeksLived: 0, date: { age: MIN_VALID_AGE } });
    expect(validateTimeInvariants(teen).valid).toBe(true);
    expect(enforceStateInvariants(teen, 'test').clean).toBe(true);

    // `date.year` is cumulative across prestige generations, so a dynasty save
    // runs well past 2100. The old validator warned on exactly those saves.
    const dynasty = createTestGameState({ date: { year: 2350 } });
    expect(validateTimeInvariants(dynasty).warnings).toEqual([]);
    expect(enforceStateInvariants(dynasty, 'test').clean).toBe(true);
  });

  it('flags a second spouse even when family.spouse is absent', () => {
    const base = createTestGameState();
    const template = base.relationships[0];
    const spouseRow = (id: string) => ({ ...template, id, name: id, type: 'spouse' as const });
    const state = createTestGameState({
      relationships: [spouseRow('a'), spouseRow('b')],
      family: { spouse: undefined, children: [] },
    });

    expect(validateStateInvariants(state).errors.join(' ')).toContain('Multiple spouses found');
  });
});

// ─── End-to-end: a corrupted save through the real loadGame ────────────────

type Probe = { loadGame: (slot: number) => Promise<GameState | null> };

let captured: Probe | null = null;

function ProbeComponent() {
  const actions = useGameActions();
  captured = { loadGame: actions.loadGame as (slot: number) => Promise<GameState | null> };
  return null;
}

function mountGame(): { root: unknown } {
  captured = null;
  let root: unknown;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as never, null, h(GameProvider as never, null, h(ProbeComponent)))
    );
  });
  return { root: root as unknown };
}

/** Persist a state into a slot through the real signed-envelope path. */
async function seedSlot(slot: number, state: GameState): Promise<void> {
  const serialized = JSON.stringify({ ...state, version: STATE_VERSION });
  const envelope = createSaveEnvelope(serialized);
  const result = await doubleBufferSave(`save_slot_${slot}`, envelope);
  if (!result.success) throw new Error(`Failed to seed slot ${slot}: ${result.error}`);
}

describe('loadGame enforces state invariants on a corrupted save', () => {
  jest.setTimeout(60_000);
  let mounted: { root: unknown } | null = null;
  let errorSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    if (mounted) {
      act(() => (mounted!.root as { unmount: () => void }).unmount());
      mounted = null;
    }
    captured = null;
    errorSpy.mockRestore();
    warnSpy.mockRestore();
    if (AsyncStorageMock?.clear) await AsyncStorageMock.clear();
  });

  it('loads the save, logs the violations, and repairs what is safe', async () => {
    const corrupted = createTestGameState({
      // Week-of-month out of range. Nothing else in the pipeline touches this:
      // `validateGameState` only rejects `week < 0`.
      date: { week: 9, age: 25 },
      // The absolute counter, negative. No other stage checks it, and a bad
      // value here poisons every cooldown and history comparison.
      weeksLived: -10,
      // Out-of-range stats. `autoFixStats` gets to these first; asserted anyway
      // because the load must end with them sane however that happened.
      stats: { health: 250, money: -500 },
    });

    await seedSlot(2, corrupted);

    mounted = mountGame();
    expect(captured).not.toBeNull();

    let loaded: GameState | null = null;
    await act(async () => {
      loaded = await captured!.loadGame(2);
      await Promise.resolve();
    });

    // (c) the save still loads.
    expect(loaded).not.toBeNull();
    const state: GameState = loaded!;

    // (b) the safely-repairable violations were repaired.
    expect(state.date.week).toBe(4);
    expect(state.weeksLived).toBe(364); // derived from date.age 25
    expect(state.stats.health).toBeLessThanOrEqual(100);
    expect(state.stats.health).toBeGreaterThanOrEqual(0);
    expect(state.stats.money).toBeGreaterThanOrEqual(0);

    // (a) the violations were logged under the grep-able tag.
    const logged = [...errorSpy.mock.calls, ...warnSpy.mock.calls].map((c) => String(c[0]));
    expect(logged.some((m) => m.includes('[INVARIANT]'))).toBe(true);
    expect(logged.some((m) => m.includes('[LOAD_GAME] State invariant violations on load'))).toBe(true);
  });

  it('leaves a healthy save untouched', async () => {
    const healthy = createTestGameState({ date: { week: 2, age: 25 }, weeksLived: 364 });
    await seedSlot(3, healthy);

    mounted = mountGame();

    let loaded: GameState | null = null;
    await act(async () => {
      loaded = await captured!.loadGame(3);
      await Promise.resolve();
    });

    expect(loaded).not.toBeNull();
    const state: GameState = loaded!;
    expect(state.date.week).toBe(2);
    expect(state.weeksLived).toBe(364);

    const logged = [...errorSpy.mock.calls, ...warnSpy.mock.calls].map((c) => String(c[0]));
    expect(logged.some((m) => m.includes('[INVARIANT]'))).toBe(false);
  });
});
