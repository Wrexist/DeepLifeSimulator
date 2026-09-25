/**
 * A purchase saved from the handler that made it must survive a reload.
 *
 * Player report (App Store 1.2.5, Canada): "items bought for YouVideo would be
 * gone when you retrieve the game from saved slots."
 *
 * `GamingApp`'s accessory handler has the shape ~40 screens share:
 *
 *     const r = buyAccessory(gameState, setGameState, id, price);
 *     if (r.success) saveGame();
 *
 * `saveGame` used to read `gameStateRef.current` the moment it was called, and
 * that ref is refreshed by a post-commit effect. In the same handler as the
 * `setGameState`, React has not even rendered the purchase yet, so the save
 * persisted the state from BEFORE it. The purchase then lived only in memory
 * until a later save happened to run — and "Switch save slot" suspends exactly
 * those later saves (R3-S1) before the player picks the slot again. Reloading
 * dropped the item and handed back its price.
 *
 * Each test mirrors a handler: the action and the save run in ONE synchronous
 * `act`, which React flushes after the block the way it flushes an onPress
 * handler's updates after the handler returns. The save is awaited AFTER that
 * block, never inside it: `act` runs no queued React work until its callback
 * settles, so a save awaited inside the block that dispatched it would be
 * waiting on a commit that cannot happen yet (tasks/lessons.md 2026-08-09).
 *
 * Runs the REAL provider stack, save queue and load path over a stateful
 * AsyncStorage, so "reload" means the bytes on disk, not a mock's argument.
 */
import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { STATE_VERSION } from '@/contexts/game/initialState';
import { ACCESSORY_PRICES, buyAccessory } from '@/contexts/game/actions/ContentActions';
import {
  createSaveEnvelope,
  decodePersistedSaveEnvelope,
  doubleBufferLoad,
  doubleBufferSave,
} from '@/utils/saveValidation';
import {
  suspendLifeAutosave,
  __resetLifeAutosaveSuspensionForTests,
} from '@/utils/autosaveSuspension';
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

const PRICE = ACCESSORY_PRICES.microphone;

describe('a save made in the same handler as the action persists the action', () => {
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
    // Every save a test starts holds this FIFO mutex until its write lands;
    // acquiring behind them is the completion barrier (earlyGameSim teardown).
    const token = await saveLoadMutex.acquire('load');
    saveLoadMutex.release(token);
    __resetLifeAutosaveSuspensionForTests();
    await AsyncStorageMock.clear();
  });

  it('a YouVideo accessory bought and saved in one handler survives Switch save slot -> reload', async () => {
    await seedSlot(1, life({ stats: { money: 5000 } }));
    mounted = mountGame();
    const before = await load(1);
    expect(before).not.toBeNull();
    expect(before!.gamingStreaming?.equipment.microphone ?? false).toBe(false);

    // GamingApp.handleAccessory, in shape.
    let saved!: Promise<boolean>;
    act(() => {
      const r = buyAccessory(probe().state, probe().setGameState, 'microphone', PRICE);
      expect(r.success).toBe(true);
      saved = probe().saveGame();
    });
    await act(async () => {
      await expect(saved).resolves.toBe(true);
    });

    // The bytes on disk carry the purchase and its cost...
    const onDisk = await readSlot(1);
    expect(onDisk.gamingStreaming?.equipment.microphone).toBe(true);
    expect(onDisk.stats.money).toBe(before!.stats.money - PRICE);

    // ...so the player's path keeps it: Settings -> Switch save slot (which
    // stops every later ambient save), then pick the same slot again.
    suspendLifeAutosave('settings -> switch save slot');
    const reloaded = await load(1);
    expect(reloaded).not.toBeNull();
    expect(reloaded!.gamingStreaming?.equipment.microphone).toBe(true);
    expect(reloaded!.stats.money).toBe(before!.stats.money - PRICE);
  });

  it('a save still waiting for its commit does not write a newly loaded life into the slot it was requested for', async () => {
    // Waiting for the commit opens a window the old synchronous read did not
    // have: if a slot switch commits inside it, the committed state belongs to
    // the NEW slot while the save was requested for the old one. Writing it
    // would overwrite slot 1 with slot 2's life.
    await seedSlot(1, life({ weeksLived: 100, stats: { money: 1111 } }));
    mounted = mountGame();
    await load(1);

    let saved!: Promise<boolean>;
    act(() => {
      saved = probe().saveGame(); // requested for slot 1
      // loadGame(2)'s commit - its state and its slot - landing first.
      probe().setGameState(life({ scenarioId: 'trust_fund', weeksLived: 300, stats: { money: 2222 } }));
      probe().setCurrentSlot(2);
    });
    let result: boolean | undefined;
    await act(async () => {
      result = await saved;
    });

    const slotOne = await readSlot(1);
    expect(slotOne.weeksLived).toBe(100);
    expect(slotOne.stats.money).toBe(1111);
    // Refused, not reported as a save that happened.
    expect(result).toBe(false);
  });

  it('R3-S1 still holds: a save requested while autosave is suspended writes nothing', async () => {
    await seedSlot(1, life({ stats: { money: 5000 } }));
    mounted = mountGame();
    await load(1);
    suspendLifeAutosave('settings -> switch save slot');

    let saved!: Promise<boolean>;
    act(() => {
      buyAccessory(probe().state, probe().setGameState, 'microphone', PRICE);
      saved = probe().saveGame(true);
    });
    await act(async () => {
      await expect(saved).resolves.toBe(false);
    });

    const onDisk = await readSlot(1);
    expect(onDisk.gamingStreaming?.equipment.microphone ?? false).toBe(false);
    expect(onDisk.stats.money).toBe(5000);
  });

  it('a save waiting for its commit settles when the provider unmounts instead of hanging', async () => {
    await seedSlot(1, life({ stats: { money: 5000 } }));
    mounted = mountGame();
    await load(1);

    let saved!: Promise<boolean>;
    act(() => {
      saved = probe().saveGame();
      mounted!.root.unmount();
    });
    mounted = null;
    await expect(saved).resolves.toBe(true);
  });
});
