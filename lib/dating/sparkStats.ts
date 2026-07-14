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

/**
 * Clear the `promoted` flag on the Spark match backing a now-ended relationship
 * (a promoted match shares its id with the relationship it created). Without
 * this a broken-up / divorced match still renders as your partner in Spark, is
 * filtered out of the swipe deck, and can never be re-dated —
 * promoteMatchToRelationship returns "Already dating this person" forever.
 * Pure; returns a NEW sparkApp (or the original when Spark is uninitialized).
 */
export function clearPromotedSparkMatch(
  sparkApp: SparkAppState | undefined,
  relationshipId: string,
): SparkAppState | undefined {
  if (!sparkApp?.matches) return sparkApp;
  return {
    ...sparkApp,
    matches: sparkApp.matches.map((m) =>
      m.id === relationshipId && m.promoted ? { ...m, promoted: false } : m
    ),
  };
}
