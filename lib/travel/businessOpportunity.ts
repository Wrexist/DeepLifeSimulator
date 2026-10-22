/**
 * What a travel business opportunity pays (LIFE-15, owner decision 2026-10-22).
 *
 * The weekly figure used to be `min(2000, destination.cost * 0.05)` against a
 * stake of `destination.cost * 2`: a 40-week payback at every destination,
 * risk-free and forever, i.e. ~130% a year. Every destination at once cost
 * ~$103k and paid ~$133k a year - stronger than stocks, savings or property.
 *
 * It now yields `BUSINESS_OPPORTUNITY_ANNUAL_YIELD` (20%) of the stake a year,
 * inside the 15-25% band the owner asked for and above the property/dividend
 * band only by the margin a one-off, illiquid stake deserves. Payback ~5 years.
 *
 * The figure is DERIVED from the stored `cost` at read time rather than read
 * from the stored `weeklyIncome`, so saves that already hold an opportunity
 * pay the new rate without a migration - `weeklyIncome` is a by-value copy
 * written at unlock, and trusting it would leave every existing stake on the
 * old 130% forever.
 */
import type { BusinessOpportunity } from '@/contexts/game/types';

export const BUSINESS_OPPORTUNITY_ANNUAL_YIELD = 0.2;
export const BUSINESS_OPPORTUNITY_STAKE_MULTIPLE = 2;
export const MAX_BUSINESS_OPPORTUNITY_WEEKLY_INCOME = 2000;

/** The stake an opportunity at a destination of this trip cost asks for. */
export function businessOpportunityCost(destinationCost: number): number {
  return Number.isFinite(destinationCost) && destinationCost > 0
    ? destinationCost * BUSINESS_OPPORTUNITY_STAKE_MULTIPLE
    : 0;
}

/** Weekly income for a stake of `cost`. */
export function businessOpportunityWeeklyIncomeFor(cost: number): number {
  if (!Number.isFinite(cost) || cost <= 0) return 0;
  return Math.min(
    MAX_BUSINESS_OPPORTUNITY_WEEKLY_INCOME,
    Math.round((cost * BUSINESS_OPPORTUNITY_ANNUAL_YIELD) / 52),
  );
}

/** Weekly income an opportunity pays (or would pay) - the one reader. */
export function businessOpportunityWeeklyIncome(
  opp: Pick<BusinessOpportunity, 'cost'> | null | undefined,
): number {
  return businessOpportunityWeeklyIncomeFor(opp?.cost ?? 0);
}
