/**
 * Regression: ContactsActions.redeemFavor must not double-credit on a
 * same-batch double-tap.
 *
 * The bug (H-8/H-9 class): redeemFavor gated on the stale `gameState`, credited
 * the cash in one setGameState call, then flipped the ledger in a SEPARATE call.
 * Two rapid taps both passed the stale gate and both paid out (a credit never
 * overdraft-rejects) while the ledger only closed once — a money printer.
 *
 * The fix folds the credit + ledger flip into ONE updater that re-checks the
 * favor's status against `prev`, so the second tap is a no-op.
 */

import type { Dispatch, SetStateAction } from 'react';
import { GameState } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { recordFavor, redeemFavor } from '@/contexts/game/actions/ContactsActions';
import { LENT_CASH_TERM_WEEKS } from '@/lib/contacts/favors';

/**
 * Minimal synchronous setGameState that applies functional updaters against the
 * latest state — mirrors React's queued-reducer semantics closely enough to
 * exercise the same-batch race (both calls read the SAME stale `gameState`, but
 * each updater runs against the evolving `current`).
 */
function makeStore(initial: GameState) {
  let current = initial;
  const setGameState: Dispatch<SetStateAction<GameState>> = (update) => {
    current = typeof update === 'function'
      ? (update as (p: GameState) => GameState)(current)
      : update;
  };
  return { get: () => current, setGameState };
}

/**
 * Cash lent to a contact is repayable `LENT_CASH_TERM_WEEKS` after it was booked
 * (week 1 here), so these race fixtures run at a week where it already is -
 * the term is pinned in `contactsCashTerms.test.ts`, not here.
 */
const MATURED = 1 + LENT_CASH_TERM_WEEKS;

describe('redeemFavor - same-batch double-credit guard', () => {
  it('credits a money IOU exactly once even when redeemed twice from stale state', () => {
    const base = createTestGameState({ weeksLived: MATURED, stats: { money: 1000 } });
    const store = makeStore(base);

    // Record a $5,000 cash favor owed TO the player.
    recordFavor(store.setGameState, {
      id: 'iou1',
      contactId: 'rich-uncle',
      direction: 'owed-to-player',
      kind: 'money',
      value: 5000,
      createdWeek: 1,
    });

    // Snapshot the state the UI would hold — both taps see this stale value.
    const stale = store.get();
    const moneyBefore = stale.stats.money;

    const r1 = redeemFavor(stale, store.setGameState, 'iou1');
    const r2 = redeemFavor(stale, store.setGameState, 'iou1');

    // The action layer reports success for both (it gates on the stale snapshot),
    // but the atomic updater must only pay out once.
    expect(r1.success).toBe(true);
    void r2; // second tap's outcome is irrelevant — money is what matters.

    const after = store.get();
    expect(after.stats.money - moneyBefore).toBe(5000); // exactly one credit
    // Ledger closed exactly once.
    const favor = after.favorLedger?.favors.find((f) => f.id === 'iou1');
    expect(favor?.status).toBe('redeemed');
  });

  it('a genuine second redeem after the first is a no-op (fresh state)', () => {
    const store = makeStore(createTestGameState({ weeksLived: MATURED, stats: { money: 0 } }));
    recordFavor(store.setGameState, {
      id: 'iou2',
      contactId: 'friend',
      direction: 'owed-to-player',
      kind: 'money',
      value: 250,
      createdWeek: 1,
    });

    redeemFavor(store.get(), store.setGameState, 'iou2');
    const moneyAfterFirst = store.get().stats.money;
    expect(moneyAfterFirst).toBe(250);

    // Now redeem again with FRESH state — should be rejected, no extra credit.
    const second = redeemFavor(store.get(), store.setGameState, 'iou2');
    expect(second.success).toBe(false);
    expect(store.get().stats.money).toBe(250);
  });

  it('keeps an invalid-amount money favor OPEN instead of closing it unpaid', () => {
    const store = makeStore(createTestGameState({ weeksLived: MATURED, stats: { money: 100 } }));
    recordFavor(store.setGameState, {
      id: 'bad',
      contactId: 'glitch',
      direction: 'owed-to-player',
      kind: 'money',
      value: Number.NaN, // corrupted value
      createdWeek: 1,
    });

    redeemFavor(store.get(), store.setGameState, 'bad');

    // No money credited and the favor must remain open (a closed-but-unpaid IOU
    // is unrecoverable).
    expect(store.get().stats.money).toBe(100);
    const favor = store.get().favorLedger?.favors.find((f) => f.id === 'bad');
    expect(favor?.status).toBe('open');
  });
});
