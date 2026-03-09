/**
 * Standalone Haptic Feedback Utility
 *
 * Context-free haptic triggers for use anywhere (actions, services, utils).
 * Respects the global haptic setting via a mutable flag.
 * For React components, prefer the useHapticFeedback hook instead.
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

function fire(fn: () => void) {
  if (!_enabled || !load()) return;
  try { fn(); } catch { /* device doesn't support haptics */ }
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
