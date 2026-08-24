/**
 * One guard for every weekly subsystem, so none can cost the player their week.
 *
 * ── Why this exists ───────────────────────────────────────────────────────
 *
 * `nextWeek()` runs ~37 `apply*` subsystems inside a single `setGameState`
 * updater wrapped in one outer try/catch. That outer catch returns `prevState`,
 * so ANY subsystem that throws does not degrade — it silently rolls back the
 * entire tick. The player taps "Next Week" and nothing happens: no error, no
 * advance, no income, no aging. A soft-lock that looks like an unresponsive
 * button. `CLAUDE.md` §4.3 names this and `tasks/lessons.md` records it five
 * times over, most recently `trackBudgetSpend` (2026-07-07).
 *
 * Most subsystems had picked up their own inline try/catch over time. Thirteen
 * had not: career salary, diet, career applications, career progress, education
 * stress, rent/housing, loan autopay, crime, mining (x2), economic events,
 * weekly events, and life moments.
 *
 * ── Why a helper rather than thirteen inline blocks ───────────────────────
 *
 * Because the failure mode here is FORGETTING, not mis-handling. Thirteen
 * hand-written try/catch blocks are thirteen chances to write a subtly different
 * fallback, and they do nothing to stop a fourteenth subsystem landing unguarded
 * next month — which is precisely how the previous twelve accumulated. One
 * named, one-line wrapper makes "guarded" the shortest thing to type and gives
 * the accompanying test a single symbol to assert coverage against.
 *
 * The fallback is passed by the CALLER, deliberately. There is no universally
 * safe neutral value for a subsystem's result, and a helper that invented one
 * would substitute a plausible wrong answer for a loud one.
 */
import { logger } from '@/utils/logger';

/**
 * Run one weekly subsystem. On a throw, log it and return `fallback` so the rest
 * of the tick completes.
 *
 * @param name     Subsystem label for the log line — make it greppable.
 * @param run      The subsystem call.
 * @param fallback The neutral result to use if it throws. Should represent
 *                 "this subsystem did nothing this week", never a guess at what
 *                 it would have done.
 */
export function guardTick<T>(name: string, run: () => T, fallback: T): T {
  try {
    return run();
  } catch (error) {
    // Not `logger.warn`. A subsystem throwing is a bug that now degrades
    // silently by design, which is exactly the kind of thing that stops being
    // noticed unless it is logged at the level someone actually reads.
    logger.error(`[WEEK TICK] Subsystem "${name}" threw - skipped for this week:`, error);
    return fallback;
  }
}
