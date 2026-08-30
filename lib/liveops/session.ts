/**
 * Session facts, captured ONCE at boot.
 *
 * WHY THESE CANNOT BE READ AT RENDER TIME. Both of them move.
 *
 * `daysAway` is derived from `lastLogin`, and that stamp is deliberately
 * rewritten during the session - `refreshSessionClock` on a short absence, and
 * `applyWelcomeBackBonus` when the return summary is dismissed. A returning-
 * player event that read it live would be eligible when the hub first rendered
 * and ineligible a tap later, which is worse than never appearing: the player
 * sees something, reaches for it, and it is gone.
 *
 * `installId` is loaded asynchronously by the analytics service and is an empty
 * string until then. A rollout decision made against the empty string buckets
 * differently from every decision made after boot, so an event would appear and
 * then vanish - the exact instability deterministic bucketing exists to prevent.
 *
 * So both are captured once, at the point the boot sequence knows them, and
 * every surface reads the same frozen answer for the life of the process.
 */

interface LiveOpsSession {
  installId: string;
  daysAway: number;
}

let session: LiveOpsSession = { installId: '', daysAway: 0 };

let captured = false;

/**
 * Capture the session's facts the FIRST time both are usable, then never again.
 *
 * Idempotent by design, and called from the read path rather than from boot.
 * The alternative - capturing in the boot sequence - cannot work, because
 * `lastLogin` lives in the save and the save has not hydrated when the service
 * tasks run. Capturing on first READ means the values are taken at the earliest
 * moment they are both knowable, which is also before any live-ops surface has
 * rendered anything.
 *
 * A call with an empty `installId` does NOT capture: an empty id buckets
 * differently from the real one, so freezing it would pin every staged rollout
 * to the wrong answer for the whole session. It waits instead.
 *
 * Non-finite or negative `daysAway` normalises to 0 rather than being rejected:
 * a clock that moved backwards produces a negative absence, and reading that as
 * "away for a long time" would hand a win-back event to a player who never
 * left. Zero is the conservative direction - at worst they do not see it.
 */
export function ensureLiveOpsSession(installId: string, daysAway: number): void {
  if (captured) return;
  if (typeof installId !== 'string' || !installId) return;
  captured = true;
  session = {
    installId,
    daysAway: Number.isFinite(daysAway) && daysAway > 0 ? Math.floor(daysAway) : 0,
  };
}

/** The frozen session facts. Safe before `beginLiveOpsSession` - both are inert. */
export function getLiveOpsSession(): LiveOpsSession {
  return session;
}

/** Days between two epoch stamps, floored, never negative. */
export function daysBetween(lastLoginMs: number | undefined, nowMs: number): number {
  if (!lastLoginMs || !Number.isFinite(lastLoginMs) || !Number.isFinite(nowMs)) return 0;
  const days = Math.floor((nowMs - lastLoginMs) / (24 * 60 * 60 * 1000));
  return days > 0 ? days : 0;
}

/** Test hook. */
export function resetLiveOpsSession(): void {
  session = { installId: '', daysAway: 0 };
  captured = false;
}
