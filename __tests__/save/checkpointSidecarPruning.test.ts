/**
 * The checkpoint sidecar must get the same snapshot pruning the slot payload
 * used to give it.
 *
 * `performSave` / `forceSave` strip `checkpoints` from the payload BEFORE
 * `pruneSaveData` runs (so the slot stays small), which meant the snapshot
 * branch of `pruneSaveData` never ran again and the sidecar stored every
 * snapshot raw and uncapped. Exercised through the real save path - the queue
 * and the force save - not by calling the private pruner.
 */
import { saveQueue, queueSave, forceSave } from '@/utils/saveQueue';
import {
  readCheckpointSidecar,
  resetCheckpointSidecarSessionCache,
} from '@/utils/checkpointSidecar';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const store = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null)),
    setItem: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    removeItem: jest.fn(async (k: string) => {
      store.delete(k);
    }),
    multiRemove: jest.fn(async (ks: string[]) => {
      ks.forEach((k) => store.delete(k));
    }),
    getAllKeys: jest.fn(async () => Array.from(store.keys())),
  },
}));

type Checkpoint = NonNullable<GameState['checkpoints']>[number];

/** A checkpoint whose snapshot carries far more history than the save caps allow. */
function heavyCheckpoint(weeksLived: number): Checkpoint {
  return {
    id: `cp_test_${weeksLived}`,
    label: 'Age 30',
    weeksLived,
    age: 30,
    timestamp: 1_700_000_000_000,
    snapshot: {
      weeksLived,
      memories: Array.from({ length: 600 }, (_, i) => ({ id: `m${i}` })),
      lifetimeStatistics: {
        netWorthHistory: Array.from({ length: 800 }, (_, i) => ({ week: i, value: i })),
        careerHistory: [],
        weeklyEarningsHistory: [],
      },
    } as unknown as Checkpoint['snapshot'],
  };
}

type SnapshotView = { memories: unknown[]; lifetimeStatistics: { netWorthHistory: unknown[] } };

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
  resetCheckpointSidecarSessionCache();
  saveQueue.clearQueue();
});

describe.each([
  ['queueSave', (slot: number, s: GameState) => queueSave(slot, s)],
  ['forceSave', (slot: number, s: GameState) => forceSave(slot, s)],
])('%s prunes checkpoint snapshots into the sidecar', (_label, save) => {
  it('caps the arrays inside every snapshot and keeps every checkpoint', async () => {
    const state = createTestGameState({ weeksLived: 1040 });
    state.checkpoints = [heavyCheckpoint(520), heavyCheckpoint(572), heavyCheckpoint(624)];

    await save(2, state);

    const sidecar = await readCheckpointSidecar(2);
    expect(sidecar?.map((cp) => cp.id)).toEqual(['cp_test_520', 'cp_test_572', 'cp_test_624']);
    for (const cp of sidecar ?? []) {
      const snap = cp.snapshot as unknown as SnapshotView;
      expect(snap.memories.length).toBe(200);
      expect(snap.lifetimeStatistics.netWorthHistory.length).toBeLessThanOrEqual(200);
    }
  });

  it('never mutates the live checkpoints', async () => {
    const state = createTestGameState({ weeksLived: 1040 });
    state.checkpoints = [heavyCheckpoint(520)];

    await save(3, state);

    const live = state.checkpoints[0].snapshot as unknown as SnapshotView;
    expect(live.memories).toHaveLength(600);
  });
});
