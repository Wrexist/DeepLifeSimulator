/**
 * ContactsActions — favor lifecycle + generic network reach-out.
 *
 * The contact ledger is system-agnostic; this file is the glue between the
 * pure `lib/contacts/favors.ts` helpers and React state updates.
 */

import type { Dispatch, SetStateAction } from 'react';
import { GameState, Relationship } from '../types';
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
 * Record a lightweight Contacts interaction (Call / Hang Out and friends) against
 * a relationship. This is the single source of truth for the recency signal —
 * it stamps `lastInteractionWeek` (so recency dots warm up and the Attention tab
 * clears) and bumps `weeklyInteractions` (the "This wk" fact chip), on top of the
 * relationship-score bump and optional money cost.
 *
 * Moved out of ContactsApp's inline `setGameState` so the UI never mutates state
 * directly (mechanics ground rule #3). The once-per-week gate, the affordability
 * check, the money leg, the score bump, the recency stamp and the action record
 * all happen inside ONE updater against `prev`, so a same-batch double-tap can't
 * charge or bump twice.
 */
export function recordInteraction(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  contactId: string,
  action: string,
  cost: number,
  bonus: number
): { success: boolean; message: string } {
  const rel = gameState.relationships?.find((r) => r.id === contactId);
  if (!rel) return { success: false, message: 'Contact not found.' };
  const ws = gameState.weeksLived ?? 0;
  // Pre-checks for immediate UI feedback; the authoritative re-check is inside
  // the updater below.
  if (rel.actions?.[action] === ws) {
    return { success: false, message: 'Already used this week.' };
  }
  if (cost > 0 && (gameState.stats?.money ?? 0) < cost) {
    return { success: false, message: `Need $${cost.toLocaleString()}.` };
  }

  let applied = false;
  setGameState((prev) => {
    const rels = prev.relationships ?? [];
    const idx = rels.findIndex((r) => r.id === contactId);
    if (idx === -1) return prev;
    const target = rels[idx];
    const prevWs = prev.weeksLived ?? 0;
    if (target.actions?.[action] === prevWs) return prev; // already used this week
    if (cost > 0 && (prev.stats?.money ?? 0) < cost) return prev; // can't afford

    // Reset the weekly counter when the last interaction was in an earlier week.
    const weeklyInteractions =
      target.lastInteractionWeek === prevWs ? (target.weeklyInteractions ?? 0) + 1 : 1;

    const updatedRel: Relationship = {
      ...target,
      relationshipScore: Math.max(0, Math.min(100, (target.relationshipScore ?? 0) + bonus)),
      actions: { ...(target.actions ?? {}), [action]: prevWs },
      lastInteractionWeek: prevWs,
      weeklyInteractions,
    };
    const newRels = [...rels];
    newRels[idx] = updatedRel;
    let next: GameState = { ...prev, relationships: newRels };
    if (cost > 0) {
      const paid = applyMoneyDelta(next, -cost, `${action} with ${target.name}`);
      if (!paid) return prev; // affordability failed inside the delta — abort
      next = { ...next, ...paid };
    }
    applied = true;
    return next;
  });

  if (!applied) return { success: false, message: 'Could not complete.' };
  return { success: true, message: `+${bonus} with ${rel.name}.` };
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
 * Repay an owed-by-player money IOU. Debits the player's cash and flips the
 * favor to `redeemed`. A pure money sink — the borrowed cash was already granted
 * when the IOU was created, so repaying only returns money to zero-out the debt
 * (no printing).
 *
 * Same double-tap guard as `redeemFavor`: the debit + ledger flip happen in ONE
 * updater that re-checks the favor's status against `prev`, so two rapid taps
 * only debit once. `applyMoneyDelta`'s overdraft reject keeps an unaffordable
 * repay from ever closing the debt.
 */
export function repayFavor(
  gameState: GameState,
  setGameState: Dispatch<SetStateAction<GameState>>,
  favorId: string
): { success: boolean; message: string; favor?: Favor } {
  const ledger = ledgerOf(gameState);
  const target = ledger.favors.find((f) => f.id === favorId);
  if (!target) return { success: false, message: 'Favor not found' };
  if (target.status !== 'open') return { success: false, message: 'Favor already closed' };
  if (target.direction !== 'owed-by-player' || target.kind !== 'money') {
    return { success: false, message: 'Only cash debts you owe can be repaid.' };
  }
  if (typeof target.value !== 'number' || !isFinite(target.value) || target.value <= 0) {
    return { success: false, message: 'This debt has an invalid amount.' };
  }
  if ((gameState.stats?.money ?? 0) < target.value) {
    return { success: false, message: `Need $${target.value.toLocaleString()} to repay.` };
  }

  let paid = false;
  setGameState((prev) => {
    const prevLedger = ledgerOf(prev);
    const fresh = prevLedger.favors.find((f) => f.id === favorId);
    if (!fresh || fresh.status !== 'open') return prev; // already repaid this batch
    if (fresh.direction !== 'owed-by-player' || fresh.kind !== 'money') return prev;
    if (typeof fresh.value !== 'number' || !isFinite(fresh.value) || fresh.value <= 0) {
      return prev;
    }
    // Debit BEFORE flipping; if unaffordable, keep the debt open.
    const debit = applyMoneyDelta(prev, -fresh.value, `Repaid loan to ${fresh.contactId}`);
    if (!debit) return prev;
    paid = true;
    return {
      ...prev,
      ...debit,
      favorLedger: redeemFavorPure(prevLedger, favorId),
    } as GameState;
  });

  if (!paid) return { success: false, message: `Need $${target.value.toLocaleString()} to repay.` };
  log.info(`Repaid favor ${favorId} ($${target.value})`);
  return { success: true, message: 'Debt repaid.', favor: target };
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
