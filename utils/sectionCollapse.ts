/**
 * Remembered collapse state for the game's collapsible sections.
 *
 * A UI preference, NOT game state: it lives in AsyncStorage under one key
 * rather than on `GameState`. Putting it in the save would mean a
 * STATE_VERSION bump and a migration for something that is per-device chrome,
 * would travel between a player's devices as if it were progress, and would be
 * reset by prestige. One map, one key, no schema.
 *
 * Reads are SYNCHRONOUS against an in-memory cache. That matters: awaiting a
 * read inside each section would render them all expanded and snap them shut a
 * frame later.
 *
 * Filling that cache is a race the store has to win, and two mechanisms cover
 * it. Hydration STARTS ON IMPORT, before any component renders, which wins it
 * in the ordinary case. And because a slow storage read can still lose,
 * `onSectionCollapseHydrated` lets a section re-read once the real values
 * land - without that fallback the remembered state is silently ignored on a
 * cold start, which is exactly the bug this comment used to claim was
 * impossible.
 */
import { safeAsyncStorage } from '@/utils/storageWrapper';
import { logger } from '@/utils/logger';

const STORAGE_KEY = 'deeplife.ui.collapsedSections.v1';

/** id -> collapsed?  Absent means "use the caller's default". */
let cache: Record<string, boolean> = {};
let hydrated = false;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
let hydrationListeners = new Set<() => void>();

/** Call once during boot, before the tab tree mounts. */
export async function hydrateSectionCollapse(): Promise<void> {
  if (hydrated) return;
  try {
    const stored = await safeAsyncStorage.getItem(STORAGE_KEY, null);
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      // Keep only the booleans - a corrupted entry must not make a section
      // un-openable, so anything else is dropped rather than trusted.
      cache = Object.fromEntries(
        Object.entries(stored as Record<string, unknown>)
          .filter(([, v]) => typeof v === 'boolean')
      ) as Record<string, boolean>;
    }
  } catch (error) {
    logger.warn('[sectionCollapse] hydrate failed; sections use their defaults', { error });
  } finally {
    hydrated = true;
    // Anything that rendered before the read landed gets to correct itself.
    const listeners = Array.from(hydrationListeners);
    hydrationListeners.clear();
    listeners.forEach((listener) => {
      try {
        listener();
      } catch {
        /* a bad listener must not stop the others */
      }
    });
  }
}

/**
 * Run `callback` once the stored values are available - immediately if they
 * already are. Returns an unsubscribe function.
 */
export function onSectionCollapseHydrated(callback: () => void): () => void {
  if (hydrated) {
    callback();
    return () => {};
  }
  hydrationListeners.add(callback);
  return () => {
    hydrationListeners.delete(callback);
  };
}

/** True when this section should render collapsed. */
export function isSectionCollapsed(id: string, defaultCollapsed: boolean): boolean {
  const stored = cache[id];
  return typeof stored === 'boolean' ? stored : defaultCollapsed;
}

/**
 * Record a section's new state. Debounced: a player flicking several sections
 * shut in a row writes once, not once per tap.
 */
export function setSectionCollapsed(id: string, collapsed: boolean): void {
  cache[id] = collapsed;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    void safeAsyncStorage.setItem(STORAGE_KEY, cache);
  }, 400);
}

/** Test seam. @internal */
export function __resetSectionCollapseForTests(): void {
  cache = {};
  hydrated = false;
  hydrationListeners = new Set();
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
}

// Start reading as soon as this module is imported - earlier than any render,
// so in practice the cache is warm before the first section paints. The root
// layout still awaits `hydrateSectionCollapse()`; the call is idempotent.
void hydrateSectionCollapse();
