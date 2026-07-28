/**
 * Watchlist toggle wiring (Wave A StocksApp): the Detail header + each stock
 * row now expose a star that calls toggleStockWatchlist, which previously had
 * ZERO importers — the rendered Watchlist sections could only ever be empty.
 * This asserts the action adds then removes a symbol and normalizes case.
 */
import { toggleStockWatchlist } from '@/contexts/game/actions/StockActions';
import type { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';

function makeSetState(initial: GameState) {
  let state = initial;
  const setState = ((update: unknown) => {
    state = typeof update === 'function' ? update(state) : (update as GameState);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
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
    const store = makeSetState(createTestGameState({}));
    toggleStockWatchlist(store.setState, 'MSFT');
    expect(store.get().stocks?.watchlist).toEqual(['MSFT']);
  });
});
