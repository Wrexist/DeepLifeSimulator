/**
 * The identity card must count the rent the tick actually charges.
 *
 * `calcWeeklyExpenses` feeds the weekly-expenses figure on `IdentityCard`. It
 * counted rent only from `realEstate` entries with `status === 'rented' && !owned`
 * — the shape that predates STATE_VERSION 32.
 *
 * v32 deliberately moved the player's tenancy to `state.rental` instead, because
 * a synthetic `realEstate` entry would make `calculateNetWorth` credit someone
 * with a home they do not own. The display was never updated, so a renting
 * player's largest recurring cost was absent from the card while the tick
 * charged it every week (`weeklyBillsDue` includes `housingWellbeing.rent`, at
 * $45-$950 a tier) and could evict them for the arrears.
 *
 * Nobody lost money — this was always a display defect — but "your expenses"
 * omitting an enforced bill is the same divergence the neighbouring
 * `partnerIncome` memo already guards against in `IdentityCard` with
 * "mirrors computeWeeklyIncome … so the displayed cash flow matches reality".
 *
 * These assertions deliberately read the expected number from
 * `computeHousingWellbeing` / `RENTAL_TIERS` rather than hardcoding it, so a
 * re-priced tier updates the test with the game instead of failing it.
 */
import { calcWeeklyExpenses } from '@/lib/economy/expenses';
import { computeHousingWellbeing, RENTAL_TIERS } from '@/lib/realEstate/rentals';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const TIER = RENTAL_TIERS[1]; // not the cheapest, so a wrong tier is visible

const renting = (over: Partial<GameState> = {}): GameState =>
  createTestGameState({
    realEstate: [],
    rental: { tierId: TIER.id, startedWeek: 10 },
    ...over,
  });

describe('a tenancy shows up in the displayed weekly expenses', () => {
  it('counts the tier rent the tick charges', () => {
    const { breakdown } = calcWeeklyExpenses(renting());

    expect(TIER.weeklyRent).toBeGreaterThan(0); // fixture is a real tier
    expect(breakdown.rent).toBe(TIER.weeklyRent);
  });

  it('and agrees with the tick, read from the tick’s own source', () => {
    // The whole point: one number, one owner. `weeklyBillsDue` in the week loop
    // adds `housingWellbeing.rent`; the card must add the same figure.
    const state = renting();

    expect(calcWeeklyExpenses(state).breakdown.rent)
      .toBe(computeHousingWellbeing(state).rent);
  });

  it('carries into the total, not just the breakdown', () => {
    // A breakdown that is right while the headline number is wrong would be a
    // worse bug than the original, because it looks audited.
    const { total, breakdown } = calcWeeklyExpenses(renting());
    const summed =
      breakdown.upkeep + breakdown.loans + breakdown.miningPower +
      breakdown.vehicles + breakdown.dietPlans + breakdown.rent;

    expect(total).toBe(summed);
    expect(total).toBeGreaterThanOrEqual(TIER.weeklyRent);
  });

  it('every tier is reflected, not just the fixture', () => {
    for (const tier of RENTAL_TIERS) {
      const state = renting({ rental: { tierId: tier.id, startedWeek: 1 } });
      expect(calcWeeklyExpenses(state).breakdown.rent).toBe(tier.weeklyRent);
    }
  });
});

describe('and it does not invent rent for anyone else', () => {
  it('charges nothing when there is no tenancy (the control)', () => {
    expect(calcWeeklyExpenses(createTestGameState({ realEstate: [] })).breakdown.rent).toBe(0);
  });

  it('an unknown tier id degrades to zero rather than NaN', () => {
    // `getRentalTier` returns undefined for an id the catalogue lost; a NaN here
    // would propagate into the displayed total.
    const state = renting({ rental: { tierId: 'a_tier_that_was_removed', startedWeek: 1 } });
    const { total, breakdown } = calcWeeklyExpenses(state);

    expect(breakdown.rent).toBe(0);
    expect(Number.isFinite(total)).toBe(true);
  });

  it('an owner is charged upkeep, not rent — no double count', () => {
    // `computeHousingWellbeing` returns rent 0 when the residence is owned, so
    // adding it cannot double up with the upkeep line this function already had.
    const owner = createTestGameState({
      rental: undefined,
      realEstate: [{
        id: 'home', name: 'Home', owned: true, currentResidence: true,
        price: 200_000, upkeep: 120, upgradeLevel: 0, interior: [],
      } as never],
    });

    const { breakdown } = calcWeeklyExpenses(owner);
    expect(breakdown.rent).toBe(0);
    expect(breakdown.upkeep).toBeGreaterThan(0);
  });

  it('the pre-v32 rented-property path still works (the regression guard)', () => {
    // Owned-but-let and legacy saves still use `status: 'rented'`, and that
    // branch was correct — this change is additive, not a replacement.
    const legacy = createTestGameState({
      rental: undefined,
      realEstate: [{
        id: 'flat', name: 'Flat', owned: false, status: 'rented',
        price: 100_000, upkeep: 0, upgradeLevel: 0, interior: [],
      } as never],
    });

    expect(calcWeeklyExpenses(legacy).breakdown.rent).toBeGreaterThan(0);
  });
});
