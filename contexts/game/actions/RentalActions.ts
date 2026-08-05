/**
 * Signing and ending a tenancy.
 *
 * ── Shape: a pure reducer, called twice ───────────────────────────────────
 *
 * The obvious way to write this is to `setGameState(prev => …)` and then
 * `return { success: true }` underneath. That is the C-9 class the repo
 * ratchets against (`__tests__/refactor/updaterResultRatchet.test.ts`): the
 * updater can reject against `prev` — a same-batch double tap, or a gate that no
 * longer holds — while the caller has already been told it worked.
 *
 * The pessimistic-capture workaround (`let result = {success:false}` assigned
 * inside the updater) is explicitly NOT sound here either, and that file
 * documents why: React runs the first functional update of a batch eagerly and
 * defers the second, so the capture reads sometimes and not others.
 *
 * So the outcome is a PURE function of state, called in both places — the C-10
 * pattern. No variable crosses the updater boundary, and the state the updater
 * commits is derived from the same function that produced the message.
 */
import React from 'react';
import type { GameState } from '../types';
import { RENTAL_TIERS, canRent, getRentalTier } from '@/lib/realEstate/rentals';
import { logger } from '@/utils/logger';

const log = logger.scope('RentalActions');

export interface RentalActionResult {
  success: boolean;
  message: string;
}

interface RentalTransition {
  next: GameState;
  result: RentalActionResult;
}

/**
 * Pure: what signing for `tierId` does to `state`, and what to tell the player.
 *
 * Returns `state` unchanged on every rejection, so the caller's updater can use
 * it directly and a second tap in the same batch is a genuine no-op rather than
 * a second charge.
 */
export function resolveRentHome(state: GameState, tierId: string): RentalTransition {
  const tier = getRentalTier(tierId);
  if (!tier) {
    return { next: state, result: { success: false, message: 'That listing is no longer available.' } };
  }
  if (state.rental?.tierId === tierId) {
    return { next: state, result: { success: false, message: `You already live at the ${tier.name}.` } };
  }

  const verdict = canRent(state, tier);
  if (!verdict.allowed) {
    return { next: state, result: { success: false, message: verdict.reason } };
  }

  const cash = typeof state.stats?.money === 'number' && isFinite(state.stats.money) ? state.stats.money : 0;

  return {
    next: {
      ...state,
      rental: { tierId: tier.id, startedWeek: state.weeksLived ?? 0 },
      stats: {
        ...state.stats,
        // Charge and record in ONE object — the gate-then-grant split is the
        // most repeated bug class in this repo (§4.4).
        money: Math.max(0, cash - tier.weeklyRent),
      },
    },
    result: {
      success: true,
      message: `Moved into the ${tier.name}. First week's rent of $${tier.weeklyRent} paid.`,
    },
  };
}

/** Pure: what moving out does. */
export function resolveEndRental(state: GameState): RentalTransition {
  const tier = getRentalTier(state.rental?.tierId);
  if (!state.rental || !tier) {
    return { next: state, result: { success: false, message: 'You are not renting anywhere.' } };
  }
  const { rental: _ended, ...withoutRental } = state;
  return {
    next: withoutRental as GameState,
    result: {
      success: true,
      message: `You moved out of the ${tier.name}. Find somewhere new before it wears you down.`,
    },
  };
}

/**
 * Sign for a rental tier. The first week is due on signing, so a tenancy never
 * starts already in arrears.
 *
 * Moving between tiers is a plain swap with no penalty. Charging a player to
 * upgrade their home would make the ladder something to avoid climbing, which is
 * the opposite of why it exists.
 */
export function rentHome(
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
  tierId: string,
): RentalActionResult {
  const { result } = resolveRentHome(gameState, tierId);
  if (!result.success) return result;

  setGameState((prev) => resolveRentHome(prev, tierId).next);
  log.info(`Signed a tenancy: ${tierId}`);
  return result;
}

/**
 * End the tenancy. Deliberately free and immediate: this is the escape hatch for
 * someone who can no longer afford their rent, and a fee would trap exactly the
 * player it exists to help.
 */
export function endRental(
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  gameState: GameState,
): RentalActionResult {
  const { result } = resolveEndRental(gameState);
  if (!result.success) return result;

  setGameState((prev) => resolveEndRental(prev).next);
  return result;
}

/** Tiers the player could sign for right now, with the reason when they cannot. */
export function listRentalOptions(gameState: GameState) {
  return RENTAL_TIERS.map((tier) => ({
    tier,
    current: gameState.rental?.tierId === tier.id,
    ...canRent(gameState, tier),
  }));
}
