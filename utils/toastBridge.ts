/**
 * toastBridge — a module-level handle on the React toast channel.
 *
 * Why this exists: `utils/feedbackSystem.ts` is a plain module singleton, not a
 * React component, so it cannot call `useToast()`. It previously reached for
 * `showAchievementToast(message, category, 0)` instead — and that helper gates
 * on `reward > 0` (deliberately, so tips and warnings can't hijack the branded
 * "ACHIEVEMENT UNLOCKED!" popup). The reward was hard-coded 0 at all four call
 * sites, so **every message passed to `useFeedback().success/error/warning/info`
 * was silently discarded**: the phone buzzed and nothing was ever shown.
 *
 * This is the same ref-registration pattern `achievementToast.ts` already uses,
 * pointed at the correct channel. `ToastProvider` registers its `showToast` on
 * mount; anything outside React can then reach the real toast queue.
 *
 * Calls made before the provider mounts are dropped rather than queued — a toast
 * describing an action the player took several screens ago is noise, which is
 * the exact problem this file exists to fix.
 */

export type ToastBridgeType = 'success' | 'error' | 'warning' | 'info';
export type ToastBridgePosition = 'top' | 'bottom';

type ToastHandler = (
  message: string,
  type?: ToastBridgeType,
  duration?: number,
  position?: ToastBridgePosition
) => void;

let toastHandler: ToastHandler | null = null;

/** Registered by ToastProvider on mount. Pass null on unmount to clear. */
export const setToastHandler = (handler: ToastHandler | null): void => {
  toastHandler = handler;
};

/**
 * Show a toast from outside the React tree. No-ops when no provider is mounted
 * (tests, boot, headless render) rather than throwing.
 */
export const showGlobalToast = (
  message: string,
  type: ToastBridgeType = 'info',
  duration?: number,
  position?: ToastBridgePosition
): void => {
  if (!toastHandler) return;
  if (!message?.trim()) return;
  toastHandler(message, type, duration, position);
};

/** Test seam — lets a suite assert the bridge is wired without a provider. */
export const hasToastHandler = (): boolean => toastHandler !== null;
