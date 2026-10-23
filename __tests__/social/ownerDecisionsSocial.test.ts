/**
 * Owner decisions D12 / D15 / D16 (2026-10-23).
 *
 * D12 - a wedding venue's happiness/reputation bonus is applied on the REAL
 *       wedding path (the weekly tick's `applyScheduledWedding`), in the same
 *       step that charges the balance. Before, only the unreachable manual
 *       `executeWedding` read the bonus, so every venue tier bought the same day.
 * D15 - cancelling an annual Spark Premium plan stops renewal; the perks run to
 *       `paidThroughWeek` instead of being forfeited on the spot.
 * D16 - gifts cannot be sent from jail (the guard dates and proposals use).
 */
import { applyScheduledWedding } from '@/contexts/game/actions/weekly/applyScheduledWedding';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';
import { applySubscriptionsForWeek } from '@/contexts/game/actions/weekly/applySubscriptions';
import {
  cancelSparkPremium,
  sparkPremiumEndsWeek,
  subscribeSparkPremium,
} from '@/contexts/game/actions/SparkActions';
import { giveGift } from '@/contexts/game/actions/DatingActions';
import {
  cancelVerifiedPro,
  subscribeVerifiedPro,
  verifiedProEndsWeek,
} from '@/contexts/game/actions/PulseActions';
import {
  calculateWeddingHappinessBonus,
  calculateWeddingReputationBonus,
  createWeddingPlan,
} from '@/lib/dating/weddingVenues';
import { isCancelledPrepaid, subscriptionWeeklyCharge } from '@/lib/subscription/billing';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import { zeroPreRolls } from '@/__tests__/helpers/zeroPreRolls';
import type { GameState, Relationship } from '@/contexts/game/types';

function harness(initial: GameState) {
  let current = initial;
  const setGameState = (u: GameState | ((p: GameState) => GameState)) => {
    current = typeof u === 'function' ? u(current) : u;
  };
  return { setGameState, get: () => current };
}

describe('D12: the venue bonus lands on the real (tick) wedding path', () => {
  function ctx(money: number, week: number, happiness = 40, reputation = 30): WeekContext {
    return {
      newStats: { money, health: 50, happiness, energy: 50, fitness: 50, reputation, gems: 0 },
      notifications: [],
      preRolls: zeroPreRolls(),
      nextWeeksLived: week,
    };
  }
  function engaged(venueId: string, week: number): Relationship {
    const plan = createWeddingPlan(venueId, 'p1', 60, week, { catering: true, music: true });
    if (!plan) throw new Error(`unknown venue ${venueId}`);
    return {
      ...createTestGameState().relationships[0],
      id: 'p1',
      name: 'Sam',
      type: 'partner',
      relationshipScore: 70,
      engagementWeek: week - 10,
      weddingPlanned: plan,
    } as Relationship;
  }

  it('grants the plan bonus when the balance is charged', () => {
    const rel = engaged('beach_sunset', 100);
    const plan = rel.weddingPlanned!;
    const c = ctx(1_000_000, 100);
    const result = applyScheduledWedding(rel, c);
    expect(result?.rel.type).toBe('spouse');
    const happy = calculateWeddingHappinessBonus(plan);
    const rep = calculateWeddingReputationBonus(plan);
    // beach 30 + catering 5 + music 5; rep 8 + floor(60/20)
    expect(happy).toBe(40);
    expect(rep).toBe(11);
    expect(c.newStats.happiness).toBe(40 + happy);
    expect(c.newStats.reputation).toBe(30 + rep);
    expect(c.newStats.money).toBe(1_000_000 - Math.floor(plan.budget * 0.75));
  });

  it('a pricier venue buys more than the courthouse', () => {
    const cheap = ctx(1_000_000, 100);
    const lavish = ctx(1_000_000, 100);
    applyScheduledWedding(engaged('courthouse', 100), cheap);
    applyScheduledWedding(engaged('destination_tropical', 100), lavish);
    expect(lavish.newStats.happiness).toBeGreaterThan(cheap.newStats.happiness);
    expect(lavish.newStats.reputation).toBeGreaterThan(cheap.newStats.reputation);
  });

  it('no bonus when the wedding cannot be paid for (postponed)', () => {
    const c = ctx(0, 100);
    const result = applyScheduledWedding(engaged('luxury_hotel', 100), c);
    expect(result?.rel.type).toBe('partner');
    expect(c.newStats.happiness).toBe(40);
    expect(c.newStats.reputation).toBe(30);
  });

  it('clamps at 100', () => {
    const c = ctx(1_000_000, 100, 95, 95);
    applyScheduledWedding(engaged('destination_tropical', 100), c);
    expect(c.newStats.happiness).toBe(100);
    expect(c.newStats.reputation).toBe(100);
  });
});

describe('D15: cancelling an annual Spark plan runs it to the end of the paid term', () => {
  function subscribed(plan: 'weekly' | 'annual') {
    const state = createTestGameState({ weeksLived: 200 });
    state.stats.money = 100_000;
    const h = harness(state);
    expect(subscribeSparkPremium(h.setGameState, state, 'ultra', plan).success).toBe(true);
    return h;
  }

  it('keeps tier and perks after cancel, and charges nothing meanwhile', () => {
    const h = subscribed('annual');
    cancelSparkPremium(h.setGameState);
    const p = h.get().sparkApp!.premium;
    expect(p.active).toBe(true);
    expect(p.tier).toBe('ultra');
    expect(p.perks.seeWhoLikedYou).toBe(true);
    expect(p.paidThroughWeek).toBe(252);
    expect(isCancelledPrepaid(p)).toBe(true);
    expect(sparkPremiumEndsWeek(p)).toBe(252);
    expect(subscriptionWeeklyCharge(p, 230)).toBe(0);

    const mid = applySubscriptionsForWeek({
      verifiedPro: undefined, sparkPremium: p, moneyAvailable: 100_000, nextWeeksLived: 251,
    });
    expect(mid.sparkPremiumChanged).toBe(false);
    expect(mid.totalCharged).toBe(0);
  });

  it('ends (no renewal charge) on paidThroughWeek', () => {
    const h = subscribed('annual');
    cancelSparkPremium(h.setGameState);
    const end = applySubscriptionsForWeek({
      verifiedPro: undefined,
      sparkPremium: h.get().sparkApp!.premium,
      moneyAvailable: 100_000,
      nextWeeksLived: 252,
    });
    expect(end.totalCharged).toBe(0);
    expect(end.sparkPremium!.active).toBe(false);
    expect(end.sparkPremium!.tier).toBe('free');
    expect(end.sparkPremium!.perks.seeWhoLikedYou).toBe(false);
    expect(end.notifications.length).toBe(1);
  });

  it('a second cancel is a no-op', () => {
    const h = subscribed('annual');
    cancelSparkPremium(h.setGameState);
    const once = h.get();
    cancelSparkPremium(h.setGameState);
    expect(h.get()).toBe(once);
  });

  it('an uncancelled annual plan still rolls into weekly renewal', () => {
    const h = subscribed('annual');
    const end = applySubscriptionsForWeek({
      verifiedPro: undefined,
      sparkPremium: h.get().sparkApp!.premium,
      moneyAvailable: 100_000,
      nextWeeksLived: 252,
    });
    expect(end.totalCharged).toBeGreaterThan(0);
    expect(end.sparkPremium!.active).toBe(true);
    expect(end.sparkPremium!.plan).toBe('weekly');
  });

  it('a weekly plan still ends at once (nothing prepaid to honour)', () => {
    const h = subscribed('weekly');
    cancelSparkPremium(h.setGameState);
    expect(h.get().sparkApp!.premium.active).toBe(false);
    expect(h.get().sparkApp!.premium.tier).toBe('free');
  });
});

describe('D15 (Pulse): cancelling annual Verified Pro runs it to the end of the paid term', () => {
  function subscribed(plan: 'weekly' | 'annual') {
    const state = createTestGameState({ weeksLived: 200 });
    state.stats.money = 100_000;
    const h = harness(state);
    expect(subscribeVerifiedPro(h.setGameState, state, plan).success).toBe(true);
    return h;
  }

  it('keeps perks and the blue check after cancel, charges nothing meanwhile', () => {
    const h = subscribed('annual');
    cancelVerifiedPro(h.setGameState);
    const vp = h.get().socialMedia!.verifiedPro!;
    expect(vp.active).toBe(true);
    expect(vp.perksUnlocked.blueCheckmark).toBe(true);
    expect(h.get().userProfile.verified).toBe(true);
    expect(verifiedProEndsWeek(vp)).toBe(252);
    const mid = applySubscriptionsForWeek({
      verifiedPro: vp, sparkPremium: undefined, moneyAvailable: 100_000, nextWeeksLived: 251,
    });
    expect(mid.verifiedProChanged).toBe(false);
    expect(mid.totalCharged).toBe(0);
  });

  it('ends without a renewal charge on paidThroughWeek', () => {
    const h = subscribed('annual');
    cancelVerifiedPro(h.setGameState);
    const end = applySubscriptionsForWeek({
      verifiedPro: h.get().socialMedia!.verifiedPro, sparkPremium: undefined,
      moneyAvailable: 100_000, nextWeeksLived: 252,
    });
    expect(end.totalCharged).toBe(0);
    expect(end.verifiedProChanged).toBe(true);
    expect(end.verifiedPro!.active).toBe(false);
    expect(end.verifiedPro!.perksUnlocked.blueCheckmark).toBe(false);
  });

  it('a second cancel is a no-op; a weekly plan still ends at once', () => {
    const h = subscribed('annual');
    cancelVerifiedPro(h.setGameState);
    const once = h.get();
    cancelVerifiedPro(h.setGameState);
    expect(h.get()).toBe(once);

    const w = subscribed('weekly');
    cancelVerifiedPro(w.setGameState);
    expect(w.get().socialMedia!.verifiedPro!.active).toBe(false);
    expect(w.get().userProfile.verified).toBe(false);
  });
});

describe('D16: no gifts from jail', () => {
  function withPartner(jailWeeks: number): GameState {
    const base = createTestGameState({ weeksLived: 50, jailWeeks });
    base.stats.money = 10_000;
    base.relationships = [
      ...base.relationships,
      { ...base.relationships[0], id: 'p1', name: 'Sam', type: 'partner', relationshipScore: 50 } as Relationship,
    ];
    return base;
  }

  it('refuses and charges nothing while jailed', () => {
    const state = withPartner(3);
    const h = harness(state);
    const r = giveGift(state, h.setGameState, 'p1', 'flowers');
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/jail/i);
    expect(h.get()).toBe(state);
  });

  it('the updater re-checks jail against prev (stale free snapshot)', () => {
    const free = withPartner(0);
    const jailed = { ...free, jailWeeks: 2 };
    const h = harness(jailed);
    giveGift(free, h.setGameState, 'p1', 'flowers');
    expect(h.get()).toBe(jailed);
  });

  it('still works once free', () => {
    const state = withPartner(0);
    const h = harness(state);
    expect(giveGift(state, h.setGameState, 'p1', 'flowers').success).toBe(true);
    expect(h.get().stats.money).toBeLessThan(10_000);
  });
});
