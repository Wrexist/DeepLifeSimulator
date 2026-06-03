/**
 * Hustle haptics — intent-named wrapper around the project's haptic util.
 */
import { haptic } from '@/utils/haptics';

export const hustleHaptics = {
  /** Card press / generic tap. */
  tap: () => haptic.light(),
  /** Heavier action: launch campaign, hire, accept acquisition. */
  commit: () => haptic.medium(),
  /** Money-in events: IPO close, deal accepted, big revenue lift. */
  success: () => haptic.success?.() ?? haptic.medium(),
  /** Scandal alert / IPO failure / fired. */
  warning: () => haptic.warning?.() ?? haptic.medium(),
  /** Insufficient funds / declined offer. */
  error: () => haptic.error?.() ?? haptic.medium(),
};
