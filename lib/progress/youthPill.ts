import type { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { trialYearsLost } from '@/lib/dynasty/trials';

/** The age a Youth Pill resets the character to. */
export const YOUTH_PILL_AGE = 18;

/**
 * The age a pill resets THIS character to: {@link YOUTH_PILL_AGE}, plus the
 * years an active Dynasty Trial took (The Long Road, D8). The Trial's reward
 * pays for carrying those years; a pill that handed them back erased the whole
 * cost while the reward still settled. The modal reads this too, so the card
 * states the age the pill actually delivers.
 */
export function youthPillTargetAge(state: GameState | undefined | null): number {
  return YOUTH_PILL_AGE + trialYearsLost(state);
}

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
 *
 * v57 (CMP-11): the pill ALSO sets `ageOffsetWeeks` to the current
 * `weeksLived`. `getAge` derives the age from that counter on every v43+ save
 * and subtracts the offset, so the character is 18 on every card and to every
 * system that asks (pension, Elder card, chapter age goals, old-age events),
 * not just on the HUD. Overwritten rather than added to: a second pill resets
 * to 18 from wherever the character is now, the same as the first.
 */
export function applyYouthPill(prev: GameState): GameState {
  const pills = Number.isFinite(prev.youthPills) ? prev.youthPills : 0;
  if (pills <= 0) return prev;
  const weeksLived =
    typeof prev.weeksLived === 'number' && Number.isFinite(prev.weeksLived) && prev.weeksLived > 0
      ? prev.weeksLived
      : 0;
  // `weeksLived` counts from the 18th birthday and `YOUTH_PILL_AGE` IS 18, so
  // the whole counter comes off: getAge = 18 + (weeksLived - offset) / 52.
  // Under The Long Road the Trial's twelve years stay on the counter (D8): the
  // pill takes off only what was lived beyond them.
  const keptWeeks = trialYearsLost(prev) * WEEKS_PER_YEAR;
  const offset = Math.max(0, weeksLived - keptWeeks);
  return {
    ...prev,
    youthPills: pills - 1,
    ageOffsetWeeks: offset,
    date: { ...prev.date, age: YOUTH_PILL_AGE + Math.floor((weeksLived - offset) / WEEKS_PER_YEAR) },
  };
}
