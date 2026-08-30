/**
 * Technical-health telemetry — the failures that are logged but never counted.
 *
 * THE GAP. Save failures, save repairs and slow cold starts all produce good
 * log lines today. A log line is visible on one device with a cable attached;
 * it says nothing about how often the failure happens across a population, on
 * which platform, or whether the release that just shipped made it worse. A
 * save failure is the worst outcome this app has — it is the player's entire
 * progress — and "how often" has never had a number.
 *
 * WHAT IS SENT, AND WHY SO LITTLE. A CATEGORY, never a message, never a path,
 * never a payload. Three reasons, and each is sufficient on its own. An error
 * message can quote the data it failed on, which here is a save file full of
 * the player's own choices. A message is high-cardinality free text, so it
 * fragments into a thousand one-row buckets and stops being countable. And the
 * category is what actually distinguishes the cases you would act on
 * differently: a full device is a UX problem, an unreadable payload is a bug in
 * our serialiser, and a rejected write is neither.
 *
 * NOT AN ALERTING SYSTEM. These are counts. Thresholds and alerts belong
 * downstream where the population is visible; a device cannot know whether its
 * own failure is one of ten or one of ten thousand, and a client-side alarm
 * would fire on every isolated incident (§38, alert fatigue).
 */
import { track } from './AnalyticsService';

/** The failure categories worth telling apart. */
export const SAVE_FAILURE_CATEGORIES = ['quota', 'corruption', 'permission', 'unknown'] as const;
export type SaveFailureCategory = (typeof SAVE_FAILURE_CATEGORIES)[number];

/**
 * Classify a thrown value into a category, reading ONLY the error's own name
 * and message and returning a fixed enum — the message itself never escapes
 * this function.
 *
 * Matching is substring-based and deliberately permissive: the same underlying
 * condition surfaces as `QuotaExceededError` on one platform, "database or disk
 * is full" on another and "no space left on device" on a third, and a strict
 * matcher would file two of the three as `unknown` — which is the bucket that
 * tells you nothing.
 */
export function classifySaveFailure(error: unknown): SaveFailureCategory {
  let text = '';
  try {
    if (typeof error === 'string') text = error;
    else if (error && typeof error === 'object') {
      const e = error as { name?: unknown; message?: unknown; code?: unknown };
      text = [e.name, e.message, e.code].filter((v) => typeof v === 'string').join(' ');
    }
  } catch {
    return 'unknown';
  }
  const lower = text.toLowerCase();
  if (!lower) return 'unknown';

  if (
    lower.includes('quota') ||
    lower.includes('disk is full') ||
    lower.includes('no space') ||
    lower.includes('storage full') ||
    lower.includes('enospc')
  ) {
    return 'quota';
  }
  if (
    lower.includes('json') ||
    lower.includes('unexpected token') ||
    lower.includes('corrupt') ||
    lower.includes('malformed') ||
    lower.includes('checksum') ||
    lower.includes('crc')
  ) {
    return 'corruption';
  }
  if (lower.includes('permission') || lower.includes('denied') || lower.includes('eacces')) {
    return 'permission';
  }
  return 'unknown';
}

/**
 * Report a save that failed for good — after every retry was spent.
 *
 * Transient failures that a retry recovers are deliberately NOT reported: they
 * happen, they are handled, and counting them would bury the one case that
 * costs a player their progress under the noise of the cases that do not.
 */
export function trackSaveFailure(error: unknown, slot: number, attempts: number): void {
  track('save_failed', {
    category: classifySaveFailure(error),
    slot,
    attempts,
  });
}

/**
 * Report that a loaded save had to be repaired.
 *
 * The count of repairs, and how many distinct fields needed one — not WHICH
 * fields, which would be an unbounded column that changes every release. A rise
 * after a release is the signal: it means a migration is not doing its job, a
 * fact that otherwise surfaces weeks later as a support ticket about a feature
 * that quietly reset itself.
 */
export function trackSaveRepaired(repairCount: number, version?: number): void {
  track('save_repaired', {
    repairs: Number.isFinite(repairCount) ? Math.max(0, Math.trunc(repairCount)) : 0,
    ...(Number.isFinite(version) ? { saveVersion: version } : {}),
  });
}

/**
 * Cold-start duration, in milliseconds.
 *
 * The one performance number that gates every other metric in this system: a
 * player who never reaches the first frame cannot be retained, converted or
 * measured. Reported once per launch.
 *
 * Rejects a non-finite or negative duration rather than sending it. A clock
 * that moved between the two reads produces a nonsense figure, and a single
 * negative outlier in a mean is worse than a missing row.
 */
export function trackStartupDuration(ms: number): void {
  if (!Number.isFinite(ms) || ms < 0) return;
  track('app_startup', { durationMs: Math.round(ms) });
}
