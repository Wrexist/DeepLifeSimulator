/**
 * Shared action guards.
 *
 * P1-3: every player action that mutates state should bail out when the player
 * is dead — otherwise the death popup is on screen but the game keeps
 * advancing in the background, money/stats change, and on revive (or prestige)
 * the player sees "ghost progress" they don't recognize.
 *
 * Use `isPlayerBlocked()` for a boolean check and `rejectIfBlocked()` for
 * actions that return `{ success, message }`.
 */

import type { GameState } from '../types';

/**
 * Returns true when the player can NOT take an action right now —
 * either dead (death popup showing) or paused.
 */
export function isPlayerBlocked(state: GameState): boolean {
  if (!state) return true;
  if (state.showDeathPopup) return true;
  // GameState has no canonical `isPaused` field today; if one is added later,
  // wire it through here.
  return false;
}

/**
 * Returns true when the player is currently incarcerated.
 *
 * Actions that make no sense from a cell (career advancement / raise requests,
 * founding a company, active dating such as going on dates or proposing) use
 * this for a clear refusal. Passive actions and jail-native actions (serving
 * time, jail activities, paying bail) must NOT be gated by it. `jailWeeks` is
 * the canonical incarceration field.
 */
export function isPlayerJailed(state: GameState): boolean {
  return (state?.jailWeeks ?? 0) > 0;
}

/**
 * Convenience wrapper for actions that return a `{ success, message }`
 * shape — returns the canonical "you have died" rejection or null when the
 * player can proceed.
 */
export function rejectIfBlocked(
  state: GameState
): { success: false; message: string } | null {
  if (state.showDeathPopup) {
    return { success: false, message: 'You have died.' };
  }
  return null;
}
