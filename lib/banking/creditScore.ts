/**
 * Credit score engine.
 *
 * FICO-inspired model. Pure functions — no game state mutation, no React.
 *
 * Components and weights:
 *   Payment history   35%
 *   Credit utilization 30%
 *   Account age       15%
 *   Credit mix        10%
 *   New inquiries     10%
 *
 * Each component is normalized to 0..100. The weighted average is then mapped
 * onto the FICO range 300..850.
 */

import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

const SCORE_MIN = 300;
const SCORE_MAX = 850;

const WEIGHTS = {
  paymentHistory: 0.35,
  utilization: 0.30,
  accountAge: 0.15,
  creditMix: 0.10,
  inquiries: 0.10,
} as const;

export type CreditBand = 'poor' | 'fair' | 'good' | 'veryGood' | 'excellent';

export interface CreditScoreInputs {
  /** Total successful on-time payments lifetime. */
  onTimePayments: number;
  /** Total missed/late payments lifetime. */
  latePayments: number;
  /** Sum of credit card balances. */
  totalCreditCardBalance: number;
  /** Sum of credit card limits. 0 if no cards. */
  totalCreditCardLimit: number;
  /** Average age of all accounts, in weeks. */
  averageAccountAgeWeeks: number;
  /** Number of distinct account types currently active (checking, savings, card, loan, mortgage). */
  distinctAccountTypes: number;
  /** Inquiries (loan/card applications) in the last 2 years. */
  recentInquiryCount: number;
  /** Whether the borrower has any open loan(s). Adds to credit mix. */
  hasOpenLoan: boolean;
  /** Whether there is an open mortgage. Adds to credit mix. */
  hasOpenMortgage: boolean;
}

export interface CreditScoreComponentBreakdown {
  paymentHistory: number;
  utilization: number;
  accountAge: number;
  creditMix: number;
  inquiries: number;
}

const safe = (n: number, fallback = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fallback;

function scorePaymentHistory(onTime: number, late: number): number {
  const onTimeSafe = Math.max(0, safe(onTime));
  const lateSafe = Math.max(0, safe(late));
  const total = onTimeSafe + lateSafe;
  if (total === 0) return 70; // no history yet — neutral-positive
  const ratio = onTimeSafe / total;
  // Late payments are heavily penalized: each late drops ~10 points off this component until floor.
  const ratioScore = ratio * 100;
  const latePenalty = Math.min(lateSafe * 5, 60);
  return Math.max(0, Math.min(100, ratioScore - latePenalty));
}

function scoreUtilization(balance: number, limit: number): number {
  const limitSafe = Math.max(0, safe(limit));
  if (limitSafe === 0) return 60; // no cards — neutral, not penalized
  const balanceSafe = Math.max(0, safe(balance));
  const util = balanceSafe / limitSafe;
  // Lower is better. 0% = 100, 10% = 95, 30% = 80, 60% = 50, 100%+ = 10.
  if (util <= 0.01) return 100;
  if (util <= 0.10) return 95;
  if (util <= 0.30) return 80;
  if (util <= 0.50) return 60;
  if (util <= 0.75) return 35;
  if (util <= 1.00) return 15;
  return 10;
}

function scoreAccountAge(averageAgeWeeks: number): number {
  const age = Math.max(0, safe(averageAgeWeeks));
  const ageYears = age / WEEKS_PER_YEAR;
  // 0y = 0, 1y = 30, 3y = 60, 7y = 85, 15y+ = 100.
  if (ageYears >= 15) return 100;
  if (ageYears >= 7) return 85;
  if (ageYears >= 3) return 60;
  if (ageYears >= 1) return 30;
  if (ageYears >= 0.25) return 15;
  return 0;
}

function scoreCreditMix(distinctTypes: number, hasLoan: boolean, hasMortgage: boolean): number {
  const types = Math.max(0, safe(distinctTypes));
  // Healthy mix: checking + savings + at least one card + at least one loan.
  // Mortgages count extra because they show long-term creditworthiness.
  let s = Math.min(60, types * 15);
  if (hasLoan) s += 15;
  if (hasMortgage) s += 25;
  return Math.max(0, Math.min(100, s));
}

function scoreInquiries(recentInquiryCount: number): number {
  const count = Math.max(0, safe(recentInquiryCount));
  // 0 = 100, 1 = 90, 2 = 75, 3 = 55, 4 = 35, 5+ = 15.
  if (count === 0) return 100;
  if (count === 1) return 90;
  if (count === 2) return 75;
  if (count === 3) return 55;
  if (count === 4) return 35;
  return 15;
}

export function computeCreditScore(inputs: CreditScoreInputs): {
  score: number;
  band: CreditBand;
  breakdown: CreditScoreComponentBreakdown;
} {
  const breakdown: CreditScoreComponentBreakdown = {
    paymentHistory: scorePaymentHistory(inputs.onTimePayments, inputs.latePayments),
    utilization: scoreUtilization(inputs.totalCreditCardBalance, inputs.totalCreditCardLimit),
    accountAge: scoreAccountAge(inputs.averageAccountAgeWeeks),
    creditMix: scoreCreditMix(inputs.distinctAccountTypes, inputs.hasOpenLoan, inputs.hasOpenMortgage),
    inquiries: scoreInquiries(inputs.recentInquiryCount),
  };

  const weighted =
    breakdown.paymentHistory * WEIGHTS.paymentHistory +
    breakdown.utilization * WEIGHTS.utilization +
    breakdown.accountAge * WEIGHTS.accountAge +
    breakdown.creditMix * WEIGHTS.creditMix +
    breakdown.inquiries * WEIGHTS.inquiries;

  // Map 0..100 weighted average into 300..850.
  const score = Math.round(SCORE_MIN + (weighted / 100) * (SCORE_MAX - SCORE_MIN));
  const clamped = Math.max(SCORE_MIN, Math.min(SCORE_MAX, score));

  return {
    score: clamped,
    band: scoreToBand(clamped),
    breakdown,
  };
}

export function scoreToBand(score: number): CreditBand {
  const s = safe(score, 650);
  if (s >= 800) return 'excellent';
  if (s >= 740) return 'veryGood';
  if (s >= 670) return 'good';
  if (s >= 580) return 'fair';
  return 'poor';
}

export function bandLabel(band: CreditBand): string {
  switch (band) {
    case 'excellent':
      return 'Excellent';
    case 'veryGood':
      return 'Very Good';
    case 'good':
      return 'Good';
    case 'fair':
      return 'Fair';
    case 'poor':
      return 'Poor';
  }
}
