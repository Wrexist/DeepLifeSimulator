/**
 * v31 gives back the market the drift bug destroyed.
 *
 * Fixing `simulateWeek` does not reach an existing player: their collapsed prices
 * are persisted in `stocks.savedMarketPrices` and restored on load, so the
 * portfolio stays worthless and — from ~0.0001x — the new ~10%/yr drift would
 * take geological time to recover it. Without this migration, the people the bug
 * hurt most are the only ones the fix does not help.
 *
 * The repair is conditional on purpose. A migration that rewrites a HEALTHY
 * market would be a worse bug than the one it is repairing, so a save that looks
 * normal must come through completely untouched.
 */
import { runMigrations } from '@/utils/saveMigrations';
import { DEFAULT_PRICES } from '@/lib/economy/stockMarket';
import { initialGameState } from '@/contexts/game/initialState';

type RawSave = Record<string, unknown>;

/** A v30 save whose persisted board sits at `ratio` x the catalogue. */
function saveWithMarketAt(ratio: number): RawSave {
  const savedMarketPrices: Record<string, { price: number; dividendYield: number }> = {};
  for (const [symbol, data] of Object.entries(DEFAULT_PRICES)) {
    savedMarketPrices[symbol] = {
      price: Math.max(0.01, data.price * ratio),
      dividendYield: data.dividendYield,
    };
  }
  return {
    ...structuredClone(initialGameState),
    version: 30,
    stocks: {
      holdings: [],
      watchlist: [],
      savedMarketPrices,
      lastWeekPrices: savedMarketPrices,
    },
  } as unknown as RawSave;
}

const marketOf = (state: unknown) =>
  (state as { stocks?: { savedMarketPrices?: unknown } }).stocks?.savedMarketPrices;

describe('v31 collapsed-market remediation', () => {
  it('drops a market the bug flattened, so the life reopens on catalogue prices', () => {
    // A 40-year save sat around 0.05x. Deleting the persisted board is the whole
    // repair: both `restoreStockPrices(undefined)` and the weekly tick's guard
    // read "no persisted market" as "open on the catalogue", so no price table
    // has to be duplicated into the migration.
    const { state } = runMigrations(saveWithMarketAt(0.05) as never);
    expect(marketOf(state)).toBeUndefined();
  });

  it('also drops the stale week-over-week comparison snapshot', () => {
    // Otherwise the board would show every symbol as a catastrophic riser on the
    // first tick after the repair.
    const { state } = runMigrations(saveWithMarketAt(0.02) as never);
    expect((state as { stocks?: { lastWeekPrices?: unknown } }).stocks?.lastWeekPrices).toBeUndefined();
  });

  it('leaves a healthy market completely alone', () => {
    const before = saveWithMarketAt(1.1);
    const expected = structuredClone(marketOf(before));
    const { state } = runMigrations(before as never);
    expect(marketOf(state)).toEqual(expected);
  });

  it('leaves a merely-down market alone - a bad run is not bug damage', () => {
    // 0.8x is variance. The threshold sits at 0.5, well below anything the fixed
    // walk produces and well above the wreckage the old one left.
    const before = saveWithMarketAt(0.8);
    const expected = structuredClone(marketOf(before));
    const { state } = runMigrations(before as never);
    expect(marketOf(state)).toEqual(expected);
  });

  it('is idempotent - a second pass over a repaired save changes nothing', () => {
    const { state: once } = runMigrations(saveWithMarketAt(0.05) as never);
    const { state: twice } = runMigrations(structuredClone(once) as never);
    expect(marketOf(twice)).toBeUndefined();
    expect((twice as { version?: number }).version).toBe((once as { version?: number }).version);
  });

  it('does not touch a save that never had a market', () => {
    const noStocks = { ...structuredClone(initialGameState), version: 30 } as unknown as RawSave;
    delete (noStocks as { stocks?: unknown }).stocks;
    expect(() => runMigrations(noStocks as never)).not.toThrow();
  });

  it('survives a corrupt price table without losing the rest of the save', () => {
    const corrupt = {
      ...structuredClone(initialGameState),
      version: 30,
      stocks: { savedMarketPrices: { AAPL: { price: 'not a number' }, NOPE: null } },
    } as unknown as RawSave;

    const { state } = runMigrations(corrupt as never);
    // No usable ratios means no verdict, so the board is left exactly as found
    // rather than being deleted on the strength of unreadable data.
    expect(marketOf(state)).toBeDefined();
    expect((state as { overdueBalance?: number }).overdueBalance).toBe(0);
  });

  it('still applies the rest of the v31 migration to a repaired save', () => {
    const { state } = runMigrations(saveWithMarketAt(0.05) as never);
    expect((state as { overdueBalance?: number }).overdueBalance).toBe(0);
  });
});
