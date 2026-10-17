/**
 * JSON writes NaN and Infinity as `null`. The repair scanner for nested numeric
 * fields only looked for `typeof === 'number'` NaN/Infinity, so a NaN that had
 * already reached disk came back as `null` and loaded silently - a NaN
 * `holdings[].shares` became a null share count. `null` in those fields is now
 * treated as the corruption it is, and the repair reports itself (§7: a repair
 * that does not set `repaired` is computed and discarded).
 */
import { repairGameState } from '@/utils/saveValidation';
import { createTestGameState } from '../helpers/createTestGameState';

type AnyState = Record<string, any>;

/** A save that held NaN in memory, after the round trip to disk. */
function persistedWithNaN(): AnyState {
  const s = JSON.parse(JSON.stringify(createTestGameState())) as AnyState;
  s.stocks = {
    ...(s.stocks ?? {}),
    holdings: [{ symbol: 'AAPL', shares: NaN, averagePrice: 100, currentPrice: 120, totalInvested: 1000 }],
  };
  s.loans = [{ id: 'l1', name: 'Loan', principal: 1000, remaining: Infinity, weeklyPayment: 10, weeksRemaining: 10, interestRate: 0.05 }];
  s.bankSavings = NaN;
  return JSON.parse(JSON.stringify(s)) as AnyState;
}

describe('NaN persisted as null is repaired', () => {
  it('the round trip really turns NaN into null (otherwise this proves nothing)', () => {
    const s = persistedWithNaN();
    expect(s.stocks.holdings[0].shares).toBeNull();
    expect(s.loans[0].remaining).toBeNull();
    expect(s.bankSavings).toBeNull();
  });

  it('repairs null numeric fields to 0 and flags the repair', () => {
    const s = persistedWithNaN();
    const result = repairGameState(s);
    expect(result.repaired).toBe(true);
    expect(s.stocks.holdings[0].shares).toBe(0);
    expect(s.loans[0].remaining).toBe(0);
    expect(s.bankSavings).toBe(0);
    expect(result.repairs.some((r) => r.includes('stocks.holdings[0].shares'))).toBe(true);
  });

  it('leaves real numbers and absent optional fields alone', () => {
    const s = persistedWithNaN();
    s.stocks.holdings.push({ symbol: 'MSFT', shares: 3, averagePrice: 50, currentPrice: 55 });
    repairGameState(s);
    expect(s.stocks.holdings[0].averagePrice).toBe(100);
    expect(s.stocks.holdings[1].shares).toBe(3);
    expect('totalInvested' in s.stocks.holdings[1]).toBe(false);
  });
});
