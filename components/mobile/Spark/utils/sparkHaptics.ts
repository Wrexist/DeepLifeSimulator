/**
 * Spark haptics — intent-named wrapper around the project's haptic utility.
 *
 * Centralizes which haptic fires for which Spark interaction so the design
 * stays consistent: a swipe is always Light, a match is always Success,
 * a jealousy event is always Warning.
 */
import { haptic } from '@/utils/haptics';

export const sparkHaptics = {
  /** Swipe gesture — most-frequent feedback. */
  swipe: () => haptic.light(),
  /** Like / pass button tap. */
  tap: () => haptic.light(),
  /** Super-like — slightly weightier. */
  superLike: () => haptic.medium(),
  /** Match celebration — joyful. */
  match: () => haptic.success?.() ?? haptic.medium(),
  /** Premium purchase / boost activated. */
  boost: () => haptic.success?.() ?? haptic.medium(),
  /** Jealousy event banner / catfish exposed warning. */
  warning: () => haptic.warning?.() ?? haptic.medium(),
  /** Insufficient gems / energy / quota exhausted. */
  error: () => haptic.error?.() ?? haptic.medium(),
};
