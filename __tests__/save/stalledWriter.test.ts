import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveLoadMutex } from '@/utils/saveLoadMutex';
import { doubleBufferSave } from '@/utils/saveValidation';

jest.useFakeTimers();

afterEach(() => {
  while (saveLoadMutex.isHeld()) saveLoadMutex.release();
  jest.clearAllTimers();
});

it('a stalled writer cannot overwrite a newer save after its watchdog expires', async () => {
  const values = new Map<string, string>([
    ['save_slot_1_active', 'A'], ['save_slot_1_A', 'original'],
  ]);
  let resume!: () => void;
  const stalled = new Promise<void>(resolve => { resume = resolve; });
  let entered!: () => void;
  const writeEntered = new Promise<void>(resolve => { entered = resolve; });
  let pauseFirstWrite = true;
  const storage = {
    ...AsyncStorage,
    instance: AsyncStorage,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      if (pauseFirstWrite && key === 'save_slot_1_B') {
        pauseFirstWrite = false;
        entered();
        await stalled;
      }
      values.set(key, value);
    },
  };
  const write = async (value: string) => {
    const token = await saveLoadMutex.acquire('save');
    try {
      return await doubleBufferSave('save_slot_1', value, storage);
    } finally {
      saveLoadMutex.release(token);
    }
  };

  const older = write('older character state');
  await writeEntered;
  jest.advanceTimersByTime(30_000);
  const newer = write('newer character state');
  // Allow an incorrectly admitted writer to finish before releasing the old I/O.
  for (let i = 0; i < 20; i += 1) await Promise.resolve();
  resume();
  expect((await older).success).toBe(true);
  expect((await newer).success).toBe(true);
  expect(values.get(`save_slot_1_${values.get('save_slot_1_active')}`))
    .toBe('newer character state');
});
