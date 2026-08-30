/**
 * The session-scoped funnel observer - what turns a stateless resolver into a
 * measurable funnel.
 *
 * WHY THIS FILE HAD TO EXIST. `resolveEvent` is pure and stateless: it reports
 * where an event stands right now and has no idea where it stood a moment ago.
 * But three of the seven funnel steps are TRANSITIONS - an objective became
 * met, the last objective became met, the window closed on an unclaimed event -
 * and a stateless resolver can emit none of them. Without this, the funnel
 * could only answer shown -> opened -> claimed, and the two questions live ops
 * actually turns on would both be unanswerable:
 *
 *   - How many players did the WORK and never got paid? That is
 *     `completed` minus `claimed`, and a gap there is a bug, not a preference -
 *     the same reason `purchase_succeeded` and `premium_activated` are separate.
 *   - How many had an event EXPIRE on them, and how far had they got? That is
 *     the biggest drop-off in any live-ops programme, and the hub deliberately
 *     hides expired events from the player, so nothing else would ever see one.
 *
 * WHY PER-SESSION AND NOT PERSISTED. The alternative is writing a marker into
 * the save on every transition, which puts a save write on a render path to
 * record telemetry. Per-session means an install that plays twice in a day
 * reports its expiries twice; the analysis counts DISTINCT INSTALLS per event
 * instance, which is the denominator that matters anyway. Bounded by the number
 * of events in the catalogue, so it cannot grow.
 *
 * NEVER CALLED FROM RENDER. Emitting from a `useMemo` body would be a side
 * effect during the render phase and would double-fire under StrictMode. The
 * one caller drives it from an effect.
 */
import {
  trackEventCompleted,
  trackEventExpired,
  trackEventProgressed,
} from './analytics';
import { instanceId } from './schedule';
import type { ResolvedLiveEvent } from './types';

/** Highest met-count seen this session, per instance. */
const metSeen = new Map<string, number>();
/** Instances already reported completed / expired this session. */
const completedSeen = new Set<string>();
const expiredSeen = new Set<string>();

/**
 * Observe one resolution pass and emit whatever transitioned.
 *
 * Takes the UNFILTERED list - the hub hides `expired` and `unavailable` from
 * the player, and passing the filtered list here is exactly how the expiry step
 * would go quiet again.
 *
 * `claimedInstanceIds` is passed rather than read, so this stays free of the
 * save's shape and testable without a `GameState`.
 */
export function observeLiveOpsFunnel(
  resolved: readonly ResolvedLiveEvent[],
  claimedInstanceIds: readonly string[],
  weeksThisLife: number,
): void {
  const claimed = new Set(claimedInstanceIds);

  for (const event of resolved) {
    const id = instanceId(event.definition);
    const total = event.objectives.length;
    if (total === 0) continue;
    const met = event.objectives.filter((o) => o.met).length;

    // Progress. Compared against the HIGH WATER MARK rather than the last
    // reading, because an objective the player can go backwards on (cash, which
    // is spent) would otherwise emit a progression event every time they
    // re-crossed the same bar - turning one player's indecision into a funnel
    // full of progress that never happened.
    const previous = metSeen.get(id);
    if (previous === undefined) {
      metSeen.set(id, met);
    } else if (met > previous) {
      metSeen.set(id, met);
      trackEventProgressed(event.definition, met, total);
    }

    if (event.complete && !completedSeen.has(id)) {
      completedSeen.add(id);
      trackEventCompleted(event.definition, weeksThisLife);
    }

    // Expiry is reported ONLY for an event the player could actually have
    // taken: unclaimed, and not one they were never eligible for. Counting an
    // expiry against someone the event was never offered to would make the
    // drop-off number meaningless - it would mostly measure the size of the
    // audience the event excluded.
    if (event.state === 'expired' && !claimed.has(id) && !expiredSeen.has(id)) {
      expiredSeen.add(id);
      trackEventExpired(event.definition, met, total);
    }
  }
}

/** Test hook. */
export function resetLiveOpsFunnel(): void {
  metSeen.clear();
  completedSeen.clear();
  expiredSeen.clear();
}
