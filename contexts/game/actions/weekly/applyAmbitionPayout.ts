/**
 * Life Ambition payoff, moved into the week tick.
 *
 * The Life Ambition is the largest single reward in the game — $60k–$300k plus
 * 200–260 gems plus 550–900 prestige points — and until now `grantAmbitionPayout`
 * had exactly ONE caller: the "Fulfil Ambition" button inside `AmbitionCard`.
 * There was no badge, no notification and no other entry point, so a player who
 * completed every milestone of the ambition they chose at character creation but
 * never scrolled to that card simply never received it. Worse, the payoff is
 * gated on `ambitionRewardClaimed` AND the cross-life `prestige.claimedAmbitions`
 * stamp, so prestiging without tapping the button burned the ambition for every
 * future life too.
 *
 * This is the same argument `applyChapterProgress` makes, with five times the
 * money at stake: a new player should not have to hunt for a card to receive
 * something they already earned. The card is now a read-only progress display
 * and the tick is the single granting path.
 *
 * ── Why this cannot double-pay ────────────────────────────────────────────
 *
 * `grantAmbitionPayout` is a pure reducer whose own output closes its gate: it
 * sets `ambitionRewardClaimed: true` and appends the ambition id to
 * `prestige.claimedAmbitions`, and `getAmbitionCompletion` reads BOTH of those
 * back as `alreadyClaimed`, which makes `readyToClaim` false. So a second call
 * on the granted state falls into the progress-only branch and pays nothing.
 * The tick calls it from inside the single `setGameState` updater, computing
 * from `prev` and folding the result into the same returned state (§4.4) — a
 * StrictMode double-invoke re-runs the reducer from the same `prev` and produces
 * the identical state rather than a second payment.
 *
 * Pure function — no React, no setGameState, no wall-clock. The caller folds the
 * returned state and notification into the tick's existing plumbing.
 */
import type { GameState } from '@/contexts/game/types';
import { getAmbitionCompletion, grantAmbitionPayout } from '@/lib/ambitions/progress';
import { formatMoney } from '@/utils/moneyFormatting';

export interface AmbitionPayoutInput {
  /** The state as it stands after this tick's other subsystems. */
  state: GameState;
}

export interface AmbitionPayoutResult {
  /**
   * The state with staged milestone progress persisted and — when it was due —
   * the payoff granted. `null` means "nothing changed"; the caller keeps its own
   * state object rather than replacing it with an equivalent clone.
   */
  state: GameState | null;
  /** True only on the tick that actually paid out. */
  granted: boolean;
  /** Player-facing notifications, already worded. */
  notifications: { id: string; title: string; message: string }[];
}

const EMPTY: AmbitionPayoutResult = { state: null, granted: false, notifications: [] };

export function applyAmbitionPayout(input: AmbitionPayoutInput): AmbitionPayoutResult {
  const state = input?.state;
  if (!state) return EMPTY;

  const completion = getAmbitionCompletion(state);
  // No ambition chosen (old saves and freeform lives) — nothing to reconcile.
  if (!completion) return EMPTY;

  // Read the gate BEFORE the reducer runs, so "did this tick pay?" is answered
  // by the pre-state rather than by inspecting the reducer's output.
  const wasDue = completion.readyToClaim;

  // One call covers both jobs: it persists freshly-reached milestones every week
  // (sticky staged progress) and grants the payoff only on the week the last
  // milestone lands. Returns the SAME reference when neither applies.
  const next = grantAmbitionPayout(state);
  if (next === state) return EMPTY;

  if (!wasDue) {
    // Milestone progress moved; no money changed hands.
    return { state: next, granted: false, notifications: [] };
  }

  const { payoff, name, emoji } = completion.ambition;
  const parts: string[] = [];
  if (payoff.money) parts.push(`+${formatMoney(payoff.money)}`);
  if (payoff.gems) parts.push(`+${payoff.gems} gems`);
  // Prestige points are only credited when the save actually has a prestige
  // record; say so only when it was paid, so the message cannot promise points
  // the state never received.
  if (payoff.prestigePoints && state.prestige) parts.push(`+${payoff.prestigePoints} prestige points`);

  return {
    state: next,
    granted: true,
    notifications: [{
      // Stable, ambition-scoped id: the outer notification flush dedupes by id,
      // so a StrictMode double-invoke cannot produce two toasts.
      id: `ambition-fulfilled-${completion.ambition.id}`,
      title: `${emoji} Ambition fulfilled — ${name}`,
      message: parts.length > 0
        ? `${parts.join(', ')}. Your life's ambition is complete.`
        : "Your life's ambition is complete.",
    }],
  };
}
