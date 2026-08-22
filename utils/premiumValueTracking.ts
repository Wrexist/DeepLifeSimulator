/**
 * "Did this subscriber ever USE what they bought?" — fired once per install.
 *
 * WHY THIS IS THE EVENT THAT MATTERS. Purchase conversion says whether the
 * paywall works; it says nothing about whether the subscription does. A member
 * who never touches a perk churns at the end of the term, and without this event
 * that is only knowable AFTER they have gone — at which point the funnel shows a
 * cancellation with no explanation attached to it. Pairing `premium_activated`
 * with `first_premium_value` splits churn into its two treatable causes:
 * subscribers who never found the value (a discovery problem) and subscribers
 * who found it and left anyway (a value problem). Those need opposite fixes.
 *
 * ── WHY ASYNCSTORAGE AND NOT THE SAVE ───────────────────────────────────────
 * "First" needs a latch, and the obvious home for one is `GameState.settings`.
 * That would make an analytics flag a SAVE FORMAT change: a new field, a
 * migration, a `STATE_VERSION` bump and a `repairGameState` decision, all for a
 * value no gameplay reads (CLAUDE.md §7). A device-local key is the right
 * weight for a device-local question, and it is the pattern `PremiumPassPromo`
 * already uses for its cooldown marker.
 *
 * The trade-off is deliberate and small: a reinstall re-arms the latch, so one
 * install can contribute at most one duplicate. That is acceptable for a
 * "did it ever happen" metric and costs nothing downstream — analysis takes the
 * earliest event per install id.
 *
 * NOT a security or economy gate. Nothing is granted here, so the usual
 * "device state is farmable" rule (§4.4) does not apply — the worst case is a
 * duplicate analytics row.
 */
import { safeGetItem, safeSetItem } from '@/utils/safeStorage';
import { track } from '@/lib/analytics';
import { logger } from '@/utils/logger';

const FIRST_VALUE_KEY = 'deeplife_plus_first_value';

/**
 * Record that a DeepLife+ member used a perk they are paying for. Only the FIRST
 * call per install emits; later ones are no-ops.
 *
 * `perk` names which benefit got them there, so discovery can be improved for
 * the specific perk that is failing rather than in the abstract.
 *
 * Fire-and-forget and fully guarded: analytics must never be able to break a
 * gameplay action, so every failure path swallows.
 */
export async function trackFirstPremiumValue(perk: string): Promise<void> {
  try {
    const seen = await safeGetItem(FIRST_VALUE_KEY);
    if (seen) return;
    // Written BEFORE the track call so a throw inside `track` cannot leave the
    // latch unset and let the event fire again on the next claim.
    await safeSetItem(FIRST_VALUE_KEY, perk);
    track('first_premium_value', { perk });
  } catch (error) {
    logger.warn('[premiumValue] could not record first premium value', { perk, error });
  }
}
