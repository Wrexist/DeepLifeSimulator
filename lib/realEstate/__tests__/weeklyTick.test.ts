/**
 * runRealEstateWeeklyTick — Wave A: the upgrade-tier rent bonus now flows through
 * the realized (tenant-model) rent instead of being computed in the legacy pass
 * and discarded. Assert the bonus lands on income ONLY for a tenanted unit that
 * actually earned rent, and never for a vacant/owner-occupied one.
 */
import { RealEstate } from '@/contexts/game/types';
import { runRealEstateWeeklyTick, REAL_ESTATE_WEEKLY_RENT_CAP } from '../weeklyTick';
import { UPGRADE_TIERS } from '../housing';

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

describe('runRealEstateWeeklyTick — upgrade rent bonus', () => {
  it('adds the tier rent bonus to income for a tenanted upgraded property', () => {
    const tenanted = owned({
      upgradeLevel: 3,
      rentMode: 'longTerm',
      status: 'rented',
      rent: 1500,
      tenant: { id: 't1', name: 'Sam', satisfaction: 95, movedInWeek: 0, weeklyRent: 1500 },
    });
    const baseline = owned({
      upgradeLevel: 0,
      rentMode: 'longTerm',
      status: 'rented',
      rent: 1500,
      tenant: { id: 't1', name: 'Sam', satisfaction: 95, movedInWeek: 0, weeklyRent: 1500 },
    });

    // Suppress move-out so both actually earn rent this week.
    const rollFor = () => 0.99;
    const withUpgrade = runRealEstateWeeklyTick({
      legacyProcessedProperties: [tenanted],
      legacyRentalIncome: 0,
      currentWeek: 5,
      rollFor,
    });
    const withoutUpgrade = runRealEstateWeeklyTick({
      legacyProcessedProperties: [baseline],
      legacyRentalIncome: 0,
      currentWeek: 5,
      rollFor,
    });

    // Both earned the same realized rent (same tenant/rolls); the ONLY delta is
    // the tier-3 rent bonus.
    expect(withUpgrade.rentalIncome - withoutUpgrade.rentalIncome).toBeCloseTo(tier3.rentBonus, 5);
  });

  it('does NOT pay the upgrade bonus on a vacant rented unit (no rent received)', () => {
    const vacant = owned({
      upgradeLevel: 3,
      rentMode: 'longTerm',
      status: 'rented',
      rent: 1500,
      tenant: undefined,
    });
    // Force "no tenant found" so rentReceived stays 0.
    const res = runRealEstateWeeklyTick({
      legacyProcessedProperties: [vacant],
      legacyRentalIncome: 0,
      currentWeek: 5,
      rollFor: (key) => (key.startsWith('re.find.') ? 0.99 : 0.5),
    });
    expect(res.properties[0].tenant).toBeUndefined();
    expect(res.rentalIncome).toBe(0);
  });

  it('does NOT pay the upgrade bonus on an owner-occupied home', () => {
    const home = owned({ upgradeLevel: 3, status: 'owner', currentResidence: true });
    const res = runRealEstateWeeklyTick({
      legacyProcessedProperties: [home],
      legacyRentalIncome: 0,
      currentWeek: 5,
      rollFor: () => 0.5,
    });
    expect(res.rentalIncome).toBe(0);
  });
});

describe('runRealEstateWeeklyTick — $150k/wk per-source rent cap (Fix 2)', () => {
  it('clamps aggregate realized rent to the design cap before it feeds cash', () => {
    // A giant $200M unit whose asked rent ($500k/wk, under the 0.4% ceiling of
    // $800k) realizes far above the $150k cap even after carrying costs.
    const whale = owned({
      currentValue: 200_000_000,
      price: 200_000_000,
      rentMode: 'longTerm',
      status: 'rented',
      rent: 500_000,
      tenant: { id: 't1', name: 'Sam', satisfaction: 95, movedInWeek: 0, weeklyRent: 500_000 },
    });
    const res = runRealEstateWeeklyTick({
      legacyProcessedProperties: [whale],
      legacyRentalIncome: 0,
      currentWeek: 5,
      rollFor: () => 0.99, // suppress move-out so the whale actually pays this week
    });
    expect(res.rentalIncome).toBe(REAL_ESTATE_WEEKLY_RENT_CAP); // exactly $150k, not ~$415k
    expect(REAL_ESTATE_WEEKLY_RENT_CAP).toBe(150000);
  });

  it('leaves sub-cap income untouched', () => {
    const modest = owned({
      rentMode: 'longTerm', status: 'rented', rent: 500,
      tenant: { id: 't1', name: 'Sam', satisfaction: 95, movedInWeek: 0, weeklyRent: 500 },
    });
    const res = runRealEstateWeeklyTick({
      legacyProcessedProperties: [modest],
      legacyRentalIncome: 0,
      currentWeek: 5,
      rollFor: () => 0.99,
    });
    expect(res.rentalIncome).toBeGreaterThan(0);
    expect(res.rentalIncome).toBeLessThan(REAL_ESTATE_WEEKLY_RENT_CAP);
  });
});
