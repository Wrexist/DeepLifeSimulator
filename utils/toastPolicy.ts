/**
 * Which toasts the player has asked to see.
 *
 * ## Why this is a policy and not an if-statement
 *
 * `settings.notificationsEnabled` shipped with a default, a repair mirror and
 * a save slot, and NOTHING read it - so it was pulled from the Settings screen
 * with the note "saved to state but had no consumers, so the UI was
 * misleading". This module is the consumer that makes the toggle real, which
 * is what earns it a place back on that screen.
 *
 * ## What the toggle does NOT silence, and why
 *
 * Only the celebratory / confirmational tiers (`success`, `info`) are muted.
 * `warning` and `error` always come through:
 *
 *   - Warnings ARE the rejection channel. They were once dropped wholesale for
 *     overlapping the status bar, and `ToastContext` records what that cost: a
 *     refused job application, a denied promotion, a blocked retirement and a
 *     failed street job all buzzed and rendered nothing, so "a rejected tap was
 *     indistinguishable from a successful one". A settings toggle that muted
 *     them would ship that same defect behind a switch.
 *   - Errors carry the one-tap Report action that emails a diagnostic. Hiding a
 *     failure the player could have reported makes the game look broken and
 *     silent rather than broken and honest.
 *
 * So the setting reads as "turn off the pop-ups that congratulate you", never
 * "turn off the ones that tell you something went wrong" - and the Settings
 * copy says exactly that.
 */

/** The toast tiers, mirroring ToastContext's own union. */
export type ToastTier = 'success' | 'error' | 'warning' | 'info';

/** Tiers that survive with notifications switched off. */
export const ALWAYS_SHOWN_TIERS: readonly ToastTier[] = ['warning', 'error'];

/**
 * Should this toast be shown?
 *
 * `enabled` takes the raw setting, which may be absent on a partial save or
 * before the game state exists at all (onboarding). Absent reads as ON: the
 * field's default is `true`, and failing OPEN keeps a pre-game error visible.
 */
export function shouldShowToast(
  tier: ToastTier,
  enabled: boolean | undefined | null
): boolean {
  if (enabled !== false) return true;
  return ALWAYS_SHOWN_TIERS.includes(tier);
}
