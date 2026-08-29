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
import { hubOrder, instanceId, msRemaining, resolveState, windowFor } from './schedule';
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
  return forDisplay(resolveAll(definitions, state, context, nowMs), nowMs);
}

/**
 * Every event resolved, INCLUDING the ones the hub hides.
 *
 * The funnel observer needs this: expiry is a transition nobody else can see,
 * precisely because the hub is careful never to show the player an event that
 * closed on them.
 */
export function resolveAll(
  definitions: readonly LiveEventDefinition[],
  state: GameState,
  context: EligibilityContext,
  nowMs: number,
): ResolvedLiveEvent[] {
  return definitions.map((definition) => resolveEvent(definition, state, context, nowMs));
}

/**
 * How far ahead an `upcoming` event may be announced.
 *
 * Seven days, matching the offer rotation's "you can see next week's offer"
 * window - which is the right precedent, because both are answering the same
 * question: what is coming that I could plan around? Beyond a week the answer
 * stops being a plan and starts being clutter.
 *
 * Without a horizon the hub advertised a year-end event from August - 128 days
 * out, three objectives at 0/3, and nothing the player could do about any of it
 * for four months. A permanent row that never changes is worse than an empty
 * card: it trains the player that the surface has nothing for them.
 */
export const UPCOMING_HORIZON_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The display filter and ordering, split out so both callers share one rule. */
export function forDisplay(
  resolved: readonly ResolvedLiveEvent[],
  nowMs: number = Date.now(),
): ResolvedLiveEvent[] {
  return resolved
    .filter((r) => {
      if (r.state === 'unavailable' || r.state === 'expired') return false;
      if (r.state !== 'upcoming') return true;
      // `msRemaining` counts to the END of the window, so it cannot answer "how
      // far away is the START" - the horizon has to be measured from the window
      // itself. An unparseable window resolves `unavailable` above, so this is
      // only ever reached with a real one.
      const window = windowFor(r.definition);
      if (!window || !Number.isFinite(nowMs)) return false;
      return window.startsAt - nowMs <= UPCOMING_HORIZON_DAYS * DAY_MS;
    })
    .slice()
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
