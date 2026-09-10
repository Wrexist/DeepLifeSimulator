import { saveQueue } from '@/utils/saveQueue';
import { saveLoadMutex } from '@/utils/saveLoadMutex';
import { createSaveEnvelope, decodePersistedSaveEnvelope, doubleBufferLoad } from '@/utils/saveValidation';
import { createTestGameState } from '../helpers/createTestGameState';

const store = new Map<string, string>();
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(async (k: string) => store.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => { store.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { store.delete(k); }),
    multiRemove: jest.fn(async (ks: string[]) => { ks.forEach(k => store.delete(k)); }),
    getAllKeys: jest.fn(async () => [...store.keys()]),
  },
}));

function journal(weeksLived: number): string {
  const data = createTestGameState({ weeksLived, scenarioId: 'rags_to_riches' });
  return createSaveEnvelope(JSON.stringify([
    { id: 'replay', slot: 1, data, timestamp: Date.now(), retryCount: 0 },
  ]));
}

afterEach(() => {
  jest.restoreAllMocks();
  store.clear();
});

it.each([false, true])('retains timed-out replay outside the live queue, then retries under ownership (journal changed: %s)', async (changeJournal) => {
  const original = journal(100);
  store.set('save_queue_persisted', original);
  const acquire = saveLoadMutex.acquire.bind(saveLoadMutex);
  const holder = await acquire('load');
  let timedOut = 0;
  let notifyTimeout!: () => void;
  const timeoutObserved = new Promise<void>(resolve => { notifyTimeout = resolve; });
  jest.spyOn(saveLoadMutex, 'acquire').mockImplementation(async op => {
    try {
      return await acquire(op, 5);
    } catch (error) {
      timedOut += 1;
      notifyTimeout();
      throw error;
    }
  });
  const replay = saveQueue.restoreOnStartup();
  try {
    await timeoutObserved;
    // Flush the rejected acquisition through the replay catch/retry path.
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(timedOut).toBeGreaterThan(0);
    expect(saveLoadMutex.isHeld()).toBe(true);
    expect(saveLoadMutex.getCurrentOperation()).toBe('load');
    expect(saveQueue.getStatus().queueLength).toBe(0);
    expect(store.get('save_queue_persisted')).toBe(original);
    expect(store.has('save_slot_1_A') || store.has('save_slot_1_B')).toBe(false);
    // Duplicate startup registration shares the pending work.
    expect(saveQueue.restoreOnStartup()).toBe(replay);
    if (changeJournal) store.set('save_queue_persisted', journal(101));
  } finally {
    saveLoadMutex.release(holder);
    await replay;
  }
  const loaded = await doubleBufferLoad('save_slot_1');
  expect(loaded.data).not.toBeNull();
  const decoded = decodePersistedSaveEnvelope(loaded.data!);
  expect(JSON.parse(decoded.data!).weeksLived).toBe(changeJournal ? 101 : 100);
  expect(store.has('save_queue_persisted')).toBe(false);
  expect(saveLoadMutex.isHeld()).toBe(false);
});
