/**
 * Who sees an event - eligibility, cooldowns, and staged rollout.
 *
 * THE FAILURE THIS GUARDS AGAINST IN BOTH DIRECTIONS. Under-targeting means a
 * new player is shown "Own five businesses" and learns that the event hub is
 * not for them. Over-targeting is worse and less visible: an event with four
 * conditions may reach nobody, and an event nobody qualifies for is
 * indistinguishable in the data from an event that is broken (14). So every
 * condition here is optional, absent means no constraint, and the common case -
 * an event for everyone - is an empty object.
 *
 * PURE AND SYNCHRONOUS. This is called for every event on every render of the
 * hub, so it takes a small resolved context rather than a `GameState`, and it
 * never reads storage or the network. The caller assembles the context once.
 */
import { resolveProgressionStage } from '@/lib/analytics/progression';
import { hashString } from '@/lib/analytics/experiments';
import type { LiveEventDefinition, LiveOpsState } from './types';

/** Everything eligibility needs, resolved once by the caller. */
export interface EligibilityContext {
  /** Weeks into the CURRENT life. Never raw `weeksLived` - CLAUDE.md 4.2. */
  weeksThisLife: number;
  /** `prestige.totalPrestiges`. */
  totalPrestiges: number;
  /** Whether the player currently holds the subscription entitlement. */
  isSubscriber: boolean;
  /** Real days since the previous session. 0 for a continuing session. */
  daysAway: number;
  /** The anonymous install id, for deterministic rollout bucketing. */
  installId: string;
}

/**
 * The share of installs an event is live for, as a stable per-install decision.
 *
 * Deterministic on `installId:eventId`, the same construction the experiment
 * assigner uses and for the same reason: a random draw would move a player in
 * and out of the rollout on every launch, so an event would appear, vanish, and
 * reappear. Salting with the event id keeps two staged rollouts independent
 * rather than landing on the same unlucky installs.
 *
 * Monotonic in the percentage: raising a rollout only ever ADDS installs. That
 * is the property staged rollout actually needs (35) - going 10 to 50 must
 * never take the event away from someone who already has it and may already
 * have made progress.
 */
export function isInRollout(eventId: string, installId: string, rolloutPercent?: number): boolean {
  if (rolloutPercent === undefined) return true;
  if (!Number.isFinite(rolloutPercent)) return true;
  if (rolloutPercent >= 100) return true;
  if (rolloutPercent <= 0) return false;
  const bucket = hashString(`${installId}:${eventId}`) % 100;
  return bucket < rolloutPercent;
}

/**
 * The minimum game weeks between two appearances of the same event id.
 *
 * Only reachable for a RECURRING event id - one scheduled again in a later
 * window. It stops a single event dominating the calendar (13) without needing
 * per-event tuning, and it is measured in GAME weeks so a player who has not
 * played is not silently cooled down by real time passing.
 */
export const DEFAULT_COOLDOWN_WEEKS = 8;

/** Why an event is not shown. `null` means it is. */
export function ineligibleReason(
  definition: LiveEventDefinition,
  context: EligibilityContext,
  state: LiveOpsState | undefined,
): string | null {
  if (!isInRollout(definition.id, context.installId, definition.rolloutPercent)) {
    return 'outside rollout';
  }

  const eligibility = definition.eligibility;
  if (eligibility) {
    if (eligibility.stages && eligibility.stages.length > 0) {
      const stage = resolveProgressionStage({
        weeksThisLife: context.weeksThisLife,
        totalPrestiges: context.totalPrestiges,
      });
      if (!eligibility.stages.includes(stage)) return `stage '${stage}' not targeted`;
    }

    if (
      typeof eligibility.minWeeksThisLife === 'number' &&
      context.weeksThisLife < eligibility.minWeeksThisLife
    ) {
      return 'too early in this life';
    }

    if (typeof eligibility.requiresSubscription === 'boolean') {
      if (eligibility.requiresSubscription !== context.isSubscriber) {
        // Both directions are legitimate: a member perk, and a win-back offer
        // that must NOT be shown to someone who already subscribes.
        return eligibility.requiresSubscription ? 'subscribers only' : 'non-subscribers only';
      }
    }

    if (typeof eligibility.minDaysAway === 'number' && context.daysAway < eligibility.minDaysAway) {
      return 'player has not been away long enough';
    }
  }

  const lastSeen = state?.lastSeenWeek?.[definition.id];
  if (typeof lastSeen === 'number' && Number.isFinite(lastSeen)) {
    const elapsed = context.weeksThisLife - lastSeen;
    // A NEGATIVE elapsed means the life clock reset (a prestige or a new life)
    // since the event was last seen. That is a genuinely fresh start, so the
    // cooldown does not apply - and treating it as "still cooling down" would
    // hide recurring events from every player who prestiges.
    if (elapsed >= 0 && elapsed < DEFAULT_COOLDOWN_WEEKS) return 'on cooldown';
  }

  return null;
}

/** Whether the player may see this event now. */
export function isEligible(
  definition: LiveEventDefinition,
  context: EligibilityContext,
  state: LiveOpsState | undefined,
): boolean {
  return ineligibleReason(definition, context, state) === null;
}
