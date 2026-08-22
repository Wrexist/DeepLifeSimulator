/**
 * What the in-game subscriptions will charge this week.
 *
 * `applySubscriptions` (the weekly tick) owned these predicates privately, so
 * the home tab's "Weekly Expenses" — the panel whose whole job is to say what
 * the week will take — did not know Pulse Verified Pro and Spark Premium
 * existed. Same shape as the salary divergence: a cost the tick charges and no
 * screen reports is a Cash Flow figure that is quietly optimistic every week.
 *
 * `lib/` cannot import values from `contexts/`, so the shared arithmetic lives
 * here at the lower layer and the tick imports it, rather than the display
 * growing a second copy of the billing rules.
 */

/** The subscription shapes this module reasons about, structurally. */
export interface BillableSubscription {
  active?: boolean;
  weeklyPrice?: number;
  plan?: string;
  paidThroughWeek?: number;
}

/**
 * Whether this subscription is billed IN GAME (has an active in-game plan with
 * a real weekly price). A real-money RevenueCat entitlement has no
 * `weeklyPrice` and must never be charged against `stats.money`.
 */
export function isInGameBillable(
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
export function isPrepaidThisWeek(
  sub: { plan?: string; paidThroughWeek?: number },
  nextWeeksLived: number,
): boolean {
  return (
    sub.plan === 'annual' &&
    typeof sub.paidThroughWeek === 'number' &&
    nextWeeksLived < sub.paidThroughWeek
  );
}

/** What one subscription costs this week — 0 when not billable or prepaid. */
export function subscriptionWeeklyCharge(
  sub: BillableSubscription | undefined,
  nextWeeksLived: number,
): number {
  if (!isInGameBillable(sub)) return 0;
  if (isPrepaidThisWeek(sub as BillableSubscription, nextWeeksLived)) return 0;
  const price = (sub as BillableSubscription).weeklyPrice as number;
  return price > 0 ? price : 0;
}

/**
 * Total in-game subscription cost for the coming week.
 *
 * Takes the subscription objects rather than a `GameState` so it stays usable
 * from the tick (which holds them individually) and from a display that reads
 * them off state.
 *
 * NOTE the week argument: the tick bills against `nextWeeksLived` (the week
 * being processed), and a display projecting "what the next tick will take"
 * must use the same basis or an annual prepay expiring this week reads as free.
 */
export function totalSubscriptionWeeklyCharge(
  subs: readonly (BillableSubscription | undefined)[],
  nextWeeksLived: number,
): number {
  const total = subs.reduce((sum, s) => sum + subscriptionWeeklyCharge(s, nextWeeksLived), 0);
  return Number.isFinite(total) && total > 0 ? total : 0;
}
