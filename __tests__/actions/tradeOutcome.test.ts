/**
 * APP-8 (audit 2026-10-21): stock and crypto trades say what happened.
 *
 * The trade sheet closed after every order whether or not anything filled; the
 * market actions were void with several silent `return prev` refusals. They
 * now return an outcome computed by the SAME pure resolver the updater runs.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';
import { buyStockMarket, sellStockMarket, placeStockLimitOrder } from '@/contexts/game/actions/StockActions';

describe('stock trade outcomes (APP-8)', () => {
  it('a filled market buy reports the shares and fill price, and matches what committed', () => {
    const stub = createSetGameStateStub(createTestGameState({ weeksLived: 50, stats: { money: 10_000 } }));
    const before = stub.current();
    const r = buyStockMarket(stub.setGameState, 'AAPL', 1_000, 100, before);
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/^Bought .* AAPL @ \$/);
    const after = stub.current();
    expect(after.stats.money).toBeLessThan(before.stats.money);
    expect(after.stocks?.holdings?.find((h) => h.symbol === 'AAPL')?.shares ?? 0).toBeGreaterThan(0);
  });

  it('an unaffordable buy reports why and changes nothing', () => {
    const stub = createSetGameStateStub(createTestGameState({ stats: { money: 500 } }));
    const before = stub.current();
    const r = buyStockMarket(stub.setGameState, 'AAPL', 1_000, 100, before);
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/Not enough cash/);
    expect(stub.current().stats.money).toBe(500);
  });

  it('selling shares you do not hold, or a limit buy you cannot fund, is reported', () => {
    const stub = createSetGameStateStub(createTestGameState({ stats: { money: 100 } }));
    const sell = sellStockMarket(stub.setGameState, 'AAPL', 5, 100, stub.current());
    expect(sell.ok).toBe(false);
    expect(sell.message).toMatch(/only hold/);
    const limit = placeStockLimitOrder(stub.setGameState, 'AAPL', 'buy', 5_000, 90, stub.current());
    expect(limit.ok).toBe(false);
    expect(stub.current().stocks?.openOrders ?? []).toHaveLength(0);
  });
});
