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
import type { Career, GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { applyRaisePremium } from '@/lib/careers/raisePremium';
import { getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';
import {
  DEEP_LIFE_PLUS_INCOME_MULTIPLIER,
  hasDeepLifePlusEntitlement,
} from '@/lib/subscription/deepLifePlus';
import { getPoliticalWeeklySalary } from '@/lib/economy/passiveIncome';

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

// ── What payroll actually credits ───────────────────────────────────────────
/**
 * `weeklyCareerSalary` above answers "what does the ladder list for this rung",
 * normalized to a week. That is the right input for a DTI gate, and the wrong
 * number to show a player: it is not what lands in their account.
 *
 * `applyCareerSalaryAndPenalty` multiplies the listed figure by a stack —
 * negotiated raise premium, the Work Pay Boost gold upgrade, the workBoost IAP
 * perk, the Negotiation/Executive life skills, and the DeepLife+ income
 * multiplier — and every screen that showed a salary applied a DIFFERENT
 * subset of it:
 *
 *   promotion modal / CareerPathCard   raise premium only
 *   work tab job card                  nothing — the raw base
 *   Cash Flow "Job Income"             nothing — the raw base
 *
 * Reported as "unsure of what the income is, usually the case with every job,
 * conflicting numbers", with three screenshots of the same Surgical Director
 * reading $26K, $13000 and $13K. All three were computing the same quantity
 * independently, which is the same failure the raise premium itself had
 * (`lib/careers/raisePremium.ts`) and the company-income figure before it. Same
 * remedy: the arithmetic is exported once, payroll calls it too, and a reader
 * that disagrees with the paycheck stops being possible.
 */
/** Work Pay Boost — gold upgrade and IAP perk each stack multiplicatively. */
const WORK_BOOST_MULT = 1.5;

/**
 * Every salary multiplier that is a property of the PLAYER rather than of the
 * rung: boosts, perks, life skills, subscription. Applies identically to the
 * job they hold and to any job they might take, which is why it takes the
 * state and not a career.
 *
 * Never returns a non-finite or negative factor — this sits on the payroll
 * path, and a corrupt modifier must not be able to stop a week from ticking or
 * turn a paycheck into a charge.
 */
export function careerPayMultiplier(state: GameState): number {
  let mult = 1;
  if (state?.goldUpgrades?.work_boost) mult *= WORK_BOOST_MULT;
  if (state?.perks?.workBoost) mult *= WORK_BOOST_MULT;
  mult *= getLifeSkillModifiers(state).salaryMult;
  if (hasDeepLifePlusEntitlement(state?.settings)) mult *= DEEP_LIFE_PLUS_INCOME_MULTIPLIER;
  return Number.isFinite(mult) && mult > 0 ? mult : 1;
}

/** The minimum a career needs to expose for its pay to be resolved. */
type PayableCareer = Pick<Career, 'id' | 'levels' | 'raiseMultiplier'>;

/**
 * Weekly pay for one rung of one ladder, as payroll would pay it.
 *
 * Used for the rung the player HOLDS and for rungs they do not — a job listing
 * that advertises a number the player would not actually receive is the bug
 * this function exists to remove, and the boosts apply wherever they work.
 *
 * Political is the exception on BOTH counts. Its ladder is annual, so it is
 * divided down to a week here; and its money is paid by
 * `getPoliticalWeeklySalary` rather than by payroll, which applies no premium
 * and no boosts — so neither does this. Applying them would advertise a
 * President's pay as something office will not deposit, which is the same class
 * of bug in the other direction.
 */
export function paidWeeklySalaryForLevel(
  state: GameState,
  career: PayableCareer | null | undefined,
  levelIndex: number | undefined,
): number {
  if (!career?.levels?.length) return 0;
  const safeLevel = Math.max(0, Math.min(levelIndex ?? 0, career.levels.length - 1));
  const raw = career.levels[safeLevel]?.salary;
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0) return 0;

  if (isAnnualSalaryCareer(career.id)) {
    const weekly = raw / WEEKS_PER_YEAR;
    return Number.isFinite(weekly) && weekly > 0 ? Math.round(weekly) : 0;
  }

  const paid = applyRaisePremium(raw, career.raiseMultiplier) * careerPayMultiplier(state);
  return Number.isFinite(paid) && paid > 0 ? Math.round(paid) : 0;
}

/** Weekly job pay, split by which subsystem credits it. */
export interface PaidWeeklyJobPay {
  /**
   * Credited by the weekly career-salary path
   * (`applyCareerSalaryAndPenalty`). 0 while unemployed, jailed, or in office.
   */
  fromPayroll: number;
  /**
   * Credited by `calcWeeklyPassiveIncome` for holding political office —
   * political money deliberately does not flow through payroll. 0 otherwise.
   *
   * Split out rather than folded into the total because a caller that also
   * shows passive income has to net this out of it or count the same money
   * twice. The Cash Flow panel did exactly that, at 52x, because it read the
   * ANNUAL political ladder as a weekly figure on top of the passive line.
   */
  fromOffice: number;
  /** What the player earns from their job this week, counted once. */
  total: number;
}

/**
 * What this week's tick will actually credit for the player's job.
 *
 * Mirrors `applyCareerSalaryAndPenalty` exactly — including the withheld
 * paycheck while incarcerated — so a cash-flow projection built on it cannot
 * promise money the week loop will not pay.
 */
export function paidWeeklyCareerSalary(state: GameState): PaidWeeklyJobPay {
  const none: PaidWeeklyJobPay = { fromPayroll: 0, fromOffice: 0, total: 0 };
  if (!state?.currentJob) return none;

  // Office pay is reported as-is even while incarcerated, because that is what
  // the tick does: `calcWeeklyPassiveIncome` has no jail check and nothing
  // strips `politics.careerLevel` on arrest, so the money is still credited.
  // Whether it SHOULD be is a design question; reporting a number the tick will
  // not pay is a bug, and this function's job is to agree with the tick.
  if (isAnnualSalaryCareer(state.currentJob)) {
    const fromOffice = getPoliticalWeeklySalary(state);
    return { fromPayroll: 0, fromOffice, total: fromOffice };
  }

  // No earned income while incarcerated — payroll withholds the paycheck.
  if ((state.jailWeeks ?? 0) > 0) return none;

  const job = (state.careers ?? []).find((c) => c?.id === state.currentJob && c?.accepted);
  if (!job) return none;

  const fromPayroll = paidWeeklySalaryForLevel(state, job, job.level);
  return { fromPayroll, fromOffice: 0, total: fromPayroll };
}

/**
 * Top weekly pay on a ladder, as payroll would pay it — the paid twin of
 * `careerCeiling` (`lib/careers/jobMarket.ts`), which answers in listed base
 * pay. The work tab advertises this next to an entry wage ("Tops out $X/wk") to
 * make a low starting salary read as a bet, so it has to be denominated in the
 * same money as the wage beside it.
 */
export function paidCareerCeiling(
  state: GameState,
  career: PayableCareer | null | undefined,
): number {
  const levels = career?.levels;
  if (!Array.isArray(levels) || levels.length === 0) return 0;
  let best = 0;
  for (let i = 0; i < levels.length; i++) {
    best = Math.max(best, paidWeeklySalaryForLevel(state, career, i));
  }
  return best;
}
