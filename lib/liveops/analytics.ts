/**
 * The live-ops funnel (37, 38).
 *
 * WHY A WRAPPER RATHER THAN `track()` AT EACH CALL SITE. Every event in this
 * funnel has to carry the same three identifiers - the event id, the instance,
 * and the kind - or the funnel cannot be assembled downstream. Nine call sites
 * each remembering to pass three properties is nine chances to forget one, and
 * a step missing its instance id silently stops joining to the rest.
 *
 * WHAT IS DELIBERATELY NOT SENT. No reward AMOUNTS on the funnel steps other
 * than the claim: the definition already says what an event pays, so repeating
 * it on every impression is data that answers nothing and is wrong the moment
 * a remote publish changes it. No copy, no titles - those change per publish
 * and would fragment the funnel by wording rather than by event.
 *
 * DE-DUPLICATION. `live_event_shown` is an impression fired from a render path,
 * so it is on the analytics de-dupe allowlist alongside the other impressions;
 * `live_event_claimed` never is, because a repeat there would be a
 * double-payout and suppressing it would delete the evidence (CLAUDE.md 4.4).
 */
import { track } from '@/lib/analytics';
import { instanceId } from './schedule';
import { bundleValueInGems } from './rewards';
import type { LiveEventDefinition, LiveEventState } from './types';

/** The three identifiers every step carries. */
function identity(definition: LiveEventDefinition): {
  eventId: string;
  instance: string;
  kind: string;
} {
  return {
    eventId: definition.id,
    instance: instanceId(definition),
    kind: definition.kind,
  };
}

/** The event rendered somewhere the player could see it. */
export function trackEventShown(definition: LiveEventDefinition, state: LiveEventState, surface: string): void {
  track('live_event_shown', { ...identity(definition), state, surface });
}

/** The player opened it and read the brief - the discovery step. */
export function trackEventOpened(definition: LiveEventDefinition, state: LiveEventState, metCount: number): void {
  track('live_event_opened', { ...identity(definition), state, metCount });
}

/**
 * An objective the player had not met became met.
 *
 * Carries how many of the total are now met, so "where do players stall" is a
 * distribution over objective counts rather than a binary completed/not.
 */
export function trackEventProgressed(
  definition: LiveEventDefinition,
  metCount: number,
  totalCount: number,
): void {
  track('live_event_progressed', { ...identity(definition), metCount, totalCount });
}

/** Every objective met. The reward is now waiting. */
export function trackEventCompleted(definition: LiveEventDefinition, weeksThisLife: number): void {
  track('live_event_completed', { ...identity(definition), weeksThisLife });
}

/**
 * The reward was actually paid.
 *
 * Carries the gem-equivalent VALUE rather than the reward list, because that is
 * the number the economy dashboard sums and it is already how the budget
 * reasons. The per-currency breakdown is recoverable from the definition.
 */
export function trackEventClaimed(definition: LiveEventDefinition, weeksThisLife: number): void {
  track('live_event_claimed', {
    ...identity(definition),
    weeksThisLife,
    valueGems: Math.round(bundleValueInGems(definition.rewards)),
  });
}

/** A claim the budget refused. Should be rare - see the event's note. */
export function trackClaimRefused(definition: LiveEventDefinition, reason: string): void {
  track('live_event_claim_refused', { ...identity(definition), reason });
}

/** The window closed on a player who had not claimed. Closes the funnel. */
export function trackEventExpired(definition: LiveEventDefinition, metCount: number, totalCount: number): void {
  track('live_event_expired', { ...identity(definition), metCount, totalCount });
}

/**
 * How the content layer resolved, once per session.
 *
 * `rejected` is the number that matters: a non-zero count means someone
 * published a definition that will never reach a player, and without this it is
 * visible only in a device log.
 */
export function trackContentResolved(
  source: string,
  eventCount: number,
  rejectedCount: number,
  paused: boolean,
): void {
  track('liveops_content_resolved', { source, eventCount, rejectedCount, paused });
}
