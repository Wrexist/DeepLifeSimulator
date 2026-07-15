/**
 * In-game subscription auto-renew billing — weekly tick.
 *
 * Pulse Verified Pro and Spark Premium are IN-GAME subscriptions paid from
 * `stats.money` (never a mirrored bank account). This pure helper is called
 * once per `nextWeek()` advance, AFTER income/rent settle, so it bills against
 * the player's real post-income cash. It:
 *   - charges the weekly fee for each ACTIVE, in-game-billable subscription,
 *   - lapses (cancels perks) any subscription the player can no longer afford,
 *   - skips billing while an annual prepay term is still in effect (then resumes
 *     ordinary weekly auto-renew once the term ends).
 *
 * Inert by construction: a subscription with `active !== true`, or with no
 * `weeklyPrice` (e.g. a legacy IAP grant), is passed through UNCHANGED (same
 * reference) with zero charge — so a save with no active in-game subscription
 * produces byte-identical weekly-tick output.
 *
 * Money rule (CLAUDE.md): mirror-safe. The caller deducts `totalCharged` from
 * `newStats.money` ONLY; `banking.accounts` mirrors are overwritten later in the
 * same tick and must never be debited here.
 */
import type { PulseVerifiedPro, SparkPremium } from '@/contexts/game/types';
import { perksForTier } from '@/lib/dating/sparkLogic';

export interface SubscriptionBillingInput {
  verifiedPro: PulseVerifiedPro | undefined;
  sparkPremium: SparkPremium | undefined;
  /** Player's available cash this tick (post income/rent). Read-only. */
  moneyAvailable: number;
  /** weeksLived AFTER the +1 advance. */
  nextWeeksLived: number;
}

export interface SubscriptionBillingResult {
  /** Possibly-lapsed Verified Pro; SAME reference when unchanged. */
  verifiedPro: PulseVerifiedPro | undefined;
  /** Possibly-lapsed Spark Premium; SAME reference when unchanged. */
  sparkPremium: SparkPremium | undefined;
  verifiedProChanged: boolean;
  sparkPremiumChanged: boolean;
  /** Total in-game cash to deduct from `stats.money` this tick (>= 0). */
  totalCharged: number;
  /** Lapse / renewal messages for the notification queue. */
  notifications: string[];
}

/** True when a subscription is an active, in-game-billed (cash) subscription. */
function isInGameBillable(
  sub: { active?: boolean; weeklyPrice?: number } | undefined,
): boolean {
  return (
    !!sub &&
    sub.active === true &&
    typeof sub.weeklyPrice === 'number' &&
    Number.isFinite(sub.weeklyPrice) &&
    sub.weeklyPrice > 0
  );
}

/** Whether an annual prepay term is still covering this week (no charge due). */
function isPrepaidThisWeek(
  sub: { plan?: string; paidThroughWeek?: number },
  nextWeeksLived: number,
): boolean {
  return (
    sub.plan === 'annual' &&
    typeof sub.paidThroughWeek === 'number' &&
    nextWeeksLived < sub.paidThroughWeek
  );
}

function lapsedVerifiedPro(vp: PulseVerifiedPro): PulseVerifiedPro {
  return {
    ...vp,
    active: false,
    plan: undefined,
    paidThroughWeek: undefined,
    perksUnlocked: {
      blueCheckmark: false,
      postBoostMultiplier: 1.0,
      analyticsUnlocked: false,
      noAdsInFeed: false,
      longerPosts: false,
    },
  };
}

function lapsedSparkPremium(sp: SparkPremium): SparkPremium {
  return {
    ...sp,
    active: false,
    tier: 'free',
    plan: undefined,
    paidThroughWeek: undefined,
    perks: perksForTier('free'),
  };
}

export function applySubscriptionsForWeek(
  input: SubscriptionBillingInput,
): SubscriptionBillingResult {
  const { verifiedPro, sparkPremium, nextWeeksLived } = input;
  let money =
    typeof input.moneyAvailable === 'number' && isFinite(input.moneyAvailable)
      ? input.moneyAvailable
      : 0;

  let nextVerifiedPro = verifiedPro;
  let nextSparkPremium = sparkPremium;
  let verifiedProChanged = false;
  let sparkPremiumChanged = false;
  let totalCharged = 0;
  const notifications: string[] = [];

  // ── Pulse Verified Pro ──────────────────────────────────────────────────
  if (isInGameBillable(verifiedPro)) {
    const vp = verifiedPro as PulseVerifiedPro;
    if (!isPrepaidThisWeek(vp, nextWeeksLived)) {
      const price = vp.weeklyPrice as number;
      if (money >= price) {
        money -= price;
        totalCharged += price;
        // Annual prepay term just ended → fall back to plain weekly auto-renew.
        if (vp.plan === 'annual') {
          nextVerifiedPro = { ...vp, plan: 'weekly', paidThroughWeek: undefined };
          verifiedProChanged = true;
        }
      } else {
        nextVerifiedPro = lapsedVerifiedPro(vp);
        verifiedProChanged = true;
        notifications.push('Your Pulse Verified Pro lapsed — not enough cash to renew.');
      }
    }
  }

  // ── Spark Premium ───────────────────────────────────────────────────────
  if (isInGameBillable(sparkPremium)) {
    const sp = sparkPremium as SparkPremium;
    if (!isPrepaidThisWeek(sp, nextWeeksLived)) {
      const price = sp.weeklyPrice as number;
      if (money >= price) {
        money -= price;
        totalCharged += price;
        if (sp.plan === 'annual') {
          nextSparkPremium = { ...sp, plan: 'weekly', paidThroughWeek: undefined };
          sparkPremiumChanged = true;
        }
      } else {
        nextSparkPremium = lapsedSparkPremium(sp);
        sparkPremiumChanged = true;
        notifications.push('Your Spark Premium lapsed — not enough cash to renew.');
      }
    }
  }

  return {
    verifiedPro: nextVerifiedPro,
    sparkPremium: nextSparkPremium,
    verifiedProChanged,
    sparkPremiumChanged,
    totalCharged,
    notifications,
  };
}
