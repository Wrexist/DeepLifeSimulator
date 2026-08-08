/**
 * What crosses a life boundary — the single hook both transition paths run.
 *
 * `createResetGameState` (prestige) and `createChildGameState` (prestige as an
 * heir, and the death → heir flow via `continueAsChild`) each rebuild the save
 * from `initialGameState` and then hand-copy the things that are LINEAGE data
 * rather than character data. Every one of those copies is a line somebody has
 * to remember to add, and the cost of forgetting is silent: the feature simply
 * evaporates on the next prestige and nobody files a bug because nobody knows
 * it was supposed to survive.
 *
 * That has already happened once here. `legacyContracts.claimedIds` was never
 * carried, so `initialGameState`'s empty board was restored on every single
 * prestige and the entire contract ladder became re-claimable — a Legacy Point
 * printer worth the full board every cycle. It is carried below, with the
 * dynasty state, because both paths call this one function.
 */

import type { GameState } from '@/contexts/game/types';
import { applyVaultToNewLife } from './vault';
import { applyTrialEffectsToNewLife, settleTrials } from './trials';
import { endowmentIds, pendingTrialIds, seatWingIds, vaultItemIds } from './state';

/**
 * Carry lineage state onto a freshly-built life, settle the Trials the old life
 * carried, and start the ones that were sworn for this one.
 *
 * Mutates and returns `newState`, which the callers are still constructing.
 *
 * IDEMPOTENT with respect to `oldState`: every number written is derived from
 * `oldState` rather than accumulated onto `newState`, so running the transition
 * twice against the same save produces the same result instead of paying the
 * Trial reward twice. Same property `claimContract` and `purchaseLegacyUpgrade`
 * rely on.
 */
export function applyDynastyTransition(oldState: GameState, newState: GameState): GameState {
  // ── Legacy Contracts ─────────────────────────────────────────────────────
  // Claimed ids are lineage data. See the header for what happened while they
  // were not carried.
  const claimedIds = oldState.legacyContracts?.claimedIds;
  if (Array.isArray(claimedIds) && claimedIds.length > 0) {
    newState.legacyContracts = { claimedIds: [...claimedIds] };
  }

  const vault = vaultItemIds(oldState);
  const endowments = endowmentIds(oldState);
  const wings = seatWingIds(oldState);
  const sworn = pendingTrialIds(oldState);
  const { points: trialPoints } = settleTrials(oldState);

  // Nothing to carry and nothing sworn: leave `dynasty` absent rather than
  // stamping an empty object onto a save that never had one. Absent already
  // means "no vault, nothing endowed, no trial, no wings" — writing the object
  // would only make every save look like it had opted in.
  const hasAnything =
    vault.length > 0 || endowments.length > 0 || wings.length > 0 || sworn.length > 0;

  if (hasAnything) {
    newState.dynasty = {
      ...(vault.length > 0 ? { vaultItemIds: [...vault] } : {}),
      ...(endowments.length > 0 ? { endowments: [...endowments] } : {}),
      ...(wings.length > 0 ? { seatWings: [...wings] } : {}),
      // The sworn Trials become the ACTIVE ones and the pending list empties,
      // so a Trial cannot be carried forward twice and settled twice.
      ...(sworn.length > 0 ? { trials: { active: [...sworn], pending: [] } } : {}),
    };
  }

  if (trialPoints > 0) {
    // `legacyPoints` is the LIFETIME total earned — the week loop only ever
    // adds to it — and both callers have already copied the old value onto
    // `newState` by this point, so this adds the settlement on top of it.
    newState.legacyPoints = (newState.legacyPoints ?? 0) + trialPoints;
  }

  // The heirlooms arrive before the handicaps, because a Trial that zeroes the
  // opening cash must not be able to strip an item the player already paid a
  // preservation fee to keep.
  applyVaultToNewLife(newState, vault);

  // LAST, deliberately: every starting bonus, inheritance and legacy grant has
  // been applied by the time the callers reach here, so a ceiling written now
  // cannot be quietly raised again afterwards.
  applyTrialEffectsToNewLife(newState, sworn);

  return newState;
}
