/**
 * Education actions — enroll / withdraw / study / acknowledge campus event.
 *
 * Replaces the inline mutation pattern from the old EducationApp. Wires student
 * loans through the banking system (so they show up in BankApp + affect credit
 * score) instead of stashing them inside the Education object.
 */

import React from 'react';
import { GameState, Loan } from '../types';
import { logger } from '@/utils/logger';
import {
  applyStudySession,
  enroll as enrollPure,
  pauseEducation as pausePure,
  setStudyGroup as setStudyGroupPure,
  withdraw as withdrawPure,
} from '@/lib/education/operations';
import { mapClassIdsToEnrolled, STUDY_GROUP_JOIN_COST } from '@/lib/education/educationSystem';
import { applyMoneyDelta } from './MoneyActions';
import { quoteScholarship } from '@/lib/education/scholarships';
import { getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';
import { highestGpa } from '@/lib/education/gpa';
import { calculatePeriodicPayment } from '@/lib/banking/amortization';
import { trackBudgetSpend } from '@/lib/banking/operations';
import { politicsAprReduction, POLITICS_LOAN_APR_FLOOR, debtProgress } from './LoanActions';

const log = logger.scope('EducationActions');

/** Standard student-loan term in weeks (10 years). */
const STUDENT_LOAN_TERM_WEEKS = 10 * 52;

/**
 * ANTI-EXPLOIT: max player-driven `studyExtra` sessions per program per week.
 * Each session advances the degree by a full week, so this bounds how fast a
 * tuition-gated degree can be completed regardless of energy on hand.
 */
const MAX_STUDY_SESSIONS_PER_WEEK = 3;

const NO_EDUCATION_PERKS = { weeksReduction: 0, costReduction: 0, scholarshipAmount: 0 };

/** Upper bounds for persisted education-policy effects (corrupt-save guards). */
const MAX_POLICY_WEEKS_REDUCTION = 26;
const MAX_POLICY_SCHOLARSHIP_USD = 500_000;

/**
 * Read politics' education effects — from the object that actually carries them.
 *
 * This used to call `getCombinedPerkEffects(careerLevel)` and read
 * `effects.education.*`. That object has exactly six keys — loanInterestReduction,
 * businessIncomeBonus, realEstateTaxBreak, socialMediaFollowerBonus,
 * unlockExclusiveOpportunities, governmentContracts — and `PoliticalPerk['effects']`
 * has no education member at all, so no perk could ever contribute one. Every
 * read was `undefined`, every value 0, for every player who has ever held office:
 * the "Politics fast-track −Nw" row in `EnrollModal` could not render, and
 * `quoteScholarship` was always called with a zero discount and zero scholarship.
 *
 * It type-checked only because the module came in through `require()`, which
 * degrades to `any` — the exact hazard CLAUDE.md §5 warns about. Hence the
 * static import now.
 *
 * The real numbers are aggregated into `politics.activePolicyEffects.education`
 * by `enactPolicy`, and nothing read them — the five education policies
 * (up to $200,000 each) bought an approval bump and nothing else.
 * 2026-07-30 audit GL-2 / GL-3.
 *
 * UNIT CONVERSION: policies express `costReduction` as a PERCENT clamped to 50
 * (`policies.ts:39`, "Percentage reduction (0-50%)"), while `quoteScholarship`
 * multiplies tuition by it as a FRACTION (`scholarships.ts:73`). Passing the raw
 * value would have discounted 20% tuition to zero.
 */
function politicsEducationPerks(state: GameState): {
  weeksReduction: number;
  costReduction: number;
  scholarshipAmount: number;
} {
  const education = state.politics?.activePolicyEffects?.education;
  if (!education) return { ...NO_EDUCATION_PERKS };

  // `Number(Infinity) || 0` is Infinity, so a malformed persisted value would
  // produce an instant degree or free tuition. Every field goes through a
  // finite check and a bound.
  const finite = (v: unknown, max: number): number => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0;
  };
  const pct = Number(education.costReduction);
  return {
    // No policy grants more than a handful of weeks; bound it well clear of a
    // full programme so a corrupt save cannot skip a degree.
    weeksReduction: Math.floor(finite(education.weeksReduction, MAX_POLICY_WEEKS_REDUCTION)),
    // percent -> fraction, then clamped to the same [0, 1] band as before.
    costReduction: Math.max(0, Math.min(1, (Number.isFinite(pct) ? pct : 0) / 100)),
    scholarshipAmount: finite(education.scholarshipAmount, MAX_POLICY_SCHOLARSHIP_USD),
  };
}

/**
 * Quote what enrolling in a program would cost, including scholarship + loan options.
 * Pure read; doesn't touch state.
 */
export function quoteEnrollment(
  state: GameState,
  template: { id: string; name: string; cost: number; duration: number }
): {
  cost: number;
  netCost: number;
  scholarship: ReturnType<typeof quoteScholarship>;
  /** Cash on hand. */
  cash: number;
  /** Can the player pay up-front? */
  canAffordCash: boolean;
  /** Suggested student-loan amount if they go that route. */
  suggestedLoanAmount: number;
  weeksReductionFromPolitics: number;
} {
  const cash = state.stats?.money ?? 0;
  const perks = politicsEducationPerks(state);
  const gpa = highestGpa(state.educations ?? []);
  const scholarship = quoteScholarship({
    bestGpa: gpa,
    tuitionCost: template.cost,
    politicsScholarshipUSD: perks.scholarshipAmount,
    politicsCostReduction: perks.costReduction,
  });
  return {
    cost: template.cost,
    netCost: scholarship.netCostUSD,
    scholarship,
    cash,
    canAffordCash: cash >= scholarship.netCostUSD,
    suggestedLoanAmount: scholarship.netCostUSD,
    weeksReductionFromPolitics: perks.weeksReduction,
  };
}

/**
 * Enroll in a program. Modes:
 *   - 'cash': pay netCost from stats.money
 *   - 'loan': accept a student loan (Loan type='personal') for the netCost,
 *             add it to gameState.loans, deposit principal into checking (or apply directly to tuition)
 *   - 'scholarship-covered': netCost is $0 — free ride
 */
export const enrollInProgram = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  spec: {
    templateId: string;
    name: string;
    description: string;
    cost: number;
    duration: number;
    mode: 'cash' | 'loan';
    /** Class ids chosen in the EnrollModal picker (mapped + capped at enrol). */
    classIds?: string[];
  }
) => {
  // P1-2: pre-roll the loan-id randomness outside the updater so React 19
  // StrictMode's double-invocation doesn't generate two different loan IDs.
  const loanIdSuffix = Math.floor(Math.random() * 1e6).toString(36);
  setGameState((prev) => {
    const quote = quoteEnrollment(prev, {
      id: spec.templateId,
      name: spec.name,
      cost: spec.cost,
      duration: spec.duration,
    });
    const cash = prev.stats?.money ?? 0;
    const netCost = quote.netCost;

    if (spec.mode === 'cash' && cash < netCost) {
      log.warn(`Enroll rejected: need $${netCost}, have $${cash}`);
      return prev;
    }

    // Build new loan if mode === 'loan' AND netCost > 0.
    let newLoans = prev.loans ?? [];
    if (spec.mode === 'loan' && netCost > 0) {
      const politicsReduction = politicsAprReduction(prev);
      const aprAdjustment = -politicsReduction;
      const baseAPR = 0.06; // student loan baseline 6%
      // R3-M2 completion: this site was missed. A student loan does not hand
      // the player cash, but it frees the cash that would have paid tuition —
      // so a 2.5% student loan funding a 5.5% CD is the same risk-free carry
      // the floor exists to close.
      const studentAprFloor = politicsReduction > 0 ? POLITICS_LOAN_APR_FLOOR : 0.025;
      const offeredAPR = Math.max(studentAprFloor, baseAPR + aprAdjustment);
      const weeklyPayment = calculatePeriodicPayment(netCost, offeredAPR, STUDENT_LOAN_TERM_WEEKS);
      const loan: Loan = {
        id: `loan-student-${prev.weeksLived}-${loanIdSuffix}`,
        name: `Student Loan: ${spec.name}`,
        principal: netCost,
        remaining: netCost,
        rateAPR: offeredAPR,
        originalAPR: offeredAPR,
        interestRate: offeredAPR,
        termWeeks: STUDENT_LOAN_TERM_WEEKS,
        weeksRemaining: STUDENT_LOAN_TERM_WEEKS,
        weeklyPayment,
        startWeek: prev.weeksLived,
        autoPay: true,
        type: 'personal', // Loan.type union has no 'student'; categorize as personal
        onTimePayments: 0,
        latePayments: 0,
      };
      newLoans = [...newLoans, loan];
      log.info(
        `Student loan: $${netCost.toLocaleString()} @ ${(offeredAPR * 100).toFixed(2)}% APR over ${STUDENT_LOAN_TERM_WEEKS}w`
      );
    }

    // Deduct cash if cash-mode and there's netCost. If loan-mode, no cash hit
    // (loan covers tuition directly).
    const newMoney = spec.mode === 'cash' ? Math.max(0, cash - netCost) : cash;

    // Budget tab: cash tuition is an education outflow. Loan-mode is NOT
    // recorded here — its weekly repayments are tracked as 'debt' instead.
    const banking =
      spec.mode === 'cash' && netCost > 0 && prev.banking?.budgetSpend
        ? trackBudgetSpend(prev.banking, prev.weeksLived, 'education', netCost)
        : prev.banking;

    // Map the chosen class ids -> concrete EducationClass[] (pure/deterministic,
    // filtered to this program + capped). Lights up exam difficulty, the
    // completion stat-bonus loop, and the detail "Classes" section.
    const classes = mapClassIdsToEnrolled(spec.templateId, spec.classIds ?? []);

    // Life Skills: Quick Learner (-10%) / Polymath (-15%) cut education time.
    // Applied at enrollment as a bounded reduction in program weeks (on top of
    // any political weeksReduction), so the fewer-weeks effect is deterministic.
    const eduTimeReductionPct = getLifeSkillModifiers(prev).educationTimeReductionPct;
    const safeDuration = typeof spec.duration === 'number' && isFinite(spec.duration) && spec.duration > 0 ? spec.duration : 0;
    const lifeSkillWeeksReduction = Math.floor(safeDuration * Math.max(0, Math.min(0.4, eduTimeReductionPct)));

    const result = enrollPure(prev.educations ?? [], {
      templateId: spec.templateId,
      name: spec.name,
      description: spec.description,
      cost: spec.cost,
      duration: spec.duration,
      startedWeek: prev.weeksLived,
      weeksReduction: quote.weeksReductionFromPolitics + lifeSkillWeeksReduction,
      classes,
    });

    log.info(
      `Enrolled in ${spec.name} (${spec.mode}). Tuition $${spec.cost}, scholarship $${quote.scholarship.totalUSD.toFixed(0)}, net $${netCost.toFixed(0)}.`
    );

    return {
      ...prev,
      banking,
      stats: { ...prev.stats, money: newMoney },
      educations: result.educations,
      loans: newLoans,
      // A student loan is debt. See `debtProgress`.
      ...debtProgress(prev, newLoans.length > (prev.loans ?? []).length),
    };
  });
};

export const withdrawFromProgram = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  educationId: string
) => {
  setGameState((prev) => ({
    ...prev,
    educations: withdrawPure(prev.educations ?? [], educationId),
  }));
};

export const togglePauseProgram = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  educationId: string
) => {
  setGameState((prev) => {
    const ed = (prev.educations ?? []).find((e) => e.id === educationId);
    if (!ed) return prev;
    const willPause = !ed.paused;
    let educations = pausePure(prev.educations ?? [], educationId, willPause);
    // BUG FIX: exam/campus cadence (educationSystem.isExamWeek /
    // shouldTriggerCampusEvent) gates on absolute `weeksLived`, but the cadence
    // anchors (lastExamWeek/lastCampusEventWeek) only advance on non-paused
    // ticks. Across a pause the delta keeps growing while `weeksLived` advances,
    // so on resume the delta is already >= the interval and an exam fires
    // immediately and stays perpetually due. Re-anchor the cadence to the
    // current week on resume so it restarts cleanly from when study resumes.
    if (!willPause) {
      const now = prev.weeksLived ?? 0;
      educations = educations.map((e) =>
        e.id === educationId
          ? { ...e, lastExamWeek: now, lastCampusEventWeek: now }
          : e,
      );
    }
    return { ...prev, educations };
  });
};

/**
 * Join / leave a course's study group. Joining charges a small one-time cost
 * (STUDY_GROUP_JOIN_COST) atomically via `applyMoneyDelta` — so a double-tap
 * debits once and an unaffordable join is rejected without flipping the flag.
 * Leaving is free (no refund). Only active (non-completed) programs qualify.
 *
 * Activating `studyGroupActive` is the missing writer that lets the already-wired
 * weekly bonus (+2 happiness / −3 energy) and the +15% exam pass boost occur.
 */
export const toggleStudyGroup = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  educationId: string
) => {
  setGameState((prev) => {
    const ed = (prev.educations ?? []).find((e) => e.id === educationId);
    if (!ed || ed.completed) {
      log.warn(`Study group toggle rejected: ${educationId} missing or completed`);
      return prev;
    }
    const willActivate = !ed.studyGroupActive;
    if (!willActivate) {
      // Leaving — free, no refund.
      return { ...prev, educations: setStudyGroupPure(prev.educations ?? [], educationId, false) };
    }
    // Joining — atomic charge; reject (leave flag off) if unaffordable.
    const spend = applyMoneyDelta(prev, -STUDY_GROUP_JOIN_COST, `Study group join: ${ed.name}`);
    if (!spend) {
      log.warn(`Study group join rejected: can't afford $${STUDY_GROUP_JOIN_COST}`);
      return prev;
    }
    log.info(`Joined study group for ${ed.name} (−$${STUDY_GROUP_JOIN_COST})`);
    return {
      ...prev,
      ...spend,
      educations: setStudyGroupPure(prev.educations ?? [], educationId, true),
    };
  });
};

/**
 * Player-driven study session: spend energy + happiness for an extra week of progress.
 */
export const studyExtra = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  educationId: string,
  energyCost: number = 15,
  happinessCost: number = 5
) => {
  setGameState((prev) => {
    const ed = (prev.educations ?? []).find((e) => e.id === educationId);
    if (!ed || ed.completed || ed.paused) return prev;
    // ANTI-EXPLOIT: cap player-driven study sessions per program per week. Each
    // call shaves a full week off the degree, so without this gate a player
    // could spam-study (or restore energy and continue) to finish a multi-year,
    // tuition-gated degree in a single week. Mirrors the per-job street-job cap.
    // Resets on week advance via `weeklyStudySessions: {}`.
    const sessionsThisWeek = prev.weeklyStudySessions?.[educationId] ?? 0;
    if (sessionsThisWeek >= MAX_STUDY_SESSIONS_PER_WEEK) {
      log.warn(`Study rejected: weekly cap (${MAX_STUDY_SESSIONS_PER_WEEK}) reached for ${educationId}`);
      return prev;
    }
    const stats = prev.stats ?? ({} as any);
    const energy = stats.energy ?? 0;
    if (energy < energyCost) {
      log.warn(`Study rejected: energy ${energy} < ${energyCost}`);
      return prev;
    }
    const happiness = stats.happiness ?? 0;
    return {
      ...prev,
      stats: {
        ...stats,
        energy: Math.max(0, energy - energyCost),
        happiness: Math.max(0, happiness - happinessCost),
      },
      weeklyStudySessions: {
        ...(prev.weeklyStudySessions ?? {}),
        [educationId]: sessionsThisWeek + 1,
      },
      educations: applyStudySession(prev.educations ?? [], educationId, 1),
    };
  });
};

/**
 * Acknowledge / resolve a campus event. Choice effects are applied by the
 * legacy modal in EducationApp; here we just clear the pending flag.
 */
export const clearCampusEvent = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>
) => {
  setGameState((prev) => ({ ...prev, pendingCampusEventEducationId: undefined }));
};

/**
 * Resolve a campus event with the player's chosen option: apply the choice's
 * stat effects (clamped 0–100), route money through the canonical
 * applyMoneyDelta path, and clear the pending flag — all in one atomic
 * setState so a double-tap can't apply the effects twice (the second call
 * sees the flag already cleared and no-ops).
 */
export const resolveCampusEventChoice = (
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  choice: {
    effects: Partial<Record<'happiness' | 'health' | 'energy' | 'reputation' | 'money', number>>;
  }
) => {
  setGameState((prev) => {
    if (!prev.pendingCampusEventEducationId) return prev; // already resolved
    const clamp = (n: number) => Math.max(0, Math.min(100, n));
    const stats = { ...prev.stats };
    for (const key of ['happiness', 'health', 'energy', 'reputation'] as const) {
      const delta = choice.effects[key];
      if (typeof delta === 'number' && isFinite(delta) && delta !== 0) {
        stats[key] = clamp((stats[key] ?? 0) + delta);
      }
    }
    let next: GameState = { ...prev, stats, pendingCampusEventEducationId: undefined };
    const money = choice.effects.money;
    if (typeof money === 'number' && isFinite(money) && money !== 0) {
      const moneyPatch = applyMoneyDelta(next, money, 'Campus event');
      // A rejected debit (can't afford) still resolves the event — campus
      // events are flavor, not a purchase gate.
      if (moneyPatch) next = { ...next, ...moneyPatch };
    }
    return next;
  });
};
