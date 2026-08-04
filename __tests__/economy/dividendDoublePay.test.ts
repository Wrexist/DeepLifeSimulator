/**
 * The same dividend was paid twice, by two different subsystems.
 *
 * `lib/stocks/dividends.ts` opens with "The legacy `lib/economy/stockMarket.ts`
 * records a per-stock `dividendYield` but never pays anything out. We pay
 * dividends every 13 weeks". That premise is false, and it is why this
 * survived: `lib/economy/passiveIncome.ts` reads the SAME `dividendYield` off
 * the SAME `getStockInfo(symbol)` for the SAME `state.stocks.holdings`, and
 * pays `annual / 52` EVERY week into `stocksIncome` → `total` → `totalIncome`
 * → `stats.money`.
 *
 * So over a year a holder received:
 *   - 52 × (annual / 52)  = one full annual yield, weekly, untaxed and silent
 *   - 4  × (annual / 4)   = one full annual yield, quarterly, taxed and notified
 *
 * Two hundred percent of the advertised yield. Dividend stocks were the
 * strongest passive-income source in the game by a factor of two, and the
 * market board, the stock detail sheet and the strategy all quote the single
 * figure. 2026-07-30 audit R1-01.
 *
 * The quarterly system is the one kept: it is the newer deliberate design, it
 * withholds capital-gains tax at parity with crypto, and it emits the payout
 * notification. The weekly duplicate in passive income is removed.
 */
import { calcWeeklyPassiveIncome } from '@/lib/economy/passiveIncome';
import { computePayouts, sumPayouts, isDividendWeek, DIVIDEND_INTERVAL_WEEKS } from '@/lib/stocks/dividends';
import { getStockInfo } from '@/lib/economy/stockMarket';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/** A dividend-paying symbol, taken from the live catalogue rather than assumed. */
const SYMBOL = 'PFE';
const SHARES = 1000;

function holder(): GameState {
  const info = getStockInfo(SYMBOL);
  return createTestGameState({
    weeksLived: 100,
    stocks: {
      holdings: [
        {
          symbol: SYMBOL,
          shares: SHARES,
          averagePrice: info.price,
          currentPrice: info.price,
        },
      ],
    } as never,
  });
}

describe('the catalogue really does pay a dividend on this symbol', () => {
  it('has a non-zero yield, so the assertions below mean something', () => {
    expect(getStockInfo(SYMBOL).dividendYield).toBeGreaterThan(0);
    expect(getStockInfo(SYMBOL).price).toBeGreaterThan(0);
  });
});

describe('passive income no longer pays a second, parallel dividend', () => {
  it('reports ZERO stock income for a pure dividend holding', () => {
    // The quarterly system in lib/stocks is the single payer. Any non-zero
    // figure here is the duplicate coming back.
    const result = calcWeeklyPassiveIncome(holder(), { excludeRealEstate: true });

    expect(result.breakdown.stocks).toBe(0);
  });

  it('leaves the overall passive total free of any stock dividend', () => {
    const withStocks = calcWeeklyPassiveIncome(holder(), { excludeRealEstate: true });
    const withoutStocks = calcWeeklyPassiveIncome(
      createTestGameState({ weeksLived: 100 }),
      { excludeRealEstate: true },
    );

    expect(withStocks.total).toBe(withoutStocks.total);
  });

  it('also ignores the legacy `stocksOwned` map, not just `stocks.holdings`', () => {
    // passiveIncome has TWO dividend loops — the new holdings array and the
    // old `{ [symbol]: shares }` map. Removing only one leaves the double
    // payment alive for any save still on the old shape.
    const legacy = createTestGameState({
      weeksLived: 100,
      stocksOwned: { [SYMBOL]: SHARES },
    } as never);

    expect(calcWeeklyPassiveIncome(legacy, { excludeRealEstate: true }).breakdown.stocks).toBe(0);
  });
});

describe('the quarterly system still pays, and is the only one that does', () => {
  it('pays on a dividend week', () => {
    const info = getStockInfo(SYMBOL);
    const payouts = computePayouts(
      [{ symbol: SYMBOL, shares: SHARES, currentPrice: info.price }],
      { [SYMBOL]: info.dividendYield },
    );

    expect(sumPayouts(payouts)).toBeGreaterThan(0);
  });

  it('pays one quarter of the annual yield, not one week of it', () => {
    const info = getStockInfo(SYMBOL);
    const payouts = computePayouts(
      [{ symbol: SYMBOL, shares: SHARES, currentPrice: info.price }],
      { [SYMBOL]: info.dividendYield },
    );
    const annual = info.price * info.dividendYield * SHARES;

    expect(sumPayouts(payouts)).toBeCloseTo(annual / 4, 2);
  });

  it('does not pay on a non-dividend week', () => {
    expect(isDividendWeek(1)).toBe(false);
    expect(isDividendWeek(DIVIDEND_INTERVAL_WEEKS)).toBe(true);
  });

  it('adds up to ONE annual yield per year, not two', () => {
    const info = getStockInfo(SYMBOL);
    const annual = info.price * info.dividendYield * SHARES;

    let paidOverAYear = 0;
    for (let week = 1; week <= 52; week += 1) {
      if (isDividendWeek(week)) {
        paidOverAYear += sumPayouts(
          computePayouts(
            [{ symbol: SYMBOL, shares: SHARES, currentPrice: info.price }],
            { [SYMBOL]: info.dividendYield },
          ),
        );
      }
      // Plus whatever passive income thinks it owes, which must now be nothing.
      paidOverAYear += calcWeeklyPassiveIncome(holder(), { excludeRealEstate: true }).breakdown.stocks;
    }

    // The headline: one annual yield, not the two a holder used to collect.
    expect(paidOverAYear).toBeCloseTo(annual, 0);
  });
});
