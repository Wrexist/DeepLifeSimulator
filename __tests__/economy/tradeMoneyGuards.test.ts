/**
 * Money-safety guards for the manual trade actions (stocks, crypto) and the
 * financed asset buys (property, vehicle).
 *
 * These paths used to write `stats.money` directly with `prev.stats?.money ?? 0`
 * — a NaN balance passes `?? 0` untouched, so `Math.max(0, NaN - cost)` is NaN
 * and every subsequent money calc is poisoned. They are now routed through the
 * canonical `applyMoneyDelta` (MONEY_CEILING clamp + NaN/overdraft guard):
 *   • BUYS with a corrupt (NaN) balance REJECT the trade (asset not granted).
 *   • SELLS with a corrupt (NaN) balance SANITIZE the balance to a finite value
 *     (the NaN no longer propagates into money).
 *
 * Each test proves the guard specifically fires by contrasting the corrupt-balance
 * run with a healthy-balance run that succeeds through the SAME market setup.
 */
import type { Dispatch, SetStateAction } from 'react';
import { GameState, GameStats, Crypto } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { buyStockMarket, sellStockMarket } from '@/contexts/game/actions/StockActions';
import { buyCryptoMarket, sellCryptoMarket } from '@/contexts/game/actions/CryptoTradingActions';
import { purchaseVehicleWithAutoLoan } from '@/contexts/game/actions/VehicleActions';

/** Minimal synchronous setGameState honoring functional-updater semantics. */
function makeStore(initial: GameState) {
  let current = initial;
  const setGameState: Dispatch<SetStateAction<GameState>> = (update) => {
    current = typeof update === 'function' ? (update as (p: GameState) => GameState)(current) : update;
  };
  return { get: () => current, setGameState };
}

const BASE_STATS = createTestGameState().stats;
const st = (money: number, over: Partial<GameStats> = {}): GameStats => ({ ...BASE_STATS, money, ...over });

const btcOwned = (owned: number): Crypto[] =>
  [{ id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 42150, change: 0, changePercent: 0, owned }];

describe('trade money guards — NaN balance', () => {
  describe('stock BUY', () => {
    it('a healthy balance fills the buy (proves the market setup works)', () => {
      const store = makeStore(createTestGameState({ stats: st(1_000_000) }));
      buyStockMarket(store.setGameState, 'AAPL', 1_000, 150);
      const holdings = store.get().stocks?.holdings ?? [];
      expect(holdings.some((h) => h.symbol === 'AAPL')).toBe(true);
      expect(store.get().stats.money).toBeLessThan(1_000_000);
      expect(isFinite(store.get().stats.money)).toBe(true);
    });

    it('a NaN balance rejects the buy — no shares granted', () => {
      const store = makeStore(createTestGameState({ stats: st(NaN) }));
      buyStockMarket(store.setGameState, 'AAPL', 1_000, 150);
      expect(store.get().stocks?.holdings ?? []).toHaveLength(0);
    });
  });

  describe('stock SELL', () => {
    const withHolding = (money: number) =>
      createTestGameState({
        stats: st(money),
        stocks: {
          holdings: [{ symbol: 'AAPL', shares: 10, averagePrice: 100, currentPrice: 150 }],
          watchlist: [],
          realizedGains: 0,
        },
      });

    it('a healthy balance credits proceeds', () => {
      const store = makeStore(withHolding(50_000));
      sellStockMarket(store.setGameState, 'AAPL', 5, 150);
      expect(store.get().stats.money).toBeGreaterThan(50_000);
    });

    it('a NaN balance is sanitized (finite money), not propagated', () => {
      const store = makeStore(withHolding(NaN));
      sellStockMarket(store.setGameState, 'AAPL', 5, 150);
      expect(isFinite(store.get().stats.money)).toBe(true);
      expect(store.get().stats.money).toBeGreaterThan(0);
    });
  });

  describe('crypto BUY', () => {
    it('a healthy balance fills the buy', () => {
      const store = makeStore(createTestGameState({ stats: st(1_000_000), cryptos: btcOwned(0) }));
      buyCryptoMarket(store.setGameState, 'btc', 1_000);
      const btc = store.get().cryptos.find((c) => c.id === 'btc');
      expect((btc?.owned ?? 0)).toBeGreaterThan(0);
    });

    it('a NaN balance rejects the buy — no coins granted', () => {
      const store = makeStore(createTestGameState({ stats: st(NaN), cryptos: btcOwned(0) }));
      buyCryptoMarket(store.setGameState, 'btc', 1_000);
      const btc = store.get().cryptos.find((c) => c.id === 'btc');
      expect(btc?.owned ?? 0).toBe(0);
    });
  });

  describe('crypto SELL', () => {
    it('a healthy balance credits proceeds', () => {
      const store = makeStore(createTestGameState({ stats: st(10_000), cryptos: btcOwned(1) }));
      sellCryptoMarket(store.setGameState, 'btc', 0.1);
      expect(store.get().stats.money).toBeGreaterThan(10_000);
    });

    it('a NaN balance is sanitized (finite money), not propagated', () => {
      const store = makeStore(createTestGameState({ stats: st(NaN), cryptos: btcOwned(1) }));
      sellCryptoMarket(store.setGameState, 'btc', 0.1);
      expect(isFinite(store.get().stats.money)).toBe(true);
      expect(store.get().stats.money).toBeGreaterThan(0);
    });
  });

  describe('vehicle BUY (financed asset)', () => {
    it('a healthy balance completes the purchase', () => {
      const store = makeStore(createTestGameState({ hasDriversLicense: true, stats: st(100_000, { reputation: 0 }) }));
      const res = purchaseVehicleWithAutoLoan(store.get(), store.setGameState, {
        templateId: 'economy_sedan',
        tier: 'cash',
        term: '5y',
        weeklyIncome: 2_000,
      });
      expect(res.success).toBe(true);
      expect((store.get().vehicles ?? []).some((v) => v.id === 'economy_sedan')).toBe(true);
    });

    it('a NaN balance rejects the purchase — no vehicle granted', () => {
      const store = makeStore(createTestGameState({ hasDriversLicense: true, stats: st(NaN) }));
      const res = purchaseVehicleWithAutoLoan(store.get(), store.setGameState, {
        templateId: 'economy_sedan',
        tier: 'cash',
        term: '5y',
        weeklyIncome: 2_000,
      });
      expect(res.success).toBe(false);
      expect((store.get().vehicles ?? []).some((v) => v.id === 'economy_sedan')).toBe(false);
    });
  });
});
