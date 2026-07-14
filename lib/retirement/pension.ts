/**
 * Retirement mechanic — pure logic.
 *
 * Nothing here has side effects or touches React: every function takes a
 * GameState and returns a value or a new state. This is what the UI + weekly
 * tick call, and what the unit tests exercise directly.
 *
 * Money-safety: `retirePlayer` mints NO money — it only STORES the computed
 * `pensionWeekly`. That pension is paid out later, weekly, through the canonical
 * income path (computeWeeklyIncome → stats.money) in the game tick. The bank
 * mirror accounts (MIRRORED_ACCOUNT_IDS) are never touched here.
 */
import type { GameState, LifeMilestone } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { netWorth } from '@/lib/progress/achievements';
import { calculateFIRETracker } from '@/lib/statistics/fireTracker';
import {
  RETIREMENT_AGE,
  EARLY_RETIRE_MIN_AGE,
  PENSION_SALARY_FACTOR,
  FULL_PENSION_YEARS,
  MIN_PENSION_QUALIFY_WEEKS,
  SOCIAL_SECURITY_FLOOR,
  PENSION_WEEKLY_ABS_CAP,
  PENSION_BASE_SALARY_CAP,
} from './constants';

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && isFinite(v) ? v : fallback;

/** Player age in whole years (floored). Defaults to 18 for malformed state. */
export function getAge(state: GameState): number {
  return Math.floor(num(state?.date?.age, 18));
}

/** True once the player is at/over the standard retirement age (elder surface gate). */
export function isElder(state: GameState): boolean {
  return getAge(state) >= RETIREMENT_AGE;
}

/** True when this life has retired (missing flag ⇒ still working). */
export function isRetired(state: GameState): boolean {
  return state?.isRetired === true;
}

export interface RetirementEligibility {
  canRetire: boolean;
  /** Machine-readable reason when `canRetire` is false. */
  reason: 'ok' | 'already-retired' | 'too-young' | 'not-eligible';
  age: number;
  netWorth: number;
  /** The FIRE number (25× estimated annual expenses) that unlocks early retirement. */
  fireNumber: number;
  /** True when the early (financial-independence) path is what qualifies them. */
  viaFinancialIndependence: boolean;
}

/**
 * Can the player retire right now?
 *   • Age ≥ 65  → always eligible.
 *   • Age ≥ 45 AND net worth ≥ FIRE number → early (financial-independence) retirement.
 * Already-retired lives are never eligible again (one-way latch, anti-farm).
 */
export function getRetirementEligibility(state: GameState): RetirementEligibility {
  const age = getAge(state);
  const nw = Math.max(0, num(netWorth(state)));
  let fireNumber = 0;
  try {
    fireNumber = Math.max(0, num(calculateFIRETracker(state).fireNumber));
  } catch {
    fireNumber = 0;
  }

  if (isRetired(state)) {
    return { canRetire: false, reason: 'already-retired', age, netWorth: nw, fireNumber, viaFinancialIndependence: false };
  }

  const atRetirementAge = age >= RETIREMENT_AGE;
  const financiallyIndependent = age >= EARLY_RETIRE_MIN_AGE && fireNumber > 0 && nw >= fireNumber;

  if (atRetirementAge || financiallyIndependent) {
    return {
      canRetire: true,
      reason: 'ok',
      age,
      netWorth: nw,
      fireNumber,
      viaFinancialIndependence: !atRetirementAge && financiallyIndependent,
    };
  }

  // Not old enough, and either not rich enough or below the early-retire age floor.
  const reason: RetirementEligibility['reason'] = age < EARLY_RETIRE_MIN_AGE ? 'too-young' : 'not-eligible';
  return { canRetire: false, reason, age, netWorth: nw, fireNumber, viaFinancialIndependence: false };
}

export interface PensionBreakdown {
  /** Final rounded weekly pension (what gets paid out). */
  weekly: number;
  /** Weekly salary base used (highest salary ever earned, sanity-capped). */
  baseWeeklySalary: number;
  /** Years of real work history. */
  yearsWorked: number;
  /** 0–1 pro-rata fraction from years worked vs FULL_PENSION_YEARS. */
  serviceFraction: number;
  /** True when the universal floor (not the pro-rata amount) set the figure. */
  floored: boolean;
}

/**
 * Compute the weekly pension from REAL work history:
 *   pension = clamp( highestWeeklySalary × 0.6 × min(1, yearsWorked / 35) )
 * with a universal floor for anyone who worked ≥ 1 year, and a hard absolute cap.
 *
 * Reads `lifetimeStatistics.highestSalary` (weekly $ in live play) and
 * `lifetimeStatistics.totalWeeksWorked`. Both are accumulated only from weeks
 * actually worked, so the pension cannot be farmed — it reflects the career.
 */
export function computePension(state: GameState): PensionBreakdown {
  const ls = state?.lifetimeStatistics;
  const rawHighest = Math.max(0, num(ls?.highestSalary));
  const baseWeeklySalary = Math.min(rawHighest, PENSION_BASE_SALARY_CAP);

  const totalWeeksWorked = Math.max(0, num(ls?.totalWeeksWorked));
  const yearsWorked = totalWeeksWorked / WEEKS_PER_YEAR;
  const serviceFraction = Math.max(0, Math.min(1, yearsWorked / FULL_PENSION_YEARS));

  let weekly = baseWeeklySalary * PENSION_SALARY_FACTOR * serviceFraction;

  // Universal floor — only for people who genuinely worked (≥ a year).
  let floored = false;
  if (totalWeeksWorked >= MIN_PENSION_QUALIFY_WEEKS && weekly < SOCIAL_SECURITY_FLOOR) {
    weekly = SOCIAL_SECURITY_FLOOR;
    floored = true;
  }

  // Hard absolute cap (final anti-runaway safety) + never above 60% of peak salary.
  weekly = Math.min(weekly, PENSION_WEEKLY_ABS_CAP, baseWeeklySalary * PENSION_SALARY_FACTOR || PENSION_WEEKLY_ABS_CAP);
  // The floor may legitimately exceed 60%-of-peak for a tiny salary; re-apply it
  // AFTER the salary-fraction cap so a genuine worker still clears the floor.
  if (floored) weekly = Math.max(weekly, Math.min(SOCIAL_SECURITY_FLOOR, PENSION_WEEKLY_ABS_CAP));

  weekly = Math.max(0, Math.round(weekly));
  return { weekly, baseWeeklySalary, yearsWorked, serviceFraction, floored };
}

/**
 * Weekly retirement income actually credited this tick. 0 for a working life;
 * the frozen `pensionWeekly` once retired (falls back to a fresh computation if
 * an older retired save somehow lacks the stored figure). Always ≥ 0 & finite.
 */
export function getRetirementIncomeWeekly(state: GameState): number {
  if (!isRetired(state)) return 0;
  const stored = num(state?.pensionWeekly, NaN);
  const weekly = isFinite(stored) ? stored : computePension(state).weekly;
  return Math.max(0, Math.round(num(weekly)));
}

export interface RetireResult {
  ok: boolean;
  reason: RetirementEligibility['reason'];
  /** New state (unchanged when `ok` is false). */
  state: GameState;
  /** The pension locked in (0 when the attempt was rejected). */
  pensionWeekly: number;
}

/**
 * Retire the player (pure reducer). Idempotent + anti-farm: a no-op that returns
 * the SAME state reference when already retired or ineligible, so it cannot be
 * used to re-roll the pension. On success it:
 *   • computes + freezes `pensionWeekly` from real work history,
 *   • ends career work (clears currentJob, resets that career, closes the open
 *     careerHistory entry) — same semantics as quitting,
 *   • stamps `isRetired / retiredAtAge / retiredAtWeek` and seeds elderActivity,
 *   • records a 'retirement' LifeMilestone.
 * Mints no money.
 */
export function retirePlayer(state: GameState): RetireResult {
  const elig = getRetirementEligibility(state);
  if (!elig.canRetire) {
    return { ok: false, reason: elig.reason, state, pensionWeekly: 0 };
  }

  const pension = computePension(state).weekly;
  const retiredAtWeek = Math.max(0, num(state.weeksLived));
  const retiredAtAge = getAge(state);
  const priorJob = state.currentJob;

  // End career work — mirror quitJob: reset the accepted career so no salary or
  // work penalty is applied afterwards (applyCareerSalaryAndPenalty returns 0
  // once currentJob is cleared).
  // Reset the job just left AND cancel any pending (applied-but-not-yet-accepted)
  // application. Without the latter, the weekly auto-accept would hand a retired
  // player a job 1-2 weeks later, stacking salary on top of the frozen pension
  // and silently un-retiring them.
  const updatedCareers = (state.careers || []).map((c) => {
    if (!c) return c;
    if (priorJob && c.id === priorJob) return { ...c, accepted: false, applied: false, progress: 0 };
    if (c.applied && !c.accepted) return { ...c, applied: false, applicationWeeksPending: undefined };
    return c;
  });

  // Close the open careerHistory entry for the job just left (same as quitJob).
  let updatedLifetimeStatistics = state.lifetimeStatistics;
  if (priorJob && state.lifetimeStatistics?.careerHistory?.length) {
    const history = state.lifetimeStatistics.careerHistory;
    let lastOpenIdx = -1;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].job === priorJob && history[i].endWeek === undefined) {
        lastOpenIdx = i;
        break;
      }
    }
    if (lastOpenIdx !== -1) {
      const updated = [...history];
      const entry = updated[lastOpenIdx];
      updated[lastOpenIdx] = {
        ...entry,
        endWeek: retiredAtWeek,
        weeks: Math.max(0, retiredAtWeek - entry.startWeek),
      };
      updatedLifetimeStatistics = { ...state.lifetimeStatistics, careerHistory: updated };
    }
  }

  const milestone: LifeMilestone = {
    id: `retirement-${retiredAtWeek}`,
    type: 'retirement',
    week: num(state.date?.week, 1),
    year: num(state.date?.year, 2025),
    details: { age: retiredAtAge, pensionWeekly: pension },
  };

  const newState: GameState = {
    ...state,
    currentJob: undefined,
    careers: updatedCareers,
    lifetimeStatistics: updatedLifetimeStatistics,
    isRetired: true,
    retiredAtAge,
    retiredAtWeek,
    pensionWeekly: pension,
    elderActivity: state.elderActivity ?? { lastUsedWeek: {}, totalActivities: 0 },
    lifeMilestones: [...(state.lifeMilestones ?? []), milestone],
  };

  return { ok: true, reason: 'ok', state: newState, pensionWeekly: pension };
}
