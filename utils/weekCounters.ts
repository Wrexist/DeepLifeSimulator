import { WEEKS_PER_MONTH, WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

/**
 * Use absolute week for gameplay logic and fall back to legacy week values only
 * when older saves do not have weeksLived populated.
 */
export function resolveAbsoluteWeek(
  weeksLived: number | undefined,
  legacyWeek: number | undefined
): number {
  if (typeof weeksLived === 'number' && isFinite(weeksLived) && weeksLived >= 0) {
    return weeksLived;
  }
  if (typeof legacyWeek === 'number' && isFinite(legacyWeek) && legacyWeek >= 0) {
    return legacyWeek;
  }
  return 0;
}

/**
 * Convert legacy cyclical week markers (1-4) into absolute weeks so existing saves
 * remain valid after moving logic to weeksLived.
 */
export function normalizeStoredWeekToAbsolute(
  storedWeek: number | undefined,
  currentAbsoluteWeek: number,
  currentWeekOfMonth: number
): number {
  if (typeof storedWeek !== 'number' || !isFinite(storedWeek) || storedWeek < 0) {
    return 0;
  }

  const safeAbsoluteWeek = Math.max(0, Math.floor(currentAbsoluteWeek));
  const safeWeekOfMonth = Math.min(
    WEEKS_PER_MONTH,
    Math.max(1, Math.floor(currentWeekOfMonth || 1))
  );

  if (storedWeek <= WEEKS_PER_MONTH && safeAbsoluteWeek > WEEKS_PER_MONTH) {
    return Math.max(
      0,
      safeAbsoluteWeek - ((safeWeekOfMonth - storedWeek + WEEKS_PER_MONTH) % WEEKS_PER_MONTH)
    );
  }

  return Math.max(0, Math.floor(storedWeek));
}

export function getWeeksSinceStoredWeek(
  storedWeek: number | undefined,
  currentAbsoluteWeek: number,
  currentWeekOfMonth: number
): number {
  const normalized = normalizeStoredWeekToAbsolute(storedWeek, currentAbsoluteWeek, currentWeekOfMonth);
  return Math.max(0, currentAbsoluteWeek - normalized);
}

// ---------------------------------------------------------------------------
// Calendar — month and week-of-month from ONE source
// ---------------------------------------------------------------------------

/**
 * Resolve the display calendar for an absolute week.
 *
 * ── The bug this closes ───────────────────────────────────────────────────
 *
 * `gameConstants` carries BOTH `WEEKS_PER_MONTH = 4` and `WEEKS_PER_YEAR = 52`,
 * and 4 x 12 = 48. The weekly tick used each one for a different half of the
 * same calendar: the displayed week cycled on 4 (`(weeksLived % 4) + 1`) while
 * the month advanced on `52 / 12 = 4.333`. So they desynchronised immediately
 * and permanently:
 *
 *   weeksLived  4 -> week 1, months elapsed 0   (week counter reset, month did not)
 *   weeksLived  5 -> week 2, months elapsed 1   (month rolled mid-cycle)
 *   weeksLived 12 -> week 1, months elapsed 2
 *   weeksLived 13 -> week 2, months elapsed 3
 *
 * "Week 1" stopped meaning "first week of the month shown beside it" after the
 * very first month, and drifted a further step every third month.
 *
 * ── The fix ───────────────────────────────────────────────────────────────
 *
 * Derive both from the same divisor, in one function, so they cannot disagree.
 * The month boundary is authoritative; the week label is defined as "weeks
 * elapsed since this month began". That yields an occasional 5-week month, which
 * is CORRECT for a 52-week year and is what a real calendar does — three or four
 * months a year genuinely span five week-boundaries.
 *
 * `weekOfMonth` is clamped to 1..5. Callers that render a 4-dot strip (the HUD)
 * already clamp to 4 and keep working; a 5th week simply shows on the last dot.
 */
export interface ResolvedCalendar {
  /** 1-based month number, 1..12. */
  monthNumber: number;
  /** Whole months elapsed since the life began. */
  monthsElapsed: number;
  /** 1-based week within the current month, 1..5. */
  weekOfMonth: number;
}

/** Weeks per month implied by the year length — the single divisor for both. */
export const WEEKS_PER_MONTH_EXACT = WEEKS_PER_YEAR / 12;

export function resolveCalendar(absoluteWeek: number, startMonthNumber = 1): ResolvedCalendar {
  const weeks =
    typeof absoluteWeek === 'number' && isFinite(absoluteWeek) && absoluteWeek > 0
      ? Math.floor(absoluteWeek)
      : 0;
  const startMonth =
    typeof startMonthNumber === 'number' && isFinite(startMonthNumber)
      ? Math.min(12, Math.max(1, Math.floor(startMonthNumber)))
      : 1;

  const monthsElapsed = Math.floor(weeks / WEEKS_PER_MONTH_EXACT);
  // The week this month actually STARTED on, from the same divisor.
  //
  // `ceil`, not `floor`. Month m begins at the smallest week w where
  // `floor(w / 4.333) === m`, which is `ceil(m * 4.333)` — flooring it lands a
  // week early, so the label read 2 on the week the month turned over. That is
  // the identical off-by-one this function exists to eliminate, reintroduced one
  // line down; the boundary sweep below is what caught it.
  const monthStartWeek = Math.ceil(monthsElapsed * WEEKS_PER_MONTH_EXACT);
  const weeksIntoMonth = weeks - monthStartWeek;
  const weekOfMonth = Math.min(5, Math.max(1, weeksIntoMonth + 1));
  const monthNumber = (((startMonth - 1 + monthsElapsed) % 12) + 12) % 12 + 1;

  return { monthNumber, monthsElapsed, weekOfMonth };
}
