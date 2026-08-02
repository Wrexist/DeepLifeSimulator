/**
 * Regression test for the currentSlot data-loss bug.
 *
 * Bug: `currentSlot` in GameStateContext was initialized to 1 and never synced
 * on load, so after loading slot 2 or 3 every saveGame/autosave silently wrote
 * back into slot 1 — overwriting it. loadGame now calls setCurrentSlot(N) after
 * a successful load. This test mounts the REAL GameProvider stack, loads a
 * seeded slot 2, then triggers a save and asserts the save targets slot 2 (not 1).
 *
 * Uses React.createElement (no JSX) so the file stays .ts, mirroring
 * realProviderLoop.stress.test.ts.
 */

// Capture the slot argument that saveGame routes to. The factory may only close
// over identifiers prefixed with `mock`.
const mockQueueSave = jest.fn().mockResolvedValue(undefined);
const mockForceSave = jest.fn().mockResolvedValue(undefined);

// The shared jest.setup AsyncStorage mock is a NO-OP (getItem always returns
// null), which cannot round-trip a seeded save. Override it per-file with a
// stateful in-memory store so the real double-buffer load/save path works.
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
  queueSave: (...args: unknown[]) => mockQueueSave(...args),
  forceSave: (...args: unknown[]) => mockForceSave(...args),
}));

// Keep the fire-and-forget pre-save backup out of the way (real IO, non-critical).
jest.mock('@/utils/saveBackup', () => ({
  ...jest.requireActual('@/utils/saveBackup'),
  createBackupFromState: jest.fn().mockResolvedValue(undefined),
}));

import React from 'react';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import { createSaveEnvelope, doubleBufferSave } from '@/utils/saveValidation';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AsyncStorageMock = require('@react-native-async-storage/async-storage').default;

const { act } = TestRenderer;
const h = React.createElement;

type Probe = {
  currentSlot: number;
  loadGame: (slot: number) => Promise<GameState | null>;
  // `Promise<boolean>`, not `void` — saveGame resolves true only once the write
  // is verified on disk, which is the whole point of `force`. This alias said
  // `void` while the cast below said `boolean`; the cast was corrected and the
  // alias was not, so the two disagreed and the alias won at every call site.
  saveGame: (force?: boolean) => Promise<boolean>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { currentSlot } = useGameState();
  const actions = useGameActions();
  captured = {
    currentSlot,
    loadGame: actions.loadGame as (slot: number) => Promise<GameState | null>,
    // No cast needed — the context already declares this signature.
    saveGame: actions.saveGame,
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

/** Persist a valid, signed save into the given slot via the real envelope path. */
async function seedSlot(slot: number): Promise<void> {
  const state: GameState = JSON.parse(JSON.stringify(initialGameState));
  const serialized = JSON.stringify({ ...state, version: STATE_VERSION });
  const envelope = createSaveEnvelope(serialized);
  const result = await doubleBufferSave(`save_slot_${slot}`, envelope);
  if (!result.success) throw new Error(`Failed to seed slot ${slot}: ${result.error}`);
}

describe('currentSlot sync on load (data-loss regression)', () => {
  jest.setTimeout(60_000);
  let mounted: { root: any } | null = null;

  afterEach(async () => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
    mockQueueSave.mockClear();
    mockForceSave.mockClear();
    if (AsyncStorageMock?.clear) await AsyncStorageMock.clear();
  });

  it('loading slot 2 makes the next save target slot 2, not slot 1', async () => {
    await seedSlot(2);

    mounted = mountGame();
    expect(captured).not.toBeNull();
    // Provider starts on the default slot 1.
    expect(captured!.currentSlot).toBe(1);

    // Load slot 2 through the real loadGame.
    let loaded: GameState | null = null;
    await act(async () => {
      loaded = await captured!.loadGame(2);
      await Promise.resolve();
    });
    expect(loaded).not.toBeNull();

    // The in-memory active slot must now be 2 (the fix).
    expect(captured!.currentSlot).toBe(2);

    // A subsequent (non-forced) save must route to slot 2.
    mockQueueSave.mockClear();
    await act(async () => {
      await captured!.saveGame(false);
      await Promise.resolve();
    });

    expect(mockQueueSave).toHaveBeenCalled();
    expect(mockQueueSave.mock.calls[0][0]).toBe(2);

    // The persisted slot markers must also point at slot 2.
    expect(await AsyncStorageMock.getItem('currentSlot')).toBe('2');
    expect(await AsyncStorageMock.getItem('lastSlot')).toBe('2');
  });
});
