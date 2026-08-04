/**
 * Watchlist toggle wiring (Wave A StocksApp): the Detail header + each stock
 * row now expose a star that calls toggleStockWatchlist, which previously had
 * ZERO importers — the rendered Watchlist sections could only ever be empty.
 * This asserts the action adds then removes a symbol and normalizes case.
 */
import { toggleStockWatchlist } from '@/contexts/game/actions/StockActions';
import type { GameState } from '@/contexts/game/types';
import { createSetGameStateStub } from '../helpers/setGameStateStub';

/**
 * Thin adapter over the shared stub in `helpers/setGameStateStub`.
 *
 * This was one of eight byte-identical hand-rolled copies. Each took
 * `(update: unknown)` and cast twice — `update as GameState` on the value
 * branch, then the whole function `as React.Dispatch<SetStateAction<GameState>>`
 * — which is exactly the shape that makes a stub's behaviour unverifiable:
 * `unknown` in means nothing about the dispatch is checked, and the outer cast
 * asserts the result matches React's type without anything proving it does.
 */
function makeSetState(initial: GameState) {
  const stub = createSetGameStateStub(initial);
  return { setState: stub.setGameState, get: stub.current };
}

function baseState(): GameState {
  return createTestGameState({
    stocks: { holdings: [], watchlist: [], realizedGains: 0 },
  });
}

describe('toggleStockWatchlist', () => {
  it('adds a symbol on first toggle, removes it on second (idempotent round-trip)', () => {
    const store = makeSetState(baseState());
    toggleStockWatchlist(store.setState, 'AAPL');
    expect(store.get().stocks?.watchlist).toContain('AAPL');
    toggleStockWatchlist(store.setState, 'AAPL');
    expect(store.get().stocks?.watchlist).not.toContain('AAPL');
  });

  it('normalizes to uppercase so the star matches the market row key', () => {
    const store = makeSetState(baseState());
    toggleStockWatchlist(store.setState, 'aapl');
    expect(store.get().stocks?.watchlist).toEqual(['AAPL']);
    // Toggling with the uppercase form removes the same entry.
    toggleStockWatchlist(store.setState, 'AAPL');
    expect(store.get().stocks?.watchlist).toEqual([]);
  });

  it('supports independent multi-symbol watchlists', () => {
    const store = makeSetState(baseState());
    toggleStockWatchlist(store.setState, 'AAPL');
    toggleStockWatchlist(store.setState, 'XOM');
    expect(store.get().stocks?.watchlist).toEqual(['AAPL', 'XOM']);
    toggleStockWatchlist(store.setState, 'AAPL');
    expect(store.get().stocks?.watchlist).toEqual(['XOM']);
  });

  it('initializes the stocks slice when absent (no crash on a fresh save)', () => {
    // A real state with the slice REMOVED, not a bare `{}`. The old fixture
    // asserted an empty object was a GameState, which tests less than it looks
    // like: nothing else on the state exists either, so a crash anywhere in the
    // function would have been attributed to the missing `stocks`. `stocks` is
    // optional on GameState, so this needs no cast.
    const store = makeSetState(createTestGameState({ stocks: undefined }));
    toggleStockWatchlist(store.setState, 'MSFT');
    expect(store.get().stocks?.watchlist).toEqual(['MSFT']);
  });
});
