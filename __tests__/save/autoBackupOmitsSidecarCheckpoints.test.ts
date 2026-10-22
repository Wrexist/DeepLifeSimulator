/**
 * PERF-2: rolling AUTO backups leave `checkpoints` out, as the slot write does.
 *
 * Checkpoints were ~62% of a late-game state and already live in the slot's
 * signed checkpoint sidecar, so every auto backup re-serialized, CRC'd and
 * HMAC'd them for nothing, five copies per slot. The deliberate one-off
 * snapshots (`before_prestige` and friends) must stay self-contained: the life
 * they protect is the one whose sidecar is about to be replaced.
 */
import { createBackupFromState, stripSidecarCheckpointsForAutoBackup } from '@/utils/saveBackup';
import { decodePersistedSaveEnvelope } from '@/utils/saveValidation';
import { createTestGameState } from '../helpers/createTestGameState';

process.env.EXPO_PUBLIC_SAVE_HMAC_KEY = 'test-key-for-auto-backup-checkpoints';

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

const SLOT = 2;

function lifeWithCheckpoints() {
  return createTestGameState({
    scenarioId: 'rags_to_riches',
    weeksLived: 300,
    checkpoints: [
      { id: 'cp-1', label: 'Year 2', weeksLived: 104, age: 20, timestamp: 1, snapshot: { weeksLived: 104 } },
      { id: 'cp-2', label: 'Year 3', weeksLived: 156, age: 21, timestamp: 2, snapshot: { weeksLived: 156 } },
    ],
  });
}

/** The decoded state inside the one backup blob for the slot. */
function onlyBackupState(): Record<string, unknown> {
  const keys = [...store.keys()].filter((k) => k.startsWith('save_backup_') || k.includes('backup'));
  const blobs = keys.map((k) => store.get(k)!).filter((v) => v.includes('"metadata"'));
  expect(blobs).toHaveLength(1);
  const parsed = JSON.parse(blobs[0]) as { data: string };
  const decoded = decodePersistedSaveEnvelope(parsed.data);
  expect(decoded.data).toBeTruthy();
  return JSON.parse(decoded.data as string) as Record<string, unknown>;
}

beforeEach(() => store.clear());

describe('auto backups and checkpoints (PERF-2)', () => {
  it('an auto_save backup carries no checkpoints key', async () => {
    const id = await createBackupFromState(SLOT, lifeWithCheckpoints(), 'auto_save');
    expect(id).not.toBeNull();
    const state = onlyBackupState();
    expect('checkpoints' in state).toBe(false);
    expect(state.weeksLived).toBe(300);
  });

  it('a before_prestige backup stays self-contained', async () => {
    const id = await createBackupFromState(SLOT, lifeWithCheckpoints(), 'before_prestige');
    expect(id).not.toBeNull();
    const state = onlyBackupState();
    expect(Array.isArray(state.checkpoints)).toBe(true);
    expect((state.checkpoints as unknown[]).length).toBe(2);
  });

  it('never mutates the live state it was handed', () => {
    const live = lifeWithCheckpoints();
    const stripped = stripSidecarCheckpointsForAutoBackup(live, 'auto_save');
    expect(stripped).not.toBe(live);
    expect(live.checkpoints).toHaveLength(2);
    expect(stripSidecarCheckpointsForAutoBackup(live, 'manual')).toBe(live);
  });
});
