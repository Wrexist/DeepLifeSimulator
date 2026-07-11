/**
 * Spark lifetime-stat helpers.
 *
 * The five "relationship milestone" counters — dates, gifts, proposals,
 * marriages, divorces — live on `sparkApp.lifetimeStats` but the milestones
 * themselves fire from DatingActions (reached from Contacts/Family), which never
 * touched `sparkApp`. This pure helper lets those actions bump the counters
 * without duplicating the sparkApp shape.
 *
 * Pure — no React, no side effects. Returns a NEW sparkApp (or the original
 * `undefined` when Spark has never been initialized, so it stays additive: a
 * player who never opened Spark accrues no phantom sparkApp).
 */
import type { SparkAppState } from '@/contexts/game/types';

export type SparkDatingStatKey =
  | 'totalDatesGoneOn'
  | 'totalGiftsGiven'
  | 'totalProposals'
  | 'totalMarriages'
  | 'totalDivorces';

export function bumpSparkLifetimeStat(
  sparkApp: SparkAppState | undefined,
  key: SparkDatingStatKey,
  delta = 1,
): SparkAppState | undefined {
  if (!sparkApp) return sparkApp;
  const stats = sparkApp.lifetimeStats;
  return {
    ...sparkApp,
    lifetimeStats: {
      ...stats,
      [key]: (stats?.[key] ?? 0) + delta,
    },
  };
}
