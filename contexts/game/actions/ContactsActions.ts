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
import { updateMoney } from './MoneyActions';

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
  favorId: string,
  deps: { updateMoney: typeof updateMoney }
): { success: boolean; message: string; favor?: Favor } {
  const ledger = ledgerOf(gameState);
  const target = ledger.favors.find((f) => f.id === favorId);
  if (!target) return { success: false, message: 'Favor not found' };
  if (target.status !== 'open') return { success: false, message: 'Favor already closed' };

  // Cash IOU owed-to-player → credit money.
  if (target.kind === 'money' && target.direction === 'owed-to-player') {
    deps.updateMoney(setGameState, target.value, `Favor redeemed from ${target.contactId}`);
  }

  setGameState((prev) => ({
    ...prev,
    favorLedger: redeemFavorPure(ledgerOf(prev), favorId),
  } as GameState));
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
