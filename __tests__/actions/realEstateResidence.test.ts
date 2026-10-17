/**
 * A home you own must be somewhere you can live (2026-10-17).
 *
 * `currentResidence` had ONE writer that could turn it on - the purchase - and
 * two that turned it off (renting out, selling). So a player who bought a house
 * with "Make this my primary residence" left at its OFF default, or who rented
 * their home out and then stopped, was read as HOMELESS by the weekly tick
 * (-2 health, -4 happiness, -5 energy every week) while owning a house.
 *
 * These pin the second door (`makePropertyHome`, backed by `canMoveIn`), the
 * stop-renting move-back-in, and the outcome the tick actually reads:
 * `computeHousingWellbeing`, the same function `applyHousingWellbeing` charges by.
 */
import {
  buyPropertyWithMortgage,
  makePropertyHome,
  resolveMakeHome,
  resolveStopRenting,
  setPropertyRentMode,
  stopRenting,
} from '@/contexts/game/actions/RealEstateActions';
import { computeHousingWellbeing, resolveTenancyStep } from '@/lib/realEstate/rentals';
import { canMoveIn, movesBackInOnStopRenting } from '@/lib/realEstate/residence';
import { COMMERCIAL_CATALOG } from '@/lib/realEstate/catalog';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, RealEstate } from '@/contexts/game/types';

function makeBatchedSetState(initial: GameState) {
  let state = initial;
  const setState: React.Dispatch<React.SetStateAction<GameState>> = (update) => {
    state = typeof update === 'function' ? update(state) : update;
  };
  return { setState, get: () => state };
}

function house(over: Partial<RealEstate> = {}): RealEstate {
  return {
    id: 'sub-house',
    name: 'Suburban House',
    price: 400_000,
    weeklyHappiness: 8,
    weeklyEnergy: 4,
    owned: true,
    interior: [],
    rooms: [],
    upgradeLevel: 0,
    currentValue: 400_000,
    purchasePrice: 400_000,
    condition: 90,
    status: 'owner',
    ...over,
  };
}

function stateWith(realEstate: RealEstate[], extra: Partial<GameState> = {}): GameState {
  return createTestGameState({ stats: { money: 50_000 }, realEstate, rental: undefined, ...extra });
}

describe('makePropertyHome - moving into a house you own', () => {
  it('moves a homeless owner in, so the tick stops charging the homeless penalty', () => {
    const before = stateWith([house({ currentResidence: false })]);
    // The defect, measured: an owner with an empty house is homeless.
    expect(computeHousingWellbeing(before).homeless).toBe(true);

    const { setState, get } = makeBatchedSetState(before);
    const r = makePropertyHome(before, setState, 'sub-house');

    expect(r.success).toBe(true);
    expect(r.message).toBe('You moved into Suburban House - no more sleeping rough.');
    const after = get();
    expect(after.realEstate[0].currentResidence).toBe(true);
    const wellbeing = computeHousingWellbeing(after);
    expect(wellbeing.homeless).toBe(false);
    expect(wellbeing.owned).toBe(true);
    // The house's own figures now apply instead of -2/-4/-5.
    expect(wellbeing).toMatchObject({ health: 2, happiness: 8, energy: 4, rent: 0 });
  });

  it('moves the player out of their previous owned home - one residence at a time', () => {
    const before = stateWith([
      house({ id: 'studio-apt', name: 'Studio Apartment', currentResidence: true }),
      house({ currentResidence: false }),
    ]);
    const outcome = resolveMakeHome(before, 'sub-house');
    expect(outcome.result).toEqual({ success: true, message: 'You moved into Suburban House and out of Studio Apartment.' });
    const homes = (outcome.next?.realEstate ?? []).filter((p) => p.currentResidence);
    expect(homes.map((p) => p.id)).toEqual(['sub-house']);
  });

  it('a renter who moves in stops paying rent and the tick ends the lease, exactly as when a renter buys', () => {
    const before = stateWith([house({ currentResidence: false })], { rental: { tierId: 'shared-room', startedWeek: 0 } });
    expect(computeHousingWellbeing(before).rent).toBe(45);

    const outcome = resolveMakeHome(before, 'sub-house');
    expect(outcome.result.message).toBe('You moved into Suburban House. Your lease on the Shared Room ends this week - no more rent.');
    const after = outcome.next!;
    // Ownership wins at once: no rent from the next tick on...
    expect(computeHousingWellbeing(after)).toMatchObject({ owned: true, rent: 0, homeless: false });
    // ...and the tick's tenancy step ends the lease rather than running its
    // eviction clock (the same path `resolveBuyProperty` relies on).
    const step = resolveTenancyStep({ rental: after.rental, overdueBalance: 0, owns: true });
    expect(step.rental).toBeUndefined();
    expect(step.notice).toMatch(/lease has ended/);
  });

  it.each([
    ['not owned', [house({ owned: false })], 'You must own this property to live in it.'],
    ['rented out', [house({ status: 'rented', rentMode: 'longTerm' })], 'Suburban House is rented out. Stop renting it first, then move in.'],
    ['already home', [house({ currentResidence: true })], 'You already live at Suburban House.'],
  ])('refuses when the property is %s, with the reason, and changes nothing', (_label, realEstate, reason) => {
    const before = stateWith(realEstate as RealEstate[]);
    const { setState, get } = makeBatchedSetState(before);
    const r = makePropertyHome(before, setState, 'sub-house');
    expect(r).toEqual({ success: false, message: reason });
    expect(get()).toBe(before);
    // The sheet reads the same verdict, so it shows this reason and a disabled button.
    expect(canMoveIn(before, 'sub-house')).toMatchObject({ allowed: false, reason });
  });

  it('refuses a commercial property - nobody lives in a warehouse', () => {
    const warehouse = { ...COMMERCIAL_CATALOG.find((c) => c.id === 'warehouse')!, owned: true, status: 'owner' as const };
    const before = stateWith([warehouse]);
    const outcome = resolveMakeHome(before, 'warehouse');
    expect(outcome.next).toBeNull();
    expect(outcome.result.message).toBe('Warehouse is a commercial property - you cannot live there.');
  });

  it('a same-batch double tap commits once (the second sees it is already home)', () => {
    const before = stateWith([house({ currentResidence: false })]);
    const { setState, get } = makeBatchedSetState(before);
    makePropertyHome(before, setState, 'sub-house');
    const once = get();
    setState((prev) => resolveMakeHome(prev, 'sub-house').next ?? prev);
    expect(get()).toBe(once);
  });
});

describe('stopRenting - taking your home off the rental market', () => {
  it('REGRESSION: rent your home out, stop, and you live there again (was: homeless)', () => {
    const start = stateWith([house({ currentResidence: true })]);
    const { setState, get } = makeBatchedSetState(start);

    setPropertyRentMode(setState, 'sub-house', 'longTerm', 600);
    // Renting it out moves you out - that half is unchanged and stated on the sheet.
    expect(get().realEstate[0].currentResidence).toBe(false);
    expect(computeHousingWellbeing(get()).homeless).toBe(true);

    stopRenting(setState, 'sub-house');
    const after = get();
    expect(after.realEstate[0].status).toBe('owner');
    expect(after.realEstate[0].rentMode).toBeUndefined();
    expect(after.realEstate[0].currentResidence).toBe(true);
    expect(computeHousingWellbeing(after).homeless).toBe(false);
  });

  it('says so in its outcome', () => {
    const before = stateWith([house({ status: 'rented', rentMode: 'longTerm', rent: 600 })]);
    expect(movesBackInOnStopRenting(before, 'sub-house')).toBe(true);
    expect(resolveStopRenting(before, 'sub-house').result.message).toBe(
      'Suburban House is off the rental market, and you moved back in.',
    );
  });

  it('does NOT move a player who already lives somewhere - an owned home or a lease', () => {
    const owner = stateWith([
      house({ id: 'studio-apt', name: 'Studio Apartment', currentResidence: true }),
      house({ status: 'rented', rentMode: 'longTerm', rent: 600 }),
    ]);
    const ownerNext = resolveStopRenting(owner, 'sub-house').next!;
    const stopped = ownerNext.realEstate.find((p) => p.id === 'sub-house')!;
    expect(stopped.status).toBe('owner');
    expect(stopped.currentResidence).toBeFalsy();
    expect(ownerNext.realEstate.find((p) => p.id === 'studio-apt')!.currentResidence).toBe(true);

    const renter = stateWith([house({ status: 'rented', rentMode: 'longTerm', rent: 600 })], {
      rental: { tierId: 'rented-penthouse', startedWeek: 0 },
    });
    const renterOutcome = resolveStopRenting(renter, 'sub-house');
    expect(renterOutcome.result.message).toBe('Suburban House is off the rental market.');
    expect(renterOutcome.next!.realEstate[0].currentResidence).toBeFalsy();
    expect(renterOutcome.next!.rental).toEqual({ tierId: 'rented-penthouse', startedWeek: 0 });
  });

  it('never moves anyone into a commercial property', () => {
    const shop = { ...COMMERCIAL_CATALOG[0], owned: true, status: 'rented' as const, rentMode: 'commercial' as const };
    const before = stateWith([shop]);
    expect(movesBackInOnStopRenting(before, shop.id)).toBe(false);
    expect(resolveStopRenting(before, shop.id).next!.realEstate[0].currentResidence).toBeFalsy();
  });

  it('refuses a property that is not rented out or not owned', () => {
    expect(resolveStopRenting(stateWith([house()]), 'sub-house').next).toBeNull();
    expect(resolveStopRenting(stateWith([house({ owned: false, status: 'rented' })]), 'sub-house').next).toBeNull();
  });
});

describe('buying - the residence flag cannot land on a commercial listing', () => {
  it('ignores asResidence for a commercial purchase even if a caller passes it', () => {
    const warehouse = COMMERCIAL_CATALOG.find((c) => c.id === 'warehouse')!;
    const before = createTestGameState({ stats: { money: 5_000_000 }, realEstate: [], rental: undefined });
    const { setState, get } = makeBatchedSetState(before);
    const r = buyPropertyWithMortgage(before, setState, {
      property: warehouse,
      tier: 'cash',
      term: '30y',
      weeklyIncome: 10_000,
      asResidence: true,
    });
    expect(r.success).toBe(true);
    expect(get().realEstate.find((p) => p.id === 'warehouse')!.currentResidence).toBe(false);
  });
});
