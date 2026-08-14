/**
 * "Investment Portfolio" — an 8,000-point prestige bonus that granted nothing.
 *
 * `applyStartingBonuses` gated the whole grant on `stockInfo.currentPrice > 0`.
 * `getStockInfo` returns `StockData`, which is `{ price, dividendYield }` — it
 * has no `currentPrice`. So the expression was `undefined > 0`, i.e. false for
 * every symbol, and the `forEach` body never ran once. Every player who spent
 * 8,000 prestige points on "Start with $50,000 in diversified stocks" started
 * with an empty portfolio, silently.
 *
 * `currentPrice` IS a real field — on the HOLDING, which is where the confusion
 * came from, and why reading it back does not look wrong at a glance.
 *
 * Found the same way as the obituary bug (#130): the value came through a lazy
 * `require('@/lib/economy/stockMarket')`, which typed it `any`, so a property
 * that does not exist compiled clean. Converting the require to a static import
 * is what surfaced it. Both are the same defect wearing different clothes —
 * a fabricated property name, silently `undefined`, folded into a falsy gate.
 */
import { applyStartingBonuses } from '@/lib/prestige/applyBonuses';
import { getStockInfo } from '@/lib/economy/stockMarket';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

const PORTFOLIO = 'starting_investment_portfolio';
const MAJOR = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'];
/** What the bonus promises, per `lib/prestige/prestigeBonuses.ts`. */
const PORTFOLIO_VALUE = 50_000;

const fresh = (over: Partial<GameState> = {}): GameState =>
  createTestGameState({ stocks: { holdings: [], watchlist: [], realizedGains: 0 }, ...over });

const holdings = (state: GameState) => state.stocks?.holdings ?? [];

describe('the starting portfolio is actually granted', () => {
  it('creates a holding for every major stock', () => {
    // The assertion that fails on the old code: zero holdings, every time.
    const out = applyStartingBonuses(fresh(), [PORTFOLIO]);

    expect(holdings(out).map((h) => h.symbol).sort()).toEqual([...MAJOR].sort());
  });

  it('and every holding has a positive share count', () => {
    // `Math.floor(budget / undefined)` is NaN, and NaN shares would be worse
    // than none — it poisons net worth for the rest of the life.
    //
    // The length assertion is not decoration. Against the old code this loop
    // iterated an EMPTY array and passed vacuously, which is the failure mode
    // of any "every element satisfies P" test: it is strongest exactly when
    // there is nothing to check. Pinning the count first makes it real.
    const result = holdings(applyStartingBonuses(fresh(), [PORTFOLIO]));
    expect(result).toHaveLength(MAJOR.length);
    for (const h of result) {
      expect(Number.isFinite(h.shares)).toBe(true);
      expect(h.shares).toBeGreaterThan(0);
    }
  });

  it('spends roughly the promised $50,000, split evenly', () => {
    // Not exact: shares are whole, so each stock rounds down by up to one
    // share. Five stocks at these prices lose well under 5% in total.
    const out = applyStartingBonuses(fresh(), [PORTFOLIO]);
    const spent = holdings(out).reduce((sum, h) => sum + h.shares * h.averagePrice, 0);

    expect(spent).toBeLessThanOrEqual(PORTFOLIO_VALUE);
    expect(spent).toBeGreaterThan(PORTFOLIO_VALUE * 0.95);
  });

  it('prices each holding at the market price, from the field that exists', () => {
    // The bug in one assertion. `price` is the real field; the old code read
    // `currentPrice` off StockData, which is not there.
    const result = holdings(applyStartingBonuses(fresh(), [PORTFOLIO]));
    expect(result).toHaveLength(MAJOR.length); // else this loop passes vacuously
    for (const h of result) {
      const market = getStockInfo(h.symbol).price;
      expect(market).toBeGreaterThan(0); // the fixture is a real symbol
      expect(h.averagePrice).toBe(market);
      expect(h.currentPrice).toBe(market);
    }
  });

  it('grants nothing to a player who did not buy the bonus (the control)', () => {
    expect(holdings(applyStartingBonuses(fresh(), []))).toHaveLength(0);
    expect(holdings(applyStartingBonuses(fresh(), ['starting_money_1']))).toHaveLength(0);
  });
});

describe('and it blends into an existing holding correctly', () => {
  /**
   * Unreachable until the gate above was fixed, which is exactly why it is
   * asserted now: the moment the outer bug was fixed this arithmetic went live.
   *
   * The original incremented `shares` FIRST and then used the new count to
   * weight the old average, and divided by `shares + shares` on top — so both
   * halves of the mean were wrong.
   */
  it('weights the average by the share count held BEFORE the grant', () => {
    const price = getStockInfo('AAPL').price;
    const state = fresh({
      stocks: {
        holdings: [{ symbol: 'AAPL', shares: 10, averagePrice: 1, currentPrice: price }],
        watchlist: [],
        realizedGains: 0,
      },
    });

    const out = applyStartingBonuses(state, [PORTFOLIO]);
    const apple = holdings(out).find((h) => h.symbol === 'AAPL');
    if (!apple) throw new Error('AAPL holding must exist');

    const granted = Math.floor(PORTFOLIO_VALUE / MAJOR.length / price);
    expect(apple.shares).toBe(10 + granted);
    // (1 × 10 + price × granted) / (10 + granted)
    expect(apple.averagePrice).toBeCloseTo((1 * 10 + price * granted) / (10 + granted), 6);
  });

  it('leaves an unrelated holding untouched (the control)', () => {
    const state = fresh({
      stocks: {
        holdings: [{ symbol: 'KO', shares: 3, averagePrice: 7, currentPrice: 7 }],
        watchlist: [],
        realizedGains: 0,
      },
    });

    const ko = holdings(applyStartingBonuses(state, [PORTFOLIO])).find((h) => h.symbol === 'KO');
    expect(ko).toEqual({ symbol: 'KO', shares: 3, averagePrice: 7, currentPrice: 7 });
  });
});
