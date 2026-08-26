/**
 * Checkpoint sidecar (2026-08-26 perf pass) — the slot payload no longer
 * carries `checkpoints`; they live in a per-slot signed envelope written only
 * when they change. See utils/checkpointSidecar.ts for the full rationale.
 *
 * What must hold, and is pinned here:
 *  1. A queued save and a force save both strip `checkpoints` from the stored
 *     payload, write the sidecar, and leave the LIVE state object untouched.
 *  2. The sidecar is written on the first save of a session and then only
 *     when the checkpoint set changes — not on every weekly save.
 *  3. The load-side reattach seam (reproduced from `loadGame`, which is not
 *     callable from a test — the carveOutRoundTrip precedent): a payload
 *     without the key gets the sidecar back; inline checkpoints always win.
 *  4. A tampered or malformed sidecar reads as ABSENT, never as an error.
 *  5. `filterCheckpointsForState` drops checkpoints that cannot belong to the
 *     loaded save (future weeksLived, foreign lifeStartWeek) and tolerates
 *     legacy string snapshots and pre-v43 saves.
 *  6. `deleteSaveSlot` removes the sidecar, and its literal key spelling
 *     matches `checkpointSidecarKey` (import-cycle-forced duplication).
 */
import { saveQueue, queueSave, forceSave } from '@/utils/saveQueue';
import {
  checkpointSidecarKey,
  persistCheckpointSidecar,
  readCheckpointSidecar,
  removeCheckpointSidecar,
  filterCheckpointsForState,
  resetCheckpointSidecarSessionCache,
} from '@/utils/checkpointSidecar';
import {
  deleteSaveSlot,
  readSaveSlot,
  decodePersistedSaveEnvelope,
} from '@/utils/saveValidation';
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

function makeCheckpoint(
  weeksLived: number,
  lifeStartWeek: number | undefined,
  id = `cp_${weeksLived}_${1_000_000 + weeksLived}`
): Checkpoint {
  return {
    id,
    label: `Age ${18 + Math.floor(weeksLived / 52)}`,
    weeksLived,
    age: 18 + Math.floor(weeksLived / 52),
    timestamp: 1_700_000_000_000 + weeksLived,
    snapshot: {
      weeksLived,
      ...(lifeStartWeek !== undefined ? { lifeStartWeek } : {}),
    } as Checkpoint['snapshot'],
  };
}

/** Decode a stored slot payload back to the parsed state object. */
async function parseStoredSlot(slot: number): Promise<Record<string, unknown>> {
  const raw = await readSaveSlot(slot);
  expect(raw).toBeTruthy();
  const decoded = decodePersistedSaveEnvelope(raw!, { allowLegacy: false });
  expect(decoded.valid).toBe(true);
  return JSON.parse(decoded.data!);
}

/** How many times the sidecar key for `slot` has been written so far. */
function sidecarWriteCount(slot: number): number {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  return (AsyncStorage.setItem as jest.Mock).mock.calls.filter(
    ([k]: [string]) => k === checkpointSidecarKey(slot)
  ).length;
}

beforeEach(() => {
  store.clear();
  jest.clearAllMocks();
  resetCheckpointSidecarSessionCache();
  saveQueue.clearQueue();
});

describe('save-side: the slot payload is stripped and the sidecar written', () => {
  it('queueSave strips checkpoints from the payload, writes the sidecar, and never mutates live state', async () => {
    const state = createTestGameState();
    const cp = makeCheckpoint(52, undefined);
    state.checkpoints = [cp];

    await queueSave(2, state);

    const parsed = await parseStoredSlot(2);
    expect('checkpoints' in parsed).toBe(false);

    // Live state untouched — the strip works on a serialized copy only.
    expect(state.checkpoints).toEqual([cp]);

    const sidecar = await readCheckpointSidecar(2);
    expect(sidecar).toEqual([cp]);
  });

  it('forceSave has the same strip + sidecar parity', async () => {
    const state = createTestGameState();
    const cp = makeCheckpoint(104, undefined);
    state.checkpoints = [cp];

    await forceSave(3, state);

    const parsed = await parseStoredSlot(3);
    expect('checkpoints' in parsed).toBe(false);
    expect(await readCheckpointSidecar(3)).toEqual([cp]);
  });

  it('a state with NO checkpoints stores an empty sidecar (clears a stale one from a previous life)', async () => {
    // Simulate the previous life's sidecar sitting in the slot.
    await persistCheckpointSidecar(2, [makeCheckpoint(520, undefined)]);
    resetCheckpointSidecarSessionCache(); // relaunch

    const freshLife = createTestGameState();
    delete (freshLife as Partial<GameState>).checkpoints;
    await queueSave(2, freshLife);

    expect(await readCheckpointSidecar(2)).toEqual([]);
  });

  it('writes the sidecar once per session, then only when the checkpoint set changes', async () => {
    const state = createTestGameState();
    state.checkpoints = [makeCheckpoint(52, undefined)];

    await queueSave(2, state);
    const afterFirst = sidecarWriteCount(2);
    expect(afterFirst).toBe(1);

    // Two more weekly saves, checkpoints unchanged — no sidecar writes.
    await queueSave(2, state);
    await queueSave(2, state);
    expect(sidecarWriteCount(2)).toBe(afterFirst);

    // A new checkpoint lands (next game-year) — one more write.
    state.checkpoints = [...state.checkpoints, makeCheckpoint(104, undefined)];
    await queueSave(2, state);
    expect(sidecarWriteCount(2)).toBe(afterFirst + 1);
    expect(await readCheckpointSidecar(2)).toHaveLength(2);
  });
});

describe('load-side: the loadGame reattach seam', () => {
  /**
   * Reproduction of the reattach block in `GameActionsContext.loadGame`
   * (loadGame is a useCallback inside the provider and not directly callable —
   * the carveOutRoundTrip precedent). Keep in step with the source.
   */
  async function reattach(parsed: Record<string, unknown>, slot: number) {
    if (parsed && typeof parsed === 'object' && parsed.checkpoints === undefined) {
      const sidecarCheckpoints = await readCheckpointSidecar(slot);
      if (sidecarCheckpoints && sidecarCheckpoints.length > 0) {
        parsed.checkpoints = filterCheckpointsForState(
          sidecarCheckpoints,
          parsed as { weeksLived?: number; lifeStartWeek?: number }
        );
      }
    }
    return parsed;
  }

  it('round trip: save → stored payload without the key → reattach restores the checkpoints', async () => {
    const state = createTestGameState();
    state.weeksLived = 120;
    const cp = makeCheckpoint(104, undefined);
    state.checkpoints = [cp];

    await queueSave(2, state);
    const parsed = await parseStoredSlot(2);
    expect(parsed.checkpoints).toBeUndefined();

    await reattach(parsed, 2);
    expect(parsed.checkpoints).toEqual([cp]);
  });

  it('inline checkpoints (old save / backup restore) always win over the sidecar', async () => {
    await persistCheckpointSidecar(2, [makeCheckpoint(999, undefined, 'cp_sidecar')]);
    const inline = [makeCheckpoint(52, undefined, 'cp_inline')];
    const parsed: Record<string, unknown> = { weeksLived: 60, checkpoints: inline };

    await reattach(parsed, 2);
    expect(parsed.checkpoints).toEqual(inline);
  });

  it('an empty-array inline value also blocks the sidecar (undefined is the only trigger)', async () => {
    await persistCheckpointSidecar(2, [makeCheckpoint(10, undefined)]);
    const parsed: Record<string, unknown> = { weeksLived: 60, checkpoints: [] };
    await reattach(parsed, 2);
    expect(parsed.checkpoints).toEqual([]);
  });
});

describe('integrity: a bad sidecar reads as absent', () => {
  it('a tampered sidecar fails verification and returns null', async () => {
    await persistCheckpointSidecar(2, [makeCheckpoint(52, undefined)]);
    const key = checkpointSidecarKey(2);
    const raw = store.get(key)!;
    // Flip a byte inside the payload without breaking the JSON envelope. The
    // inner data string is JSON-escaped inside the envelope, so the needle
    // carries escaped quotes.
    const tampered = raw.replace('\\"weeksLived\\":52', '\\"weeksLived\\":51');
    expect(tampered).not.toBe(raw); // the needle matched — the tamper is real
    store.set(key, tampered);
    expect(await readCheckpointSidecar(2)).toBeNull();
  });

  it('garbage and non-array payloads return null', async () => {
    store.set(checkpointSidecarKey(2), 'not json at all');
    expect(await readCheckpointSidecar(2)).toBeNull();
    expect(await readCheckpointSidecar(3)).toBeNull(); // absent
  });
});

describe('filterCheckpointsForState (wrong-life guard)', () => {
  const sameLife = makeCheckpoint(104, 364);
  const futureWeek = makeCheckpoint(500, 364);
  const foreignLife = makeCheckpoint(52, 0);
  const legacyString: Checkpoint = {
    ...makeCheckpoint(52, undefined, 'cp_legacy'),
    snapshot: '{"weeksLived":52}',
  };

  it('keeps checkpoints matching the save, drops future weeks and foreign lives', () => {
    const kept = filterCheckpointsForState(
      [sameLife, futureWeek, foreignLife],
      { weeksLived: 200, lifeStartWeek: 364 }
    );
    expect(kept).toEqual([sameLife]);
  });

  it('tolerates legacy string snapshots (weeksLived check only) and pre-v43 saves', () => {
    expect(
      filterCheckpointsForState([legacyString], { weeksLived: 60, lifeStartWeek: 364 })
    ).toEqual([legacyString]);
    // Pre-v43: both sides undefined compares equal.
    const noLife = makeCheckpoint(52, undefined);
    expect(filterCheckpointsForState([noLife], { weeksLived: 60 })).toEqual([noLife]);
  });

  it('drops malformed entries rather than attaching them', () => {
    const junk = [null, 42, 'x'] as unknown as NonNullable<GameState['checkpoints']>;
    expect(filterCheckpointsForState(junk, { weeksLived: 60 })).toEqual([]);
  });
});

describe('lifecycle', () => {
  it('deleteSaveSlot removes the sidecar, and the literal key spelling matches checkpointSidecarKey', async () => {
    await persistCheckpointSidecar(2, [makeCheckpoint(52, undefined)]);
    expect(store.has(checkpointSidecarKey(2))).toBe(true);

    await deleteSaveSlot(2);
    expect(store.has(checkpointSidecarKey(2))).toBe(false);
    expect(await readCheckpointSidecar(2)).toBeNull();
  });

  it('removeCheckpointSidecar clears the key and the session cache', async () => {
    await persistCheckpointSidecar(2, [makeCheckpoint(52, undefined)]);
    await removeCheckpointSidecar(2);
    expect(store.has(checkpointSidecarKey(2))).toBe(false);
    // After removal the next persist must write again (cache cleared).
    await persistCheckpointSidecar(2, [makeCheckpoint(52, undefined)]);
    expect(store.has(checkpointSidecarKey(2))).toBe(true);
  });
});
