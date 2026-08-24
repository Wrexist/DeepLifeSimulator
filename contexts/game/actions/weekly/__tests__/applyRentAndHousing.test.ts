/**
 * applyRentAndHousing — Wave A (RealEstateApp):
 *   - Feeds the persisted, capped `realEstateActivity` slice from the weekly
 *     real-estate tick notifications (tenant in/out, cycle shift, maintenance),
 *     stamped with nextWeeksLived, de-duped by id, capped at 40 (newest kept).
 *   - Routes the upgrade-tier rent bonus through the realized (tenant-model)
 *     rent so it is no longer computed-then-discarded (dead double-assignment).
 */
import type { RealEstate, RealEstateActivityEntry } from '@/contexts/game/types';
import { applyRentAndHousing } from '../applyRentAndHousing';
import type { WeekContext } from '../weekContext';
import { UPGRADE_TIERS } from '@/lib/realEstate/housing';
import { zeroPreRolls } from '@/__tests__/helpers/zeroPreRolls';

function ctx(): WeekContext {
  return {
    newStats: { health: 0, happiness: 0, energy: 0, fitness: 0, money: 0, reputation: 0, gems: 0 },
    notifications: [],
    preRolls: zeroPreRolls(),
    nextWeeksLived: 0,
  };
}

function owned(over: Partial<RealEstate> = {}): RealEstate {
  return {
    id: 'p1',
    name: 'Test Apt',
    price: 200_000,
    weeklyHappiness: 5,
    weeklyEnergy: 2,
    owned: true,
    interior: [],
    upgradeLevel: 0,
    purchasePrice: 200_000,
    purchasedWeek: 0,
    currentValue: 200_000,
    condition: 95,
    marketCycle: 'stable',
    cycleWeeksRemaining: 26,
    ...over,
  };
}

const tier3 = UPGRADE_TIERS.find((t) => t.level === 3)!;

describe('applyRentAndHousing - realEstateActivity slice', () => {
  it('records a tenant-arrival tick event as an activity entry stamped with the week', () => {
    // Vacant rented unit + forced find-tenant roll → "New Tenant" notification.
    const vacant = owned({ rentMode: 'longTerm', status: 'rented', rent: 1000, tenant: undefined });
    const res = applyRentAndHousing(
      [vacant],
      42,
      (key) => (key.startsWith('re.find.') ? 0.01 : 0.99),
      ctx(),
      [],
    );
    expect(res.realEstateActivity.length).toBeGreaterThan(0);
    const entry = res.realEstateActivity[res.realEstateActivity.length - 1];
    expect(entry.week).toBe(42);
    expect(entry.kind).toBe('tenant_in');
    expect(entry.label).toContain('moved into');
  });

  it('appends to the prior slice and caps at 40 (newest kept)', () => {
    const prev: RealEstateActivityEntry[] = Array.from({ length: 40 }, (_, i) => ({
      id: `old-${i}`,
      week: i,
      kind: 'event',
      label: `old ${i}`,
    }));
    const vacant = owned({ rentMode: 'longTerm', status: 'rented', rent: 1000, tenant: undefined });
    const res = applyRentAndHousing(
      [vacant],
      99,
      (key) => (key.startsWith('re.find.') ? 0.01 : 0.99),
      ctx(),
      prev,
    );
    expect(res.realEstateActivity.length).toBe(40);
    // The oldest entry was evicted; the freshest (week 99) survived at the tail.
    expect(res.realEstateActivity.some((e) => e.id === 'old-0')).toBe(false);
    expect(res.realEstateActivity[res.realEstateActivity.length - 1].week).toBe(99);
  });

  it('de-dupes by id (idempotent - re-running the same week adds nothing new)', () => {
    const vacant = owned({ rentMode: 'longTerm', status: 'rented', rent: 1000, tenant: undefined });
    const first = applyRentAndHousing(
      [vacant],
      7,
      (key) => (key.startsWith('re.find.') ? 0.01 : 0.99),
      ctx(),
      [],
    );
    const countAfterFirst = first.realEstateActivity.length;
    // Feed the same-week result back in with the SAME rolls → same ids → no growth.
    const second = applyRentAndHousing(
      [vacant],
      7,
      (key) => (key.startsWith('re.find.') ? 0.01 : 0.99),
      ctx(),
      first.realEstateActivity,
    );
    expect(second.realEstateActivity.length).toBe(countAfterFirst);
  });

  it('defaults to an empty slice when no prior activity is passed', () => {
    const home = owned({ status: 'owner', currentResidence: true });
    const res = applyRentAndHousing([home], 1, () => 0.99, ctx());
    expect(Array.isArray(res.realEstateActivity)).toBe(true);
  });
});

describe('applyRentAndHousing - upgrade rent bonus reaches realized rent', () => {
  it('an upgraded tenanted unit earns ~rentBonus more than an identical un-upgraded one', () => {
    const tenant = { id: 't1', name: 'Sam', satisfaction: 95, movedInWeek: 0, weeklyRent: 1500 };
    const upgraded = owned({ upgradeLevel: 3, rentMode: 'longTerm', status: 'rented', rent: 1500, tenant });
    const plain = owned({ upgradeLevel: 0, rentMode: 'longTerm', status: 'rented', rent: 1500, tenant });

    const withUp = applyRentAndHousing([upgraded], 5, () => 0.99, ctx(), []);
    const without = applyRentAndHousing([plain], 5, () => 0.99, ctx(), []);

    // ~= rentBonus; a few cents shy because the upgrade also lifts appreciation
    // (appreciatePropertyValue), nudging the upgraded unit's carrying cost up.
    expect(withUp.housingRentalIncome - without.housingRentalIncome).toBeCloseTo(tier3.rentBonus, 0);
  });
});
