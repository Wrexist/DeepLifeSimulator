/**
 * Housing wellbeing — and the two things it must NOT get wrong.
 *
 * The reducer itself is small; what earns a test file is the pair of boundary
 * cases either side of it:
 *
 *  - The first week's rent is taken at SIGNING (`resolveRentHome` charges it on
 *    the spot so a tenancy never starts in arrears). If the tick then bills the
 *    same week, the player pays twice for one week of housing while the signing
 *    message tells them the week is already paid.
 *  - `owns` has to be distinguishable from `rent === 0`, because the caller uses
 *    it to decide whether a lease is still live. Conflate them and the skipped
 *    signing-week charge reads as ownership, ending the lease on its first week.
 */
import { applyHousingWellbeing } from '../applyHousingWellbeing';
import type { WeekContext } from '../weekContext';
import { RENTAL_TIERS, HOMELESS_PENALTY } from '@/lib/realEstate/rentals';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const TIER = RENTAL_TIERS[2];

const ctx = (): WeekContext =>
  ({
    newStats: { health: 50, happiness: 50, energy: 50, money: 1000 },
    notifications: [],
  }) as unknown as WeekContext;

const renting = (startedWeek: number, weeksLived: number): GameState =>
  createTestGameState({
    weeksLived,
    realEstate: [],
    rental: { tierId: TIER.id, startedWeek },
  });

const run = (prevState: GameState, c = ctx()) => ({
  result: applyHousingWellbeing(
    { prevState, ownedHappinessBonus: 7, nextWeeksLived: (prevState.weeksLived ?? 0) + 1 },
    c,
  ),
  ctx: c,
});

describe('the signing week is not charged twice', () => {
  it('bills no rent on the week the tenancy started', () => {
    // startedWeek === weeksLived: the player signed during this week and has
    // already paid for it.
    expect(run(renting(20, 20)).result.rent).toBe(0);
  });

  it('bills the full rent every week after that', () => {
    expect(run(renting(20, 21)).result.rent).toBe(TIER.weeklyRent);
    expect(run(renting(20, 40)).result.rent).toBe(TIER.weeklyRent);
  });

  it('still pays the wellbeing on the signing week', () => {
    // Skipping the CHARGE must not skip the benefit — the player lives there.
    const { result, ctx: c } = run(renting(20, 20));
    expect(result.happiness).toBe(TIER.happiness);
    expect(c.newStats.energy).toBe(50 + TIER.energy);
    expect(c.newStats.health).toBe(50 + TIER.health);
  });

  it('treats a legacy tenancy with no startedWeek as an ordinary rent week', () => {
    const state = createTestGameState({
      weeksLived: 30,
      realEstate: [],
      // A tenancy written before `startedWeek` existed.
      rental: { tierId: TIER.id } as GameState['rental'],
    });
    expect(run(state).result.rent).toBe(TIER.weeklyRent);
  });
});

describe('`owns` says who the home belongs to, not what it costs', () => {
  it('is false on the signing week, even though the rent is 0', () => {
    // The whole reason the flag exists: `rent === 0` is also true here, and the
    // caller would read that as ownership and cancel the brand-new lease.
    const { result } = run(renting(20, 20));
    expect(result.rent).toBe(0);
    expect(result.owns).toBe(false);
  });

  it('is false when homeless', () => {
    const state = createTestGameState({ realEstate: [], rental: undefined });
    const { result } = run(state);
    expect(result.owns).toBe(false);
    expect(result.homeless).toBe(true);
    expect(result.happiness).toBe(HOMELESS_PENALTY.happiness);
  });

  it('is true for an owned residence, which keeps the housing module’s happiness', () => {
    const state = createTestGameState({
      realEstate: [
        {
          id: 'home', name: 'House', price: 100_000, weeklyHappiness: 4, weeklyEnergy: 6,
          owned: true, currentResidence: true, status: 'owner', interior: [], upgradeLevel: 0,
        },
      ],
      rental: undefined,
    });
    const { result } = run(state);
    expect(result.owns).toBe(true);
    expect(result.rent).toBe(0);
    // 7 = the ownedHappinessBonus passed in, not the catalogue's 4: the housing
    // module already folded decor, rooms and condition into it.
    expect(result.happiness).toBe(7);
  });
});
