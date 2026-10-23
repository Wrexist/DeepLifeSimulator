/**
 * Regression (M-1): acquiring a new identity discharges unsecured (personal/
 * business) loans. It used to cost a flat 0.5 BTC, so maxing out loans, spending
 * the cash, and buying an identity wiped the debt for almost nothing — repeatable
 * free money. The cost now scales with the discharged principal (a settlement
 * fee), so walking away from debt costs nearly as much as repaying it.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { applyWithSetState as apply } from '../helpers/setGameStateStub';
import {
  acquireNewIdentity,
  IDENTITY_DISCHARGE_FEE_RATE,
  NEW_IDENTITY_COST_BTC,
  newIdentitySettlement,
} from '@/contexts/game/actions/CrimeActions';
import { acceptLoan } from '@/contexts/game/actions/LoanActions';
import { CreditCard, GameState, Loan } from '@/contexts/game/types';



const personalLoan = (remaining: number): Loan => ({
  id: 'pl1', name: 'Personal Loan', principal: remaining, remaining,
  rateAPR: 0.2, termWeeks: 52, weeklyPayment: 100, startWeek: 0, autoPay: false,
  type: 'personal', weeksRemaining: 52, interestRate: 0.2,
});

/** Deep clone (the test factory shares nested refs with initialGameState). */
const freshState = (overrides: Partial<GameState> = {}): GameState =>
  JSON.parse(JSON.stringify(createTestGameState(overrides)));

function setBtc(state: GameState, owned: number): { state: GameState; price: number } {
  const btc = state.cryptos.find((c) => c.id === 'btc')!;
  btc.owned = owned;
  return { state, price: btc.price };
}

describe('new-identity debt-discharge cost (M-1)', () => {
  it('with no unsecured debt, costs only the base BTC fee', () => {
    const { state } = setBtc(freshState({ loans: [] }), 10);
    const before = state.cryptos.find((c) => c.id === 'btc')!.owned;
    const after = apply(state, (set) => acquireNewIdentity(set));
    const spent = before - after.cryptos.find((c) => c.id === 'btc')!.owned;
    expect(spent).toBeCloseTo(NEW_IDENTITY_COST_BTC, 5);
  });

  it('with large unsecured debt, costs far more than the base fee (settlement)', () => {
    const { state, price } = setBtc(freshState({ loans: [personalLoan(100000)] }), 10);
    const before = state.cryptos.find((c) => c.id === 'btc')!.owned;
    const after = apply(state, (set) => acquireNewIdentity(set));
    const spent = before - after.cryptos.find((c) => c.id === 'btc')!.owned;
    const expectedFee = NEW_IDENTITY_COST_BTC + (100000 * IDENTITY_DISCHARGE_FEE_RATE) / price;
    expect(spent).toBeCloseTo(expectedFee, 4);
    expect(spent).toBeGreaterThan(NEW_IDENTITY_COST_BTC * 2);
    // The unsecured loan is gone.
    expect(after.loans?.some((l) => l.id === 'pl1')).toBe(false);
  });

  it('is rejected when BTC cannot cover the settlement fee (debt not wiped)', () => {
    const { state } = setBtc(freshState({ loans: [personalLoan(1_000_000)] }), 1); // 1 BTC, fee needs ~19
    const after = apply(state, (set) => acquireNewIdentity(set));
    expect(after.loans?.some((l) => l.id === 'pl1')).toBe(true); // still owes
    expect(after.cryptos.find((c) => c.id === 'btc')!.owned).toBe(1); // nothing spent
  });

  // LATE-16: closing the cards used to wipe their balances for free.
  it('card balances are settled like unsecured debt, and the mortgage stays', () => {
    const card: CreditCard = {
      id: 'cc1', name: 'Gold', tier: 'gold' as CreditCard['tier'], creditLimit: 50_000, balance: 40_000,
      baseAPR: 0.24, rewardsRate: 0.01, rewardsType: 'cashback' as CreditCard['rewardsType'],
      pendingRewards: 0, openedWeek: 0, minCreditScore: 600,
    };
    const mortgage: Loan = { ...personalLoan(200_000), id: 'mg1', name: 'Mortgage', type: 'mortgage' };
    const base = freshState({ loans: [mortgage] });
    base.banking = { ...base.banking!, creditCards: [card] };
    const { state, price } = setBtc(base, 50);

    const quote = newIdentitySettlement(state);
    expect(quote.dischargedDebt).toBe(40_000);
    expect(quote.closedCards).toBe(1);
    expect(quote.keptLoans.map((l) => l.id)).toEqual(['mg1']);
    expect(quote.totalBtc).toBeCloseTo(NEW_IDENTITY_COST_BTC + (40_000 * IDENTITY_DISCHARGE_FEE_RATE) / price, 6);

    const before = state.cryptos.find((c) => c.id === 'btc')!.owned;
    const after = apply(state, (set) => acquireNewIdentity(set));
    const spent = before - after.cryptos.find((c) => c.id === 'btc')!.owned;
    expect(spent).toBeCloseTo(quote.totalBtc, 6);
    expect(after.banking!.creditCards).toEqual([]);
    expect(after.loans?.map((l) => l.id)).toEqual(['mg1']);
  });

  // APP2-1: at a 0.8 fee, borrow-then-burn was a profit by itself, and the 580
  // reset is exactly the personal-loan minimum, so the next loan followed at once.
  it('borrowing and then burning the identity is never a profit (APP2-1)', () => {
    expect(IDENTITY_DISCHARGE_FEE_RATE).toBeGreaterThanOrEqual(1);
    const base = freshState({ loans: [] });
    base.banking = {
      ...base.banking!,
      creditScore: { ...base.banking!.creditScore, score: 580, inquiries: [] },
    };
    const { state, price } = setBtc(base, 1_000);
    const worth = (s: GameState) =>
      s.stats.money
      + (s.cryptos.find((c) => c.id === 'btc')!.owned * price)
      - (s.loans ?? []).reduce((sum, l) => sum + (l.remaining ?? 0), 0);

    let s = state;
    const start = s.stats.money + s.cryptos.find((c) => c.id === 'btc')!.owned * price;
    for (let cycle = 0; cycle < 3; cycle++) {
      s = apply(s, (set) => acceptLoan(set, {
        principal: 200_000, termWeeks: 260, type: 'personal', name: 'Personal',
        weeklyIncome: 1_000_000, depositAccountId: 'checking-default',
      }));
      expect((s.loans ?? []).length).toBe(1); // the loan really landed
      s = apply(s, (set) => acquireNewIdentity(set));
      expect((s.loans ?? []).length).toBe(0); // and was walked away from
    }
    // Cash plus BTC, with no debt left: three cycles must have cost money.
    expect(worth(s)).toBeLessThan(start);
  });
});
