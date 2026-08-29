/**
 * The event lifecycle - windows, states, and what a moved clock can and cannot do.
 *
 * THE STATE MACHINE (28):
 *
 *   upcoming ──(startsAt)──> active ──(all objectives met)──> claimable
 *        │                      │                                  │
 *        │                      │                          (claim) │
 *        │                      ▼                                  ▼
 *        │                   (endsAt)                           claimed
 *        │                      │
 *        │                      ├─ complete? ──> claimable until endsAt+grace
 *        │                      └─ incomplete ──> expired
 *        └── ineligible at any point ──> unavailable
 *
 * `claimable` is reachable from two directions and that is deliberate. Inside
 * the window it means "you have finished, take it now". After the window it
 * means "you finished in time and the app closed before you tapped" - the grace
 * period (30). Progress stops at `endsAt`; only the claim is extended, so the
 * grace can never be used to finish an event late.
 *
 * WHAT A MOVED DEVICE CLOCK BUYS. Nothing that matters, by construction:
 *  - Forward past `endsAt`: the event expires early. A self-inflicted loss.
 *  - Backward into a claimed window: `claimed` is keyed on the INSTANCE id,
 *    which is already in the ledger, so it stays `claimed`.
 *  - Backward into an unclaimed window: the event becomes claimable again -
 *    but only if the OBJECTIVES are met, and those read game state. A clock
 *    scrub cannot produce a single point of progress.
 *  - Forward into a future window: the player sees an event early. That is a
 *    shop window, and this file is careful never to let one pay out twice.
 *
 * The one thing a clock scrub genuinely gains is seeing an event before its
 * date. The rolling budget in `rewards.ts` is what bounds the value of doing
 * that repeatedly, and it deliberately does not refund on a rewind.
 */
import type { LiveEventDefinition, LiveEventState } from './types';
import { parseInstant } from './validation';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The stable identity of one RUN of an event.
 *
 * `eventId@startsAt` rather than just `eventId`, so an event that runs again
 * next season is a new instance and legitimately claimable again, while
 * re-entering the same window - the most a clock scrub can achieve - finds the
 * id already in the ledger. Built from the raw `startsAt` string so it is
 * stable across timezones and formatting.
 */
export function instanceId(definition: Pick<LiveEventDefinition, 'id' | 'startsAt'>): string {
  return `${definition.id}@${definition.startsAt}`;
}

/** Window bounds in epoch ms, or null when the definition is unparseable. */
export function windowFor(
  definition: Pick<LiveEventDefinition, 'startsAt' | 'endsAt' | 'claimGraceDays'>,
): { startsAt: number; endsAt: number; claimUntil: number } | null {
  const startsAt = parseInstant(definition.startsAt);
  const endsAt = parseInstant(definition.endsAt);
  if (startsAt === null || endsAt === null || endsAt <= startsAt) return null;
  const graceDays =
    typeof definition.claimGraceDays === 'number' && Number.isFinite(definition.claimGraceDays)
      ? Math.max(0, definition.claimGraceDays)
      : 0;
  return { startsAt, endsAt, claimUntil: endsAt + graceDays * DAY_MS };
}

/** Milliseconds until the window closes. 0 once it has, or when unparseable. */
export function msRemaining(definition: LiveEventDefinition, nowMs: number): number {
  const window = windowFor(definition);
  if (!window || !Number.isFinite(nowMs)) return 0;
  return Math.max(0, window.endsAt - nowMs);
}

export interface LifecycleInput {
  definition: LiveEventDefinition;
  nowMs: number;
  /** All objectives met, evaluated against game state. */
  complete: boolean;
  /** This instance id is in the claim ledger. */
  claimed: boolean;
  /** The player passes `eligibility.ts`. */
  eligible: boolean;
}

/**
 * Resolve one event to a state.
 *
 * `claimed` is checked FIRST, before eligibility and before the window. Once a
 * reward has been taken, that fact outranks everything: an event whose window
 * has closed, or whose audience the player has aged out of, must still read as
 * `claimed` rather than flipping to `expired` or `unavailable`. Otherwise the
 * hub would tell a player they missed something they actually collected, and -
 * worse - a state machine that can leave `claimed` is one that can be argued
 * back into paying.
 */
export function resolveState(input: LifecycleInput): {
  state: LiveEventState;
  unavailableReason?: string;
} {
  const { definition, nowMs, complete, claimed, eligible } = input;

  if (claimed) return { state: 'claimed' };

  const window = windowFor(definition);
  if (!window) return { state: 'unavailable', unavailableReason: 'unparseable window' };
  if (!Number.isFinite(nowMs)) return { state: 'unavailable', unavailableReason: 'unreadable clock' };

  if (!eligible) return { state: 'unavailable', unavailableReason: 'not eligible' };

  if (nowMs < window.startsAt) return { state: 'upcoming' };

  if (nowMs < window.endsAt) {
    return { state: complete ? 'claimable' : 'active' };
  }

  // The window has closed. A COMPLETED event stays claimable through the grace
  // period; an incomplete one is over. Progress is not extended by the grace -
  // `complete` was already decided by objectives that stop being reachable the
  // moment the window shuts, because the hub stops offering the event.
  if (complete && nowMs < window.claimUntil) return { state: 'claimable' };

  return { state: 'expired' };
}

/** Whether a claim may be paid right now. The ONE predicate the claim path reads. */
export function isClaimable(state: LiveEventState): boolean {
  return state === 'claimable';
}

/**
 * Sort for the hub: what needs attention first.
 *
 * `claimable` leads because it is the one state with something to DO right now
 * and a deadline attached. Then explicit priority, then the soonest deadline.
 * Ending soonest last among the tie-breakers rather than first among the
 * sorts, because leading with a countdown on everything is how a hub starts
 * feeling like pressure rather than an offer (41).
 */
export function hubOrder(
  a: { state: LiveEventState; definition: LiveEventDefinition; msRemaining: number },
  b: { state: LiveEventState; definition: LiveEventDefinition; msRemaining: number },
): number {
  const rank = (state: LiveEventState): number =>
    state === 'claimable' ? 0 : state === 'active' ? 1 : state === 'upcoming' ? 2 : 3;
  const byState = rank(a.state) - rank(b.state);
  if (byState !== 0) return byState;

  const byPriority = (b.definition.priority ?? 0) - (a.definition.priority ?? 0);
  if (byPriority !== 0) return byPriority;

  const byDeadline = a.msRemaining - b.msRemaining;
  if (byDeadline !== 0) return byDeadline;

  // Ids as the final tie-break, so the hub's order is stable across renders
  // rather than depending on however the definitions happened to be merged.
  return a.definition.id.localeCompare(b.definition.id);
}
