/**
 * Suspend the ambient life-autosave while the player is out in the menus.
 *
 * `GameActionsProvider` is mounted app-wide by `AppProviders`, so its 2-minute
 * autosave interval and its AppState background force-save run on EVERY screen —
 * including the whole `(onboarding)` stack. Nothing clears `gameState` or
 * `currentSlot` when the app leaves gameplay for the menus, and the only guard
 * on the write is `isPristineUnstartedState`, which a real character never
 * trips. So a slot the pre-game UI has just emptied or replaced gets the stale
 * in-memory life written straight back over it.
 *
 * Two traced consequences, both reachable:
 *
 *  1. Death -> "Start New Game" resurrects the character it just buried.
 *     `DeathPopup` deletes the slot, clears its meta and `lastSlot`, and
 *     navigates to Scenarios — but leaves the dead character in `gameState` and
 *     `currentSlot`. The next autosave tick (or backgrounding the app while
 *     choosing a scenario) writes it back and restores `lastSlot`. By the time
 *     the player reaches Perks, `resolveNewLifeSlot` reads the slot fresh, finds
 *     it occupied, and refuses: "Slot N holds <the character they just buried>".
 *     The new-life flow dead-ends in the player's own slot.
 *
 *  2. A backup restore is silently reverted. "Switch Save Slot" reaches
 *     `SaveSlots` from inside a live game; `restoreFromBackup` writes the backup
 *     into the slot's double buffer, but nothing loads it or clears memory, so
 *     the still-loaded pre-restore state is force-saved over it on the next
 *     background transition. The player is told the restore succeeded and gets
 *     their unrestored save back — the failure the `atomicSave` ->
 *     `doubleBufferSave` work was written to eliminate, reintroduced from the
 *     other end.
 *
 * 2026-07-31 audit round 3, R3-S1.
 *
 * Scope: this gates ONLY the ambient `saveGame` path, which reads
 * `gameStateRef.current` and targets `currentSlot`. Explicit
 * `forceSave(slot, state)` calls — IAP grant fulfilment, redeem codes, the
 * onboarding write itself — pass their own resolved slot and state and must
 * keep working, or a purchase made on the main menu would be lost.
 *
 * Module-level rather than React state on purpose: the timers that need gating
 * live outside the render tree, and the flag has to be readable synchronously
 * from inside `saveGame` without a subscription.
 */
import { logger } from '@/utils/logger';

let suspended = false;
let suspendReason = '';

/**
 * Stop the ambient autosave from writing the in-memory life.
 *
 * Call when navigating from gameplay into the pre-game stack. Idempotent.
 */
export function suspendLifeAutosave(reason: string): void {
  if (suspended && suspendReason === reason) return;
  suspended = true;
  suspendReason = reason;
  logger.info(`[autosave] suspended: ${reason}`);
}

/**
 * Allow the ambient autosave again.
 *
 * Call when a life is actually in play — after a successful load, and after
 * onboarding has written and loaded the new character. Safe to call when not
 * suspended.
 */
export function resumeLifeAutosave(): void {
  if (!suspended) return;
  suspended = false;
  logger.info(`[autosave] resumed (was: ${suspendReason})`);
  suspendReason = '';
}

/** Whether the ambient autosave is currently gated. */
export function isLifeAutosaveSuspended(): boolean {
  return suspended;
}

/** The reason recorded by the last `suspendLifeAutosave`, for diagnostics. */
export function lifeAutosaveSuspendReason(): string {
  return suspendReason;
}

/** Test seam — resets module state between cases. */
export function __resetLifeAutosaveSuspensionForTests(): void {
  suspended = false;
  suspendReason = '';
}
