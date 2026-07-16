import { calculateRetirementPlanning } from '../retirementCalculator';
import { GameState } from '@/contexts/game/types';

function stateWithSalary(salary: number, over: Partial<any> = {}): GameState {
  return {
    date: { age: 30, year: 2025 },
    currentJob: 'job1',
    careers: [{ id: 'job1', level: 0, levels: [{ salary }] }],
    stats: { money: 0 },
    bankSavings: 0,
    ...over,
  } as any;
}

describe('calculateRetirementPlanning (salary is WEEKLY)', () => {
  it('requiredNetWorth scales with salary — a $5k/wk earner needs far more than $390k', () => {
    const r = calculateRetirementPlanning(stateWithSalary(5000));
    // annualExpenses = 5000 * 0.7 * 52 = 182,000 → required = /4 * 100 = 4,550,000
    expect(r.requiredNetWorth).toBe((5000 * 0.7 * 52) / 4 * 100);
    expect(r.requiredNetWorth).toBeGreaterThan(390_000);
    expect(r.requiredNetWorth).toBeGreaterThan(4_000_000);
  });

  it('requiredNetWorth increases with income', () => {
    const low = calculateRetirementPlanning(stateWithSalary(1000));
    const high = calculateRetirementPlanning(stateWithSalary(5000));
    expect(high.requiredNetWorth).toBeGreaterThan(low.requiredNetWorth);
  });

  it('a high earner with modest savings is NOT on track (savingsGap > 0)', () => {
    // $5k/wk needs ~$4.55M; only $200k saved → large gap.
    const r = calculateRetirementPlanning(stateWithSalary(5000, { stats: { money: 200000 } }));
    expect(r.currentNetWorth).toBe(200000);
    expect(r.savingsGap).toBeGreaterThan(0);
  });
});
