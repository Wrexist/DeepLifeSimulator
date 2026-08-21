/**
 * The player's WEEKLY salary from their current job.
 *
 * One implementation, because four screens had their own copy and all four were
 * wrong the same way.
 *
 * `Career.levels[].salary` is a WEEKLY figure for every ladder except
 * `political`, whose POLITICAL_CAREER levels are ANNUAL — 800 for a Local
 * Council Member up to 100,000 for a President. The repo states this in two
 * places: `lib/economy/passiveIncome.ts` divides by WEEKS_PER_YEAR with the
 * comment "salary is annual in POLITICAL_CAREER", and
 * `applyCareerSalaryAndPenalty` skips the political salary on the generic
 * weekly path precisely to avoid paying an annual figure every week.
 *
 * The four loan/mortgage/auto-finance screens read `levels[level].salary`
 * straight into the figure they hand the DTI gate as weekly income. Winning an
 * election sets `currentJob: 'political'` with the annual ladder attached, so
 * from that moment `exceedsDTI` saw a President's income as $100,000/week
 * instead of $1,923 — a 52x inflation of borrowing capacity, on a principal
 * field with no other ceiling. Combined with R3-M2's floored APR that approved
 * a ~$47M loan where ~$900k was intended, credited straight to `stats.money`.
 * 2026-07-31 audit round 3, R3-M3.
 */
import type { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

/**
 * Career ids whose `levels[].salary` is an ANNUAL figure.
 *
 * Kept as a set rather than a boolean on the career object because that object
 * is persisted in saves — an existing save's `political` entry carries no such
 * flag, so deriving from the id is the only thing that works for saves already
 * on disk.
 */
export const ANNUAL_SALARY_CAREER_IDS = new Set(['political']);

/** Whether this career id stores annual rather than weekly salaries. */
export function isAnnualSalaryCareer(careerId: string | undefined): boolean {
  return !!careerId && ANNUAL_SALARY_CAREER_IDS.has(careerId);
}

/**
 * Weekly salary from the accepted current job, 0 if unemployed.
 *
 * Always returns a finite, non-negative number: a corrupt `salary` or a `level`
 * out of range must not produce NaN, because `exceedsDTI` compares against it
 * and `NaN < x` is false — a NaN income would silently approve every loan.
 */
export function weeklyCareerSalary(state: Pick<GameState, 'careers' | 'currentJob'>): number {
  const job = (state.careers ?? []).find((c) => c?.id === state.currentJob && c?.accepted);
  if (!job?.levels?.length || job.level == null) return 0;

  const safeLevel = Math.max(0, Math.min(job.level, job.levels.length - 1));
  const raw = job.levels[safeLevel]?.salary;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 0;

  const weekly = isAnnualSalaryCareer(job.id) ? raw / WEEKS_PER_YEAR : raw;
  return Number.isFinite(weekly) && weekly > 0 ? Math.round(weekly) : 0;
}

/**
 * A career-level salary converted to the WEEKLY figure a player is actually
 * paid — for display.
 *
 * `weeklyCareerSalary` above answers "what does the player earn right now",
 * which needs `currentJob` and `accepted`. Screens ask a different question:
 * they hold a career and a rung (often one the player does not hold — a job
 * listing, the next promotion, a career they are browsing) and want to print a
 * number with `/wk` after it.
 *
 * Every one of those screens read `levels[level].salary` raw, so the political
 * ladder — the one ladder whose salaries are ANNUAL — was rendered as weekly
 * across the entire app. A President saw "$100,000/wk" on the Work tab and was
 * paid $1,923. The Politics app got it right (`PoliticalApp` divides), which is
 * how the same save showed two numbers 52x apart depending on which screen you
 * opened.
 *
 * Returns a finite, non-negative integer for any input, so a corrupt save
 * prints $0 rather than `NaN/wk`.
 */
export function displayWeeklySalary(
  careerId: string | undefined,
  rawSalary: number | undefined | null,
): number {
  if (typeof rawSalary !== 'number' || !Number.isFinite(rawSalary) || rawSalary <= 0) return 0;
  const weekly = isAnnualSalaryCareer(careerId) ? rawSalary / WEEKS_PER_YEAR : rawSalary;
  return Number.isFinite(weekly) && weekly > 0 ? Math.round(weekly) : 0;
}
