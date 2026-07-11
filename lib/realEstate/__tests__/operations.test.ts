import { RealEstate } from '@/contexts/game/types';
import {
  addRoom,
  endRental,
  findOwnedById,
  installDecor,
  kickTenant,
  maintenanceCost,
  markOwned,
  performMaintenance,
  sellProperty,
  setRentMode,
  tickProperty,
  totalEquity,
  upgradeProperty,
} from '../operations';

function unowned(over: Partial<RealEstate> = {}): RealEstate {
  return {
    id: 'p1',
    name: 'Test Apt',
    price: 200_000,
    weeklyHappiness: 5,
    weeklyEnergy: 2,
    owned: false,
    interior: [],
    upgradeLevel: 0,
    ...over,
  };
}

function owned(over: Partial<RealEstate> = {}): RealEstate {
  return {
    ...unowned(),
    owned: true,
    purchasePrice: 200_000,
    purchasedWeek: 0,
    currentValue: 200_000,
    condition: 90,
    marketCycle: 'stable',
    cycleWeeksRemaining: 26,
    ...over,
  };
}

const seededRoll = (key: string): number => {
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return Math.abs(hash % 1000) / 1000;
};

describe('markOwned', () => {
  it('flips a property to owned and seeds bookkeeping', () => {
    const props = [unowned({ id: 'p1' })];
    const next = markOwned(props, {
      propertyId: 'p1',
      currentWeek: 5,
      purchasePrice: 300_000,
      mortgageId: 'mort1',
      asResidence: true,
    });
    const p = next[0];
    expect(p.owned).toBe(true);
    expect(p.purchasePrice).toBe(300_000);
    expect(p.purchasedWeek).toBe(5);
    expect(p.mortgageId).toBe('mort1');
    expect(p.currentResidence).toBe(true);
    expect(p.marketCycle).toBe('stable');
    expect(p.neighborhood).toBeTruthy();
  });

  it('demotes the prior residence when a new one is chosen', () => {
    const props = [
      owned({ id: 'home', currentResidence: true }),
      unowned({ id: 'new' }),
    ];
    const next = markOwned(props, {
      propertyId: 'new',
      currentWeek: 5,
      purchasePrice: 100_000,
      asResidence: true,
    });
    expect(next.find((p) => p.id === 'home')!.currentResidence).toBe(false);
    expect(next.find((p) => p.id === 'new')!.currentResidence).toBe(true);
  });
});

describe('sellProperty', () => {
  it('returns proceeds minus mortgage, closing cost, and capital-gains tax', () => {
    const props = [owned({ currentValue: 300_000, mortgageId: 'm1' })];
    const r = sellProperty(props, 'p1', 100_000);
    // value 300k − debt 100k − closing (6% = 18k) − cap-gains tax (15% of 100k gain = 15k)
    expect(r.saleProceeds).toBe(167_000);
    expect(r.mortgagePayoff).toBe(100_000);
    expect(r.releasedMortgageId).toBe('m1');
    expect(r.properties[0].owned).toBe(false);
  });

  it('records capital gain over purchase price', () => {
    const props = [owned({ purchasePrice: 200_000, currentValue: 300_000 })];
    const r = sellProperty(props, 'p1', 0);
    expect(r.capitalGain).toBe(100_000);
  });

  it('floors at zero when underwater', () => {
    const props = [owned({ currentValue: 100_000, mortgageId: 'm1' })];
    const r = sellProperty(props, 'p1', 200_000);
    expect(r.saleProceeds).toBe(0);
  });
});

describe('setRentMode / endRental / kickTenant', () => {
  it('sets the rental mode and clears any tenant', () => {
    const props = [
      owned({ tenant: { id: 't1', name: 'Sam', satisfaction: 80, movedInWeek: 0, weeklyRent: 1000 } }),
    ];
    const next = setRentMode(props, 'p1', 'airbnb', 2000);
    expect(next[0].status).toBe('rented');
    expect(next[0].rentMode).toBe('airbnb');
    expect(next[0].rent).toBe(2000);
    expect(next[0].tenant).toBeUndefined();
  });

  it('ends the rental and converts back to owner-occupied', () => {
    const props = [owned({ status: 'rented', rentMode: 'longTerm', rent: 1000 })];
    const next = endRental(props, 'p1');
    expect(next[0].status).toBe('owner');
    expect(next[0].rentMode).toBeUndefined();
  });

  it('removes a tenant and resets vacancy clock', () => {
    const props = [
      owned({
        tenant: { id: 't1', name: 'Sam', satisfaction: 80, movedInWeek: 0, weeklyRent: 1000 },
        weeksVacant: 5,
      }),
    ];
    const next = kickTenant(props, 'p1');
    expect(next[0].tenant).toBeUndefined();
    expect(next[0].weeksVacant).toBe(0);
  });
});

describe('totalEquity', () => {
  it('sums equity across owned properties', () => {
    const props = [
      owned({ id: 'a', currentValue: 300_000, mortgageId: 'm1' }),
      owned({ id: 'b', currentValue: 200_000 }), // no mortgage
      unowned({ id: 'c' }),
    ];
    const map = new Map([['m1', 100_000]]);
    expect(totalEquity(props, map)).toBe(200_000 + 200_000);
  });
});

describe('performMaintenance', () => {
  it('restores condition to 100 by default', () => {
    const props = [owned({ condition: 40 })];
    const next = performMaintenance(props, 'p1', 7);
    expect(next[0].condition).toBe(100);
    expect(next[0].lastMaintenance).toBe(7);
  });
});

describe('maintenanceCost', () => {
  it('returns 0 for properties at 100 condition', () => {
    expect(maintenanceCost(owned({ condition: 100 }))).toBe(0);
  });

  it('costs more for higher-value properties', () => {
    const cheap = maintenanceCost(owned({ currentValue: 100_000, condition: 50 }));
    const lux = maintenanceCost(owned({ currentValue: 1_000_000, condition: 50 }));
    expect(lux).toBeGreaterThan(cheap);
  });
});

describe('tickProperty', () => {
  it('skips unowned properties', () => {
    const r = tickProperty({ property: unowned(), currentWeek: 1, rollFor: seededRoll });
    expect(r.rentReceived).toBe(0);
    expect(r.notifications).toHaveLength(0);
  });

  it('decrements cycleWeeksRemaining and reuses the existing cycle', () => {
    const r = tickProperty({
      property: owned({ cycleWeeksRemaining: 5 }),
      currentWeek: 1,
      rollFor: seededRoll,
    });
    expect(r.property.cycleWeeksRemaining).toBe(4);
    expect(r.cycleChanged).toBe(false);
  });

  it('re-rolls the cycle when remaining ≤ 1', () => {
    const r = tickProperty({
      property: owned({ cycleWeeksRemaining: 1 }),
      currentWeek: 1,
      rollFor: seededRoll,
    });
    expect(r.property.cycleWeeksRemaining).toBeGreaterThan(1);
  });

  it('a satisfied tenant produces realized rent', () => {
    const r = tickProperty({
      property: owned({
        rentMode: 'longTerm',
        status: 'rented',
        rent: 1500,
        condition: 90,
        tenant: { id: 't1', name: 'Sam', satisfaction: 90, movedInWeek: 0, weeklyRent: 1500 },
      }),
      currentWeek: 1,
      rollFor: () => 0.99, // suppress move-out
    });
    expect(r.rentReceived).toBeGreaterThan(0);
  });

  it('vacant property may attract a new tenant', () => {
    let p = owned({ rentMode: 'longTerm', status: 'rented', rent: 1000, condition: 95 });
    // Roll forces find-tenant.
    const r = tickProperty({
      property: p,
      currentWeek: 1,
      rollFor: (key) => (key.startsWith('re.find.') ? 0.01 : 0.99),
    });
    expect(r.property.tenant).toBeDefined();
    expect(r.notifications.find((n) => n.id.startsWith('re-tenant-arrive-'))).toBeDefined();
  });
});

describe('installDecor / addRoom / upgradeProperty', () => {
  it('appends a decor id to interior without duplicating', () => {
    const props = [owned({ interior: ['luxury_bed'] })];
    const next = installDecor(props, 'p1', 'smart_tv');
    expect(next[0].interior).toEqual(['luxury_bed', 'smart_tv']);
    // Re-install is a no-op (no dupes).
    const again = installDecor(next, 'p1', 'smart_tv');
    expect(again[0].interior).toEqual(['luxury_bed', 'smart_tv']);
  });

  it('appends a room id to rooms without duplicating', () => {
    const props = [owned({ rooms: [] })];
    const next = addRoom(props, 'p1', 'home_office');
    expect(next[0].rooms).toEqual(['home_office']);
    const again = addRoom(next, 'p1', 'home_office');
    expect(again[0].rooms).toEqual(['home_office']);
  });

  it('sets the upgrade tier to the requested level', () => {
    const props = [owned({ upgradeLevel: 0 })];
    const next = upgradeProperty(props, 'p1', 2);
    expect(next[0].upgradeLevel).toBe(2);
  });

  it('only touches the targeted property', () => {
    const props = [owned({ id: 'a', interior: [] }), owned({ id: 'b', interior: [] })];
    const next = installDecor(props, 'a', 'pool');
    expect(next.find((p) => p.id === 'a')!.interior).toEqual(['pool']);
    expect(next.find((p) => p.id === 'b')!.interior).toEqual([]);
  });
});

describe('findOwnedById', () => {
  it('returns owned only', () => {
    const props = [unowned({ id: 'a' }), owned({ id: 'b' })];
    expect(findOwnedById(props, 'a')).toBeUndefined();
    expect(findOwnedById(props, 'b')).toBeDefined();
  });
});
