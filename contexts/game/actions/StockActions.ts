/**
 * Stock trading actions — buy / sell / place-limit / place-stop / cancel.
 *
 * Mirrors the CryptoTradingActions pattern. Pure math lives in lib/stocks/;
 * this file dispatches setGameState mutations.
 */

import React from 'react';
import { GameState } from '../types';
import { logger } from '@/utils/logger';
import { executeMarket, placeOrder as placeOrderPure, cancelOrder as cancelOrderPure } from '@/lib/stocks/operations';
import { StockOrderSide, StockOrderType } from '@/lib/stocks/orderBook';

const log = logger.scope('StockActions');

const STOCK_FEE = 0.02; // 2% commission, matches legacy

interface Holding {
  symbol: string;
  shares: number;
  averagePrice: number;
  currentPrice: number;
}

type StocksSlice = NonNullable<GameState['stocks']>;

function ensureStocks(state: GameState): StocksSlice {
  return (
    state.stocks ?? {
      holdings: [],
      watchlist: [],
      realizedGains: 0,
    }
  );
}

function updateHoldingsOnBuy(holdings: Holding[], symbol: string, shares: number, price: number): Holding[] {
  const sym = symbol.toUpperCase();
  const idx = holdings.findIndex((h) => h.symbol.toUpperCase() === sym);
  if (idx === -1) {
    return [...holdings, { symbol: sym, shares, averagePrice: price, currentPrice: price }];
  }
  const existing = holdings[idx];
  const totalShares = existing.shares + shares;
  const totalCost = existing.shares * existing.averagePrice + shares * price;
  const newAvg = totalShares > 0 ? totalCost / totalShares : price;
  const next = [...holdings];
  next[idx] = { ...existing, shares: totalShares, averagePrice: newAvg, currentPrice: price };
  return next;
}

function applySellOnHoldings(holdings: Holding[], symbol: string, shares: number): { holdings: Holding[]; basisPerShare: number } {
  const sym = symbol.toUpperCase();
  const idx = holdings.findIndex((h) => h.symbol.toUpperCase() === sym);
  if (idx === -1) return { holdings, basisPerShare: 0 };
  const existing = holdings[idx];
  const basis = existing.averagePrice;
  const remaining = existing.shares - shares;
  if (remaining <= 0.0001) {
    return { holdings: holdings.filter((_, i) => i !== idx), basisPerShare: basis };
  }
  const next = [...holdings];
  next[idx] = { ...existing, shares: remaining };
  return { holdings: next, basisPerShare: basis };
}

// ---------------------------------------------------------------------------
// Market orders — immediate fill
// ---------------------------------------------------------------------------

export const buyStockMarket = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  symbol: string,
  amountUSD: number,
  midPrice: number
) => {
  setGameState((prev) => {
    const cash = prev.stats?.money ?? 0;
    // R2-G: include the broker fee in the affordability check. The previous
    // check only compared `amountUSD > cash`, so a player with exactly the
    // notional in cash would buy and end up with `money = cash - amountUSD - fee`
    // (i.e. negative money). Negative money is undefined behavior downstream
    // and bypasses the overdraft guard in updateMoney.
    const grossCost = amountUSD * (1 + STOCK_FEE);
    if (!isFinite(amountUSD) || amountUSD <= 0 || grossCost > cash) {
      log.warn(`Buy rejected: amount=${amountUSD}, grossCost=${grossCost}, cash=${cash}`);
      return prev;
    }
    const result = executeMarket(symbol, 'buy', amountUSD, midPrice, prev.weeksLived);
    if ('error' in result) {
      log.warn(`Buy failed: ${result.error}`);
      return prev;
    }
    const fee = result.notionalUSD * STOCK_FEE;
    const stocks = ensureStocks(prev);
    const newHoldings = updateHoldingsOnBuy(stocks.holdings ?? [], symbol, result.shares, result.order.filledPrice!);
    const newHistory = [result.order, ...(stocks.orderHistory ?? [])].slice(0, 50);
    return {
      ...prev,
      stats: { ...prev.stats, money: Math.max(0, cash - amountUSD - fee) },
      stocks: { ...stocks, holdings: newHoldings, orderHistory: newHistory },
    };
  });
};

export const sellStockMarket = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  symbol: string,
  shares: number,
  midPrice: number
) => {
  setGameState((prev) => {
    const stocks = ensureStocks(prev);
    const existing = (stocks.holdings ?? []).find((h) => h.symbol.toUpperCase() === symbol.toUpperCase());
    if (!existing || existing.shares < shares || shares <= 0) {
      log.warn(`Sell rejected: have ${existing?.shares ?? 0}, want ${shares}`);
      return prev;
    }
    const result = executeMarket(symbol, 'sell', shares, midPrice, prev.weeksLived);
    if ('error' in result) {
      log.warn(`Sell failed: ${result.error}`);
      return prev;
    }
    const proceeds = result.notionalUSD * (1 - STOCK_FEE);
    const { holdings: newHoldings, basisPerShare } = applySellOnHoldings(stocks.holdings ?? [], symbol, shares);
    const realizedGain = (result.order.filledPrice! - basisPerShare) * shares;
    const newHistory = [result.order, ...(stocks.orderHistory ?? [])].slice(0, 50);
    const cash = prev.stats?.money ?? 0;
    return {
      ...prev,
      stats: { ...prev.stats, money: cash + proceeds },
      stocks: {
        ...stocks,
        holdings: newHoldings,
        realizedGains: (stocks.realizedGains ?? 0) + realizedGain,
        orderHistory: newHistory,
      },
    };
  });
};

// ---------------------------------------------------------------------------
// Limit / stop orders — placed in the book; weekly tick fills them
// ---------------------------------------------------------------------------

export const placeStockLimitOrder = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  symbol: string,
  side: StockOrderSide,
  amount: number,
  limitPrice: number
) => {
  setGameState((prev) => {
    const stocks = ensureStocks(prev);
    const r = placeOrderPure(stocks.openOrders ?? [], {
      symbol: symbol.toUpperCase(),
      side,
      type: 'limit' as StockOrderType,
      amount,
      limitPrice,
      placedWeek: prev.weeksLived,
    });
    return { ...prev, stocks: { ...stocks, openOrders: r.orders } };
  });
};

export const placeStockStopOrder = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  symbol: string,
  side: StockOrderSide,
  amount: number,
  stopPrice: number
) => {
  setGameState((prev) => {
    const stocks = ensureStocks(prev);
    const r = placeOrderPure(stocks.openOrders ?? [], {
      symbol: symbol.toUpperCase(),
      side,
      type: 'stop' as StockOrderType,
      amount,
      stopPrice,
      placedWeek: prev.weeksLived,
    });
    return { ...prev, stocks: { ...stocks, openOrders: r.orders } };
  });
};

export const cancelStockOrder = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  orderId: string
) => {
  setGameState((prev) => {
    const stocks = ensureStocks(prev);
    const r = cancelOrderPure(stocks.openOrders ?? [], stocks.orderHistory ?? [], orderId);
    return { ...prev, stocks: { ...stocks, openOrders: r.orders, orderHistory: r.orderHistory } };
  });
};

// ---------------------------------------------------------------------------
// Watchlist toggle (kept for compat with the existing UI)
// ---------------------------------------------------------------------------

export const toggleStockWatchlist = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  symbol: string
) => {
  setGameState((prev) => {
    const stocks = ensureStocks(prev);
    const sym = symbol.toUpperCase();
    const has = (stocks.watchlist ?? []).includes(sym);
    return {
      ...prev,
      stocks: {
        ...stocks,
        watchlist: has ? stocks.watchlist!.filter((s) => s !== sym) : [...(stocks.watchlist ?? []), sym],
      },
    };
  });
};
