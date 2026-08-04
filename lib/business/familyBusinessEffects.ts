/**
 * What a family business's Brand and Reputation actually do.
 *
 * C-2. `manageFamilyBusiness` charges $10,000–$50,000 for three actions that
 * raise `brandValue` and `reputation`. `brandValue` was rendered as a meter in
 * `CompanyDetailScreen` and read by NOTHING else; `reputation` was read by
 * nothing at all. The player paid real money to move two bars that changed no
 * outcome.
 *
 * The owner's call was to wire them rather than remove them, reusing the shape
 * `hustleLogic` already uses for regular companies — brand drives money,
 * reputation drives how much scrutiny you draw.
 *
 * ── Why the curves start neutral ──────────────────────────────────────────
 *
 * `createFamilyBusiness` seeds `brandValue: 0` and `reputation: 50`. Both
 * mappings below are therefore built so an untouched business lands on exactly
 * 1.0 — no existing save's income or scandal rate moves until the player
 * spends on it. Brand is pure upside for the same reason: a business at brand
 * 0 is the default state, not a failing one, and taxing it would be a stealth
 * nerf dressed as a bug fix.
 */

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

/** A finite, in-range reading of a stored 0-100 meter. */
const meter = (raw: number | undefined, fallback: number): number =>
  typeof raw === 'number' && Number.isFinite(raw) ? clamp(raw, 0, 100) : fallback;

/** Income multiplier at brand 100. Brand 0 is neutral (1.0). */
export const MAX_BRAND_INCOME_BONUS = 0.25;

/**
 * How much a family business's brand lifts its weekly income.
 *
 * Linear from 1.0 at brand 0 to 1.25 at brand 100. The three manage actions
 * grant +5 / +15 brand, so a full run from 0 to 100 costs roughly $350k-$1m
 * and returns 25% more income forever — worth doing, not a must-do.
 */
export function familyBrandIncomeMultiplier(brandValue: number | undefined): number {
  return 1 + (meter(brandValue, 0) / 100) * MAX_BRAND_INCOME_BONUS;
}

/** Scandal-chance multiplier at reputation 0 and 100. 50 is neutral (1.0). */
export const MAX_REPUTATION_SCANDAL_RELIEF = 0.4;
export const MAX_REPUTATION_SCANDAL_PENALTY = 0.4;

/**
 * How much a family business's reputation moves its scandal odds.
 *
 * 1.4x at reputation 0, 1.0x at the starting 50, 0.6x at 100. Multiplies the
 * chance `scandalSpawnChance` already computes from brand and size rather than
 * replacing it, so the existing size gate and cooldown still do their work.
 *
 * Deliberately bounded well away from 0: reputation must not buy immunity, or
 * the scandal system — and the resolution UI built for it — stops existing for
 * anyone who invests.
 */
export function familyReputationScandalMultiplier(reputation: number | undefined): number {
  const rep = meter(reputation, 50);
  if (rep >= 50) {
    return 1 - ((rep - 50) / 50) * MAX_REPUTATION_SCANDAL_RELIEF;
  }
  return 1 + ((50 - rep) / 50) * MAX_REPUTATION_SCANDAL_PENALTY;
}

/** The stored shape both helpers read, kept local so this module stays pure. */
export interface FamilyBusinessMeters {
  companyId: string;
  brandValue: number;
  reputation: number;
}

/** The family-business record for a company id, if it is one. */
export function findFamilyBusiness(
  familyBusinesses: readonly FamilyBusinessMeters[] | undefined | null,
  companyId: string | undefined,
): FamilyBusinessMeters | undefined {
  if (!companyId || !Array.isArray(familyBusinesses)) return undefined;
  return familyBusinesses.find((fb) => fb && fb.companyId === companyId);
}
