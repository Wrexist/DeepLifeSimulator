import type { GameState } from '@/contexts/game/types';

/** The age a Youth Pill resets the character to. */
export const YOUTH_PILL_AGE = 18;

/**
 * Spend one Youth Pill: one pill off the inventory and the displayed age back
 * to {@link YOUTH_PILL_AGE}, in ONE transition.
 *
 * The pill count is re-checked against `prev` (CLAUDE.md §4.4): the modal's
 * gate reads a selector outside the updater, so a same-batch double tap used
 * to run this twice - the second time on a count that was already 0, which
 * the old `Math.max(0, ...)` turned into a free reset. Returns `prev`
 * unchanged (same reference) when there is no pill to spend.
 *
 * `date.age` is the ticking age (the week loop advances it). The modal also
 * used to write `userProfile.age`, which is not a `UserProfile` field and has
 * no reader, so it is no longer written.
 */
export function applyYouthPill(prev: GameState): GameState {
  const pills = Number.isFinite(prev.youthPills) ? prev.youthPills : 0;
  if (pills <= 0) return prev;
  return {
    ...prev,
    youthPills: pills - 1,
    date: { ...prev.date, age: YOUTH_PILL_AGE },
  };
}
