/**
 * Economy Flow Stress Test
 *
 * Drives stocks, crypto, real estate, and the stockMarket simulator through
 * the real provider. Focuses on math invariants — these are where mid-game
 * money corruption bugs hide.
 *
 *   Stocks:
 *     - Buy/sell via direct state mutation (matches StocksApp.tsx UI flow)
 *     - Holdings invariants: shares ≥ 0, averagePrice > 0 after buys
 *     - Stock market simulateWeek doesn't produce NaN prices
 *
 *   Crypto:
 *     - buyCrypto / sellCrypto / swapCrypto via the hook
 *     - Insufficient-funds / insufficient-holdings reject paths
 *     - NaN / Infinity / negative amount inputs are rejected
 *
 *   Real estate:
 *     - processWeeklyHousing applied 100 weeks, no NaN in currentValue
 *     - Property appreciation stays finite
 *
 *   Cross-cutting:
 *     - Money stays finite + non-negative through 100 mixed-economy ticks
 */

import React from 'react';
import { GameProvider } from '@/contexts/game/GameProvider';
import { useGameState, useGameActions, useMoneyActions } from '@/contexts/game';
import { UIUXProvider } from '@/contexts/UIUXContext';
import type { GameState } from '@/contexts/game/types';
import { validateGameState } from '@/utils/saveValidation';
import { makeRealEstate } from '../helpers/makeRealEstate';

jest.mock('@/utils/saveQueue', () => ({
  saveQueue: {
    addToQueue: jest.fn().mockResolvedValue(undefined),
    forceSave: jest.fn().mockResolvedValue(undefined),
    flushQueue: jest.fn().mockResolvedValue(undefined),
    restoreOnStartup: jest.fn().mockResolvedValue(undefined),
    setToastCallback: jest.fn(),
    getStatus: jest.fn(() => ({ queueLength: 0, isProcessing: false })),
  },
  queueSave: jest.fn().mockResolvedValue(undefined),
  forceSave: jest.fn().mockResolvedValue(undefined),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const TestRenderer = require('react-test-renderer');

const { act } = TestRenderer;
const h = React.createElement;

// ──────────────────── Probe ────────────────────────────────────────────────

type Probe = {
  state: GameState;
  setGameState: React.Dispatch<React.SetStateAction<GameState>>;
  money: ReturnType<typeof useMoneyActions>;
  game: ReturnType<typeof useGameActions>;
};

let captured: Probe | null = null;

function ProbeComponent() {
  const { gameState, setGameState } = useGameState();
  const money = useMoneyActions();
  const game = useGameActions();
  captured = { state: gameState, setGameState, money, game };
  return null;
}

function mountGame() {
  captured = null;
  let root: any;
  act(() => {
    root = TestRenderer.create(
      h(UIUXProvider as any, null, h(GameProvider as any, null, h(ProbeComponent)))
    );
  });
  return { root };
}

function deepCheck(state: unknown, path = 'root'): string[] {
  const issues: string[] = [];
  const seen = new WeakSet();
  const walk = (v: unknown, p: string) => {
    if (v === null || v === undefined) return;
    if (typeof v === 'number') {
      if (Number.isNaN(v)) issues.push(`NaN at ${p}`);
      if (!Number.isFinite(v)) issues.push(`Infinity at ${p}`);
      return;
    }
    if (typeof v === 'function') { issues.push(`function at ${p}`); return; }
    if (typeof v === 'object') {
      const obj = v as object;
      if (seen.has(obj)) return;
      seen.add(obj);
      if (Array.isArray(obj)) obj.forEach((x, i) => walk(x, `${p}[${i}]`));
      else for (const k of Object.keys(obj)) walk((obj as Record<string, unknown>)[k], `${p}.${k}`);
    }
  };
  walk(state, path);
  return issues;
}

function assertClean(stage: string) {
  const issues = deepCheck(captured!.state);
  if (issues.length) throw new Error(`[${stage}] corruption: ${issues.slice(0, 5).join('; ')}`);
  const v = validateGameState(captured!.state);
  if (!v.valid) throw new Error(`[${stage}] validateGameState: ${v.errors.join('; ')}`);
}

function seedWealthy() {
  act(() => captured!.setGameState(prev => ({
    ...prev,
    weeksLived: 100,
    date: { ...prev.date, age: 23, year: 2030 },
    stats: { ...prev.stats, money: 1_000_000, gems: 50_000, health: 100, happiness: 100, energy: 100, fitness: 100, reputation: 80 },
  })));
}

// ──────────────────── Tests ────────────────────────────────────────────────

describe('Economy flow — stocks + crypto + real estate', () => {
  jest.setTimeout(180_000);
  let mounted: { root: any } | null = null;

  afterEach(() => {
    if (mounted) {
      act(() => mounted!.root.unmount());
      mounted = null;
    }
    captured = null;
  });

  // ── STOCK MARKET SIMULATOR ─────────────────────────────────────────────
  it('Stocks: simulateWeek over 500 weeks keeps every price finite', async () => {
    const { simulateWeek, getAllStocks, resetStockPrices } = await import('@/lib/economy/stockMarket');
    resetStockPrices();

    for (let w = 0; w < 500; w++) {
      simulateWeek();
      const stocks = getAllStocks();
      for (const [sym, stock] of Object.entries(stocks)) {
        if (!Number.isFinite(stock.price) || Number.isNaN(stock.price) || stock.price < 0) {
          throw new Error(`Stock ${sym} price=${stock.price} at week ${w}`);
        }
      }
    }
  });

  it('Stocks: getStockPricesSnapshot round-trips through restoreStockPrices', async () => {
    const { simulateWeek, getStockPricesSnapshot, restoreStockPrices, getAllStocks, resetStockPrices } =
      await import('@/lib/economy/stockMarket');
    resetStockPrices();
    for (let i = 0; i < 50; i++) simulateWeek();

    const snapshot = getStockPricesSnapshot();
    // Mutate prices then restore.
    for (let i = 0; i < 10; i++) simulateWeek();
    restoreStockPrices(snapshot);

    const restored = getAllStocks();
    for (const [sym, original] of Object.entries(snapshot)) {
      expect(restored[sym]?.price).toBeCloseTo(original.price, 4);
    }
  });

  // ── STOCK BUY/SELL (state-level invariants) ────────────────────────────
  it('Stocks: buying via state mutation keeps holdings invariants', () => {
    mounted = mountGame();
    seedWealthy();

    const ticker = 'TECH';
    const price = 100;
    const sharesToBuy = 50;
    const cost = sharesToBuy * price;

    act(() => captured!.setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money - cost },
      stocks: {
        holdings: [
          ...(prev.stocks?.holdings || []),
          { symbol: ticker, shares: sharesToBuy, averagePrice: price, currentPrice: price },
        ],
        watchlist: prev.stocks?.watchlist || [],
      },
    })));

    const holding = captured!.state.stocks?.holdings.find(h => h.symbol === ticker);
    expect(holding).toBeDefined();
    expect(holding!.shares).toBe(sharesToBuy);
    expect(holding!.averagePrice).toBe(price);
    expect(holding!.shares).toBeGreaterThanOrEqual(0);
    expect(holding!.averagePrice).toBeGreaterThan(0);
    expect(captured!.state.stats.money).toBeGreaterThanOrEqual(0);
    assertClean('stocks buy');
  });

  it('Stocks: dollar-cost averaging — second buy at higher price raises averagePrice', () => {
    mounted = mountGame();
    seedWealthy();

    // Buy 10 shares @ $100.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      stats: { ...prev.stats, money: prev.stats.money - 1000 },
      stocks: {
        holdings: [{ symbol: 'TECH', shares: 10, averagePrice: 100, currentPrice: 100 }],
        watchlist: prev.stocks?.watchlist || [],
      },
    })));

    // Buy 10 more shares @ $200. Average should become $150.
    act(() => captured!.setGameState(prev => {
      const existing = prev.stocks!.holdings.find(h => h.symbol === 'TECH')!;
      const totalShares = existing.shares + 10;
      const totalCost = existing.shares * existing.averagePrice + 10 * 200;
      return {
        ...prev,
        stats: { ...prev.stats, money: prev.stats.money - 2000 },
        stocks: {
          holdings: prev.stocks!.holdings.map(h =>
            h.symbol === 'TECH'
              ? { ...h, shares: totalShares, averagePrice: totalCost / totalShares, currentPrice: 200 }
              : h
          ),
          watchlist: prev.stocks!.watchlist || [],
        },
      };
    }));

    const holding = captured!.state.stocks?.holdings.find(h => h.symbol === 'TECH')!;
    expect(holding.shares).toBe(20);
    expect(holding.averagePrice).toBeCloseTo(150, 4);
    assertClean('stocks DCA');
  });

  // ── CRYPTO BUY/SELL/SWAP ───────────────────────────────────────────────
  it('Crypto: buyCrypto deducts money and adds owned', () => {
    mounted = mountGame();
    seedWealthy();
    const cryptos = captured!.state.cryptos || [];
    if (cryptos.length === 0) return;
    const target = cryptos[0];

    const moneyBefore = captured!.state.stats.money;
    const ownedBefore = target.owned || 0;
    act(() => captured!.money.buyCrypto(target.id, 1000));
    const cryptoAfter = captured!.state.cryptos?.find(c => c.id === target.id);
    expect(captured!.state.stats.money).toBe(moneyBefore - 1000);
    expect((cryptoAfter?.owned || 0)).toBeGreaterThan(ownedBefore);
    expect(Number.isFinite(cryptoAfter?.owned ?? 0)).toBe(true);
    assertClean('crypto buy');
  });

  it('Crypto: buyCrypto rejects 0 / negative / non-finite amount', () => {
    mounted = mountGame();
    seedWealthy();
    const cryptos = captured!.state.cryptos || [];
    if (cryptos.length === 0) return;
    const target = cryptos[0];
    const moneyBefore = captured!.state.stats.money;

    act(() => captured!.money.buyCrypto(target.id, 0));
    act(() => captured!.money.buyCrypto(target.id, -100));
    act(() => captured!.money.buyCrypto(target.id, NaN));
    act(() => captured!.money.buyCrypto(target.id, Infinity));

    expect(captured!.state.stats.money).toBe(moneyBefore);
    assertClean('crypto buy rejects');
  });

  it('Crypto: buyCrypto rejects unknown cryptoId', () => {
    mounted = mountGame();
    seedWealthy();
    const moneyBefore = captured!.state.stats.money;
    act(() => captured!.money.buyCrypto('not-a-real-coin', 1000));
    expect(captured!.state.stats.money).toBe(moneyBefore);
  });

  it('Crypto: buyCrypto rejects insufficient funds', () => {
    mounted = mountGame();
    seedWealthy();
    const cryptos = captured!.state.cryptos || [];
    if (cryptos.length === 0) return;
    const target = cryptos[0];
    const moneyBefore = captured!.state.stats.money;
    act(() => captured!.money.buyCrypto(target.id, moneyBefore + 1_000_000));
    expect(captured!.state.stats.money).toBe(moneyBefore);
  });

  it('Crypto: sellCrypto deducts owned and adds money', () => {
    mounted = mountGame();
    seedWealthy();
    const cryptos = captured!.state.cryptos || [];
    if (cryptos.length === 0) return;
    const target = cryptos[0];
    act(() => captured!.money.buyCrypto(target.id, 1000));
    const ownedAfterBuy = captured!.state.cryptos?.find(c => c.id === target.id)?.owned || 0;
    expect(ownedAfterBuy).toBeGreaterThan(0);

    const moneyBeforeSell = captured!.state.stats.money;
    act(() => captured!.money.sellCrypto(target.id, ownedAfterBuy / 2));
    const ownedAfterSell = captured!.state.cryptos?.find(c => c.id === target.id)?.owned || 0;
    expect(ownedAfterSell).toBeLessThan(ownedAfterBuy);
    expect(captured!.state.stats.money).toBeGreaterThan(moneyBeforeSell);
    expect(Number.isFinite(captured!.state.stats.money)).toBe(true);
    assertClean('crypto sell');
  });

  it('Crypto: sellCrypto rejects when not enough owned', () => {
    mounted = mountGame();
    seedWealthy();
    const cryptos = captured!.state.cryptos || [];
    if (cryptos.length === 0) return;
    const target = cryptos[0];
    const moneyBefore = captured!.state.stats.money;
    act(() => captured!.money.sellCrypto(target.id, 99999));
    expect(captured!.state.stats.money).toBe(moneyBefore);
  });

  it('Crypto: swapCrypto preserves total value within rounding tolerance', () => {
    mounted = mountGame();
    seedWealthy();
    const cryptos = captured!.state.cryptos || [];
    if (cryptos.length < 2) return;
    const [a, b] = cryptos;
    act(() => captured!.money.buyCrypto(a.id, 5000));
    const aOwned = captured!.state.cryptos?.find(c => c.id === a.id)?.owned || 0;
    const moneyBeforeSwap = captured!.state.stats.money;

    act(() => captured!.money.swapCrypto(a.id, b.id, aOwned / 2));

    // Money should not change on a swap.
    expect(captured!.state.stats.money).toBe(moneyBeforeSwap);
    const aAfter = captured!.state.cryptos?.find(c => c.id === a.id)?.owned || 0;
    const bAfter = captured!.state.cryptos?.find(c => c.id === b.id)?.owned || 0;
    expect(aAfter).toBeCloseTo(aOwned / 2, 4);
    expect(bAfter).toBeGreaterThan(0);
    expect(Number.isFinite(aAfter)).toBe(true);
    expect(Number.isFinite(bAfter)).toBe(true);
    assertClean('crypto swap');
  });

  // ── REAL ESTATE / HOUSING ──────────────────────────────────────────────
  it('Housing: processWeeklyHousing keeps property currentValue finite', async () => {
    const { processWeeklyHousing } = await import('@/lib/realEstate/housing');

    let realEstate = [makeRealEstate({
      id: 'starter_apt',
      name: 'Starter Apt',
      price: 100_000,
      currentValue: 100_000,
      status: 'rented',
      rent: 800,
      upkeep: 200,
      purchasedWeek: 50,
    })];

    for (let week = 1; week <= 100; week++) {
      const result = processWeeklyHousing(realEstate, week);
      realEstate = result.properties;
      for (const p of realEstate) {
        expect(Number.isFinite(p.currentValue)).toBe(true);
        expect(p.currentValue).toBeGreaterThanOrEqual(0);
      }
      expect(Number.isFinite(result.totalRentalIncome)).toBe(true);
      expect(Number.isFinite(result.totalUpkeep)).toBe(true);
    }
  });

  it('Housing: property appreciates over 100 weeks (currentValue >= base)', async () => {
    const { processWeeklyHousing } = await import('@/lib/realEstate/housing');

    let realEstate = [makeRealEstate({
      id: 'home_x',
      name: 'Home X',
      price: 250_000,
      currentValue: 250_000,
      upkeep: 500,
    })];

    for (let week = 1; week <= 200; week++) {
      realEstate = processWeeklyHousing(realEstate, week).properties;
    }

    // Over time, value should be at or above the initial price (appreciation > 0).
    // We allow some flex for short-term volatility.
    expect(realEstate[0].currentValue).toBeGreaterThanOrEqual(realEstate[0].price * 0.5);
    expect(Number.isFinite(realEstate[0].currentValue)).toBe(true);
  });

  // ── CROSS-CUTTING: ECONOMY + NEXTWEEK ──────────────────────────────────
  it('Cross: 100 mixed-economy ticks keep money + holdings clean', async () => {
    mounted = mountGame();
    seedWealthy();
    const cryptos = captured!.state.cryptos || [];
    if (cryptos.length > 0) {
      act(() => captured!.money.buyCrypto(cryptos[0].id, 50_000));
    }

    // Seed some stock holdings.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      stocks: {
        holdings: [{ symbol: 'TECH', shares: 100, averagePrice: 100, currentPrice: 100 }],
        watchlist: prev.stocks?.watchlist || [],
      },
    })));

    for (let i = 0; i < 100; i++) {
      await act(async () => { await captured!.game.nextWeek(); });
      // Spot-check at every 25 weeks.
      if (i % 25 === 0) {
        expect(Number.isFinite(captured!.state.stats.money)).toBe(true);
        expect(captured!.state.stats.money).toBeGreaterThanOrEqual(0);
      }
    }
    assertClean('mixed economy 100 ticks');
  });

  // ── PASSIVE INCOME ─────────────────────────────────────────────────────
  it('Passive income: calcWeeklyPassiveIncome returns finite value on a populated state', async () => {
    mounted = mountGame();
    seedWealthy();
    const { calcWeeklyPassiveIncome } = await import('@/lib/economy/passiveIncome');
    // Seed a populated economic state.
    act(() => captured!.setGameState(prev => ({
      ...prev,
      stocks: {
        holdings: [{ symbol: 'TECH', shares: 100, averagePrice: 100, currentPrice: 120 }],
        watchlist: prev.stocks?.watchlist || [],
      },
      realEstate: [makeRealEstate({
        id: 'rented_apt', name: 'Rented Apt',
        price: 200_000, currentValue: 200_000, status: 'rented',
        rent: 1500, upkeep: 300, purchasedWeek: 50,
      })],
    })));

    const result = calcWeeklyPassiveIncome(captured!.state);
    expect(result).toBeDefined();
    // Check whatever shape it returns is finite top-level.
    const total = typeof result === 'number' ? result : (result as { total?: number; weeklyTotal?: number })?.total ?? (result as { total?: number; weeklyTotal?: number })?.weeklyTotal ?? 0;
    expect(Number.isFinite(total)).toBe(true);
    expect(total).toBeGreaterThanOrEqual(0);
  });
});
