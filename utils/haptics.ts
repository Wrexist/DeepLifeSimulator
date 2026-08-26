/**
 * Standalone Haptic Feedback Utility
 *
 * Context-free haptic triggers for use anywhere (components, actions, services).
 * Respects the global haptic setting via a mutable flag, set in exactly two
 * places: save load (GameActionsContext) and the settings toggle. This module
 * is the ONE haptic authority — `useFeedback()` and the mini-app wrappers all
 * route through it.
 */

let Haptics: any = null;
let loadAttempted = false;
let _enabled = true;

function load(): boolean {
  if (loadAttempted) return Haptics !== null;
  loadAttempted = true;
  try {
    Haptics = require('expo-haptics');
    return true;
  } catch {
    return false;
  }
}

/** Call from settings when haptic toggle changes */
export function setHapticsEnabled(enabled: boolean) {
  _enabled = enabled;
}

function fire(fn: () => unknown) {
  if (!_enabled || !load()) return;
  try {
    // expo-haptics calls return Promises; a device without a Taptic Engine
    // rejects asynchronously, which a bare try/catch cannot see.
    const result = fn() as { catch?: (h: () => void) => void } | undefined;
    result?.catch?.(() => { /* device doesn't support haptics */ });
  } catch { /* device doesn't support haptics */ }
}

// ---------------------------------------------------------------------------
// Public API — call these from anywhere
// ---------------------------------------------------------------------------

export const haptic = {
  /** Soft tap — tab switches, selections */
  light: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Button presses, actions */
  medium: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Significant events — prestige, death */
  heavy: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  /** Achievement unlock, purchase complete */
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Low stat warning */
  warning: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  /** Death, failure */
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** Picker / selection change */
  selection: () => fire(() => Haptics.selectionAsync()),
};
