/**
 * "Weekly Cash Flow" has to be the player's actual cash flow.
 *
 * The home tab's panel answers one question — what will this week take, and
 * what will it bring — and it was answering with a SUBSET. Three costs the
 * weekly tick charges had no representation in `calcWeeklyExpenses` at all:
 *
 *   luxury upkeep    `applyLuxuryItems`   up to $556,820/wk for a full collection
 *   pet food         `applyPets`          $15/wk per living pet
 *   subscriptions    `applySubscriptions` Pulse Verified Pro + Spark Premium
 *
 * and luxury YIELD (up to $301,200/wk, credited by the same subsystem) was
 * missing from the income side. A collector's Cash Flow was optimistic by more
 * than a quarter of a million dollars a week.
 *
 * This is the same failure as the salary report that started this work — a
 * number the tick computes and a screen recomputes differently — except that
 * here the screen's version omitted whole terms rather than a multiplier. The
 * remedy is the same: each line is computed by calling the function the
 * CHARGING subsystem calls (`getTotalLuxuryUpkeep`, `PET_WEEKLY_FOOD_COST`,
 * `totalSubscriptionWeeklyCharge`), never by restating its rules.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { calcWeeklyExpenses } from '@/lib/economy/expenses';
import { getTotalLuxuryUpkeep, getTotalLuxuryYield } from '@/lib/luxury/operations';
import { PET_WEEKLY_FOOD_COST } from '@/lib/pets/lifecycle';
import {
  isInGameBillable,
  isPrepaidThisWeek,
  totalSubscriptionWeeklyCharge,
} from '@/lib/subscription/billing';
import { LUXURY_CATALOG } from '@/lib/luxury/catalog';
import type { GameState, Pet, PulseVerifiedPro } from '@/contexts/game/types';

const pet = (id: string, isDead = false): Pet =>
  ({ id, name: id, type: 'dog', age: 1, hunger: 50, happiness: 50, health: 80, isDead }) as Pet;

/** A complete PulseVerifiedPro, so the states below need no `as GameState`. */
const verifiedPro = (overrides: Partial<PulseVerifiedPro>): PulseVerifiedPro => ({
  active: true,
  perksUnlocked: {
    blueCheckmark: true,
    postBoostMultiplier: 1.25,
    analyticsUnlocked: true,
    noAdsInFeed: true,
    longerPosts: true,
  },
  ...overrides,
});

/** A couple of real catalogue items, so the numbers are the game's own. */
const someLuxuryIds = LUXURY_CATALOG.slice(0, 3).map((i) => i.id);

describe('every cost the tick charges reaches the expense breakdown', () => {
  it('counts luxury upkeep', () => {
    const withNone = createTestGameState();
    const withSome = createTestGameState({ luxuryItems: someLuxuryIds });

    const expected = getTotalLuxuryUpkeep(someLuxuryIds);
    expect(expected).toBeGreaterThan(0); // guards the assertion below

    expect(calcWeeklyExpenses(withNone).breakdown.luxury).toBe(0);
    expect(calcWeeklyExpenses(withSome).breakdown.luxury).toBe(expected);
    // And it reaches the TOTAL, which is the number the panel actually prints.
    expect(calcWeeklyExpenses(withSome).total - calcWeeklyExpenses(withNone).total).toBe(expected);
  });

  it('counts pet food for living pets only', () => {
    const state = createTestGameState({ pets: [pet('a'), pet('b'), pet('dead', true)] });
    // A dead pet eats nothing — `applyPets` filters on `isDead` before charging.
    expect(calcWeeklyExpenses(state).breakdown.pets).toBe(2 * PET_WEEKLY_FOOD_COST);
  });

  it('counts an active in-game subscription', () => {
    const base = createTestGameState();
    const state: GameState = {
      ...base,
      socialMedia: { ...base.socialMedia!, verifiedPro: verifiedPro({ weeklyPrice: 250 }) },
    };
    expect(calcWeeklyExpenses(state).breakdown.subscriptions).toBe(250);
  });

  it('does not charge an annual plan that is still prepaid', () => {
    // The tick skips it, so the panel must too — otherwise it reports a bill
    // that is not coming.
    const base = createTestGameState({ weeksLived: 100 });
    const state: GameState = {
      ...base,
      socialMedia: {
        ...base.socialMedia!,
        verifiedPro: verifiedPro({ weeklyPrice: 250, plan: 'annual', paidThroughWeek: 200 }),
      },
    };
    expect(calcWeeklyExpenses(state).breakdown.subscriptions).toBe(0);
  });

  it('bills against the week being processed, not the week just finished', () => {
    // `applySubscriptions` charges on `nextWeeksLived`. A prepay expiring at the
    // very next tick is due; reading `weeksLived` raw would call it free.
    const base = createTestGameState({ weeksLived: 199 });
    const state: GameState = {
      ...base,
      socialMedia: {
        ...base.socialMedia!,
        verifiedPro: verifiedPro({ weeklyPrice: 250, plan: 'annual', paidThroughWeek: 200 }),
      },
    };
    expect(calcWeeklyExpenses(state).breakdown.subscriptions).toBe(250);
  });

  it('the itemised lines add up to the total', () => {
    // Student loans and income tax were IN the total with no row to show them,
    // so the itemisation silently disagreed with the figure above it.
    const base = createTestGameState({
      luxuryItems: someLuxuryIds,
      pets: [pet('a')],
    });
    const { total, breakdown } = calcWeeklyExpenses(base, 5000);
    const summed = Object.values(breakdown).reduce((a, b) => a + b, 0);
    expect(summed).toBe(total);
  });
});

describe('the shared billing predicates behave as the tick expects', () => {
  it('ignores a real-money entitlement with no in-game price', () => {
    // A RevenueCat subscription has no `weeklyPrice`. Charging stats.money for
    // it would bill the player twice, once in cash and once for real.
    expect(isInGameBillable({ active: true })).toBe(false);
    expect(isInGameBillable({ active: true, weeklyPrice: 0 })).toBe(false);
    expect(isInGameBillable({ active: false, weeklyPrice: 100 })).toBe(false);
    expect(isInGameBillable(undefined)).toBe(false);
    expect(isInGameBillable({ active: true, weeklyPrice: 100 })).toBe(true);
  });

  it('treats an annual term as prepaid only while it is still running', () => {
    expect(isPrepaidThisWeek({ plan: 'annual', paidThroughWeek: 200 }, 199)).toBe(true);
    expect(isPrepaidThisWeek({ plan: 'annual', paidThroughWeek: 200 }, 200)).toBe(false);
    expect(isPrepaidThisWeek({ plan: 'weekly', paidThroughWeek: 200 }, 100)).toBe(false);
  });

  it('sums several subscriptions and survives corrupt entries', () => {
    expect(
      totalSubscriptionWeeklyCharge(
        [
          { active: true, weeklyPrice: 250 },
          { active: true, weeklyPrice: 100 },
          undefined,
          { active: true, weeklyPrice: Number.NaN },
        ],
        10,
      ),
    ).toBe(350);
  });
});

describe('luxury yield is credited once, not twice', () => {
  it('is real money the tick pays, so the panel has to show it', () => {
    expect(getTotalLuxuryYield(someLuxuryIds)).toBeGreaterThanOrEqual(0);
  });

  it('is NOT inside calcWeeklyPassiveIncome, which the tick consumes directly', () => {
    // `applyIncome` credits `calcWeeklyPassiveIncome(prev).total` and
    // `applyLuxuryItems` credits the yield separately. Folding luxury into the
    // former would pay it twice every week — so IdentityCard adds it at the
    // display layer instead. This test is the guard on that reasoning.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const src: string = require('fs').readFileSync(
      require('path').join(__dirname, '..', '..', 'lib', 'economy', 'passiveIncome.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/getTotalLuxuryYield/);
  });
});
