/**
 * A minimally-valid owned `RealEstate`, for tests that need a property to exist.
 *
 * Four suites were hand-rolling this literal, and all four had drifted off the
 * real interface in the SAME three ways — because they were copied from each
 * other rather than from `contexts/game/types.ts`:
 *
 *   `type: 'house'`      — no such field. `RealEstate` has no `type` at all.
 *   `installedDecor: []` — no such field. Those are the names of two LOCAL
 *   `installedRooms: []`    variables inside `calculatePropertyHappiness`
 *                           (housing.ts:143,149), derived by mapping the real
 *                           fields `interior` and `rooms` through the decor and
 *                           room catalogues. A fixture setting `installedDecor`
 *                           reads as "no decor installed" while the field the
 *                           function actually looks at, `interior`, is
 *                           `undefined`.
 *
 * and all four omitted `weeklyHappiness`, `weeklyEnergy` and `interior`, which
 * are required.
 *
 * None of that changed a single assertion — `processWeeklyHousing` and
 * `calcWeeklyPassiveIncome` read only `owned/rent/upkeep/upgradeLevel/status`,
 * and `calculatePropertyHappiness` returns 0 before touching `interior` unless
 * `currentResidence` is set, which no fixture set. So this is hygiene, not a
 * shipped bug. It is worth fixing anyway for the reason the `PreRolls` factory
 * exists: the phantom names are what a reader trusts when deciding whether a
 * case is covered, and the day a test DOES set `currentResidence`, the decor
 * bonus it thinks it configured would silently be zero.
 *
 * `status` defaults to 'owner', not 'owned' — 'owned' is not one of the three
 * valid values ('vacant' | 'owner' | 'rented') and two of the four fixtures
 * were passing it behind an `as never`.
 */
import type { RealEstate } from '@/contexts/game/types';

export function makeRealEstate(overrides: Partial<RealEstate> = {}): RealEstate {
  const price = overrides.price ?? 200_000;
  return {
    id: 'prop_1',
    name: 'Test Property',
    price,
    weeklyHappiness: 0,
    weeklyEnergy: 0,
    owned: true,
    interior: [],
    rooms: [],
    upgradeLevel: 0,
    rent: 0,
    upkeep: 0,
    status: 'owner',
    currentValue: price,
    purchasedWeek: 0,
    ...overrides,
  };
}
