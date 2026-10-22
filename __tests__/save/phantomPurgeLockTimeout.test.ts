/**
 * The phantom-save purge must never delete without the save lock.
 *
 * On an acquire timeout it used to log "proceeding unlocked" and run its
 * read → verify → delete anyway. A timed-out acquire means another holder's
 * storage IO is still in flight (saveLoadMutex.ts), so that verdict can be
 * overtaken by the write it raced, and the delete then wipes a life that just
 * landed. It now skips and lets the next menu visit retry, as restoreQueue
 * does. 2026-10-21 audit SAVE-12.
 */
import { purgeSlotIfPhantom } from '@/utils/phantomSaveCleanup';
import { saveLoadMutex } from '@/utils/saveLoadMutex';

const store = new Map<string, string>();
const getItem = jest.fn(async (k: string) => (store.has(k) ? store.get(k)! : null));
const removeItem = jest.fn(async (k: string) => {
  store.delete(k);
});

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: (k: string) => getItem(k),
    setItem: jest.fn(async (k: string, v: string) => {
      store.set(k, v);
    }),
    removeItem: (k: string) => removeItem(k),
    multiRemove: jest.fn(async (ks: string[]) => ks.forEach((k) => store.delete(k))),
    getAllKeys: jest.fn(async () => Array.from(store.keys())),
  },
}));

afterEach(() => {
  jest.restoreAllMocks();
  store.clear();
  getItem.mockClear();
  removeItem.mockClear();
});

it('skips the purge, touching nothing, when the save lock times out', async () => {
  store.set('save_slot_1_A', 'whatever-the-stalled-writer-is-replacing');
  store.set('save_slot_1_active', 'A');
  jest
    .spyOn(saveLoadMutex, 'acquire')
    .mockRejectedValueOnce(new Error('SaveLoadMutex acquire timeout for save'));

  expect(await purgeSlotIfPhantom(1)).toBe(false);
  expect(getItem).not.toHaveBeenCalled();
  expect(removeItem).not.toHaveBeenCalled();
  expect(store.get('save_slot_1_A')).toBe('whatever-the-stalled-writer-is-replacing');
});
