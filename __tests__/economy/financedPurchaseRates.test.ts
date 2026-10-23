/**
 * ECO2-4 (second audit swarm, 2026-10-23): a mortgage and an auto loan are
 * priced like every other loan.
 *
 * `quotePropertyPurchase` and `quoteVehiclePurchase` called `quoteLoan`
 * without the Private Banking cap (a $9.99 purchase sold as "Loan rates
 * capped at 6% APR") and without the live rate environment, so neither
 * reached the two biggest loans in the game. The mortgage path also added its
 * PMI / high-down adjustment AFTER the politics floor, so a high-down
 * politician's mortgage was walked under the floor `POLITICS_LOAN_APR_FLOOR`
 * exists to hold.
 */
import { quotePropertyPurchase } from '@/contexts/game/actions/RealEstateActions';
import { quoteVehiclePurchase } from '@/contexts/game/actions/VehicleActions';
import { getLoanQuote, POLITICS_LOAN_APR_FLOOR, PRIVATE_BANKING_APR_CAP } from '@/contexts/game/actions/LoanActions';
import { RESIDENTIAL_CATALOG } from '@/lib/realEstate/catalog';
import { initialGameState } from '@/contexts/game/initialState';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const studio = RESIDENTIAL_CATALOG[0];

function player(opts: { score?: number; privateBanking?: boolean; loanDelta?: number; careerLevel?: number } = {}): GameState {
  const base = createTestGameState();
  const banking = initialGameState.banking!;
  return createTestGameState({
    stats: { money: 10_000_000 },
    settings: { privateBanking: opts.privateBanking === true },
    loans: [],
    banking: {
      ...banking,
      creditScore: { ...banking.creditScore, score: opts.score ?? 680 },
      rateEnvironment: { depositMult: 1, loanDelta: opts.loanDelta ?? 0 },
    },
    ...(opts.careerLevel ? { politics: { ...(base.politics ?? {}), careerLevel: opts.careerLevel } as never } : {}),
  });
}

const mortgageAPR = (s: GameState, tier: 'low' | 'standard' | 'high' = 'standard'): number => {
  const q = quotePropertyPurchase(s, studio, tier, '30y', 50_000);
  if (q.rejected) throw new Error(`mortgage quote rejected: ${q.reason}`);
  return q.offeredAPR!;
};
const autoAPR = (s: GameState, tier: 'low' | 'standard' | 'high' = 'standard'): number => {
  const q = quoteVehiclePurchase(s, 'economy_sedan', tier, '5y', 50_000);
  if (q.rejected) throw new Error(`auto quote rejected: ${q.reason}`);
  return q.offeredAPR!;
};

describe('Private Banking caps financed purchases too', () => {
  it('caps a mid-credit mortgage at 6%, PMI surcharge included', () => {
    expect(mortgageAPR(player())).toBeGreaterThan(PRIVATE_BANKING_APR_CAP);
    expect(mortgageAPR(player({ privateBanking: true }))).toBeLessThanOrEqual(PRIVATE_BANKING_APR_CAP + 1e-12);
    expect(mortgageAPR(player({ privateBanking: true }), 'low')).toBeLessThanOrEqual(PRIVATE_BANKING_APR_CAP + 1e-12);
  });

  it('caps a mid-credit auto loan at 6%', () => {
    expect(autoAPR(player())).toBeGreaterThan(PRIVATE_BANKING_APR_CAP);
    expect(autoAPR(player({ privateBanking: true }))).toBeLessThanOrEqual(PRIVATE_BANKING_APR_CAP + 1e-12);
  });

  it('is the only place a mortgage is priced: the Bank app no longer sells one (D7)', () => {
    const s = player({ privateBanking: true });
    const bank = getLoanQuote(s, { principal: 100_000, termWeeks: 1560, type: 'mortgage', weeklyIncome: 50_000 });
    expect(bank.rejected).toBe(true);
    expect(mortgageAPR(s, 'standard')).toBeLessThanOrEqual(PRIVATE_BANKING_APR_CAP + 1e-12);
  });
});

describe('the live rate environment reaches financed purchases', () => {
  it('a recession premium raises the mortgage and the auto loan', () => {
    expect(mortgageAPR(player({ loanDelta: 0.02 }))).toBeCloseTo(mortgageAPR(player()) + 0.02, 10);
    expect(autoAPR(player({ loanDelta: 0.02 }))).toBeCloseTo(autoAPR(player()) + 0.02, 10);
  });
});

describe('the politics floor survives the down-payment discount', () => {
  it('a top-office politician with a high down payment stays at or above the floor', () => {
    expect(mortgageAPR(player({ careerLevel: 6, score: 820 }), 'high')).toBeGreaterThanOrEqual(POLITICS_LOAN_APR_FLOOR);
    expect(autoAPR(player({ careerLevel: 6, score: 820 }), 'high')).toBeGreaterThanOrEqual(POLITICS_LOAN_APR_FLOOR);
  });

  it('a private citizen keeps the high-down discount', () => {
    expect(mortgageAPR(player(), 'high')).toBeLessThan(mortgageAPR(player(), 'standard'));
    expect(autoAPR(player(), 'high')).toBeLessThan(autoAPR(player(), 'standard'));
  });
});
