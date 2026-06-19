/**
 * E-2 (defense-in-depth) — a dead player (`showDeathPopup`) must not be able to execute
 * financial transactions. The DeathPopup already gates the UI (a blocking full-screen
 * modal whose only exits are new-life/revive), but the money-moving action functions now
 * also short-circuit at the top of their updater so the invariant holds regardless of UI
 * — mirroring how PetActions guards `isDead` at the action layer.
 *
 * Each guarded updater's first line is `if (prev.showDeathPopup) return prev;`, so a dead
 * `prev` is returned unchanged (reference-equal) before any subsystem state is touched —
 * no stocks/crypto/banking/dark-web fixtures are needed for the dead case.
 */
import type { Dispatch, SetStateAction } from 'react';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
import { buyStockMarket, sellStockMarket } from '@/contexts/game/actions/StockActions';
import { buyCryptoMarket, sellCryptoMarket } from '@/contexts/game/actions/CryptoTradingActions';
import {
  depositCashToAccount,
  withdrawCashFromAccount,
  transferBetweenOwnAccounts,
  spendOnCard,
  payDownCard,
} from '@/contexts/game/actions/BankingActions';
import {
  buyMarketListing,
  submitMixerTransaction,
  cashOutCleanBtc,
  acquireNewIdentity,
} from '@/contexts/game/actions/CrimeActions';

function captureUpdater() {
  let updater: ((prev: GameState) => GameState) | undefined;
  const setGameState: Dispatch<SetStateAction<GameState>> = (u) => {
    if (typeof u === 'function') updater = u;
  };
  return {
    setGameState,
    run(prev: GameState): GameState {
      if (!updater) throw new Error('setGameState was never called with a function updater');
      return updater(prev);
    },
  };
}

const deadState = (): GameState =>
  createTestGameState({ showDeathPopup: true, stats: { money: 100_000 } });

/** One entry per guarded action; each invokes the action so we can run its updater. */
const cases: Array<{ name: string; invoke: (sg: Dispatch<SetStateAction<GameState>>) => void }> = [
  { name: 'buyStockMarket', invoke: (sg) => buyStockMarket(sg, 'AAPL', 1_000, 150) },
  { name: 'sellStockMarket', invoke: (sg) => sellStockMarket(sg, 'AAPL', 5, 150) },
  { name: 'buyCryptoMarket', invoke: (sg) => buyCryptoMarket(sg, 'btc', 1_000) },
  { name: 'sellCryptoMarket', invoke: (sg) => sellCryptoMarket(sg, 'btc', 0.1) },
  { name: 'depositCashToAccount', invoke: (sg) => depositCashToAccount(sg, 'acct-1', 1_000) },
  { name: 'withdrawCashFromAccount', invoke: (sg) => withdrawCashFromAccount(sg, 'acct-1', 1_000) },
  { name: 'transferBetweenOwnAccounts', invoke: (sg) => transferBetweenOwnAccounts(sg, 'a', 'b', 1_000) },
  { name: 'spendOnCard', invoke: (sg) => spendOnCard(sg, 'card-1', 1_000, 'shopping') },
  { name: 'payDownCard', invoke: (sg) => payDownCard(sg, 'card-1', 'acct-1', 1_000) },
  { name: 'buyMarketListing', invoke: (sg) => buyMarketListing(sg, 'listing-1') },
  { name: 'submitMixerTransaction', invoke: (sg) => submitMixerTransaction(sg, 'standard', 0.1) },
  { name: 'cashOutCleanBtc', invoke: (sg) => cashOutCleanBtc(sg, 0.5) },
  { name: 'acquireNewIdentity', invoke: (sg) => acquireNewIdentity(sg) },
];

describe('E-2: dead players cannot execute financial transactions', () => {
  it.each(cases)(
    '$name no-ops (returns prev unchanged) when showDeathPopup is set',
    ({ invoke }) => {
      const prev = deadState();
      const cap = captureUpdater();
      invoke(cap.setGameState);
      const result = cap.run(prev);
      expect(result).toBe(prev); // guard short-circuits before any state mutation
      expect(result.stats.money).toBe(100_000); // money untouched
    }
  );
});
