/**
 * Save Migration v16 — BitcoinMiningApp remake.
 *
 *   1. Additive — existing cryptos[] preserved, owned balances kept.
 *   2. Idempotent — running twice is a no-op.
 *   3. Defensive — handles missing cryptos[], bad prices, NaN owned.
 *   4. Cost basis seeded from existing holdings at current price.
 *   5. Chains end-to-end from v10 → CURRENT_STATE_VERSION.
 */

import { runMigrations, CURRENT_STATE_VERSION } from '@/utils/saveMigrations';

describe('Save migration → v16 (BitcoinMiningApp remake)', () => {
  describe('additive preservation', () => {
    it('preserves existing cryptos[] verbatim', () => {
      const v15 = {
        version: 15,
        weeksLived: 10,
        cryptos: [
          { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 50_000, change: 0, changePercent: 0, owned: 0.5 },
          { id: 'eth', symbol: 'ETH', name: 'Ethereum', price: 3000, change: 0, changePercent: 0, owned: 2 },
        ],
      };
      const { state, errors } = runMigrations(v15);
      expect(errors).toEqual([]);
      expect(state.cryptos).toHaveLength(2);
      expect(state.cryptos[0].owned).toBe(0.5);
      expect(state.cryptos[1].owned).toBe(2);
    });

    it('creates a cryptoMarket slice with a CoinMarket per crypto', () => {
      const v15 = {
        version: 15,
        weeksLived: 10,
        cryptos: [
          { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 50_000, change: 0, changePercent: 0, owned: 0 },
          { id: 'eth', symbol: 'ETH', name: 'Ethereum', price: 3000, change: 0, changePercent: 0, owned: 0 },
        ],
      };
      const { state } = runMigrations(v15);
      expect(state.cryptoMarket).toBeDefined();
      expect(state.cryptoMarket.coinMarkets.btc).toBeDefined();
      expect(state.cryptoMarket.coinMarkets.eth).toBeDefined();
      expect(state.cryptoMarket.coinMarkets.btc.regime).toBe('stable');
    });

    it('seeds price history with current price', () => {
      const v15 = {
        version: 15,
        weeksLived: 42,
        cryptos: [{ id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 60_000, change: 0, changePercent: 0, owned: 0 }],
      };
      const { state } = runMigrations(v15);
      const cm = state.cryptoMarket.coinMarkets.btc;
      expect(cm.priceHistory).toHaveLength(1);
      expect(cm.priceHistory[0].weeksLived).toBe(42);
      expect(cm.priceHistory[0].price).toBe(60_000);
    });

    it('seeds cost basis for existing holdings', () => {
      const v15 = {
        version: 15,
        weeksLived: 10,
        cryptos: [
          { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 50_000, change: 0, changePercent: 0, owned: 0.5 },
          { id: 'eth', symbol: 'ETH', name: 'Ethereum', price: 3000, change: 0, changePercent: 0, owned: 0 },
        ],
      };
      const { state } = runMigrations(v15);
      expect(state.cryptoMarket.costBasis.btc).toEqual({ totalCost: 25_000, totalShares: 0.5 });
      // No basis seeded for non-owned ETH
      expect(state.cryptoMarket.costBasis.eth).toBeUndefined();
    });

    it('initializes empty order book, history, DCA rules, gains', () => {
      const { state } = runMigrations({ version: 15, weeksLived: 0, cryptos: [] });
      expect(state.cryptoMarket.openOrders).toEqual([]);
      expect(state.cryptoMarket.orderHistory).toEqual([]);
      expect(state.cryptoMarket.dcaRules).toEqual([]);
      expect(state.cryptoMarket.realizedGainsThisYear).toBe(0);
      expect(state.cryptoMarket.totalRealizedGains).toBe(0);
    });
  });

  describe('idempotence', () => {
    it('running v16 twice leaves cryptoMarket identical', () => {
      const v15 = {
        version: 15,
        weeksLived: 5,
        cryptos: [{ id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 50_000, change: 0, changePercent: 0, owned: 1 }],
      };
      const first = runMigrations(v15);
      const snapshot = JSON.parse(JSON.stringify(first.state.cryptoMarket));
      const second = runMigrations(first.state);
      expect(second.state.cryptoMarket).toEqual(snapshot);
    });
  });

  describe('defensive', () => {
    it('handles missing cryptos[] without crashing', () => {
      const { state, errors } = runMigrations({ version: 15, weeksLived: 0 });
      expect(errors).toEqual([]);
      expect(state.cryptoMarket).toBeDefined();
      expect(state.cryptoMarket.coinMarkets).toEqual({});
    });

    it('handles cryptos with bad price (defaults to 1)', () => {
      const { state, errors } = runMigrations({
        version: 15,
        weeksLived: 0,
        cryptos: [{ id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: NaN, change: 0, changePercent: 0, owned: 0 }],
      });
      expect(errors).toEqual([]);
      expect(state.cryptoMarket.coinMarkets.btc.priceHistory[0].price).toBe(1);
    });

    it('handles cryptos with bad owned (defaults to 0; no cost basis row)', () => {
      const { state } = runMigrations({
        version: 15,
        weeksLived: 0,
        cryptos: [{ id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 50_000, change: 0, changePercent: 0, owned: NaN }],
      });
      expect(state.cryptoMarket.costBasis.btc).toBeUndefined();
    });
  });

  describe('chained migrations', () => {
    it('migrates a v10 save through to v16', () => {
      const v10 = {
        version: 10,
        weeksLived: 50,
        bankSavings: 100,
        cryptos: [
          { id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 50_000, change: 0, changePercent: 0, owned: 0 },
        ],
      };
      const { state, errors, migrationsApplied } = runMigrations(v10);
      expect(errors).toEqual([]);
      expect(state.version).toBe(CURRENT_STATE_VERSION);
      expect(migrationsApplied).toEqual(expect.arrayContaining([11, 12, 13, 14, 15, 16]));
      expect(state.cryptoMarket).toBeDefined();
      expect(state.banking).toBeDefined();
    });
  });

  describe('CURRENT_STATE_VERSION', () => {
    it('is at least 16 (banking + crypto remakes landed)', () => {
      expect(CURRENT_STATE_VERSION).toBeGreaterThanOrEqual(16);
    });
  });
});
