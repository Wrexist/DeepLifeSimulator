/**
 * ECO-4 (owner decision 2026-10-22): minted coins pay the net-worth passive
 * soft cap, and they carry a zero cost basis.
 */
import { applyMiningCryptos } from '@/contexts/game/actions/weekly/applyMiningCryptos';
import { executeMarketOrder, recordMintedCoins } from '@/lib/crypto/operations';
import { passiveIncomeEfficiency } from '@/lib/economy/passiveIncome';
import type { Crypto, CryptoMarketState } from '@/contexts/game/types';

const aCrypto = (id: string, owned: number, price: number) =>
  ({ id, name: id.toUpperCase(), symbol: id.toUpperCase(), owned, price, weeklyRate: 0 } as never);

const warehouse = {
  level: 5,
  miners: { quantum: 2 },
  minerDurability: { quantum: 100 },
  selectedCrypto: 'btc',
} as never;

describe('ECO-4: the soft cap reaches minted coins', () => {
  it('mints the same coins below $10M and fewer above it, by the companies factor', () => {
    const run = (eff?: number) =>
      applyMiningCryptos({ prevWarehouse: warehouse, prevCryptos: [aCrypto('btc', 0, 40_000)], halvingCount: 0, passiveEfficiency: eff });
    const uncapped = run().minted!.amount;
    expect(run(1).minted!.amount).toBeCloseTo(uncapped, 10);
    const eff = passiveIncomeEfficiency(100_000_000, 0);
    expect(eff).toBeLessThan(1);
    expect(run(eff).minted!.amount).toBeCloseTo(uncapped * eff, 10);
    // The minted figure is exactly what reached the wallet.
    expect(run(eff).updatedCryptos.find((c) => c.id === 'btc')!.owned).toBeCloseTo(uncapped * eff, 10);
  });

  it('ignores a corrupt factor instead of minting more', () => {
    const base = applyMiningCryptos({ prevWarehouse: warehouse, prevCryptos: [aCrypto('btc', 0, 40_000)], halvingCount: 0 });
    for (const bad of [NaN, -1, 2, Infinity]) {
      const r = applyMiningCryptos({
        prevWarehouse: warehouse,
        prevCryptos: [aCrypto('btc', 0, 40_000)],
        halvingCount: 0,
        passiveEfficiency: bad,
      });
      expect(r.minted!.amount).toBeCloseTo(base.minted!.amount, 10);
    }
  });
});

describe('ECO-4: minted coins carry a zero cost basis', () => {
  const market = (): CryptoMarketState => ({
    coinMarkets: {
      btc: {
        cryptoId: 'btc',
        regime: 'stable',
        regimeWeeksRemaining: 16,
        priceHistory: [{ weeksLived: 0, price: 100 }],
        bidAskSpread: 0.002,
      },
    },
    openOrders: [],
    orderHistory: [],
    dcaRules: [],
    costBasis: {},
    realizedGainsThisYear: 0,
    totalRealizedGains: 0,
  });
  const btc = (owned: number): Crypto => ({ id: 'btc', symbol: 'BTC', name: 'Bitcoin', price: 100, change: 0, changePercent: 0, owned });

  it('a sale after mining realises the mined share as a gain', () => {
    const bought = executeMarketOrder(market(), [btc(0)], { cryptoId: 'btc', side: 'buy', amount: 1000, placedWeek: 1 });
    if ('error' in bought) throw new Error(bought.error);
    const coins = bought.coinAmount;

    // Without booking the mint, selling `coins` coins out of 2x that holding
    // draws down the WHOLE purchased basis: ~zero gain on half the stack.
    const unbooked = executeMarketOrder(bought.market, [btc(coins * 2)], { cryptoId: 'btc', side: 'sell', amount: coins, placedWeek: 2 });
    if ('error' in unbooked) throw new Error(unbooked.error);
    expect(Math.abs(unbooked.realizedGain)).toBeLessThan(10);

    // Booked at $0, the same sale carries half the basis and realises ~half.
    const minted = recordMintedCoins(bought.market, 'btc', coins);
    expect(minted.costBasis.btc.totalCost).toBe(bought.market.costBasis.btc.totalCost);
    expect(minted.costBasis.btc.totalShares).toBeCloseTo(coins * 2, 10);
    const booked = executeMarketOrder(minted, [btc(coins * 2)], { cryptoId: 'btc', side: 'sell', amount: coins, placedWeek: 2 });
    if ('error' in booked) throw new Error(booked.error);
    expect(booked.realizedGain).toBeGreaterThan(400);
  });

  it('a mint with nothing bought is all gain, and a non-positive mint is a no-op', () => {
    const m = recordMintedCoins(market(), 'btc', 5);
    expect(m.costBasis.btc).toEqual({ totalCost: 0, totalShares: 5 });
    expect(recordMintedCoins(m, 'btc', 0)).toBe(m);
    expect(recordMintedCoins(m, 'btc', NaN)).toBe(m);
  });
});
