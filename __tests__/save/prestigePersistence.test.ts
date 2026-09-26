/** Prestige must serialize its backup/write and only acknowledge durable saves. */
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { STATE_VERSION } from '@/contexts/game/initialState';
import {
  createSaveEnvelope,
  decodePersistedSaveEnvelope,
  doubleBufferLoad,
  doubleBufferSave,
} from '@/utils/saveValidation';
import {
  __resetLifeAutosaveSuspensionForTests,
} from '@/utils/autosaveSuspension';
import { saveLoadMutex } from '@/utils/saveLoadMutex';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

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
  createBackupFromState: jest.fn().mockImplementation((...args: unknown[]) => {
    const real = jest.requireActual('@/utils/saveBackup');
    return args[2] === 'before_prestige' ? real.createBackupFromState(...args) : Promise.resolve(null);
  }),
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
  executePrestige: ReturnType<typeof useGameActions>['executePrestige'];
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState, setCurrentSlot } = useGameState();
  const { loadGame, saveGame, executePrestige } = useGameActions();
  captured = { state: gameState, setGameState, setCurrentSlot, loadGame, saveGame, executePrestige };
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


function prestigeLevel(state: GameState): number {
  if (!state.prestige) throw new Error('Fixture must contain prestige data');
  return state.prestige.prestigeLevel;
}

async function settle<T>(pending: Promise<T>): Promise<T> {
  let complete = false;
  pending.finally(() => { complete = true; });
  for (let i = 0; i < 150 && !complete; i++) {
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  }
  if (!complete) throw new Error('Prestige did not settle');
  return pending;
}

let mounted: ReturnType<typeof mountGame> | null = null;
beforeEach(async () => {
  __resetLifeAutosaveSuspensionForTests();
  await AsyncStorageMock.clear();
  await seedSlot(1, life({ stats: { money: 1e9 } }));
  mounted = mountGame();
  await load(1);
});
afterEach(() => {
  if (mounted) act(() => mounted!.root.unmount());
  mounted = null;
  jest.restoreAllMocks();
  __resetLifeAutosaveSuspensionForTests();
});

it('waits for the owning mutex, blocks double submission, and a queued autosave cannot undo prestige', async () => {
  const token = await saveLoadMutex.acquire('load');
  const before = prestigeLevel(probe().state);
  let prestige!: ReturnType<Probe['executePrestige']>;
  let saving!: Promise<boolean>;
  try {
    act(() => { prestige = probe().executePrestige('reset'); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
    expect(prestigeLevel(probe().state)).toBe(before);
    expect(prestigeLevel(await readSlot(1))).toBe(before);
    await expect(probe().executePrestige('reset')).resolves.toBe('rejected');
    act(() => { saving = probe().saveGame(true); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  } finally { saveLoadMutex.release(token); }
  await expect(settle(prestige)).resolves.toBe('saved');
  await expect(settle(saving)).resolves.toBe(true);
  expect(prestigeLevel(await readSlot(1))).toBe(before + 1);
  expect(prestigeLevel(probe().state)).toBe(before + 1);
  expect(saveLoadMutex.isHeld()).toBe(false);
});

it('refuses a changed slot while waiting without resetting either life', async () => {
  const token = await saveLoadMutex.acquire('load');
  let pending!: ReturnType<Probe['executePrestige']>;
  act(() => { pending = probe().executePrestige('reset'); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); });
  act(() => { probe().setCurrentSlot(2); });
  saveLoadMutex.release(token);
  await expect(settle(pending)).resolves.toBe('rejected');
  expect(prestigeLevel(probe().state)).toBe(0);
  expect(prestigeLevel(await readSlot(1))).toBe(0);
});

it('requires the protected outgoing backup before resetting', async () => {
  const backup = await import('@/utils/saveBackup');
  jest.mocked(backup.createBackupFromState).mockResolvedValueOnce(null);
  let pending!: ReturnType<Probe['executePrestige']>;
  act(() => { pending = probe().executePrestige('reset'); });
  await expect(settle(pending)).resolves.toBe('rejected');
  expect(probe().state.stats.money).toBe(1e9);
  expect((await readSlot(1)).stats.money).toBe(1e9);
});

it('reports failed durability and retries only saving, without a second reset or XP award', async () => {
  const queue = await import('@/utils/saveQueue');
  jest.spyOn(queue, 'forceSave').mockRejectedValueOnce(new Error('disk unavailable'));
  let pending!: ReturnType<Probe['executePrestige']>;
  act(() => { pending = probe().executePrestige('reset'); });
  await expect(settle(pending)).resolves.toBe('save-failed');
  expect(prestigeLevel(await readSlot(1))).toBe(0);
  expect(prestigeLevel(probe().state)).toBe(1);
  const newLife = probe().state;
  const backup = await import('@/utils/saveBackup');
  expect((await backup.listBackups(1)).some(entry => entry.reason === 'before_prestige')).toBe(true);
  let saved!: Promise<boolean>;
  act(() => { saved = probe().saveGame(true); });
  await expect(settle(saved)).resolves.toBe(true);
  expect((await readSlot(1)).prestige).toEqual(newLife.prestige);
  expect((await readSlot(1)).legacyPass).toEqual(newLife.legacyPass);
});

it('refuses a newer action arriving during backup instead of overwriting it', async () => {
  const backup = await import('@/utils/saveBackup');
  let release!: (value: string) => void;
  jest.mocked(backup.createBackupFromState).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  let pending!: ReturnType<Probe['executePrestige']>;
  act(() => { pending = probe().executePrestige('reset'); });
  for (let i = 0; i < 50 && !release; i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  act(() => { probe().setGameState(prev => ({ ...prev, stats: { ...prev.stats, money: prev.stats.money + 200 } })); });
  release('protected-backup');
  await expect(settle(pending)).resolves.toBe('rejected');
  expect(probe().state.stats.money).toBe(1e9 + 200);
  expect(prestigeLevel(probe().state)).toBe(0);
});


it('releases ownership if the provider unmounts while the outgoing backup is pending', async () => {
  const backup = await import('@/utils/saveBackup');
  let release!: (value: string) => void;
  jest.mocked(backup.createBackupFromState).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
  let pending!: ReturnType<Probe['executePrestige']>;
  act(() => { pending = probe().executePrestige('reset'); });
  for (let i = 0; i < 50 && !release; i++) await act(async () => { await new Promise(resolve => setTimeout(resolve, 10)); });
  expect(saveLoadMutex.isHeld()).toBe(true);
  act(() => mounted!.root.unmount());
  mounted = null;
  release('protected-backup');
  await expect(settle(pending)).resolves.toBe('rejected');
  expect(saveLoadMutex.isHeld()).toBe(false);
  expect(prestigeLevel(await readSlot(1))).toBe(0);
});
