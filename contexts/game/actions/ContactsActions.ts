/**
 * ContactsActions — favor lifecycle + generic network reach-out.
 *
 * The contact ledger is system-agnostic; this file is the glue between the
 * pure `lib/contacts/favors.ts` helpers and React state updates.
 */

import type { Dispatch, SetStateAction } from 'react';
import { GameState } from '../types';
import {
  Favor,
  FavorLedger,
  addFavor as addFavorPure,
  emptyLedger,
  expireFavors as expireFavorsPure,
  redeemFavor as redeemFavorPure,
} from '@/lib/contacts/favors';
import { logger } from '@/utils/logger';
import { applyMoneyDelta } from './MoneyActions';

const log = logger.scope('ContactsActions');

function ledgerOf(state: GameState): FavorLedger {
  return state.favorLedger ?? emptyLedger();
}

/**
 * Record a new IOU between the player and a contact. Caller provides the
 * Favor sans `status` — we always create with status='open'.
 */
export function recordFavor(
  setGameState: Dispatch<SetStateAction<GameState>>,
  favor: Omit<Favor, 'status'>
): void {
  setGameState((prev) => ({
    ...prev,
    favorLedger: addFavorPure(ledgerOf(prev), favor),
  } as GameState));
  log.info(`Favor recorded: ${favor.id} (${favor.direction}, ${favor.kind}, value ${favor.value})`);
}

/**
 * Redeem (close) an open favor. If it's a money IOU owed-to-player,
 * also credit the cash. Money owed-by-player should be paid via the regular
 * money flow; this function only flips the ledger state and returns the favor.
 */
export function redeemFavor(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  favorId: string
): { success: boolean; message: string; favor?: Favor } {
  const ledger = ledgerOf(gameState);
  const target = ledger.favors.find((f) => f.id === favorId);
  if (!target) return { success: false, message: 'Favor not found' };
  if (target.status !== 'open') return { success: false, message: 'Favor already closed' };

  // H-8/H-9: fold the cash credit and the ledger flip into ONE updater that
  // re-checks the favor's status against `prev`. The previous code gated on the
  // stale `gameState`, credited money in one setGameState call, then flipped the
  // ledger in a separate call — so two rapid taps both passed the outer gate and
  // both paid out (a credit never overdraft-rejects) while the ledger closed
  // once: a same-batch double-credit money printer. Re-checking `prev` here makes
  // the second tap a no-op.
  setGameState((prev) => {
    const prevLedger = ledgerOf(prev);
    const fresh = prevLedger.favors.find((f) => f.id === favorId);
    if (!fresh || fresh.status !== 'open') return prev; // already redeemed this batch

    // Cash IOU owed-to-player → validate the amount BEFORE flipping. If the
    // value is invalid (NaN/Infinity/≤0), keep the favor open rather than
    // closing it without paying out — a redeemed-but-unpaid IOU is unrecoverable.
    if (fresh.kind === 'money' && fresh.direction === 'owed-to-player') {
      if (
        typeof fresh.value !== 'number' ||
        !isFinite(fresh.value) ||
        fresh.value <= 0
      ) {
        log.warn(`Cannot redeem invalid money favor`, { favorId, value: fresh.value });
        return prev;
      }
      const flipped = {
        ...prev,
        favorLedger: redeemFavorPure(prevLedger, favorId),
      } as GameState;
      const credit = applyMoneyDelta(
        flipped,
        fresh.value,
        `Favor redeemed from ${fresh.contactId}`
      );
      if (!credit) return prev; // credit rejected → leave the favor open
      return { ...flipped, ...credit };
    }

    // Non-money favor → just flip the ledger.
    return {
      ...prev,
      favorLedger: redeemFavorPure(prevLedger, favorId),
    } as GameState;
  });
  log.info(`Redeemed favor ${favorId}`);
  return { success: true, message: 'Favor redeemed', favor: target };
}

/**
 * Mark every favor whose expiresWeek has passed as expired. Called from the
 * weekly tick.
 */
export function tickFavors(
  setGameState: Dispatch<SetStateAction<GameState>>,
  currentWeek: number
): void {
  setGameState((prev) => {
    const before = ledgerOf(prev);
    const after = expireFavorsPure(before, currentWeek);
    if (after === before) return prev;
    return { ...prev, favorLedger: after } as GameState;
  });
}
