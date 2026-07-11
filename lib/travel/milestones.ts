/**
 * Passport milestones — frequent-flyer tiers.
 *
 * Gives the passport an aim: hitting distinct-destination thresholds grants a
 * one-off, bounded happiness/reputation reward. Each tier is claimed exactly
 * once; the claimed ids live in `TravelState.passportMilestones` (read via `??`).
 *
 * Pure data + pure evaluators. No side effects, no wall-clock — the caller
 * (returnFromTrip) evaluates on return using the post-trip visited count.
 */

export interface TravelMilestoneTier {
  id: string;
  /** Distinct destinations visited required to earn this tier. */
  threshold: number;
  label: string;
  description: string;
  /** One-off bounded rewards granted on the trip that crosses the threshold. */
  happiness: number;
  reputation: number;
}

/** Ordered by ascending threshold. Rewards stay small (bounded one-offs). */
export const TRAVEL_MILESTONE_TIERS: TravelMilestoneTier[] = [
  { id: 'jetsetter',   threshold: 3,  label: 'Jet Setter',      description: 'Visited 3 destinations.',  happiness: 5,  reputation: 0 },
  { id: 'globetrotter', threshold: 6, label: 'Globe Trotter',   description: 'Visited 6 destinations.',  happiness: 8,  reputation: 3 },
  { id: 'explorer',    threshold: 10, label: 'World Explorer',   description: 'Visited 10 destinations.', happiness: 10, reputation: 5 },
  { id: 'master',      threshold: 15, label: 'Passport Master',  description: 'Visited 15 destinations.', happiness: 12, reputation: 8 },
];

export interface TravelMilestoneEvaluation {
  /** Tiers whose threshold is met but not yet in `claimed`. */
  newlyEarned: TravelMilestoneTier[];
  /** Bounded totals to apply once for the newly-earned tiers. */
  happiness: number;
  reputation: number;
  /** All claimed ids after granting (existing + newly earned). */
  claimedAfter: string[];
}

/**
 * Given the number of distinct destinations visited and the already-claimed
 * tier ids, return the tiers newly earned this evaluation plus their summed
 * bounded rewards. Idempotent: a tier already in `claimed` is never re-granted.
 */
export function evaluateTravelMilestones(
  visitedCount: number,
  claimed: string[] | undefined
): TravelMilestoneEvaluation {
  const already = claimed ?? [];
  const newlyEarned = TRAVEL_MILESTONE_TIERS.filter(
    (t) => visitedCount >= t.threshold && !already.includes(t.id)
  );
  const happiness = newlyEarned.reduce((s, t) => s + t.happiness, 0);
  const reputation = newlyEarned.reduce((s, t) => s + t.reputation, 0);
  return {
    newlyEarned,
    happiness,
    reputation,
    claimedAfter: [...already, ...newlyEarned.map((t) => t.id)],
  };
}
