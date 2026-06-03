/**
 * Pulse haptics — intent-named wrapper around the project's haptic util.
 *
 * Centralizes which haptic fires for which Pulse interaction so the design
 * stays consistent: a like is always Light, a viral notification is always
 * Success, a scandal banner is always Warning.
 */
import { haptic } from '@/utils/haptics';

export const pulseHaptics = {
  /** Like / bookmark / follow — most-frequent feedback. */
  light: () => haptic.light(),
  /** Repost — slightly weightier action. */
  medium: () => haptic.medium(),
  /** Viral post lands · brand deal completed. */
  success: () => haptic.success?.() ?? haptic.medium(),
  /** Scandal banner enters · brand deal breached. */
  warning: () => haptic.warning?.() ?? haptic.medium(),
  /** Composer error · low energy / cooldown. */
  error: () => haptic.error?.() ?? haptic.medium(),
  /** Live stream goes live. */
  goLive: () => haptic.medium(),
};
