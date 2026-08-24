/**
 * Company-upgrade payback ratchet (2026-08-24 owner-approved balance pass).
 *
 * Every income upgrade used to pay back in ~20 weeks at level 1 (~260%/yr) —
 * an order of magnitude above every other investment, making company upgrades
 * the game's single dominant strategy. The catalogue now sits at a ~45-week
 * level-1 payback (~115%/yr). This ratchet pins the BAND, not the literals, so
 * individual entries can be tuned but a new upgrade cannot quietly ship as a
 * 20-week money printer again — and cannot be nerfed into pointlessness
 * either.
 */
import { COMPANY_UPGRADES, COMPANY_STARTING_INCOME } from '@/contexts/game/companyUpgradeCatalog';

const MIN_PAYBACK_WEEKS = 40;
const MAX_PAYBACK_WEEKS = 60;

describe('company upgrade payback band', () => {
  const incomeUpgrades = Object.entries(COMPANY_UPGRADES).flatMap(([type, upgrades]) =>
    upgrades
      .filter((u) => u.weeklyIncomeBonus > 0)
      .map((u) => ({ type, id: u.id, cost: u.cost, bonus: u.weeklyIncomeBonus }))
  );

  it('covers the whole catalogue (the ratchet is not vacuous)', () => {
    expect(incomeUpgrades.length).toBeGreaterThanOrEqual(25);
  });

  it.each(incomeUpgrades)(
    '$type/$id pays back in the 40-60 week band at level 1',
    ({ cost, bonus }) => {
      const payback = cost / bonus;
      expect(payback).toBeGreaterThanOrEqual(MIN_PAYBACK_WEEKS);
      expect(payback).toBeLessThanOrEqual(MAX_PAYBACK_WEEKS);
    }
  );

  it('ops_management stays a pure overhead reducer (no income)', () => {
    for (const upgrades of Object.values(COMPANY_UPGRADES)) {
      const ops = upgrades.find((u) => u.id === 'ops_management');
      expect(ops?.weeklyIncomeBonus).toBe(0);
    }
  });

  it('founding deals are untouched (the entry fantasy keeps its price)', () => {
    expect(COMPANY_STARTING_INCOME).toEqual({
      factory: 1500,
      ai: 2200,
      restaurant: 2600,
      realestate: 3200,
      bank: 4000,
    });
  });
});
