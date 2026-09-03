/**
 * Why the character died, in the player's terms - for the death screen.
 *
 * ── Why this exists (Master Program 7, fair failure) ────────────────────
 *
 * A vital death takes four consecutive weeks at zero (`ZERO_STAT_DEATH_WEEKS`),
 * and the death screen said "The weight of life became too much" / "You lost
 * the will to go on". Both true, neither an explanation. A player who died at
 * week 13 with $4,000 in the bank could not answer the three fair-failure
 * questions: what happened, what was pulling the number down, and what they
 * could have done. The tick had the answers all along - the recap line names
 * the drains every week - so the death screen reads the SAME projection over
 * the final state and says them once more, with the free fix beside them.
 *
 * Pure and total: a state with no drains, or a malformed one, yields a short
 * neutral line rather than a throw - this renders on the one screen that must
 * never crash.
 */
import type { GameState } from '@/contexts/game/types';
import { ZERO_STAT_DEATH_WEEKS } from '@/lib/config/gameConstants';
import { driftDrainLabels, projectWeeklyVitalDrift } from '@/lib/economy/vitalDrift';

export type VitalDeathReason = 'health' | 'happiness';

export interface DeathExplanation {
  /** "Happiness sat at 0 for 4 weeks." */
  what: string;
  /** "Pulling it down each week: No home · Janitor shifts · Natural decay." Empty when nothing was. */
  why: string;
  /** "Free fixes were one tap away in Life → Health; a room is $45/week in Market → Housing." */
  fix: string;
}

const isVitalReason = (r: unknown): r is VitalDeathReason => r === 'health' || r === 'happiness';

const num = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/**
 * Explain a vital death from the state the character died in.
 * Returns null for any other death (old age, disease countdown, no reason).
 */
export function explainVitalDeath(state: GameState | null | undefined): DeathExplanation | null {
  if (!state || !isVitalReason(state.deathReason)) return null;
  const reason = state.deathReason;
  const zeroWeeks = Math.max(
    ZERO_STAT_DEATH_WEEKS,
    num(reason === 'health' ? state.healthZeroWeeks : state.happinessZeroWeeks, ZERO_STAT_DEATH_WEEKS),
  );
  const what = `${reason === 'health' ? 'Health' : 'Happiness'} sat at 0 for ${zeroWeeks} weeks.`;

  let why = '';
  let homeless = false;
  try {
    const drift = projectWeeklyVitalDrift(state);
    const drains = drift.causes.filter((c) => (reason === 'health' ? c.health < 0 : c.happiness < 0));
    homeless = drains.some((c) => c.id === 'home' && c.label === 'No home');
    const labels = driftDrainLabels({ ...drift, causes: drains }, 3);
    if (labels.length > 0) why = `Pulling it down each week: ${labels.join(' · ')}.`;
  } catch {
    why = '';
  }

  const fix = homeless
    ? 'Free fixes were one tap away in Life → Health; a room is $45/week in Market → Housing.'
    : 'Free fixes were one tap away in Life → Health.';

  return { what, why, fix };
}
