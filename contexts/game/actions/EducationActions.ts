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
import { politicsAprReduction } from './LoanActions';

const log = logger.scope('EducationActions');

/** Standard student-loan term in weeks (10 years). */
const STUDENT_LOAN_TERM_WEEKS = 10 * 52;

/**
 * ANTI-EXPLOIT: max player-driven `studyExtra` sessions per program per week.
 * Each session advances the degree by a full week, so this bounds how fast a
 * tuition-gated degree can be completed regardless of energy on hand.
 */
const MAX_STUDY_SESSIONS_PER_WEEK = 3;

/** Read politics' education perk effects. */
function politicsEducationPerks(state: GameState): {
  weeksReduction: number;
  costReduction: number;
  scholarshipAmount: number;
} {
  const careerLevel = state.politics?.careerLevel ?? 0;
  if (!careerLevel) return { weeksReduction: 0, costReduction: 0, scholarshipAmount: 0 };
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getCombinedPerkEffects } = require('@/lib/politics/perks');
    const effects = getCombinedPerkEffects(careerLevel);
    return {
      weeksReduction: Math.max(0, Math.floor(effects?.education?.weeksReduction ?? 0)),
      costReduction: Math.max(0, Math.min(1, effects?.education?.costReduction ?? 0)),
      scholarshipAmount: Math.max(0, effects?.education?.scholarshipAmount ?? 0),
    };
  } catch {
    return { weeksReduction: 0, costReduction: 0, scholarshipAmount: 0 };
  }
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
      const aprAdjustment = -politicsAprReduction(prev);
      const baseAPR = 0.06; // student loan baseline 6%
      const offeredAPR = Math.max(0.025, baseAPR + aprAdjustment);
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
