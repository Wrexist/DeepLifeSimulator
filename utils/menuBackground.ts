/**
 * Shared main-menu background artwork + the per-launch cycle counter.
 *
 * Used by BOTH the boot loader (app/index.tsx) and the main menu
 * (app/(onboarding)/MainMenu.tsx): the loader PEEKS the current index so it can
 * show the exact image the menu is about to use (a seamless boot → menu
 * handoff), and the menu TAKES it — shows it and advances the cycle — exactly
 * once per launch.
 *
 * Boot-safe by design: leaf imports only (storageWrapper, logger), and nothing
 * exported here ever throws — the boot loader must stay crash-proof.
 */
import { lazyAsyncStorage as AsyncStorage } from '@/utils/storageWrapper';
import { logger } from '@/utils/logger';

const log = logger.scope('MenuBackground');

// Owner-generated, text-free artwork (see docs/menu-background-prompts.md).
// Metro needs literal require paths, so the set is static.
export const MENU_BACKGROUNDS = [
  require('@/assets/images/Main_Menu/Mainmenu_1.png'),
  require('@/assets/images/Main_Menu/Mainmenu_2.png'),
  require('@/assets/images/Main_Menu/Mainmenu_4.png'),
  require('@/assets/images/Main_Menu/Mainmenu_5.png'),
] as const;

export const MENU_BG_CYCLE_KEY = 'menu_bg_cycle_v1';

async function readIndex(): Promise<number> {
  const raw = await AsyncStorage.getItem(MENU_BG_CYCLE_KEY);
  const n = raw != null ? parseInt(raw, 10) : 0;
  return !Number.isNaN(n) && Number.isFinite(n) && n >= 0 ? n % MENU_BACKGROUNDS.length : 0;
}

/** Read-only: which image THIS launch shows. Never throws; 0 on any failure. */
export async function peekMenuBackgroundIndex(): Promise<number> {
  try {
    return await readIndex();
  } catch (error) {
    log.warn('Failed to peek menu background cycle', { error });
    return 0;
  }
}

/**
 * Show-and-advance: returns this launch's index and moves the cycle forward.
 * Called once per launch (by the main menu). The write is quota-safe: the key
 * is a single digit, so on QuotaExceededError it is cleared and rewritten.
 * Never throws; worst case the same image shows again next launch.
 */
export async function takeMenuBackgroundIndex(): Promise<number> {
  let index = 0;
  try {
    index = await readIndex();
  } catch (error) {
    log.warn('Failed to read menu background cycle (using first image)', { error });
  }
  const nextValue = String((index + 1) % MENU_BACKGROUNDS.length);
  try {
    await AsyncStorage.setItem(MENU_BG_CYCLE_KEY, nextValue);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === 'QuotaExceededError' || error.message.includes('QuotaExceeded'))
    ) {
      try {
        await AsyncStorage.removeItem(MENU_BG_CYCLE_KEY);
        await AsyncStorage.setItem(MENU_BG_CYCLE_KEY, nextValue);
      } catch (retryError) {
        log.warn('Failed to advance menu background cycle after quota cleanup', {
          error: retryError,
        });
      }
    } else {
      log.warn('Failed to advance menu background cycle', { error });
    }
  }
  return index;
}
