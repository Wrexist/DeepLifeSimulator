/**
 * Vehicle insurance is a 26-week term, and terms have to end.
 *
 * ── What was wrong ────────────────────────────────────────────────────────
 * `purchaseInsurance` charges a six-month premium and stamps `expiresWeek`.
 * Three places READ that field — to block re-buying an active policy, and
 * twice to prorate a cancellation refund — and not one of them ever expired
 * the policy.
 *
 * The code that did expire it lived in `VehicleActions.processVehicleWeekly`,
 * the pre-WeekContext version of this reducer. That function has NO production
 * caller: it is reachable only from its own stress tests, which is exactly the
 * shape that makes dead code dangerous — it looks maintained.
 *
 * So in live play a single premium bought PERMANENT coverage: reduced repair
 * bills and reduced injury on every accident, for the rest of the life. The
 * most expensive recurring purchase in the vehicle system was a one-off.
 *
 * These tests drive the live reducer, `applyVehiclesForWeek`.
 */

import { applyVehiclesForWeek } from '@/contexts/game/actions/weekly/applyVehicles';
import type { WeekContext } from '@/contexts/game/actions/weekly/weekContext';
import type { Vehicle } from '@/contexts/game/types';

const TERM_WEEKS = 26;

function ctxAt(week: number): WeekContext {
  return {
    newStats: { health: 100, happiness: 100, energy: 100, fitness: 100, money: 100_000, reputation: 50, gems: 0 },
    notifications: [],
    // No accidents: every roll sits above any plausible chance, so these tests
    // observe expiry alone rather than an accident's side effects.
    preRolls: {
      vehicleAccident: Array(10).fill(0.999),
      vehicleAccidentSeverity: Array(10).fill(0.5),
    },
    nextWeeksLived: week,
    deferredCharges: 0,
  } as unknown as WeekContext;
}

function insuredCar(expiresWeek: number): Vehicle {
  return {
    id: 'car-1',
    name: 'Test Car',
    owned: true,
    price: 20_000,
    condition: 90,
    mileage: 1_000,
    weeklyMaintenanceCost: 10,
    weeklyFuelCost: 5,
    insurance: { active: true, coveragePercent: 80, monthlyCost: 100, expiresWeek },
  } as unknown as Vehicle;
}

describe('a policy inside its term keeps working', () => {
  it('stays active the week before it expires', () => {
    const out = applyVehiclesForWeek([insuredCar(TERM_WEEKS)], ctxAt(TERM_WEEKS - 1));
    expect(out[0]?.insurance?.active).toBe(true);
  });

  it('raises no expiry notification while it is live', () => {
    const ctx = ctxAt(TERM_WEEKS - 1);
    applyVehiclesForWeek([insuredCar(TERM_WEEKS)], ctx);
    expect(ctx.notifications.filter((n) => n.title === 'Insurance Expired')).toHaveLength(0);
  });
});

describe('a policy past its term lapses', () => {
  it('deactivates exactly ON the expiry week', () => {
    // `>=`, not `>`: the term is 26 weeks of cover, so week 26 is the first
    // uncovered one.
    const out = applyVehiclesForWeek([insuredCar(TERM_WEEKS)], ctxAt(TERM_WEEKS));
    expect(out[0]?.insurance?.active).toBe(false);
  });

  it('deactivates long after expiry, which is what existing saves hit', () => {
    // Every save in the wild has been accruing permanent coverage. The first
    // tick after this ships must lapse it rather than skip an already-past date.
    const out = applyVehiclesForWeek([insuredCar(30)], ctxAt(500));
    expect(out[0]?.insurance?.active).toBe(false);
  });

  it('tells the player, so the lapse is not silent', () => {
    const ctx = ctxAt(TERM_WEEKS);
    applyVehiclesForWeek([insuredCar(TERM_WEEKS)], ctx);
    const notes = ctx.notifications.filter((n) => n.title === 'Insurance Expired');
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toMatch(/Test Car/);
  });

  it('only fires once — a lapsed policy is not re-expired every week', () => {
    let vehicles = [insuredCar(TERM_WEEKS)];
    const ctx = ctxAt(TERM_WEEKS);
    vehicles = applyVehiclesForWeek(vehicles, ctx);
    const later = ctxAt(TERM_WEEKS + 1);
    applyVehiclesForWeek(vehicles, later);
    expect(later.notifications.filter((n) => n.title === 'Insurance Expired')).toHaveLength(0);
  });
});

describe('expiry does not disturb the rest of the tick', () => {
  it('leaves an uninsured vehicle alone', () => {
    const bare = { ...insuredCar(TERM_WEEKS), insurance: undefined } as Vehicle;
    const ctx = ctxAt(TERM_WEEKS);
    const out = applyVehiclesForWeek([bare], ctx);
    expect(out[0]?.insurance).toBeUndefined();
    expect(ctx.notifications.filter((n) => n.title === 'Insurance Expired')).toHaveLength(0);
  });

  it('ignores a policy with no expiry stamped rather than lapsing it', () => {
    // A malformed or legacy record must not be silently cancelled — that would
    // take away cover the player did pay for.
    const out = applyVehiclesForWeek([insuredCar(0)], ctxAt(500));
    expect(out[0]?.insurance?.active).toBe(true);
  });

  it('still charges running costs and decays condition', () => {
    const ctx = ctxAt(TERM_WEEKS);
    const out = applyVehiclesForWeek([insuredCar(TERM_WEEKS)], ctx);
    expect(ctx.newStats.money).toBeLessThan(100_000);
    expect(out[0]!.condition).toBeLessThan(90);
  });
});
