/**
 * The stock market must not eat itself.
 *
 * `simulateWeek` used to step prices with `price *= (1 + z·σ)` and no drift
 * term. That is zero-mean in the ARITHMETIC return and −σ²/2 in the GEOMETRIC
 * one, so every price trended to the $0.01 floor. Measured against the real
 * pipeline on 2026-08-04, before the fix:
 *
 *   10 game years — median multiple 0.32×, 22 of 25 symbols down, NFLX 0.014×
 *   40 game years — median multiple 0.052×, four symbols pinned at $0.01
 *
 * And the walk is seeded on `weeksLived`, so that was not one unlucky save. It
 * was the same guaranteed collapse for every player on every device.
 *
 * Nothing in the old suite could have caught it: the existing stock tests assert
 * that prices stay finite, positive and inside the clamp band — all of which are
 * true of a market on its way to zero. This file asserts the property that
 * actually matters to a player, which is where the money ends up after a life.
 *
 * The assertions are deliberately BANDS, not point values. Pinning an exact
 * multiple would break on any re-seed or re-tune and teach the next person to
 * update the number instead of reading it.
 */
import {
  MARKET_ANNUAL_DRIFT,
  getStockPricesSnapshot,
  resetStockPrices,
  simulateWeek,
  weeklyLogDriftFor,
} from '../stockMarket';

/** One game year. Matches WEEKS_PER_YEAR without importing the game config. */
const WEEKS_PER_YEAR = 52;

/** Run the walk for N years from a clean board and return the per-symbol multiple. */
function buyAndHoldMultiples(years: number): number[] {
  resetStockPrices();
  const start = getStockPricesSnapshot();
  for (let week = 1; week <= years * WEEKS_PER_YEAR; week++) {
    simulateWeek(undefined, week);
  }
  const end = getStockPricesSnapshot();
  return Object.keys(start)
    .map((symbol) => end[symbol].price / start[symbol].price)
    .sort((a, b) => a - b);
}

const median = (sorted: number[]): number => sorted[Math.floor(sorted.length / 2)];

/**
 * What a DIVERSIFIED holder actually ends up with — equal weight across the
 * board. This is the honest measure of "is the market worth being in", and the
 * one the assertions below lean on. A single volatile name can still go to
 * nearly nothing over sixty years; that is a real market, not a bug. What must
 * never be true again is that the whole board sinks together.
 */
const portfolio = (multiples: number[]): number =>
  multiples.reduce((sum, x) => sum + x, 0) / multiples.length;

describe('long-run stock market drift', () => {
  afterAll(() => resetStockPrices());

  it('does not grind the median stock down over a decade', () => {
    const multiples = buyAndHoldMultiples(10);

    // The pre-fix value here was 0.32×. Anything at or below 1.0 means holding
    // cash beat holding the market for ten years, which makes the entire stocks
    // pillar a trap.
    expect(median(multiples)).toBeGreaterThan(1.2);
  });

  it('pays a diversified holder over a decade and over a life', () => {
    expect(portfolio(buyAndHoldMultiples(10))).toBeGreaterThan(1.5);
    expect(portfolio(buyAndHoldMultiples(60))).toBeGreaterThan(5);
  });

  it('does not pin any symbol to the hard price floor over a full life', () => {
    resetStockPrices();
    for (let week = 1; week <= 60 * WEEKS_PER_YEAR; week++) simulateWeek(undefined, week);
    const end = getStockPricesSnapshot();

    // Pre-fix, NFLX / NVDA / META / TSLA all sat at EXACTLY $0.01 — the clamp,
    // not a price. A symbol resting on the floor has stopped being tradeable:
    // it can no longer fall, so the board is lying about what it is.
    for (const symbol of Object.keys(end)) {
      expect(end[symbol].price).toBeGreaterThan(0.01);
    }
  });

  it('pays the volatile names more in expectation than the blue chips', () => {
    // Otherwise the high-volatility tier is strictly dominated — same reward,
    // four times the variance — and engaging with the interesting half of the
    // board is a punishment.
    //
    // Asserted on the drift function, NOT on a simulated sample. Over any
    // horizon short of the price ceiling the 25-symbol dispersion swamps the
    // drift difference, so an empirical version of this test would be a coin
    // flip dressed up as an assertion. (The first draft was exactly that, and
    // it failed for a third reason entirely: at a 200-year horizon every symbol
    // was resting on MAX_STOCK_PRICE, so it was comparing opening prices.)
    expect(weeklyLogDriftFor(0.08)).toBeGreaterThan(weeklyLogDriftFor(0.04));
    expect(weeklyLogDriftFor(0.04)).toBeGreaterThan(0);
    expect(weeklyLogDriftFor(0.04, true)).toBeGreaterThan(weeklyLogDriftFor(0.04));
  });

  it('keeps the all-in annual return in index territory, not fantasy territory', () => {
    const annual = (vol: number) => Math.exp(weeklyLogDriftFor(vol) * WEEKS_PER_YEAR) - 1;
    // A real broad index does ~10%/yr over the long run. Drifting far above that
    // makes every other system in the game pointless by the second decade.
    expect(annual(0.04)).toBeGreaterThan(0.06);
    expect(annual(0.08)).toBeLessThan(0.14);
  });

  it('never leaves a price resting on the ceiling in a played life', () => {
    resetStockPrices();
    for (let week = 1; week <= 80 * WEEKS_PER_YEAR; week++) simulateWeek(undefined, week);
    const end = getStockPricesSnapshot();
    // A clamped price can fall but not rise — the board silently becomes a
    // one-way bet. Eighty years is longer than any life the game grants.
    for (const symbol of Object.keys(end)) {
      expect(end[symbol].price).toBeLessThan(10_000_000);
    }
  });

  it('leaves most of the board up over a full life, not most of it down', () => {
    const multiples = buyAndHoldMultiples(60);
    const winners = multiples.filter((x) => x > 1).length;

    // Pre-fix: 5 winners out of 25. A market where the base rate of holding an
    // asset for 60 years is a loss is not a market, it is a fee.
    expect(winners).toBeGreaterThan(multiples.length / 2);
  });

  it('compounds roughly toward the stated annual drift, not wildly past it', () => {
    const years = 20;
    const multiples = buyAndHoldMultiples(years);
    const target = Math.pow(1 + MARKET_ANNUAL_DRIFT, years);

    // Volatility drag still bites the high-vol names, and sector tilt/macro
    // drift are layered on elsewhere, so the median lands UNDER the drift-only
    // target. The band checks the drift is real without pretending the walk is
    // deterministic: not a collapse, not a money printer.
    expect(median(multiples)).toBeGreaterThan(target * 0.15);
    expect(median(multiples)).toBeLessThan(target * 3);
  });

  it('keeps a single week inside a believable move', () => {
    resetStockPrices();
    const before = getStockPricesSnapshot();
    simulateWeek(undefined, 7);
    const after = getStockPricesSnapshot();

    for (const symbol of Object.keys(before)) {
      const move = after[symbol].price / before[symbol].price - 1;
      // The exponential step has no natural bound, unlike the old additive one.
      expect(move).toBeGreaterThanOrEqual(-0.36);
      expect(move).toBeLessThanOrEqual(0.36);
    }
  });

  it('is still fully deterministic per absolute week', () => {
    const first = buyAndHoldMultiples(3);
    const second = buyAndHoldMultiples(3);
    expect(second).toEqual(first);
  });
});
