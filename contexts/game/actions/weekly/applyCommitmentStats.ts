/**
 * Weekly activity-commitment stat effects (LIFE-13, owner decision 2026-10-22).
 *
 * `getCommitmentBonuses` / `getCommitmentPenalties` (lib/commitments) have
 * always carried a reputation bonus for the primary focus and a happiness cost
 * for each neglected area, and nothing read either. This is the one reader.
 *
 * Writes:
 *   - `ctx.newStats.happiness` - the neglect cost, a LOSS. It lands inside the
 *     weekly updater, so the week loop's single net happiness scaling sees it
 *     like every other tick writer (TICK_CHOKE_POINT in happinessGainAudit).
 *   - `ctx.newStats.reputation` - a soft-target nudge, +1 a week while below
 *     the primary focus's target. Never pushes reputation down.
 *
 * Pure arithmetic on the previous week's commitments: no draws, no clock.
 */
import type { GameState } from '@/contexts/game/types';
import type { WeekContext } from './weekContext';
import {
  COMMITMENT_REPUTATION_STEP,
  weeklyCommitmentStatEffects,
} from '@/lib/commitments/commitmentSystem';

export function applyCommitmentStats(
  commitments: GameState['activityCommitments'],
  ctx: Pick<WeekContext, 'newStats'>,
): void {
  if (!commitments) return;
  const { happiness, reputationTarget } = weeklyCommitmentStatEffects({ activityCommitments: commitments });

  if (happiness < 0) {
    const h = Number.isFinite(ctx.newStats.happiness) ? ctx.newStats.happiness : 0;
    ctx.newStats.happiness = Math.max(0, h + happiness);
  }

  if (reputationTarget > 0) {
    const rep = Number.isFinite(ctx.newStats.reputation) ? ctx.newStats.reputation : 0;
    if (rep < reputationTarget) {
      ctx.newStats.reputation = Math.min(reputationTarget, rep + COMMITMENT_REPUTATION_STEP);
    }
  }
}
