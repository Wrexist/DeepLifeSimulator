import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBackup, restoreFromBackup } from '@/utils/saveBackup';
import { saveLoadMutex } from '@/utils/saveLoadMutex';
import { createSaveEnvelope, decodePersistedSaveEnvelope, doubleBufferLoad, doubleBufferSave } from '@/utils/saveValidation';
import { createTestGameState } from '../helpers/createTestGameState';

const store = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (key: string) => store.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { store.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { store.delete(key); }),
    multiRemove: jest.fn(async (keys: string[]) => { keys.forEach(key => store.delete(key)); }),
    getAllKeys: jest.fn(async () => [...store.keys()]),
  },
}));

const envelope = (weeksLived: number) => createSaveEnvelope(JSON.stringify(
  createTestGameState({ weeksLived, scenarioId: 'rags_to_riches' }),
));

afterEach(() => {
  jest.restoreAllMocks();
  store.clear();
});

it('keeps a requested restore behind an outstanding save until its write settles', async () => {
  const old = envelope(50);
  const backupId = await createBackup(1, old, 'manual');
  expect(backupId).not.toBeNull();
  const holder = await saveLoadMutex.acquire('save');
  let releaseWrite!: () => void;
  const pausedWrite = new Promise<void>(resolve => { releaseWrite = resolve; });
  let announceWrite!: () => void;
  const writeStarted = new Promise<void>(resolve => { announceWrite = resolve; });
  const setItem = AsyncStorage.setItem as jest.Mock;
  const originalSetItem = setItem.getMockImplementation()!;
  setItem.mockImplementationOnce(async (key: string, value: string) => {
    announceWrite();
    await pausedWrite;
    return originalSetItem(key, value);
  });
  const writing = doubleBufferSave('save_slot_1', envelope(100));
  await writeStarted;
  let restored = false;
  const restoring = restoreFromBackup(1, backupId!).then(result => {
    restored = true;
    return result;
  });
  try {
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(restored).toBe(false);
    expect(store.has('save_slot_1_active')).toBe(false);
  } finally {
    releaseWrite();
    await writing;
    saveLoadMutex.release(holder);
    await restoring;
  }
  expect((await restoring).success).toBe(true);
  const loaded = await doubleBufferLoad('save_slot_1');
  expect(JSON.parse(decodePersistedSaveEnvelope(loaded.data!).data!).weeksLived).toBe(50);
  expect(saveLoadMutex.isHeld()).toBe(false);
});

it('returns failure without releasing another holder or writing when acquisition times out', async () => {
  const backupId = await createBackup(1, envelope(50), 'manual');
  const before = new Map(store);
  const acquire = saveLoadMutex.acquire.bind(saveLoadMutex);
  const holder = await acquire('load');
  jest.spyOn(saveLoadMutex, 'acquire').mockImplementation(op => acquire(op, 5));
  const release = jest.spyOn(saveLoadMutex, 'release');
  try {
    const result = await restoreFromBackup(1, backupId!);
    expect(result.success).toBe(false);
    expect(store).toEqual(before);
    expect(saveLoadMutex.getCurrentOperation()).toBe('load');
    expect(release).not.toHaveBeenCalled();
  } finally {
    saveLoadMutex.release(holder);
  }
});
