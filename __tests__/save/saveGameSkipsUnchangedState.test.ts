/**
 * PERF-1: `saveGame` skips a NON-forced save whose state object is already on
 * disk in that slot, and never skips one that has something new to write.
 *
 * The 2-minute autosave on an idle menu, and the saves queued behind each
 * other on a busy turn (an action's save, then Next Week's, then the timer),
 * used to validate, serialize, sign, write and read back identical bytes every
 * time. The skip keys on the state object's identity (`setGameState` keeps the
 * same object for a no-op update) plus a slot-storage generation that every
 * other writer bumps, so a skip can never leave bytes some other path wrote.
 *
 * Runs the REAL provider stack and save queue over a stateful AsyncStorage,
 * and counts slot-buffer writes rather than trusting a mock's arguments.
 */
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { STATE_VERSION } from '@/contexts/game/initialState';
import {
  createSaveEnvelope,
  decodePersistedSaveEnvelope,
  deleteSaveSlot,
  doubleBufferLoad,
  doubleBufferSave,
} from '@/utils/saveValidation';
import { __resetLifeAutosaveSuspensionForTests } from '@/utils/autosaveSuspension';
import { saveLoadMutex } from '@/utils/saveLoadMutex';
import { createTestGameState } from '../helpers/createTestGameState';

// The shared jest.setup AsyncStorage mock is a no-op (getItem always returns
// null), which cannot round-trip a save. A stateful in-memory store can.
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

// The pre-save backup is fire-and-forget and non-critical; keep its IO out of
// the way so nothing outlives a test.
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

type Probe = {
  state: GameState;
  setGameState: ReturnType<typeof useGameState>['setGameState'];
  setCurrentSlot: ReturnType<typeof useGameState>['setCurrentSlot'];
  loadGame: ReturnType<typeof useGameActions>['loadGame'];
  saveGame: ReturnType<typeof useGameActions>['saveGame'];
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState, setCurrentSlot } = useGameState();
  const { loadGame, saveGame } = useGameActions();
  captured = { state: gameState, setGameState, setCurrentSlot, loadGame, saveGame };
  return null;
}

function mountGame(): { root: { unmount: () => void } } {
  captured = null;
  let root!: { unmount: () => void };
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as React.ComponentType<{ children?: React.ReactNode }>, null,
        h(GameProvider as React.ComponentType<{ children?: React.ReactNode }>, null,
          h(ProbeComponent)))
    );
  });
  return { root };
}

function probe(): Probe {
  if (!captured) throw new Error('Probe not mounted');
  return captured;
}

/** A started life (a scenario, so the pristine-state guard does not skip it). */
function life(overrides: Parameters<typeof createTestGameState>[0] = {}): GameState {
  return createTestGameState({ scenarioId: 'rags_to_riches', ...overrides });
}

/** Write a signed save into a slot through the real envelope path. */
async function seedSlot(slot: number, state: GameState): Promise<void> {
  const envelope = createSaveEnvelope(JSON.stringify({ ...state, version: STATE_VERSION }));
  const result = await doubleBufferSave(`save_slot_${slot}`, envelope);
  if (!result.success) throw new Error(`Failed to seed slot ${slot}: ${result.error}`);
}

/** What is on disk for a slot, decoded - independent of the provider. */
async function readSlot(slot: number): Promise<GameState> {
  const loaded = await doubleBufferLoad(`save_slot_${slot}`);
  if (!loaded.data) throw new Error(`Slot ${slot} is empty`);
  const decoded = decodePersistedSaveEnvelope(loaded.data);
  if (!decoded.data) throw new Error(`Slot ${slot} did not decode`);
  return JSON.parse(decoded.data) as GameState;
}

async function load(slot: number): Promise<GameState | null> {
  let loaded: GameState | null = null;
  await act(async () => {
    loaded = await probe().loadGame(slot);
  });
  return loaded;
}


/** Writes that reached a slot's double buffer (`save_slot_N_A` / `_B`). */
function bufferWrites(slot: number): number {
  return (AsyncStorageMock.setItem as jest.Mock).mock.calls.filter(
    ([k]: [string]) => k === `save_slot_${slot}_A` || k === `save_slot_${slot}_B`,
  ).length;
}

async function save(force = false): Promise<boolean> {
  let pending!: Promise<boolean>;
  act(() => {
    pending = probe().saveGame(force);
  });
  let result = false;
  await act(async () => {
    result = await pending;
  });
  return result;
}

describe('saveGame skips a save only when nothing has changed (PERF-1)', () => {
  jest.setTimeout(60_000);
  let mounted: { root: { unmount: () => void } } | null = null;

  beforeEach(() => {
    __resetLifeAutosaveSuspensionForTests();
  });

  afterEach(async () => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
    const token = await saveLoadMutex.acquire('load');
    saveLoadMutex.release(token);
    __resetLifeAutosaveSuspensionForTests();
    await AsyncStorageMock.clear();
  });

  it('a second save of the same state writes nothing and still reports success', async () => {
    await seedSlot(1, life({ stats: { money: 5000 } }));
    mounted = mountGame();
    await load(1);

    expect(await save()).toBe(true);
    const afterFirst = bufferWrites(1);
    expect(afterFirst).toBeGreaterThan(0);

    // The autosave timer firing on an idle screen, twice.
    expect(await save()).toBe(true);
    expect(await save()).toBe(true);
    expect(bufferWrites(1)).toBe(afterFirst);
  });

  it('back-to-back saves requested together write the state once', async () => {
    await seedSlot(1, life({ stats: { money: 5000 } }));
    mounted = mountGame();
    await load(1);
    const before = bufferWrites(1);

    let a!: Promise<boolean>;
    let b!: Promise<boolean>;
    let c!: Promise<boolean>;
    act(() => {
      probe().setGameState(prev => ({ ...prev, stats: { ...prev.stats, money: 4321 } }));
      a = probe().saveGame();
      b = probe().saveGame();
      c = probe().saveGame();
    });
    await act(async () => {
      await expect(Promise.all([a, b, c])).resolves.toEqual([true, true, true]);
    });
    expect(bufferWrites(1) - before).toBe(1);
    expect((await readSlot(1)).stats.money).toBe(4321);
  });

  it('a real change after a save is always written', async () => {
    await seedSlot(1, life({ stats: { money: 5000 } }));
    mounted = mountGame();
    await load(1);
    expect(await save()).toBe(true);
    const afterFirst = bufferWrites(1);

    act(() => {
      probe().setGameState(prev => ({ ...prev, stats: { ...prev.stats, money: 1234 } }));
    });
    expect(await save()).toBe(true);
    expect(bufferWrites(1)).toBeGreaterThan(afterFirst);
    expect((await readSlot(1)).stats.money).toBe(1234);
  });

  it('a no-op update keeps the skip (the state object is unchanged)', async () => {
    await seedSlot(1, life({ stats: { money: 5000 } }));
    mounted = mountGame();
    await load(1);
    expect(await save()).toBe(true);
    const afterFirst = bufferWrites(1);

    // An action that rejects returns `prev`; GameStateContext keeps the object.
    act(() => {
      probe().setGameState(prev => prev);
    });
    expect(await save()).toBe(true);
    expect(bufferWrites(1)).toBe(afterFirst);
  });

  it('another writer putting different bytes in the slot re-arms the save', async () => {
    await seedSlot(1, life({ stats: { money: 5000 } }));
    mounted = mountGame();
    await load(1);
    act(() => {
      probe().setGameState(prev => ({ ...prev, stats: { ...prev.stats, money: 7777 } }));
    });
    expect(await save()).toBe(true);

    // e.g. a backup restore or an IAP fulfilment writing the slot directly.
    await seedSlot(1, life({ stats: { money: 1 } }));
    expect((await readSlot(1)).stats.money).toBe(1);

    expect(await save()).toBe(true);
    expect((await readSlot(1)).stats.money).toBe(7777);
  });

  it('a deleted slot is written again by the next save', async () => {
    await seedSlot(1, life({ stats: { money: 5000 } }));
    mounted = mountGame();
    await load(1);
    expect(await save()).toBe(true);

    await deleteSaveSlot(1);
    expect(await save()).toBe(true);
    expect((await readSlot(1)).stats.money).toBe(5000);
  });

  it('a forced save always writes', async () => {
    await seedSlot(1, life({ stats: { money: 5000 } }));
    mounted = mountGame();
    await load(1);
    expect(await save()).toBe(true);
    const afterFirst = bufferWrites(1);

    expect(await save(true)).toBe(true);
    expect(bufferWrites(1)).toBeGreaterThan(afterFirst);
  });
});
