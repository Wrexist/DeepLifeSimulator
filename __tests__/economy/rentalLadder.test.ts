/**
 * Rentable housing: the ladder, the wellbeing it grants, and the cost of none.
 *
 * ── The three things this covers ──────────────────────────────────────────
 *
 * 1. The ladder is priced against the CURRENT income scale. A ladder where every
 *    rung is affordable is a menu, not a decision, and a ladder priced by
 *    intuition drifts the moment wages are re-tuned — which they just were.
 *
 * 2. The bonuses actually reach the player. Housing granted happiness only, via
 *    the owned-residence path.
 *
 * 3. `weeklyEnergy` is finally paid. Every catalogue property carries it (2 to
 *    10 per week) and nothing in shipping code read it — except `TopStatsBar`,
 *    which has been adding it to the HUD's predicted weekly energy change the
 *    whole time. The HUD promised a bonus the tick never delivered, and nothing
 *    could catch that because no test compared the two.
 */
import { INITIAL_CAREERS } from '@/lib/careers/careerData';
import {
  HOMELESS_PENALTY,
  RENTAL_TIERS,
  canRent,
  computeHousingWellbeing,
  getRentalTier,
  weeklyIncomeForLetting,
} from '@/lib/realEstate/rentals';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const BOTTOM_RUNG = INITIAL_CAREERS.find((c) => c.id === 'fast_food')!.levels[0].salary;

/** A state holding a job at `salary`, with `cash` on hand. */
function earner(salary: number, cash = 10_000, over: Partial<GameState> = {}): GameState {
  return createTestGameState({
    currentJob: 'probe',
    careers: [
      {
        id: 'probe',
        levels: [{ name: 'Probe', salary }],
        level: 0,
        description: 'fixture',
        requirements: {},
        progress: 0,
        applied: true,
        accepted: true,
      },
    ],
    stats: { ...createTestGameState().stats, money: cash },
    ...over,
  } as Partial<GameState>);
}

describe('the ladder is a decision, not a menu', () => {
  it('runs cheapest to dearest, with bonuses that follow the rent', () => {
    for (let i = 1; i < RENTAL_TIERS.length; i++) {
      const prev = RENTAL_TIERS[i - 1];
      const tier = RENTAL_TIERS[i];
      expect(`${tier.id} rent`).toBe(tier.weeklyRent > prev.weeklyRent ? `${tier.id} rent` : 'out of order');
      expect(tier.happiness).toBeGreaterThanOrEqual(prev.happiness);
      expect(tier.energy).toBeGreaterThanOrEqual(prev.energy);
      expect(tier.health).toBeGreaterThanOrEqual(prev.health);
    }
  });

  it('keeps the bottom rung reachable on the worst income in the game', () => {
    // It has to be signable by someone with no job at all, because that is who
    // most needs to get off the street.
    const bottom = RENTAL_TIERS[0];
    expect(bottom.incomeRequirement).toBe(0);
    expect(bottom.weeklyRent).toBeLessThan(BOTTOM_RUNG);
  });

  it('makes the second rung a real commitment on a minimum wage', () => {
    // Affordable, but most of the paycheck — so taking it costs something.
    const second = RENTAL_TIERS[1];
    expect(second.weeklyRent).toBeLessThan(BOTTOM_RUNG);
    expect(second.weeklyRent).toBeGreaterThan(BOTTOM_RUNG * 0.5);
  });

  it('puts the upper tiers out of reach of a bottom-rung wage', () => {
    const reachable = RENTAL_TIERS.filter((t) => t.incomeRequirement <= BOTTOM_RUNG);
    expect(reachable.length).toBeLessThan(RENTAL_TIERS.length);
    expect(reachable.length).toBeGreaterThanOrEqual(2);
  });

  it('never lets rent exceed the income it demands', () => {
    // A tier a player qualifies for but cannot service is a trap, not a choice.
    for (const tier of RENTAL_TIERS) {
      if (tier.incomeRequirement > 0) {
        expect(tier.weeklyRent).toBeLessThan(tier.incomeRequirement);
      }
    }
  });
});

describe('signing a lease', () => {
  it('refuses on income, and says why', () => {
    const top = RENTAL_TIERS[RENTAL_TIERS.length - 1];
    const verdict = canRent(earner(BOTTOM_RUNG), top);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/income/i);
  });

  it('refuses when the first week is not on hand, and says why', () => {
    const tier = RENTAL_TIERS[0];
    const verdict = canRent(earner(BOTTOM_RUNG, 5), tier);
    expect(verdict.allowed).toBe(false);
    expect(verdict.reason).toMatch(/first week/i);
  });

  it('allows a qualified, solvent player', () => {
    expect(canRent(earner(BOTTOM_RUNG), RENTAL_TIERS[0]).allowed).toBe(true);
  });

  it('reads income from the career, not from wealth', () => {
    // A landlord asks what you earn. Net worth would let a retired millionaire
    // with no job fail, and a broke lottery winner pass.
    expect(weeklyIncomeForLetting(earner(500))).toBe(500);
    expect(weeklyIncomeForLetting(createTestGameState({ currentJob: undefined }))).toBe(0);
  });
});

describe('what your home does for you each week', () => {
  it('pays the rented tier s health, happiness and energy', () => {
    const tier = RENTAL_TIERS[2];
    const state = earner(BOTTOM_RUNG, 10_000, {
      rental: { tierId: tier.id, startedWeek: 4 },
    } as Partial<GameState>);

    const wellbeing = computeHousingWellbeing(state);
    expect(wellbeing.health).toBe(tier.health);
    expect(wellbeing.happiness).toBe(tier.happiness);
    expect(wellbeing.energy).toBe(tier.energy);
    expect(wellbeing.rent).toBe(tier.weeklyRent);
    expect(wellbeing.homeless).toBe(false);
  });

  it('pays an OWNED residence the energy the HUD has been promising', () => {
    // THE regression. `TopStatsBar` adds `currentResidence.weeklyEnergy` to its
    // predicted weekly change; `processWeeklyHousing` applied happiness alone,
    // so the number on screen was never delivered.
    const state = createTestGameState({
      realEstate: [
        {
          id: 'sub-house',
          name: 'Suburban House',
          price: 480_000,
          owned: true,
          currentResidence: true,
          status: 'owner',
          weeklyHappiness: 8,
          weeklyEnergy: 4,
          interior: [],
          upgradeLevel: 0,
        },
      ],
    } as unknown as Partial<GameState>);

    const wellbeing = computeHousingWellbeing(state);
    expect(wellbeing.energy).toBe(4);
    expect(wellbeing.health).toBeGreaterThan(0);
    expect(wellbeing.rent).toBe(0);
  });

  it('charges nothing when you own the roof over your head', () => {
    const state = createTestGameState({
      realEstate: [
        { id: 'studio-apt', name: 'Studio', price: 95_000, owned: true, currentResidence: true,
          status: 'owner', weeklyHappiness: 3, weeklyEnergy: 2, interior: [], upgradeLevel: 0 },
      ],
      rental: { tierId: RENTAL_TIERS[0].id, startedWeek: 1 },
    } as unknown as Partial<GameState>);

    // Owning wins over a tenancy: buying a home should be an upgrade, and it
    // should stop the rent.
    expect(computeHousingWellbeing(state).rent).toBe(0);
  });
});

describe('the HUD predicts what the tick actually pays', () => {
  // The original bug ran one way — the bar promised energy the tick never paid.
  // Adding rentals, a homeless penalty and a health effect opened it the other
  // way: the bar's own copy of the housing maths only knew about an OWNED
  // residence, so it under-predicted for a renter and showed nothing at all for
  // someone sleeping rough, while the tick applied all three. One function now
  // answers "what does my home do this week" and both callers read it.
  const source = () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path') as typeof import('path');
    return fs.readFileSync(
      path.join(__dirname, '..', '..', 'components/TopStatsBar.tsx'),
      'utf8',
    );
  };

  it('TopStatsBar derives its prediction from computeHousingWellbeing', () => {
    const bar = source();
    expect(bar).toMatch(/computeHousingWellbeing\s*\(/);
    expect(bar).toMatch(/from\s+'@\/lib\/realEstate\/rentals'/);
  });

  it('no longer keeps a second, owned-only copy of the housing maths', () => {
    // The specific shape that made the bar disagree with the tick.
    expect(source()).not.toMatch(/currentResidence\.weekly(Energy|Happiness)/);
  });
});

describe('having nowhere to live costs something', () => {
  it('applies the homeless penalty', () => {
    const wellbeing = computeHousingWellbeing(createTestGameState());
    expect(wellbeing.homeless).toBe(true);
    expect(wellbeing.health).toBe(HOMELESS_PENALTY.health);
    expect(wellbeing.happiness).toBe(HOMELESS_PENALTY.happiness);
    expect(wellbeing.energy).toBe(HOMELESS_PENALTY.energy);
  });

  it('is survivable — pressure, not a death sentence', () => {
    // Death from a zero stat needs four consecutive weeks. From full health this
    // penalty alone must never be able to get there, or "cannot afford rent"
    // becomes "the save is over".
    const weeksToZeroHealth = 100 / Math.abs(HOMELESS_PENALTY.health);
    expect(weeksToZeroHealth).toBeGreaterThan(20);
  });

  it('costs more than the cheapest room is worth, so renting is the better play', () => {
    const bottom = RENTAL_TIERS[0];
    const swing = Math.abs(HOMELESS_PENALTY.happiness) + bottom.happiness;
    expect(swing).toBeGreaterThan(0);
    expect(bottom.energy - HOMELESS_PENALTY.energy).toBeGreaterThan(0);
  });

  it('treats an unknown tier id as homeless rather than crashing', () => {
    const state = createTestGameState({
      rental: { tierId: 'a-tier-that-was-removed', startedWeek: 3 },
    } as unknown as Partial<GameState>);
    expect(getRentalTier('a-tier-that-was-removed')).toBeUndefined();
    expect(computeHousingWellbeing(state).homeless).toBe(true);
  });

  it('survives a corrupt state without emitting NaN into the stats', () => {
    // DELIBERATE-CORRUPTION — the values a truncated or partially-migrated save
    // actually presents. Typing them honestly is impossible; that is the test.
    for (const bad of [undefined, null, {} as GameState]) {
      const wellbeing = computeHousingWellbeing(bad as GameState);
      expect(Number.isFinite(wellbeing.health)).toBe(true);
      expect(Number.isFinite(wellbeing.happiness)).toBe(true);
      expect(Number.isFinite(wellbeing.energy)).toBe(true);
      expect(Number.isFinite(wellbeing.rent)).toBe(true);
    }
  });
});
