/**
 * Welcome-back cash bonus.
 *
 * Scaled by the player's current weekly salary and how long they were away
 * (capped at 7 days). Lives in its own module so both the popup (which displays
 * it) and the home screen (which grants it on close) share one source of truth —
 * the amount shown must always equal the amount granted. Pure; reads only the
 * player's career list + currentJob.
 */

interface CareerLike {
  id?: string;
  accepted?: boolean;
  level?: number;
  levels?: { salary?: number }[];
}

export function computeWelcomeBackBonus(
  gameState: { careers?: CareerLike[]; currentJob?: string },
  daysAway: number,
): number {
  const currentCareer = gameState.careers?.find(
    (c) => c?.id === gameState.currentJob && c?.accepted,
  );
  const weeklySalary = currentCareer?.levels?.[currentCareer?.level || 0]?.salary || 0;
  const rewardWeeks = Math.min(Math.max(daysAway, 1), 7);
  return Math.max(100, Math.round(weeklySalary * rewardWeeks * 0.5));
}
