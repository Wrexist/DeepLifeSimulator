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
 * dynasty state, because both paths call this one function. `dynastyStats`
 * (heirlooms) was the second instance: only the heir path wrote it, so a reset
 * restored the empty default.
 */

import type { GameState } from '@/contexts/game/types';
import { applyVaultToNewLife } from './vault';
import { applyTrialEffectsToNewLife, settleTrials } from './trials';
import { endowmentIds, pendingTrialIds, seatWingIds, vaultItemIds } from './state';
import { readLiveOpsState } from '@/lib/liveops/state';
import { ownsLuxuryItem } from '@/lib/luxury/operations';

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
  // Live-event payouts belong to the lineage. Neither prestige nor becoming
  // an heir reopens an event instance or refunds its real-time weekly budget.
  // The reader copies nested arrays/entries so the ended life stays immutable.
  if (oldState.liveOps) {
    const liveOps = readLiveOpsState(oldState);
    newState.liveOps = { ...liveOps, lastSeenWeek: {} };
    // Seen-instance badges persist, but cooldown weeks are relative to the
    // ended life. Carrying them would suppress unrelated future appearances
    // when the new life eventually reaches that same week number.
  }

  // ── Legacy Contracts ─────────────────────────────────────────────────────
  // Claimed ids are lineage data. See the header for what happened while they
  // were not carried.
  const claimedIds = oldState.legacyContracts?.claimedIds;
  if (Array.isArray(claimedIds) && claimedIds.length > 0) {
    newState.legacyContracts = { claimedIds: [...claimedIds] };
  }

  // ── Milestone gem rewards ────────────────────────────────────────────────
  // "Once-ever per milestone id", paid in gems that DO cross the boundary.
  // The ledger did not, and every milestone re-derives from per-life state
  // (first pet, first property, first company...), so each prestige or heir
  // re-minted the whole board (ACT-2, 2026-10-21). A union, so it can only
  // refuse a claim, never grant one.
  const claimedMilestones = oldState.claimedMilestoneRewards;
  if (Array.isArray(claimedMilestones) && claimedMilestones.length > 0) {
    const own = Array.isArray(newState.claimedMilestoneRewards) ? newState.claimedMilestoneRewards : [];
    newState.claimedMilestoneRewards = Array.from(
      new Set([...own, ...claimedMilestones.filter((id): id is string => typeof id === 'string')]),
    );
  }

  // ── Dynasty stats (heirlooms, family records) ───────────────────────────
  // Lineage data, and it must never go BACKWARD across a life boundary. The
  // heir path folds the ended life in before calling here (`computeInheritance`:
  // +1 generation, heirlooms aged), so its record is ahead of the old one and
  // stands. A prestige RESET is the same generation starting over and folds
  // nothing in - it arrived holding `initialGameState`'s empty record, which
  // wiped every heirloom on "start fresh". Anything not ahead of the old record
  // is replaced by a copy of it.
  const oldDynastyStats = oldState.dynastyStats;
  if (oldDynastyStats && typeof oldDynastyStats === 'object') {
    const oldGenerations = Number(oldDynastyStats.totalGenerations) || 0;
    const newGenerations = Number(newState.dynastyStats?.totalGenerations) || 0;
    if (!newState.dynastyStats || newGenerations <= oldGenerations) {
      newState.dynastyStats = JSON.parse(JSON.stringify(oldDynastyStats));
    }
  }

  // Only heirlooms the old life still OWNS cross over (exploit sweep,
  // 2026-10-19): a vaulted item that was sold stayed listed and was re-granted
  // free every life - vault a supercar (25% fee), sell it (60%), prestige, repeat.
  const vault = vaultItemIds(oldState).filter((id) => ownsLuxuryItem(oldState.luxuryItems, id));
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
