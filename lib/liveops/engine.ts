/**
 * The resolver - one function that turns (content, save, clock) into what the UI renders.
 *
 * WHY IT IS ONE PURE FUNCTION. The hub, the home-screen card, the badge count
 * and the claim path all need the same answer, and three of those four are
 * render paths. Any disagreement between them is a bug the player sees
 * directly: a badge saying one event is claimable next to a hub that shows
 * none. Computing it once, purely, from explicit inputs is what makes them
 * agree by construction and what makes every case testable without a renderer.
 *
 * COST. It is O(events x objectives) with no allocation beyond the result, and
 * the catalogue is single digits. The expensive read in the whole system is
 * `net_worth`, which walks the portfolio - so callers memoise on the inputs
 * rather than resolving inside a render body.
 */
import type { GameState } from '@/contexts/game/types';
import { evaluateObjective } from './objectives';
import { hasClaimed, readLiveOpsState } from './state';
import { hubOrder, instanceId, msRemaining, resolveState } from './schedule';
import { isEligible, ineligibleReason, type EligibilityContext } from './eligibility';
import type { LiveEventDefinition, LiveObjectiveProgress, ResolvedLiveEvent } from './types';

/**
 * Resolve one event for one player at one instant.
 *
 * Objectives are evaluated even for an event the player is not eligible for and
 * even for one already claimed. That is a deliberate few microseconds: the
 * progress numbers are what the hub renders for a `claimed` event ("3 of 3"),
 * and branching on state first would mean a claimed card rendering zeros.
 */
export function resolveEvent(
  definition: LiveEventDefinition,
  state: GameState,
  context: EligibilityContext,
  nowMs: number,
): ResolvedLiveEvent {
  const liveOps = readLiveOpsState(state);

  const objectives: LiveObjectiveProgress[] = [];
  for (const ref of definition.objectives) {
    const progress = evaluateObjective(ref.objectiveId, ref.target, state);
    // A null means the objective id is not in the registry. Validation should
    // have dropped the whole event before this, so reaching here means the
    // event bypassed validation - skip the objective rather than rendering a
    // blank row, and let `complete` below refuse to be true for an event with
    // no readable objectives.
    if (progress) objectives.push(progress);
  }

  const complete = objectives.length > 0 && objectives.every((o) => o.met);
  const id = instanceId(definition);

  const { state: lifecycleState, unavailableReason } = resolveState({
    definition,
    nowMs,
    complete,
    claimed: hasClaimed(liveOps, id),
    eligible: isEligible(definition, context, liveOps),
  });

  return {
    definition,
    state: lifecycleState,
    objectives,
    complete,
    msRemaining: msRemaining(definition, nowMs),
    unavailableReason: unavailableReason ?? ineligibleReason(definition, context, liveOps) ?? undefined,
  };
}

/**
 * Everything the hub shows, in the order it shows it.
 *
 * `unavailable` events are dropped rather than rendered greyed out. A player
 * who cannot take part in something learns nothing from seeing it, and a hub
 * padded with locked cards is how a discovery surface becomes a wall (21).
 * `expired` is dropped for the same reason - an event that closed with the
 * player mid-way is a loss they can do nothing about, and listing it only
 * converts a missed opportunity into a reproach (15: never guilt the player).
 */
export function resolveHub(
  definitions: readonly LiveEventDefinition[],
  state: GameState,
  context: EligibilityContext,
  nowMs: number,
): ResolvedLiveEvent[] {
  return definitions
    .map((definition) => resolveEvent(definition, state, context, nowMs))
    .filter((resolved) => resolved.state !== 'unavailable' && resolved.state !== 'expired')
    .sort(hubOrder);
}

/**
 * What the badge shows: how many events have a reward waiting RIGHT NOW.
 *
 * Deliberately counts `claimable` only. A badge that counts everything active
 * is a badge that is never zero, which trains the player to ignore it - and a
 * notification that is always on is not a notification.
 */
export function claimableCount(resolved: readonly ResolvedLiveEvent[]): number {
  return resolved.filter((r) => r.state === 'claimable').length;
}

/** Whether anything is worth surfacing on the home screen at all. */
export function hasSomethingToDo(resolved: readonly ResolvedLiveEvent[]): boolean {
  return resolved.some((r) => r.state === 'claimable' || r.state === 'active');
}
