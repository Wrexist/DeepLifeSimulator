/**
 * Food satiety — the weekly diminishing-returns curve on bought meals.
 *
 * ## Why (2026-08-24 owner-approved balance pass)
 *
 * `buyFood` had no weekly cap and no cooldown, and a $40 steak restores
 * +25 energy — energy at ~$1.60/point, purchasable unlimited times. Since
 * energy is the currency gating street jobs, crime, health activities and
 * hobbies, money trivially bought the whole weekly energy budget back the
 * moment a player cleared a few hundred dollars, and the resource triangle
 * (money <-> energy <-> wellbeing) collapsed to one corner.
 *
 * The fix is satiety, not a hard wall: meals 1-3 in a game week restore in
 * full, 4-6 at half strength, 7+ at a quarter. Eating stays always available
 * (a broke, exhausted player is never locked out of food), but stacking ten
 * steaks stops being an energy printer. The counter lives on
 * `GameState.weeklyFoodPurchases` (v48 carve-out) and resets with the other
 * weekly counters in the tick — game-state gated, never the device clock.
 *
 * The SAME helpers feed the charge (ItemActionsContext.buyFood) and every
 * player-facing surface (the market hint and toast), so what is advertised is
 * exactly what is applied — the advertised-vs-actual rule.
 */

/** Meals at full strength per game week. */
export const FULL_STRENGTH_MEALS_PER_WEEK = 3;
/** Meals at half strength (after the full-strength ones). */
export const HALF_STRENGTH_MEALS_PER_WEEK = 3;

/**
 * Effect multiplier for the NEXT meal, given how many were already bought
 * this game week. 1 for meals 1-3, 0.5 for 4-6, 0.25 from the 7th on.
 */
export function foodEffectMultiplier(purchasesThisWeek: number | undefined): number {
  const count = typeof purchasesThisWeek === 'number' && Number.isFinite(purchasesThisWeek)
    ? Math.max(0, Math.floor(purchasesThisWeek))
    : 0;
  if (count < FULL_STRENGTH_MEALS_PER_WEEK) return 1;
  if (count < FULL_STRENGTH_MEALS_PER_WEEK + HALF_STRENGTH_MEALS_PER_WEEK) return 0.5;
  return 0.25;
}

/**
 * Scale a restore through the satiety curve. Any positive restore stays at
 * least 1 so a meal is never a pure no-op — it is weak, not fake.
 */
export function scaledFoodRestore(base: number, purchasesThisWeek: number | undefined): number {
  if (!(typeof base === 'number' && Number.isFinite(base)) || base <= 0) return 0;
  return Math.max(1, Math.round(base * foodEffectMultiplier(purchasesThisWeek)));
}

/**
 * The player-facing state of the curve, for the market screen. Null while
 * meals are still full strength — no banner is the normal state.
 */
export function satietyHint(purchasesThisWeek: number | undefined): string | null {
  const mult = foodEffectMultiplier(purchasesThisWeek);
  if (mult >= 1) return null;
  if (mult === 0.5) return 'Well fed: meals restore half as much until next week.';
  return 'Completely full: meals barely help until next week.';
}
