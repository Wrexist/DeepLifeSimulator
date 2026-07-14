/**
 * applySubscriptionsForWeek — in-game subscription auto-renew billing.
 *
 * Covers the weekly loop: charge active subs, lapse on insufficient cash, skip
 * annual prepay terms, and stay INERT (byte-identical passthrough) when nothing
 * is billable.
 */
import { applySubscriptionsForWeek } from '@/contexts/game/actions/weekly/applySubscriptions';
import { perksForTier } from '@/lib/dating/sparkLogic';
import type { PulseVerifiedPro, SparkPremium } from '@/contexts/game/types';

function activeVerifiedPro(overrides: Partial<PulseVerifiedPro> = {}): PulseVerifiedPro {
  return {
    active: true,
    plan: 'weekly',
    weeklyPrice: 20,
    startedWeek: 0,
    perksUnlocked: {
      blueCheckmark: true,
      postBoostMultiplier: 1.25,
      analyticsUnlocked: true,
      noAdsInFeed: true,
      longerPosts: true,
    },
    ...overrides,
  };
}

function activeSparkPremium(overrides: Partial<SparkPremium> = {}): SparkPremium {
  return {
    active: true,
    tier: 'ultra',
    plan: 'weekly',
    weeklyPrice: 24,
    startedWeek: 0,
    perks: perksForTier('ultra'),
    ...overrides,
  };
}

describe('applySubscriptionsForWeek', () => {
  it('is inert when there are no subscriptions (passthrough, zero charge)', () => {
    const r = applySubscriptionsForWeek({
      verifiedPro: undefined,
      sparkPremium: undefined,
      moneyAvailable: 1000,
      nextWeeksLived: 5,
    });
    expect(r.totalCharged).toBe(0);
    expect(r.verifiedProChanged).toBe(false);
    expect(r.sparkPremiumChanged).toBe(false);
    expect(r.notifications).toEqual([]);
    expect(r.verifiedPro).toBeUndefined();
    expect(r.sparkPremium).toBeUndefined();
  });

  it('does not bill an inactive subscription (same reference, no charge)', () => {
    const vp = activeVerifiedPro({ active: false });
    const r = applySubscriptionsForWeek({
      verifiedPro: vp,
      sparkPremium: undefined,
      moneyAvailable: 1000,
      nextWeeksLived: 5,
    });
    expect(r.totalCharged).toBe(0);
    expect(r.verifiedProChanged).toBe(false);
    expect(r.verifiedPro).toBe(vp); // untouched reference
  });

  it('does not bill a legacy active sub that has no in-game weeklyPrice', () => {
    const vp = activeVerifiedPro({ weeklyPrice: undefined });
    const r = applySubscriptionsForWeek({
      verifiedPro: vp,
      sparkPremium: undefined,
      moneyAvailable: 1000,
      nextWeeksLived: 5,
    });
    expect(r.totalCharged).toBe(0);
    expect(r.verifiedProChanged).toBe(false);
    expect(r.verifiedPro).toBe(vp);
  });

  it('charges the weekly fee for an active, affordable weekly subscription', () => {
    const vp = activeVerifiedPro();
    const r = applySubscriptionsForWeek({
      verifiedPro: vp,
      sparkPremium: undefined,
      moneyAvailable: 1000,
      nextWeeksLived: 5,
    });
    expect(r.totalCharged).toBe(20);
    expect(r.verifiedProChanged).toBe(false); // still active, plan unchanged
    expect(r.verifiedPro!.active).toBe(true);
  });

  it('lapses Verified Pro (perks off) when the player cannot afford the renewal', () => {
    const vp = activeVerifiedPro();
    const r = applySubscriptionsForWeek({
      verifiedPro: vp,
      sparkPremium: undefined,
      moneyAvailable: 5, // < 20
      nextWeeksLived: 5,
    });
    expect(r.totalCharged).toBe(0);
    expect(r.verifiedProChanged).toBe(true);
    expect(r.verifiedPro!.active).toBe(false);
    expect(r.verifiedPro!.perksUnlocked.postBoostMultiplier).toBe(1.0);
    expect(r.verifiedPro!.perksUnlocked.blueCheckmark).toBe(false);
    expect(r.notifications.some((n) => /Verified Pro lapsed/.test(n))).toBe(true);
  });

  it('lapses Spark Premium back to the free tier when unaffordable', () => {
    const sp = activeSparkPremium();
    const r = applySubscriptionsForWeek({
      verifiedPro: undefined,
      sparkPremium: sp,
      moneyAvailable: 10, // < 24
      nextWeeksLived: 5,
    });
    expect(r.totalCharged).toBe(0);
    expect(r.sparkPremiumChanged).toBe(true);
    expect(r.sparkPremium!.active).toBe(false);
    expect(r.sparkPremium!.tier).toBe('free');
    expect(r.sparkPremium!.perks.unlimitedSwipes).toBe(false);
    expect(r.notifications.some((n) => /Spark Premium lapsed/.test(n))).toBe(true);
  });

  it('skips billing while an annual prepay term is still in effect', () => {
    const vp = activeVerifiedPro({ plan: 'annual', paidThroughWeek: 52, startedWeek: 0 });
    const r = applySubscriptionsForWeek({
      verifiedPro: vp,
      sparkPremium: undefined,
      moneyAvailable: 1000,
      nextWeeksLived: 10, // still within the prepaid term
    });
    expect(r.totalCharged).toBe(0);
    expect(r.verifiedProChanged).toBe(false);
    expect(r.verifiedPro).toBe(vp);
  });

  it('resumes weekly auto-renew (and charges) once the annual term ends', () => {
    const vp = activeVerifiedPro({ plan: 'annual', paidThroughWeek: 52, startedWeek: 0 });
    const r = applySubscriptionsForWeek({
      verifiedPro: vp,
      sparkPremium: undefined,
      moneyAvailable: 1000,
      nextWeeksLived: 52, // term ended → bill weekly
    });
    expect(r.totalCharged).toBe(20);
    expect(r.verifiedProChanged).toBe(true);
    expect(r.verifiedPro!.active).toBe(true);
    expect(r.verifiedPro!.plan).toBe('weekly');
    expect(r.verifiedPro!.paidThroughWeek).toBeUndefined();
  });

  it('bills both subscriptions sequentially and sums the charge', () => {
    const r = applySubscriptionsForWeek({
      verifiedPro: activeVerifiedPro(), // 20
      sparkPremium: activeSparkPremium(), // 24
      moneyAvailable: 1000,
      nextWeeksLived: 5,
    });
    expect(r.totalCharged).toBe(44);
    expect(r.verifiedPro!.active).toBe(true);
    expect(r.sparkPremium!.active).toBe(true);
  });

  it('bills the first sub, then lapses the second when cash runs out mid-tick', () => {
    // $30 covers Pulse ($20) but not the remaining $10 vs Spark's $24 → Spark lapses.
    const r = applySubscriptionsForWeek({
      verifiedPro: activeVerifiedPro(), // 20, affordable
      sparkPremium: activeSparkPremium(), // 24, unaffordable after Pulse
      moneyAvailable: 30,
      nextWeeksLived: 5,
    });
    expect(r.totalCharged).toBe(20);
    expect(r.verifiedPro!.active).toBe(true);
    expect(r.sparkPremium!.active).toBe(false);
    expect(r.sparkPremium!.tier).toBe('free');
  });
});
