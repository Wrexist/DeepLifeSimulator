/**
 * ONB-10 (owner decision 2026-10-22): the Intro shows once per device, and its
 * beats are non-interactive. Every New Game used to force the three-chapter
 * Intro, whose direction / legacy picks were thrown away.
 */
import fs from 'fs';
import path from 'path';
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { hasSeenIntro, markIntroSeen, INTRO_SEEN_KEY } from '@/src/features/onboarding/introSeen';

// An in-memory device store, so "seen" survives between reads like the real one.
const mockStore = new Map<string, string>();
jest.mock('@/utils/storageWrapper', () => ({
  lazyAsyncStorage: {
    getItem: jest.fn(async (k: string) => mockStore.get(k) ?? null),
    setItem: jest.fn(async (k: string, v: string) => { mockStore.set(k, v); }),
    removeItem: jest.fn(async (k: string) => { mockStore.delete(k); }),
  },
}));

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');

describe('ONB-10 - once per device', () => {
  beforeEach(async () => {
    await AsyncStorage.removeItem(INTRO_SEEN_KEY);
  });

  it('a fresh device has not seen it', async () => {
    expect(await hasSeenIntro()).toBe(false);
  });

  it('once marked, it stays seen', async () => {
    await markIntroSeen();
    expect(await hasSeenIntro()).toBe(true);
    expect(await hasSeenIntro()).toBe(true);
  });

  it('a storage failure reads as not seen and never throws', async () => {
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('boom'));
    await expect(hasSeenIntro()).resolves.toBe(false);
    spy.mockRestore();
    const set = jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('boom'));
    await expect(markIntroSeen()).resolves.toBeUndefined();
    set.mockRestore();
  });

  it('New Game routes past the Intro once it has been seen', () => {
    const menu = read('app/(onboarding)/MainMenu.tsx');
    const startNew = menu.slice(menu.indexOf('const startNew'));
    const body = startNew.slice(0, startNew.indexOf('finally'));
    expect(body).toMatch(/if \(await hasSeenIntro\(\)\)\s*\{\s*router\.push\('\/\(onboarding\)\/Scenarios'\)/);
    expect(body).toMatch(/router\.push\('\/\(onboarding\)\/Intro'\)/);
  });

  it('the Intro marks itself seen when shown', () => {
    expect(read('app/(onboarding)/Intro.tsx')).toMatch(/useEffect\(\(\) => \{ void markIntroSeen\(\); \}, \[\]\)/);
  });
});

describe('ONB-10 - the beats are non-interactive', () => {
  const intro = read('app/(onboarding)/Intro.tsx');

  it('has no selection state left', () => {
    expect(intro).not.toMatch(/setDirection|setMoment|setLegacy/);
    expect(intro).not.toMatch(/accessibilityState=\{\{ selected/);
  });

  it('only navigation is tappable: back, skip and the chapter button', () => {
    const touchables = intro.match(/<TouchableOpacity/g) ?? [];
    expect(touchables.length).toBe(3);
  });
});
