/**
 * The Intro shows once per device (ONB-10, owner decision 2026-10-22).
 *
 * Every New Game used to push the three-chapter Intro, so a returning player
 * paid three extra screens before the wizard on every new life. It is a
 * DEVICE preference, not game state: it lives in AsyncStorage beside the other
 * per-device keys, never in a save, so a new slot or a prestige does not show
 * it again and nothing about a life depends on it.
 *
 * Every read and write is guarded: storage that fails (a private context, a
 * cleared store) reads as "not seen", which errs toward showing the Intro
 * once more rather than skipping it for a first-time player.
 */
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';

export const INTRO_SEEN_KEY = 'onboarding_intro_seen_v1';

export async function hasSeenIntro(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(INTRO_SEEN_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function markIntroSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    // Best effort: a failed write only means the Intro may show once more.
  }
}
