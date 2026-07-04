/**
 * Relationship exclusivity guards — anti-bigamy enforcement.
 *
 * Two levels of exclusivity exist in the game:
 *
 *   1. ROMANTIC exclusivity — you can only date ONE person at a time.
 *      `findRomanticPartner` finds any existing partner/spouse. Used when
 *      STARTING a relationship (SocialActionsContext.startDating,
 *      SparkActions.promoteMatchToRelationship).
 *
 *   2. COMMITTED exclusivity — engagement, marriage, or cohabitation with
 *      one person blocks proposing to / moving in with anyone else.
 *      `hasCommittedPartner` / `findCommittedPartner` treat a relationship
 *      as "committed" when it is type 'spouse', has `engagementWeek` set,
 *      or has `livingTogether`. Used by proposeToPartner / moveInTogether
 *      (GameActionsContext) and proposeMarriage (DatingActions).
 *
 * Pure functions, no React deps — safe to call inside setGameState updaters
 * for same-batch double-tap rechecks.
 */

import type { Relationship } from '@/contexts/game/types';

/**
 * Find an existing romantic relationship (partner OR spouse), optionally
 * ignoring `exceptId`. Any hit means the player is already seeing someone.
 */
export function findRomanticPartner(
  relationships: Relationship[] | undefined,
  exceptId?: string,
): Relationship | undefined {
  return (relationships ?? []).find(
    (r) => r.id !== exceptId && (r.type === 'partner' || r.type === 'spouse'),
  );
}

/**
 * Find a relationship (other than `exceptId`) the player is COMMITTED to:
 * married to ('spouse'), engaged to (`engagementWeek` set), or living with
 * (`livingTogether`). Returns the relationship so callers can name them in
 * error messages.
 */
export function findCommittedPartner(
  relationships: Relationship[] | undefined,
  exceptId?: string,
): Relationship | undefined {
  return (relationships ?? []).find(
    (r) =>
      r.id !== exceptId &&
      (r.type === 'spouse' || r.engagementWeek != null || r.livingTogether === true),
  );
}

/**
 * True when any relationship other than `exceptId` is committed
 * (spouse / engaged / living together). See `findCommittedPartner`.
 */
export function hasCommittedPartner(
  relationships: Relationship[] | undefined,
  exceptId?: string,
): boolean {
  return findCommittedPartner(relationships, exceptId) !== undefined;
}
