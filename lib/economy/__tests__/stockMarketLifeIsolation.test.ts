/**
 * A new life must not inherit the previous life's market.
 *
 * The board in `lib/economy/stockMarket` is module-level mutable state: it is
 * created once per app launch and shared by every save slot, every prestige and
 * every generation. `resetStockPrices` was written for exactly this — its
 * docstring says "used on prestige/new game" — and had ZERO production callers.
 * The only anchor was `restoreStockPrices`, which returned EARLY when a save
 * carried no `savedMarketPrices`, i.e. precisely in the fresh-life case.
 *
 * So: play a life, start a new one in the same session, and the new life opened
 * on the old market. `nextWeek` then snapshots the board into the new save, and
 * the inheritance becomes permanent. Before the drift fix that meant an heir
 * inheriting a collapsed board (NFLX at $0.01); after it, an heir inheriting a
 * board that had compounded for sixty years while holding a starter wallet.
 * Both are the same bug.
 */
import {
  getStockInfo,
  getStockPricesSnapshot,
  resetStockPrices,
  restoreStockPrices,
  simulateWeek,
} from '../stockMarket';

/** Advance the shared board far enough that it cannot be mistaken for fresh. */
function playALife(years: number) {
  for (let week = 1; week <= years * 52; week++) simulateWeek(undefined, week);
}

describe('stock board isolation between lives', () => {
  beforeEach(() => resetStockPrices());
  afterAll(() => resetStockPrices());

  it('opens on catalogue prices when a save carries no market', () => {
    const catalogue = getStockPricesSnapshot();
    playALife(30);
    expect(getStockInfo('AAPL').price).not.toBeCloseTo(catalogue.AAPL.price, 2);

    // This is the fresh-life call: the save has nothing persisted.
    restoreStockPrices(undefined);

    for (const symbol of Object.keys(catalogue)) {
      expect(getStockInfo(symbol).price).toBeCloseTo(catalogue[symbol].price, 2);
    }
  });

  it('treats null and a non-object the same as absent', () => {
    const catalogue = getStockPricesSnapshot();
    playALife(10);

    restoreStockPrices(null);
    expect(getStockInfo('KO').price).toBeCloseTo(catalogue.KO.price, 2);

    playALife(10);
    // A corrupt save should land on the catalogue too — never on a stale board.
    restoreStockPrices(undefined);
    expect(getStockInfo('KO').price).toBeCloseTo(catalogue.KO.price, 2);
  });

  it('still restores a real persisted market exactly', () => {
    playALife(12);
    const midLife = getStockPricesSnapshot();

    resetStockPrices();
    restoreStockPrices(midLife);

    for (const symbol of Object.keys(midLife)) {
      expect(getStockInfo(symbol).price).toBeCloseTo(midLife[symbol].price, 4);
    }
  });

  it('is idempotent, so a StrictMode double-invoke changes nothing', () => {
    const catalogue = getStockPricesSnapshot();
    playALife(5);
    resetStockPrices();
    resetStockPrices();
    for (const symbol of Object.keys(catalogue)) {
      expect(getStockInfo(symbol).price).toBeCloseTo(catalogue[symbol].price, 4);
    }
  });
});
