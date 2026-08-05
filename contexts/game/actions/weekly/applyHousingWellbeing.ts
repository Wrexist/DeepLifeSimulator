/**
 * Weekly wellbeing from wherever the player lives — or does not.
 *
 * ── What this fixes as well as adds ───────────────────────────────────────
 *
 * Housing already granted weekly HAPPINESS, through
 * `processWeeklyHousing` -> `calculatePropertyHappiness`, and only for an owned
 * `currentResidence`. Two things were missing and one was actively wrong:
 *
 *  - `weeklyEnergy` was never paid. Every property in the catalogue carries it
 *    (2 to 10 per week) and no shipping code read it — EXCEPT `TopStatsBar`,
 *    which has been adding it to the predicted weekly energy change all along.
 *    So the HUD promised an energy bonus the tick never delivered.
 *  - Housing had no health effect at all.
 *  - Having nowhere to live cost nothing, so the cheapest strategy was always to
 *    live nowhere and "get a roof over your head" was never a goal.
 *
 * This reducer owns all three, for rentals and owned homes alike, so there is
 * one place that answers "what does my home do for me this week".
 *
 * Happiness stays with the existing housing module for OWNED homes — it already
 * folds in decor, room additions and the condition penalty, which this has no
 * business duplicating. `housingHappinessBonus` from that module is passed in
 * and returned unchanged when the player owns; this only supplies happiness for
 * a RENTAL, which that module knows nothing about.
 */
import { computeHousingWellbeing } from '@/lib/realEstate/rentals';
import type { GameState } from '@/contexts/game/types';
import type { WeekContext } from './weekContext';

export interface HousingWellbeingResult {
  /** Weekly rent owed for a tenancy. Folded into the bill line by the caller. */
  rent: number;
  /** Happiness to apply, already resolved between owned and rented. */
  happiness: number;
  /** True when the player has no home — drives the notification. */
  homeless: boolean;
  /**
   * True when the player lives in a home they OWN.
   *
   * Distinct from `rent === 0`, which is also true on the week a tenancy is
   * signed (see below) and while homeless. The caller uses this to decide
   * whether a tenancy is still live, so conflating the two would end a lease on
   * its first week.
   */
  owns: boolean;
}

export interface HousingWellbeingInput {
  prevState: GameState;
  /**
   * Happiness the housing module computed for an OWNED residence (decor, rooms,
   * condition). Authoritative when the player owns; ignored when renting,
   * because the module cannot see a tenancy.
   */
  ownedHappinessBonus: number;
  nextWeeksLived: number;
}

/**
 * Applies health and energy directly to `ctx.newStats` and returns the rent plus
 * the happiness figure the caller should use.
 *
 * Health and energy are applied here rather than returned because they have no
 * other consumer — happiness is returned because the caller already threads a
 * housing happiness number through its own capping logic, and splitting that in
 * two would be the kind of divergence that produces two different answers.
 */
export function applyHousingWellbeing(
  input: HousingWellbeingInput,
  ctx: WeekContext,
): HousingWellbeingResult {
  const wellbeing = computeHousingWellbeing(input.prevState);
  // Carried, not re-derived from `rent === 0` — that is also true while homeless
  // and on a tenancy's signing week (see below), and either read as ownership
  // would end the lease on the next tick.
  const owns = wellbeing.owned;

  ctx.newStats.health = clampStat(ctx.newStats.health + wellbeing.health);
  ctx.newStats.energy = clampStat(ctx.newStats.energy + wellbeing.energy);

  if (wellbeing.homeless) {
    // Once, on a cadence — not every week. A penalty the player is reminded of
    // fifty-two times a year stops being information and becomes noise, which is
    // how the event system got dialled down to almost nothing in the first place.
    if (input.nextWeeksLived % 8 === 1) {
      ctx.notifications.push({
        id: `homeless-${input.nextWeeksLived}`,
        title: 'Nowhere to live',
        message: 'Sleeping rough is wearing you down. Renting even a shared room would help.',
      });
    }
  }

  // The first week is charged at SIGNING (`resolveRentHome` takes it on the
  // spot, so a tenancy never starts already in arrears). Without this the tick
  // then bills the same week again and the player pays twice for one week of
  // housing — the message says "first week's rent paid" while the bill line
  // disagrees. `startedWeek` is stamped from `weeksLived` at signing, so the
  // tick that carries the player out of that week skips exactly one charge.
  const startedWeek = input.prevState.rental?.startedWeek;
  const signingWeek =
    typeof startedWeek === 'number' && startedWeek === (input.prevState.weeksLived ?? 0);

  return {
    rent: signingWeek ? 0 : wellbeing.rent,
    // Owned homes keep the housing module's richer figure (decor, rooms,
    // condition); a rental uses its tier's flat value.
    happiness: owns ? input.ownedHappinessBonus : wellbeing.happiness,
    homeless: wellbeing.homeless,
    owns,
  };
}

const clampStat = (n: number): number => {
  const safe = typeof n === 'number' && isFinite(n) ? n : 0;
  return Math.max(0, Math.min(100, safe));
};
