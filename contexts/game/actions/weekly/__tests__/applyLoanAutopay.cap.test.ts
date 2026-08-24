/**
 * Runaway-debt cap: total owed never exceeds 3x the original principal.
 *
 * The intended "debt never exceeds 3x principal" ceiling was computed as
 * `Math.max(remainingWithInterest, principal * 3)`, which never bound once weekly
 * interest pushed the balance past 3x (a simulated delinquent $80K loan at 35%
 * APR reached ~$1,153,276 by week 300). The ceiling is now a hard `principal * 3`:
 * the missed-payment penalty stops compounding at the ceiling, and a balance
 * already beyond it heals back down. Normal amortization below the cap and normal
 * sub-cap missed-payment compounding are unchanged.
 */
import { applyLoanAutopay } from '../applyLoanAutopay';
import type { Loan } from '@/contexts/game/types';

function loan(over: Partial<Loan> = {}): Loan {
  return {
    id: 'l1', name: 'Personal', principal: 80000, remaining: 80000,
    rateAPR: 0.35, interestRate: 0.35, termWeeks: 52, weeklyPayment: 100000,
    startWeek: 0, autoPay: true, type: 'personal', weeksRemaining: 52,
    ...over,
  } as Loan;
}

describe('applyLoanAutopay - 3x principal ceiling', () => {
  it('clamps a delinquent balance AT 3x principal (does not exceed it)', () => {
    // remaining 238000 → after interest+penalty would cross 240000 (3x of 80000);
    // cash 0 forces a missed payment so the penalty path runs.
    const res = applyLoanAutopay({ prevLoans: [loan({ remaining: 238000 })], cashAvailable: 0 });
    const owed = res.processedLoans[0].remaining;
    expect(owed).toBeLessThanOrEqual(80000 * 3);
    expect(owed).toBe(80000 * 3); // pinned exactly to the ceiling
  });

  it('heals a balance already beyond the ceiling back down to 3x principal', () => {
    // A runaway balance ($500K on an $80K loan) heals to the 240000 ceiling this
    // tick — and the heal is NOT counted as a penalty (would be negative).
    const res = applyLoanAutopay({ prevLoans: [loan({ remaining: 500000 })], cashAvailable: 0 });
    expect(res.processedLoans[0].remaining).toBe(80000 * 3);
    expect(res.totalLoanPenalty).toBe(0);
  });

  it('leaves normal amortization below the cap unchanged (affordable paid path)', () => {
    // A healthy loan far below 3x: paid normally, balance drops by the payment.
    const res = applyLoanAutopay({
      prevLoans: [loan({ principal: 5000, remaining: 5000, rateAPR: 0.10, interestRate: 0.10, weeklyPayment: 100 })],
      cashAvailable: 10000,
    });
    expect(res.totalLoanAutoPaid).toBe(100);
    // 5000 × (1 + 0.10/52) − 100 ≈ 4909.6, well under the 15000 ceiling.
    expect(res.processedLoans[0].remaining).toBeCloseTo(4909.6, 0);
    expect(res.processedLoans[0].remaining).toBeLessThan(5000 * 3);
  });

  it('still compounds a sub-cap missed payment normally (ceiling does not bind)', () => {
    // remaining 1000 on a 5000-principal loan: penalty compounds to ~1011.94,
    // far below the 15000 ceiling — unchanged behavior.
    const res = applyLoanAutopay({
      prevLoans: [loan({ principal: 5000, remaining: 1000, rateAPR: 0.10, interestRate: 0.10, weeklyPayment: 5000 })],
      cashAvailable: 0,
    });
    expect(res.processedLoans[0].remaining).toBeCloseTo(1011.94, 1);
    expect(res.processedLoans[0].remaining).toBeLessThan(5000 * 3);
    expect(res.totalLoanPenalty).toBeGreaterThan(0);
  });

  it('bounds a perpetually-delinquent loan at 3x principal over 300 weeks (audit runaway fix)', () => {
    const principal = 80000;
    let remaining = principal;
    for (let week = 0; week < 300; week++) {
      const res = applyLoanAutopay({
        prevLoans: [loan({ principal, remaining, weeksRemaining: 52 })],
        cashAvailable: 0, // always misses → penalty path every week
      });
      remaining = res.processedLoans[0]?.remaining ?? 0;
    }
    // Pre-fix this reached ~$1,153,276; now it can never exceed 3x principal.
    expect(remaining).toBeLessThanOrEqual(principal * 3);
    expect(remaining).toBe(principal * 3); // converged to the ceiling
  });

  it('falls back to no penalty when principal is missing/invalid (unchanged)', () => {
    // No valid principal → no ceiling to clamp against → no penalty compounds
    // (balance carries interest only), preserving the prior NaN-safe fallback.
    const res = applyLoanAutopay({
      prevLoans: [loan({ principal: 0, remaining: 1000, weeklyPayment: 5000 })],
      cashAvailable: 0,
    });
    // remainingWithInterest only (1000 × (1 + 0.35/52) ≈ 1006.73), no penalty added.
    expect(res.processedLoans[0].remaining).toBeCloseTo(1006.73, 1);
    expect(res.totalLoanPenalty).toBe(0);
  });
});
