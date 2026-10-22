/**
 * ECO-10 (v57): the company catalogue is a ladder, not a trap.
 *
 * The Bank cost $2M and started at $4,000/wk: 10.4%/yr against real estate's
 * 83%, so the most expensive company was the worst one to own. The rule pinned
 * here is the shape every rung must keep: a pricier company earns MORE per
 * week, at a yield that falls as the ticket rises (a bigger, steadier business,
 * never a strictly worse buy), and the top rung still pays a real return.
 */
import { COMPANY_FOUNDING_COST, COMPANY_STARTING_INCOME } from '@/contexts/game/companyUpgradeCatalog';
import { createCompany } from '@/contexts/game/company';
import { createTestGameState } from '../helpers/createTestGameState';

const ladder = Object.entries(COMPANY_FOUNDING_COST)
  .map(([type, cost]) => {
    const income = COMPANY_STARTING_INCOME[type];
    return { type, cost, income, annualYield: (income * 52) / cost };
  })
  .sort((a, b) => a.cost - b.cost);

describe('company yield ladder (ECO-10)', () => {
  it('every founding type has a starting income', () => {
    for (const row of ladder) expect(row.income).toBeGreaterThan(0);
  });

  it('a pricier company earns more per week', () => {
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i].income).toBeGreaterThan(ladder[i - 1].income);
    }
  });

  it('yield never RISES with price (no cheap rung is a strictly worse buy)', () => {
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i].annualYield).toBeLessThanOrEqual(ladder[i - 1].annualYield);
    }
  });

  it('the top rung still pays a real return (was 10.4%/yr)', () => {
    const top = ladder[ladder.length - 1];
    expect(top.type).toBe('bank');
    expect(top.annualYield).toBeGreaterThanOrEqual(0.5);
  });

  it('the Bank is priced and paid as decided: $400k founding, $5,500/wk', () => {
    expect(COMPANY_FOUNDING_COST.bank).toBe(400_000);
    expect(COMPANY_STARTING_INCOME.bank).toBe(5_500);
  });

  it('createCompany charges the catalogue price', () => {
    const base = createTestGameState();
    let state = createTestGameState({
      stats: { ...base.stats, money: 1_000_000 },
      economy: { ...base.economy, priceIndex: 1 },
      educations: [{ id: 'entrepreneurship', name: 'Entrepreneurship', description: '', cost: 0, duration: 0, completed: true }],
    });
    const before = state.stats.money;
    const setState = ((u: unknown) => {
      state = typeof u === 'function' ? (u as (p: typeof state) => typeof state)(state) : (u as typeof state);
    }) as Parameters<typeof createCompany>[1];
    const result = createCompany(state, setState, 'bank');
    expect(result.message).toBeUndefined();
    expect(result.success).toBe(true);
    expect(before - state.stats.money).toBe(400_000);
  });
});
