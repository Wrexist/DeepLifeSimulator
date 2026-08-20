/**
 * Retention cohorts — turning a stream of events into D1/D7/D30.
 *
 * WHY THIS EXISTS. The funnel records that sessions happen; nothing recorded
 * WHEN, relative to install. Without an anchor there is no cohort, and without
 * a cohort "D7 retention" cannot be computed from the data at all — only
 * guessed at from raw session counts. This adds the one fact the whole
 * retention program is missing: how many days after install this session is.
 *
 * WHAT IS DERIVED ON DEVICE AND WHAT IS NOT. The device reports FACTS — the
 * day index, how many distinct days it has been seen, how many sessions. It
 * does NOT decide what "D7 retention" means, because the two common definitions
 * disagree:
 *
 *   classic day-N   — returned on day N exactly
 *   rolling N-day   — returned on day N or later
 *
 * Both are one query away from `dayIndex`, and neither can be recovered if the
 * device picks one and throws the other away. So the device emits the index and
 * the sink defines the metric. (The benchmarks in
 * `tasks/retention-and-content-strategy-2026-06-19.md` — D1 26%, D7 10% — are
 * classic day-N.)
 *
 * THE DEVICE CLOCK. `dayIndex` is wall-clock derived, and this repo has five
 * `STATE_VERSION` bumps that exist to close a device-clock exploit
 * (v28/v31/v35/v40/v44). None of that reasoning applies here, for one reason:
 * **nothing is paid out**. A retention index is an observation, not a reward,
 * so moving the clock buys the player nothing and there is no incentive to try.
 * What a moved clock DOES threaten is data quality, so:
 *
 *   - the index is MONOTONIC. A rewound clock cannot walk a cohort backwards;
 *     it re-reports the day it already reached.
 *   - `anchorEstimated` marks records whose install date could not be known
 *     (see below), so the sink can exclude them rather than average them in.
 *
 * PRE-EXISTING INSTALLS. There is no install timestamp in this app's history,
 * and none can be recovered. A player who installed months ago gets their
 * anchor set the first time this code runs, which would read as a brand-new
 * install and inflate the cohort. They are therefore flagged
 * `anchorEstimated: true` — permanently, for that install. **Only records with
 * `anchorEstimated: false` are valid for a retention curve.** That means the
 * curve starts accumulating from the release that ships this, not before, and
 * there is no honest way around it.
 *
 * WHERE IT IS STORED. AsyncStorage, NOT `GameState`. It is install-scoped: it
 * must survive prestige, death, a new life and a save-slot switch, none of
 * which are new installs. Putting it in the save would also make it a schema
 * change with a migration, for data that is not part of the game.
 */

/** One UTC day. */
const DAY_MS = 24 * 60 * 60 * 1000;

/** AsyncStorage key. Versioned so a future shape change is a new key, not a
 *  silent reinterpretation of the old one. */
export const RETENTION_COHORT_KEY = 'analytics_retention_cohort_v1';

/** The persisted record. Small and flat — it is written on every new day. */
export interface RetentionCohortRecord {
  /** Epoch ms of the install anchor. */
  firstSeenMs: number;
  /**
   * True when `firstSeenMs` is the first time this CODE ran rather than a real
   * install. Sticky for the life of the install. Exclude these from any
   * retention curve.
   */
  anchorEstimated: boolean;
  /** Highest day index ever reached. Monotonic — never decreases. */
  lastDayIndex: number;
  /** Distinct days on which a session was recorded. */
  daysSeen: number;
  /** Total sessions recorded. */
  sessions: number;
}

/** What one session start contributes, ready to attach to an event. */
export interface RetentionSnapshot {
  dayIndex: number;
  daysSeen: number;
  sessions: number;
  anchorEstimated: boolean;
  /** True when this session is the first on a NEW day index. */
  isNewDay: boolean;
}

/**
 * A fresh record for an install we are seeing for the first time.
 *
 * `anchorEstimated` is the caller's call, because only the caller knows whether
 * this is a genuinely new install or an existing player meeting this code for
 * the first time. `hasPriorHistory` is the signal: any save on disk means the
 * player predates this feature.
 */
export function createCohortRecord(nowMs: number, hasPriorHistory: boolean): RetentionCohortRecord {
  return {
    firstSeenMs: nowMs,
    anchorEstimated: hasPriorHistory,
    lastDayIndex: 0,
    daysSeen: 0,
    sessions: 0,
  };
}

/**
 * Days between the anchor and now, floored, never negative.
 *
 * Floor rather than round: day 0 must span the whole first 24 hours, or half of
 * an install's first day would report as D1 and every cohort would be wrong at
 * the point it matters most.
 */
export function rawDayIndex(record: RetentionCohortRecord, nowMs: number): number {
  if (!Number.isFinite(nowMs) || !Number.isFinite(record.firstSeenMs)) return 0;
  return Math.max(0, Math.floor((nowMs - record.firstSeenMs) / DAY_MS));
}

/**
 * Fold one session into the record and report what to attach to the event.
 *
 * Pure: takes a record, returns a NEW record plus the snapshot. Persisting is
 * the caller's job, which is what keeps this testable without AsyncStorage.
 */
export function recordSession(
  record: RetentionCohortRecord,
  nowMs: number,
): { next: RetentionCohortRecord; snapshot: RetentionSnapshot } {
  const raw = rawDayIndex(record, nowMs);
  // Monotonic. A rewound clock re-reports the day already reached rather than
  // walking the cohort backwards and manufacturing a second "day 3".
  const dayIndex = Math.max(raw, record.lastDayIndex);
  const isNewDay = dayIndex > record.lastDayIndex || record.sessions === 0;

  const next: RetentionCohortRecord = {
    ...record,
    lastDayIndex: dayIndex,
    daysSeen: isNewDay ? record.daysSeen + 1 : record.daysSeen,
    sessions: record.sessions + 1,
  };

  return {
    next,
    snapshot: {
      dayIndex,
      daysSeen: next.daysSeen,
      sessions: next.sessions,
      anchorEstimated: record.anchorEstimated,
      isNewDay,
    },
  };
}

/**
 * Parse a stored record, or null if it is absent or malformed.
 *
 * Strict on every field: a partially-written record would otherwise produce
 * NaN day indices that silently poison the cohort rather than failing loudly.
 * Returning null makes the caller create a fresh, correctly-flagged record.
 */
export function parseCohortRecord(raw: string | null | undefined): RetentionCohortRecord | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<RetentionCohortRecord>;
    if (
      !parsed ||
      typeof parsed.firstSeenMs !== 'number' ||
      !Number.isFinite(parsed.firstSeenMs) ||
      typeof parsed.lastDayIndex !== 'number' ||
      !Number.isFinite(parsed.lastDayIndex) ||
      typeof parsed.daysSeen !== 'number' ||
      !Number.isFinite(parsed.daysSeen) ||
      typeof parsed.sessions !== 'number' ||
      !Number.isFinite(parsed.sessions)
    ) {
      return null;
    }
    return {
      firstSeenMs: parsed.firstSeenMs,
      // A record written before this field existed cannot prove a real install
      // date, so absence reads as estimated — the conservative direction.
      anchorEstimated: parsed.anchorEstimated !== false,
      lastDayIndex: Math.max(0, parsed.lastDayIndex),
      daysSeen: Math.max(0, parsed.daysSeen),
      sessions: Math.max(0, parsed.sessions),
    };
  } catch {
    return null;
  }
}
