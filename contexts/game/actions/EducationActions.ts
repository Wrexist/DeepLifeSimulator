/**
 * Education actions — enroll / withdraw / study / acknowledge campus event.
 *
 * Replaces the inline mutation pattern from the old EducationApp. Wires student
 * loans through the banking system (so they show up in BankApp + affect credit
 * score) instead of stashing them inside the Education object.
 */

import React from 'react';
import { GameState, Loan, Education } from '../types';
import { logger } from '@/utils/logger';
import {
  applyStudySession,
  enroll as enrollPure,
  pauseEducation as pausePure,
  withdraw as withdrawPure,
} from '@/lib/education/operations';
import { quoteScholarship } from '@/lib/education/scholarships';
import { highestGpa } from '@/lib/education/gpa';
import { calculatePeriodicPayment } from '@/lib/banking/amortization';
import { politicsAprReduction } from './LoanActions';

const log = logger.scope('EducationActions');

/** Standard student-loan term in weeks (10 years). */
const STUDENT_LOAN_TERM_WEEKS = 10 * 52;

/** Read politics' education perk effects. */
function politicsEducationPerks(state: GameState): {
  weeksReduction: number;
  costReduction: number;
  scholarshipAmount: number;
} {
  const careerLevel = (state as any).politics?.careerLevel ?? 0;
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

    const result = enrollPure(prev.educations ?? [], {
      templateId: spec.templateId,
      name: spec.name,
      description: spec.description,
      cost: spec.cost,
      duration: spec.duration,
      startedWeek: prev.weeksLived,
      weeksReduction: quote.weeksReductionFromPolitics,
    });

    log.info(
      `Enrolled in ${spec.name} (${spec.mode}). Tuition $${spec.cost}, scholarship $${quote.scholarship.totalUSD.toFixed(0)}, net $${netCost.toFixed(0)}.`
    );

    return {
      ...prev,
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
    return { ...prev, educations: pausePure(prev.educations ?? [], educationId, !ed.paused) };
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
