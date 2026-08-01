/**
 * Regression (M-1): acquiring a new identity discharges unsecured (personal/
 * business) loans. It used to cost a flat 0.5 BTC, so maxing out loans, spending
 * the cash, and buying an identity wiped the debt for almost nothing — repeatable
 * free money. The cost now scales with the discharged principal (a settlement
 * fee), so walking away from debt costs nearly as much as repaying it.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { applyWithSetState as apply } from '../helpers/setGameStateStub';
import { acquireNewIdentity, NEW_IDENTITY_COST_BTC } from '@/contexts/game/actions/CrimeActions';
import { GameState, Loan } from '@/contexts/game/types';



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
    const expectedFee = NEW_IDENTITY_COST_BTC + (100000 * 0.8) / price;
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
});
