import { ADULTHOOD_AGE, WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

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

/**
 * Weeks elapsed since THIS life began, from the two raw counters.
 *
 * The primitive behind `weeksInThisLife` (`lib/progress/lifeChapters.ts`), which
 * is the form to reach for when you hold a `GameState`. This one exists for the
 * call sites that only have the two numbers — components subscribing through
 * `useGameSelector`, where pulling the whole state object in to answer an
 * arithmetic question would re-subscribe the component to everything.
 *
 * Why it is needed at all: `weeksLived` is ABSOLUTE and seeded from the starting
 * age (`computeWeeksLived` = `(age - 18) * 52`), so an age-25 character begins at
 * 364. Comparing it to a small number asks "is this character more than N weeks
 * past 18", which is already true on frame one for every scenario that does not
 * start at 18 — see CLAUDE.md §4.2.
 *
 * `lifeStartWeek` (v43) is absent on older saves; 0 there keeps exactly the
 * behaviour those saves already have.
 */
export function weeksSinceLifeStart(
  weeksLived: unknown,
  lifeStartWeek: unknown
): number {
  // Strict typeof: a corrupt counter (including a numeric STRING from a
  // hand-edited save) resolves to week zero, which errs toward the quieter,
  // more-protected first session.
  const now = weeksLived;
  if (typeof now !== 'number' || !Number.isFinite(now) || now < 0) return 0;
  const start = lifeStartWeek;
  if (typeof start !== 'number' || !Number.isFinite(start) || start < 0) return now;
  return Math.max(0, now - start);
}

/**
 * Age in whole years, derived from the ABSOLUTE `weeksLived` counter.
 *
 * The primitive behind `getAge` (`lib/progress/lifeChapters.ts`), which is the
 * form to reach for when you hold a `GameState`. This one exists for the call
 * sites that only have a week number — notably the story generator, which asks
 * "how old was the player when this happened?" of a HISTORICAL `weeksLived`
 * stamped on an event, where there is no state to read an age off at all.
 *
 * The inverse of `computeWeeksLived` (`lib/config/gameConstants.ts`), which
 * seeds the counter as `(startingAge - 18) * 52` at the start of every life —
 * onboarding (`gameStateBuilder`) and BOTH prestige paths, each of which resets
 * `weeksLived` to `computeWeeksLived(newAge)` rather than letting it run on. So
 * `18 + weeksLived / 52` is the player's age in every life, heirs included, and
 * no `lifeStartWeek` term is needed: `lifeStartWeek` is stamped to the same
 * value, making `startingAge + weeksInThisLife / 52` algebraically identical.
 */
export function ageFromWeeksLived(weeksLived: unknown): number {
  const weeks = weeksLived;
  if (typeof weeks !== 'number' || !Number.isFinite(weeks) || weeks < 0) {
    return ADULTHOOD_AGE;
  }
  return Math.floor(ADULTHOOD_AGE + weeks / WEEKS_PER_YEAR);
}
