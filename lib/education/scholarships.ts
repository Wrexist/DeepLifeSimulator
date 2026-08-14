/**
 * Scholarships — pure helpers.
 *
 * Combines two sources of free money for education:
 *   1. Merit-based: GPA ≥ 3.5 unlocks academic scholarship covering a fraction of cost
 *   2. Politics-driven: state.politics scholarship policy effects add a flat amount
 *
 * The scholarship is granted at enrollment time (against tuition cost) and again
 * at each exam-week milestone if the player has maintained eligibility — modeled
 * here as a single `awardable` API the action layer wires up.
 */

import { clampGpa } from './gpa';

const safe = (n: number | undefined, fb = 0): number =>
  typeof n === 'number' && isFinite(n) ? n : fb;

export interface ScholarshipInputs {
  /** Player's best GPA across all educations (0..4). */
  bestGpa: number;
  /** Tuition cost of the program being considered. */
  tuitionCost: number;
  /** Politics-driven flat scholarship amount (USD). 0 when no policy active. */
  politicsScholarshipUSD?: number;
  /** Politics-driven cost reduction (0..1). */
  politicsCostReduction?: number;
  /**
   * A one-off tuition award the player has been granted and not yet spent —
   * today only the poverty scholarship event (`grant_free_education`).
   *
   * Separate from `politicsScholarshipUSD` because the two are consumed
   * differently: the politics figure is a standing policy effect that applies to
   * every enrolment while the policy is active, and this one is a credit that
   * is SPENT the moment it is used. Folding them into one number would make the
   * quote unable to tell the caller how much to deduct.
   */
  awardScholarshipUSD?: number;
}

export interface ScholarshipQuote {
  /** Total assistance applied (capped at tuition cost). */
  totalUSD: number;
  /** Net tuition the player still owes. */
  netCostUSD: number;
  /** Breakdown for UI display. */
  breakdown: {
    meritUSD: number;
    politicsUSD: number;
    politicsReductionUSD: number;
    /** The part of `totalUSD` that came from a one-off award. */
    awardUSD: number;
  };
  /** Eligibility band for display. */
  eligibility: 'none' | 'partial' | 'half' | 'full';
}

/** Merit scholarship rate as a function of GPA. */
export function meritRate(gpa: number): number {
  const g = clampGpa(gpa);
  if (g < 3.0) return 0;
  if (g < 3.3) return 0.10;
  if (g < 3.5) return 0.20;
  if (g < 3.7) return 0.35;
  if (g < 3.85) return 0.50;
  if (g < 4.0) return 0.65;
  return 0.80; // 4.0 → 80% covered
}

/**
 * Quote scholarship assistance for a given program.
 * Caller passes politicsScholarshipUSD and politicsCostReduction; we apply both.
 */
export function quoteScholarship(input: ScholarshipInputs): ScholarshipQuote {
  const tuition = Math.max(0, safe(input.tuitionCost));
  if (tuition === 0) {
    return {
      totalUSD: 0,
      netCostUSD: 0,
      breakdown: { meritUSD: 0, politicsUSD: 0, politicsReductionUSD: 0, awardUSD: 0 },
      eligibility: 'none',
    };
  }

  const rate = meritRate(input.bestGpa);
  const meritUSD = tuition * rate;
  const politicsReductionUSD = tuition * Math.max(0, Math.min(1, safe(input.politicsCostReduction)));
  const politicsUSD = Math.max(0, safe(input.politicsScholarshipUSD));
  const awardOffered = Math.max(0, safe(input.awardScholarshipUSD));

  const totalAssistance = Math.min(
    tuition,
    meritUSD + politicsUSD + politicsReductionUSD + awardOffered,
  );
  /**
   * How much of the award is actually SPENT here.
   *
   * Only the part still needed after merit and politics have been applied, and
   * never more than the tuition. A 4.0 student enrolling in a $12k certificate
   * already has 80% covered, so the award should give up the $2.4k that remains
   * and keep the rest for next time — charging the whole credit for a bill it
   * did not pay is the same class of defect as a reward that never arrives.
   */
  const awardUSD = Math.max(
    0,
    Math.min(awardOffered, tuition - Math.min(tuition, meritUSD + politicsUSD + politicsReductionUSD)),
  );
  const netCost = Math.max(0, tuition - totalAssistance);
  const coverageRatio = totalAssistance / tuition;

  let eligibility: ScholarshipQuote['eligibility'] = 'none';
  if (coverageRatio >= 0.99) eligibility = 'full';
  else if (coverageRatio >= 0.5) eligibility = 'half';
  else if (coverageRatio > 0) eligibility = 'partial';

  return {
    totalUSD: totalAssistance,
    netCostUSD: netCost,
    breakdown: {
      awardUSD,
      meritUSD,
      politicsUSD,
      politicsReductionUSD,
    },
    eligibility,
  };
}
