import { calculateFIRETracker } from '../fireTracker';
import { GameState } from '@/contexts/game/types';

/**
 * Build a minimal GameState with a single job whose weekly salary is `salary`.
 * `careers[].levels[].salary` is canonically WEEKLY.
 */
function stateWithSalary(salary: number, over: Partial<any> = {}): GameState {
  return {
    weeksLived: 52,
    currentJob: 'job1',
    careers: [{ id: 'job1', level: 0, levels: [{ salary }] }],
    stats: { money: 0 },
    bankSavings: 0,
    ...over,
  } as any;
}

const MIN_FIRE_NUMBER = 15600 * 25; // 390,000 — the expense-floor pin

describe('calculateFIRETracker (salary is WEEKLY)', () => {
  it('a $2,000/wk earner gets a FIRE number in the low millions, not pinned at $390k', () => {
    const r = calculateFIRETracker(stateWithSalary(2000));
    // annualExpenses = 2000 * 0.7 * 52 = 72,800 → fireNumber = 1,820,000
    expect(r.fireNumber).toBe(2000 * 0.7 * 52 * 25);
    expect(r.fireNumber).toBeGreaterThan(MIN_FIRE_NUMBER);
    expect(r.fireNumber).toBeGreaterThan(1_000_000);
  });

  it('savings rate stays within 0-100%', () => {
    // weeklySavings = bankSavings / weeksLived = 52000/52 = 1000; income 2000 → 50%
    const r = calculateFIRETracker(stateWithSalary(2000, { bankSavings: 52000, weeksLived: 52 }));
    expect(r.savingsRate).toBeGreaterThanOrEqual(0);
    expect(r.savingsRate).toBeLessThanOrEqual(100);
    expect(r.savingsRate).toBeCloseTo(50, 5);
  });

  it('FIRE number scales with income', () => {
    const low = calculateFIRETracker(stateWithSalary(500));
    const high = calculateFIRETracker(stateWithSalary(5000));
    expect(high.fireNumber).toBeGreaterThan(low.fireNumber);
    expect(high.fireNumber).toBe(5000 * 0.7 * 52 * 25); // 4,550,000
  });

  it('falls back to the expense floor when there is no salary', () => {
    const r = calculateFIRETracker(stateWithSalary(0));
    expect(r.fireNumber).toBe(MIN_FIRE_NUMBER);
    expect(r.savingsRate).toBe(0);
  });
});


describe('FIRE life-relative planning', () => {
  it('gives identical savings pace and forecast after four played weeks at different starting ages', () => {
    const young = calculateFIRETracker(stateWithSalary(1000, { bankSavings: 1000, weeksLived: 4, lifeStartWeek: 0 }));
    const older = calculateFIRETracker(stateWithSalary(1000, { bankSavings: 1000, weeksLived: 108, lifeStartWeek: 104 }));
    expect(older).toEqual(young);
    expect(older.savingsRate).toBe(25);
  });
  it('keeps a finite estimate on the first week', () => {
    const result = calculateFIRETracker(stateWithSalary(1000, { bankSavings: 100, weeksLived: 104, lifeStartWeek: 104 }));
    expect(result.savingsRate).toBe(10);
    expect(Number.isFinite(result.yearsToFIRE)).toBe(true);
  });
});
