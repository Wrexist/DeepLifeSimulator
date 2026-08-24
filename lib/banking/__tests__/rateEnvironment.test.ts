/**
 * Live rate environment (v22) — table direction, clamp behavior, and the
 * critical anti-arbitrage economy invariant: across EVERY economy state, the
 * best achievable deposit APY must stay strictly below the cheapest loan APR,
 * so a live rate environment can never open a borrow-low / save-high money loop.
 */
import { SAVINGS_APR_HARD_CAP } from '@/lib/economy/constants';
import {
  RATE_ENVIRONMENT_TABLE,
  LOAN_APR_FLOOR,
  getRateEnvironment,
  effectiveDepositAPR,
  effectiveLoanAPR,
  type EconomyStateName,
} from '../rateEnvironment';

const ECONOMY_STATES: EconomyStateName[] = ['normal', 'boom', 'recession', 'crash'];

// Standard self-opened deposit account APRs (savings/MM/HYSA/CD).
const DEPOSIT_BASE_APRS = [0.02, 0.035, 0.045, 0.055];
// Standard loan base APRs (mortgage/auto/business/personal) from operations.ts.
const LOAN_BASE_APRS = [0.065, 0.08, 0.10, 0.12];

describe('rateEnvironment table', () => {
  it('moves rates in the direction the notifications claim', () => {
    // Boom: better deposit yields (>1), cheaper borrowing (<0).
    expect(RATE_ENVIRONMENT_TABLE.boom.depositMult).toBeGreaterThan(1);
    expect(RATE_ENVIRONMENT_TABLE.boom.loanDelta).toBeLessThan(0);
    // Recession & crash: falling yields (<1), rising loan rates (>0).
    for (const s of ['recession', 'crash'] as const) {
      expect(RATE_ENVIRONMENT_TABLE[s].depositMult).toBeLessThan(1);
      expect(RATE_ENVIRONMENT_TABLE[s].loanDelta).toBeGreaterThan(0);
    }
    // Normal is neutral.
    expect(RATE_ENVIRONMENT_TABLE.normal).toEqual({ depositMult: 1, loanDelta: 0 });
  });

  it('getRateEnvironment falls back to normal for unknown states', () => {
    expect(getRateEnvironment(undefined)).toEqual(RATE_ENVIRONMENT_TABLE.normal);
    expect(getRateEnvironment('nonsense')).toEqual(RATE_ENVIRONMENT_TABLE.normal);
    expect(getRateEnvironment('boom')).toEqual(RATE_ENVIRONMENT_TABLE.boom);
  });
});

describe('effective rate helpers', () => {
  it('deposit boost is clamped at the savings hard cap', () => {
    // CD (0.055) boosted in a boom must not exceed the regulatory hard cap.
    const boosted = effectiveDepositAPR(0.055, RATE_ENVIRONMENT_TABLE.boom);
    expect(boosted).toBeLessThanOrEqual(SAVINGS_APR_HARD_CAP);
  });

  it('normal state is a no-op for deposits at/under the cap', () => {
    expect(effectiveDepositAPR(0.045, RATE_ENVIRONMENT_TABLE.normal)).toBeCloseTo(0.045, 10);
  });

  it('loan APR is floored at LOAN_APR_FLOOR', () => {
    const env = { depositMult: 1, loanDelta: -10 };
    expect(effectiveLoanAPR(0.065, env)).toBe(LOAN_APR_FLOOR);
  });
});

describe('ECONOMY INVARIANT - no borrow-low/save-high arbitrage', () => {
  it('max effective deposit APY < min effective loan APR across all economy states', () => {
    let maxDepositAPY = -Infinity;
    let minLoanAPR = Infinity;

    for (const state of ECONOMY_STATES) {
      const env = RATE_ENVIRONMENT_TABLE[state];
      for (const base of DEPOSIT_BASE_APRS) {
        maxDepositAPY = Math.max(maxDepositAPY, effectiveDepositAPR(base, env));
      }
      for (const base of LOAN_BASE_APRS) {
        minLoanAPR = Math.min(minLoanAPR, effectiveLoanAPR(base, env));
      }
    }

    // The core anti-money-printer guarantee.
    expect(maxDepositAPY).toBeLessThan(minLoanAPR);
    // And the deposit ceiling never exceeds the regulatory hard cap.
    expect(maxDepositAPY).toBeLessThanOrEqual(SAVINGS_APR_HARD_CAP);
  });
});
