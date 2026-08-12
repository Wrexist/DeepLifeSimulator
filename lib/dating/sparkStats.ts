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

/**
 * Clear `promoted` on every match whose relationship no longer exists.
 *
 * The sibling above takes ONE id and is called from the paths that knowingly
 * end a relationship (divorce, breakup). This one reconciles against the whole
 * live set instead, because the weekly health pass removes relationships
 * WITHOUT any single call site knowing which — a partner breakup roll, and
 * (since neglect got teeth) a friend drifting away.
 *
 * A match left stranded is unusable in both directions: the chat header reads
 * "Dating", the befriend affordance is hidden because it only renders for an
 * un-promoted match, and BOTH promotion actions refuse with "Already dating
 * this person" / "Already in your contacts". The person is gone from your life
 * and you cannot re-approach them.
 *
 * Reconciling against the live set rather than a removed-id list also self-heals
 * any match orphaned by an earlier path that forgot to call the sibling.
 *
 * Returns the SAME object when nothing is stale, so the common weekly path
 * allocates nothing.
 */
/** Minimum shape this reconciliation needs from a relationship. */
export interface RelationshipIdentity {
  id?: string;
}

export function clearOrphanedSparkPromotions(
  sparkApp: SparkAppState | undefined,
  relationships: readonly RelationshipIdentity[] | undefined,
): SparkAppState | undefined {
  if (!sparkApp?.matches) return sparkApp;
  /**
   * A missing or malformed relationship list means "I cannot tell", NOT "there
   * are no relationships".
   *
   * The previous form degraded a non-array to `[]`, which made `live` empty and
   * therefore cleared the `promoted` flag on EVERY match — turning an absent
   * input into wholesale data loss, and re-offering "Befriend" for people the
   * player is already dating. Changing nothing is the only safe answer when the
   * comparison set is unavailable.
   */
  if (!Array.isArray(relationships)) return sparkApp;
  const live = new Set(
    relationships.map((r) => r?.id).filter((id): id is string => typeof id === 'string'),
  );
  if (!sparkApp.matches.some((m) => m?.promoted && !live.has(m.id))) return sparkApp;
  return {
    ...sparkApp,
    matches: sparkApp.matches.map((m) =>
      m?.promoted && !live.has(m.id) ? { ...m, promoted: false } : m,
    ),
  };
}
