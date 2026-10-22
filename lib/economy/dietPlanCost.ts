import type { DietPlan } from '@/contexts/game/types';

/**
 * A diet plan's weekly charge (dailyCost x 7). The tick (`applyDietPlan`)
 * skips a plan the player cannot cover, and the vital projection
 * (`projectWeeklyVitalDrift`) compares money to the same number, so the
 * screens never promise a gain the tick will not pay. A non-finite cost
 * reads as 0, as it always has in the tick.
 */
export function dietPlanWeeklyCost(plan: Pick<DietPlan, 'dailyCost'> | null | undefined): number {
  const daily = plan?.dailyCost;
  return typeof daily === 'number' && Number.isFinite(daily) ? daily * 7 : 0;
}
