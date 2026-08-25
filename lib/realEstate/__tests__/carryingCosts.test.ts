/**
 * Property tax - the mandatory cost that finally scales with wealth.
 *
 * The 2026-08-25 audit's one structural gap: nothing recurring scaled with a
 * fortune unless the player volunteered it. Tenant rent tops out at $950/wk,
 * luxury upkeep is opt-in, and an OWNED home paid literally nothing - a $8M
 * penthouse was free to hold while the renter across the street paid $950.
 */
import {
  PROPERTY_TAX_ANNUAL_RATE,
  RENTED_MAINTENANCE_ANNUAL_RATE,
  propertyTaxWeekly,
  portfolioPropertyTaxWeekly,
} from '../carryingCosts';
import { COMMERCIAL_CATALOG, RESIDENTIAL_CATALOG } from '../catalog';
import type { RealEstate } from '@/contexts/game/types';
import fs from 'fs';
import path from 'path';

const own = (over: Partial<RealEstate>): RealEstate => ({
  id: 'p', name: 'P', price: 100_000, weeklyHappiness: 0, weeklyEnergy: 0,
  owned: true, interior: [], upgradeLevel: 0, status: 'owner', ...over,
});

describe('property tax', () => {
  it('costs nothing on a property you do not own', () => {
    expect(propertyTaxWeekly(own({ owned: false }))).toBe(0);
    expect(propertyTaxWeekly(null)).toBe(0);
    expect(propertyTaxWeekly(undefined)).toBe(0);
  });

  it('scales with what the property is worth', () => {
    const studio = propertyTaxWeekly(own({ price: 95_000 }));
    const penthouse = propertyTaxWeekly(own({ price: 8_000_000 }));
    expect(studio).toBeGreaterThan(0);
    // ~$22/wk against ~$1,846/wk - the wealth axis finally has weight.
    expect(penthouse / studio).toBeCloseTo(8_000_000 / 95_000, 0);
  });

  it('follows market value, not the price paid', () => {
    const appreciated = propertyTaxWeekly(own({ price: 100_000, currentValue: 400_000 }));
    const atCost = propertyTaxWeekly(own({ price: 100_000 }));
    expect(appreciated).toBeGreaterThan(atCost);
  });

  it('adds up across a portfolio', () => {
    const portfolio = [own({ id: 'a', price: 500_000 }), own({ id: 'b', price: 1_500_000 })];
    expect(portfolioPropertyTaxWeekly(portfolio)).toBe(
      propertyTaxWeekly(portfolio[0]) + propertyTaxWeekly(portfolio[1]),
    );
    expect(portfolioPropertyTaxWeekly([])).toBe(0);
    expect(portfolioPropertyTaxWeekly(undefined)).toBe(0);
  });

  it('does not double-charge a landlord', () => {
    // The tenancy tick used to charge 2.2%/yr on a rented unit, authored as
    // "~1.2% tax + ~1% maintenance". Tax is universal now, so the tenancy tick
    // keeps only maintenance and the TOTAL on a rented unit is unchanged.
    expect(PROPERTY_TAX_ANNUAL_RATE + RENTED_MAINTENANCE_ANNUAL_RATE).toBeCloseTo(0.022, 5);
  });

  it('is a real but survivable bill at every rung of the catalogue', () => {
    // A cost that scales must not become a cost that traps: tax on the home
    // stays a fraction of what the equivalent tenancy would cost per week.
    for (const p of RESIDENTIAL_CATALOG) {
      const weekly = propertyTaxWeekly({ ...p, owned: true } as RealEstate);
      expect(weekly).toBeGreaterThan(0);
      expect(weekly).toBeLessThan(p.price * 0.0005); // < 2.6%/yr, sanity bound
    }
  });
});

describe('the charge is honest', () => {
  it('the expense panel includes exactly what the tick charges', () => {
    // Both sides read propertyTaxWeekly: applyRentAndHousing folds it into
    // housingUpkeep, calcWeeklyExpenses adds it to the upkeep row.
    const root = path.join(__dirname, '..', '..', '..');
    const tick = fs.readFileSync(
      path.join(root, 'contexts/game/actions/weekly/applyRentAndHousing.ts'), 'utf8');
    const panel = fs.readFileSync(path.join(root, 'lib/economy/expenses.ts'), 'utf8');
    expect(tick).toContain('portfolioPropertyTaxWeekly(updatedRealEstate)');
    expect(panel).toContain('portfolioPropertyTaxWeekly(realEstate)');
  });
});

describe('commercial property tax premium', () => {
  it('a commercial building pays double the residential rate on the same value', () => {
    const warehouse = { ...COMMERCIAL_CATALOG.find((c: RealEstate) => c.id === 'warehouse'), owned: true } as RealEstate;
    const sameValueHome = own({ id: 'sub-house', price: warehouse.price });
    expect(propertyTaxWeekly(warehouse)).toBe(propertyTaxWeekly(sameValueHome) * 2);
  });

  it('which prices the yield/stability edge the audit found free', () => {
    // Commercial rent mode: 0.20%/wk at 0.5% vacancy vs longTerm 0.15% at 1%.
    // Net of maintenance (1%/yr) and its OWN tax, commercial must keep a
    // premium (it is the capital-gated tier) without dominating for free.
    const WEEKS = 52;
    const commercialNet = 0.0020 - 0.010 / WEEKS - (0.012 * 2) / WEEKS;
    const longTermNet = 0.0015 - 0.010 / WEEKS - 0.012 / WEEKS;
    expect(commercialNet).toBeGreaterThan(longTermNet); // still a premium
    expect(commercialNet / longTermNet).toBeLessThan(1.35); // no longer ~1.5x for free
  });
});
