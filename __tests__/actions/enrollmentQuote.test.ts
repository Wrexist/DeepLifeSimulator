import type { GameState } from '@/contexts/game/types';
import { quoteEnrollment, enrollInProgram, withdrawFromProgram } from '@/contexts/game/actions/EducationActions';
import { applyLoanAutopay } from '@/contexts/game/actions/weekly/applyLoanAutopay';
import { EDUCATION_PROGRAMS } from '@/lib/education/programs';
import { createTestGameState } from '../helpers/createTestGameState';

const program = EDUCATION_PROGRAMS.find(p => p.id === 'business_degree')!;
function enroll(initial: GameState, mode: 'cash' | 'loan' = 'loan') {
  let state = initial;
  const set: React.Dispatch<React.SetStateAction<GameState>> = u => { state = typeof u === 'function' ? u(state) : u; };
  enrollInProgram(set, { ...program, templateId: program.id, mode });
  return { get: () => state, set };
}

describe('the enrollment quote matches delivery and repayment', () => {
  it.each([0, 12_000, 48_000, 100_000])('quotes cash left from $%i without treating tuition as living costs', money => {
    const state = createTestGameState({ stats: { money }, educations: [] });
    const q = quoteEnrollment(state, program);
    expect(q.cashAfterTuition).toBe(money - program.cost);
    expect(q.canAffordCash).toBe(money >= program.cost);
    const after = enroll(state, 'cash').get();
    expect(after.stats.money).toBe(q.canAffordCash ? q.cashAfterTuition : money);
  });
  it('funds only net tuition after aid and starts repayment next week', () => {
    const state = createTestGameState({ stats: { money: 10_000 }, educations: [], loans: [], tuitionWaiverUSD: 12_000 });
    const q = quoteEnrollment(state, program);
    expect(q.loan?.principal).toBe(36_000);
    const after = enroll(state).get();
    const loan = after.loans![0];
    expect(loan).toMatchObject({ principal: q.loan!.principal, rateAPR: q.loan!.rateAPR, weeklyPayment: q.loan!.weeklyPayment, termWeeks: q.loan!.termWeeks });
    expect(after.stats.money).toBe(state.stats.money);
    expect(after.educations[0].completed).toBe(false);
    const tick = applyLoanAutopay({ prevLoans: after.loans, cashAvailable: after.stats.money });
    expect(tick.totalLoanAutoPaid).toBe(q.loan!.weeklyPayment);
    expect(tick.processedLoans[0].remaining).toBeLessThan(q.loan!.principal);
    // Enrollment records and debt survive serialization without a new field.
    expect(JSON.parse(JSON.stringify(after)).loans![0]).toEqual(loan);
  });
  it('quotes total repayment against all 520 actual scheduled payments', () => {
    const state = createTestGameState({ educations: [], loans: [] });
    const q = quoteEnrollment(state, program).loan!;
    let loans = enroll(state).get().loans ?? [];
    let paid = 0;
    let interest = 0;
    for (let week = 0; week < q.termWeeks; week++) {
      const tick = applyLoanAutopay({ prevLoans: loans, cashAvailable: 1_000_000 });
      loans = tick.processedLoans;
      paid += tick.totalLoanAutoPaid;
      interest += tick.totalLoanInterest;
    }
    expect(paid).toBeCloseTo(q.totalRepaid, 5);
    expect(interest).toBeCloseTo(q.totalInterest, 5);
    expect(loans.reduce((sum, loan) => sum + loan.remaining, 0)).toBeLessThan(0.00001);
  });
  it('keeps loan obligations after withdrawal, including missed-payment risk', () => {
    const state = createTestGameState({ educations: [], loans: [], stats: { money: 0 } });
    const s = enroll(state);
    const debt = s.get().loans![0];
    withdrawFromProgram(s.set, program.id);
    expect(s.get().loans![0]).toBe(debt);
    const tick = applyLoanAutopay({ prevLoans: s.get().loans, cashAvailable: 0 });
    expect(tick.totalLoanAutoPaid).toBe(0);
    expect(tick.processedLoans[0].remaining).toBeGreaterThan(debt.principal);
  });
  it('does not create a loan when aid covers the entire tuition', () => {
    const state = createTestGameState({ educations: [], loans: [], tuitionWaiverUSD: program.cost });
    expect(quoteEnrollment(state, program).loan).toBeNull();
    expect(enroll(state).get().loans).toHaveLength(0);
  });
  it('quotes the same shortened duration and policy assistance that enrollment uses', () => {
    const state = createTestGameState({ educations: [] });
    state.politics = { ...state.politics!, activePolicyEffects: { education: { weeksReduction: 8, costReduction: 20, scholarshipAmount: 2000 } } };
    const q = quoteEnrollment(state, program);
    const after = enroll(state).get();
    expect(q.adjustedDuration).toBe(82);
    expect(q.netCost).toBe(program.cost * 0.8 - 2000);
    expect(after.educations[0].duration).toBe(q.adjustedDuration);
    expect(after.loans?.at(-1)?.principal).toBe(q.loan!.principal);
  });
  it('requotes against the committed scholarship balance, not an old preview', () => {
    const state = createTestGameState({ educations: [], loans: [], tuitionWaiverUSD: 12_000 });
    const preview = quoteEnrollment(state, program);
    const after = enroll({ ...state, tuitionWaiverUSD: undefined }).get();
    expect(after.loans![0].principal).toBe(program.cost);
    expect(after.loans![0].principal).toBeGreaterThan(preview.loan!.principal);
  });
});
