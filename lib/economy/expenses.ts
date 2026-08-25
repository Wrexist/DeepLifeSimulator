import { GameState } from '@/contexts/game/types';
import { getUpgradeTier } from '@/lib/realEstate/housing';
import { computeHousingWellbeing } from '@/lib/realEstate/rentals';
import { calculateIncomeTax, PLAYER_RENT_RATE_WEEKLY } from '@/lib/economy/constants';
import { minerFleetWeeklyPowerCost } from '@/lib/economy/minerPower';
import { fleetWeeklyRunningCost } from '@/lib/vehicles/runningCosts';
import { getLifeSkillModifiers } from '@/lib/skillTrees/lifeSkillEffects';
import { getTotalLuxuryUpkeep } from '@/lib/luxury/operations';
import { PET_WEEKLY_FOOD_COST } from '@/lib/pets/lifecycle';
import { totalSubscriptionWeeklyCharge } from '@/lib/subscription/billing';
import { logger } from '@/utils/logger';

// Type guard helpers for Loan properties. Field-only intersections (not `Loan & ...`)
// so the FALSE branch doesn't narrow to `never` — Loan declares these fields
// as required, but at runtime corrupted save data can still violate that.
function hasLoanRemaining(loan: unknown): loan is { remaining: number } {
  return typeof loan === 'object' && loan !== null && 'remaining' in loan && typeof (loan as { remaining?: unknown }).remaining === 'number' && isFinite((loan as { remaining: number }).remaining) && (loan as { remaining: number }).remaining >= 0;
}

function hasLoanPrincipal(loan: unknown): loan is { principal: number } {
  return typeof loan === 'object' && loan !== null && 'principal' in loan && typeof (loan as { principal?: unknown }).principal === 'number' && isFinite((loan as { principal: number }).principal) && (loan as { principal: number }).principal >= 0;
}

function hasLoanWeeksRemaining(loan: unknown): loan is { weeksRemaining: number } {
  return typeof loan === 'object' && loan !== null && 'weeksRemaining' in loan && typeof (loan as { weeksRemaining?: unknown }).weeksRemaining === 'number' && isFinite((loan as { weeksRemaining: number }).weeksRemaining) && (loan as { weeksRemaining: number }).weeksRemaining > 0;
}

function hasLoanTermWeeks(loan: unknown): loan is { termWeeks: number } {
  return typeof loan === 'object' && loan !== null && 'termWeeks' in loan && typeof (loan as { termWeeks?: unknown }).termWeeks === 'number' && isFinite((loan as { termWeeks: number }).termWeeks) && (loan as { termWeeks: number }).termWeeks > 0;
}

export interface ExpenseBreakdown {
  upkeep: number;
  loans: number;
  miningPower: number;
  vehicles: number;
  dietPlans: number;
  rent: number;
  /** Student-loan payments, which the tick charges via education progression. */
  studentLoans: number;
  /** Weekly income tax. 0 unless a taxable income is supplied — see below. */
  incomeTax: number;
  /** Luxury & collectibles upkeep, charged by `applyLuxuryItems`. */
  luxury: number;
  /** Pet food, charged by `applyPets` at a flat rate per living pet. */
  pets: number;
  /** In-game subscription renewals, charged by `applySubscriptions`. */
  subscriptions: number;
}

interface LoanLike {
  weeklyPayment: number;
}

export function calcWeeklyExpenses(
  state: GameState & { loans?: LoanLike[] },
  /**
   * This week's taxable income, so the figure can include income tax.
   *
   * Passed in rather than derived here because the caller already knows it —
   * `IdentityCard` computes job, passive and partner income a few lines above —
   * and because a second income calculation living inside the EXPENSE function
   * is exactly the kind of duplicate that put the tenancy rent out of step in
   * the first place. Omit it and tax is simply 0, which is what every existing
   * caller gets.
   */
  taxableIncome?: number,
): { total: number; breakdown: ExpenseBreakdown } {
  // CRITICAL: Wrap entire function in try-catch to prevent crashes
  try {
    // CRITICAL: Validate realEstate array exists before reducing
    const realEstate = Array.isArray(state.realEstate) ? state.realEstate : [];
    const upkeep = realEstate.reduce((sum, p) => {
      // Only calculate upkeep for owned properties
      if (!p || !p.owned) return sum;
      
      // CRITICAL: Validate all property values before calculation
      const upgradeLevel = typeof p.upgradeLevel === 'number' && isFinite(p.upgradeLevel) && p.upgradeLevel >= 0 ? p.upgradeLevel : 0;
      const tier = getUpgradeTier(upgradeLevel) || getUpgradeTier(0);
      if (!tier) return sum; // Skip if tier lookup fails
      
      const propertyUpkeep = typeof p.upkeep === 'number' && isFinite(p.upkeep) && p.upkeep >= 0 ? p.upkeep : 0;
      const tierUpkeepBonus = typeof tier.upkeepBonus === 'number' && isFinite(tier.upkeepBonus) && tier.upkeepBonus >= 0 ? tier.upkeepBonus : 0;
      
      const totalUpkeep = propertyUpkeep + tierUpkeepBonus;
      if (isFinite(totalUpkeep) && totalUpkeep > 0) {
        return sum + totalUpkeep;
      }
      return sum;
    }, 0);
    const loans = Array.isArray(state.loans) ? state.loans : [];
    // BUG FIX: Calculate loan payments, but also ensure minimum payment for loans with zero weeklyPayment
    // For loans with 0 weeklyPayment (long terms), calculate minimum payment based on remaining debt
    const loanPayments = loans.reduce((sum, l) => {
      if (!l) return sum; // Skip invalid loans
      
      // CRITICAL: Validate weeklyPayment before using
      const weeklyPayment = typeof l.weeklyPayment === 'number' && isFinite(l.weeklyPayment) && l.weeklyPayment >= 0 ? l.weeklyPayment : 0;
      if (weeklyPayment > 0) {
        return sum + weeklyPayment;
      } else {
        // For loans with 0 weeklyPayment, calculate minimum payment to ensure debt is paid
        // Use remaining debt (or principal if remaining not set) divided by remaining weeks.
        // Guards are called as plain functions; the chained ternary used to narrow `l`
        // to `never` because Loan declares these fields as required, so we read the
        // fields directly through `unknown` casts after the guard returns true.
        const loanData = l as unknown;
        const remaining = hasLoanRemaining(loanData)
          ? loanData.remaining
          : (hasLoanPrincipal(loanData) ? loanData.principal : 0);
        if (remaining <= 0) return sum; // Skip fully paid or corrupted loans
        const weeksRemaining = hasLoanWeeksRemaining(loanData)
          ? loanData.weeksRemaining
          : (hasLoanTermWeeks(loanData) ? loanData.termWeeks : 520);

        // CRITICAL: Validate before division to prevent division by zero
        if (remaining > 0 && weeksRemaining > 0 && isFinite(remaining) && isFinite(weeksRemaining)) {
          // Minimum payment: at least 0.1% of remaining debt per week
          const minPayment = Math.max(remaining / weeksRemaining, remaining * 0.001);
          if (isFinite(minPayment) && minPayment > 0) {
            return sum + minPayment;
          }
        }
        return sum;
      }
    }, 0);
  
  // Mining power costs — WAREHOUSE rigs only (2026-08-25 economy audit).
  //
  // This block used to display company rigs at $0.20/unit/DAY and warehouse
  // rigs at $0.60/unit/wk — two rates the tick never charged (warehouse rigs
  // actually pay $0.40/unit/wk, deducted in-crypto by `applyMiningCryptos`;
  // company rigs paid NOTHING). Company power is now CHARGED — netted against
  // company mining income inside `calcWeeklyPassiveIncome` — so listing it
  // here again would double-count it in the player's ledger: the passive-income
  // figure they see is already net of it. The warehouse fleet stays listed
  // because its cost is deducted from mined crypto, not from the cash income
  // shown elsewhere, and it now shows the rate that is really charged
  // (`lib/economy/minerPower.ts`, flat-rate — power upgrades reduce the real
  // in-crypto deduction below this, so this is a slightly conservative bound).
  let miningPowerCosts = minerFleetWeeklyPowerCost(state.warehouse?.miners);
  // Final validation
  if (!isFinite(miningPowerCosts) || miningPowerCosts < 0) miningPowerCosts = 0;
  
    // Vehicle running costs — the SAME shared formula the tick charges
    // (`lib/vehicles/runningCosts.ts`: active vehicle full fuel, idle 25%).
    // This block used to add a weekly insurance line the tick never takes —
    // the premium is a 26-week TERM paid upfront in purchaseInsurance(), not a
    // recurring bill — so the panel overstated a garage owner's real weekly
    // spend while the tick (until 2026-08-25) charged full fuel on idle cars
    // the panel discounted. One formula now, both places.
    let vehicleCosts = fleetWeeklyRunningCost(state.vehicles, state.activeVehicleId);
    // Final validation
    if (!isFinite(vehicleCosts) || vehicleCosts < 0) vehicleCosts = 0;
  
    // Diet plan costs (weekly cost for active diet plan)
    let dietPlanCosts = 0;
    const activeDietPlan = (state.dietPlans || []).find(plan => plan && plan.active);
    if (activeDietPlan) {
      const weeklyCost = activeDietPlan.dailyCost * 7;
      if (isFinite(weeklyCost) && weeklyCost > 0) {
        dietPlanCosts = weeklyCost;
      }
    }
    // Final validation
    if (!isFinite(dietPlanCosts) || dietPlanCosts < 0) dietPlanCosts = 0;
    
    // Weekly rent for rented properties (not owned)
    let rentCosts = 0;
    const realEstateForRent = Array.isArray(state.realEstate) ? state.realEstate : [];
    realEstateForRent.forEach(property => {
      if (!property) return;
      // Check if property is rented (status === 'rented' and not owned)
      if ('status' in property && property.status === 'rented' && !property.owned) {
        const propertyPrice = typeof property.price === 'number' && isFinite(property.price) && property.price >= 0 ? property.price : 0;
        if (propertyPrice > 0) {
          const rent = Math.round(propertyPrice * PLAYER_RENT_RATE_WEEKLY);
          if (isFinite(rent) && rent > 0) {
            rentCosts += rent;
          }
        }
      }
    });

    // The v32 TENANCY, which the loop above cannot see. `state.rental` is
    // deliberately NOT an entry in `realEstate` (a tenancy is not a holding —
    // a synthetic entry there would make `calculateNetWorth` credit the
    // player with a home they do not own), so this function counted only the
    // pre-v32 shape and a renting player's largest recurring cost was missing
    // from the card entirely. The tick charges it every week — it is in
    // `weeklyBillsDue` via `housingWellbeing.rent` — and can evict for the
    // arrears, so the number on screen was understating a real, enforced bill
    // by $45-$950 a week.
    //
    // Read through `computeHousingWellbeing`, the SAME function the tick uses,
    // rather than looking the tier up again here. Two implementations of one
    // number is what produced this divergence; a second one would only move it.
    // It returns 0 when the player owns or is homeless, so this cannot double
    // count against the `upkeep` line above.
    const tenancyRent = computeHousingWellbeing(state).rent;
    if (typeof tenancyRent === 'number' && isFinite(tenancyRent) && tenancyRent > 0) {
      rentCosts += tenancyRent;
    }

    // Final validation
    if (!isFinite(rentCosts) || rentCosts < 0) rentCosts = 0;
    
    // Student-loan payments. `applyEducationProgression` charges
    // `min(weeklyPayment, remaining)` per education whose loan still has a
    // balance, so this mirrors that cap rather than the nominal payment — the
    // last instalment of a nearly-repaid loan is smaller than the sticker.
    let studentLoanCosts = 0;
    for (const edu of Array.isArray(state.educations) ? state.educations : []) {
      const loan = edu?.studentLoan;
      if (!loan) continue;
      const remaining = typeof loan.remaining === 'number' && isFinite(loan.remaining) ? loan.remaining : 0;
      const payment = typeof loan.weeklyPayment === 'number' && isFinite(loan.weeklyPayment) ? loan.weeklyPayment : 0;
      if (remaining > 0 && payment > 0) studentLoanCosts += Math.min(payment, remaining);
    }
    if (!isFinite(studentLoanCosts) || studentLoanCosts < 0) studentLoanCosts = 0;

    // Income tax, through the SAME `calculateIncomeTax` the week loop uses and
    // scaled by the same Tax Strategy life-skill multiplier. A projection, so
    // it moves with next week's income rather than reporting last week's bill.
    let incomeTaxCost = 0;
    if (typeof taxableIncome === 'number' && isFinite(taxableIncome) && taxableIncome > 0) {
      const taxMult = getLifeSkillModifiers(state)?.taxMult;
      const mult = typeof taxMult === 'number' && isFinite(taxMult) && taxMult >= 0 ? taxMult : 1;
      const owed = Math.round(calculateIncomeTax(taxableIncome) * mult);
      if (isFinite(owed) && owed > 0) incomeTaxCost = owed;
    }

    // Three costs the weekly tick charges that this panel did not report.
    //
    // "Weekly Expenses" answers "what will the week take", and the answer was a
    // subset of the bill — the same complaint the tax and student-loan lines
    // were added to fix, one layer further down. Each is computed by calling the
    // function the CHARGING subsystem calls, never by reimplementing its rules.
    //
    // Luxury is the big one by an order of magnitude: a full collection owes
    // $556,820/wk of upkeep (`applyLuxuryItems`), so the Cash Flow beneath this
    // was optimistic by more than a quarter of a million a week for a collector.
    // Its YIELD is likewise absent from the income side, and is added there
    // rather than netted off here — the two are separate lines in the tick.
    const luxuryCosts = getTotalLuxuryUpkeep(
      Array.isArray(state.luxuryItems) ? state.luxuryItems : [],
    );

    // `applyPets` charges a flat rate per LIVING pet; a dead pet eats nothing.
    const alivePets = (Array.isArray(state.pets) ? state.pets : []).filter(
      (pet) => pet && !pet.isDead,
    ).length;
    const petCosts = alivePets * PET_WEEKLY_FOOD_COST;

    // Billed against the week being processed, which is the week AFTER the one
    // the state is sitting on — matching `applySubscriptions`, so an annual
    // prepay lapsing this week is not reported as free.
    const nextWeeksLived = (typeof state.weeksLived === 'number' && isFinite(state.weeksLived)
      ? state.weeksLived
      : 0) + 1;
    const subscriptionCosts = totalSubscriptionWeeklyCharge(
      [state.socialMedia?.verifiedPro, state.sparkApp?.premium],
      nextWeeksLived,
    );

    // CRITICAL: Validate all components before summing to prevent NaN propagation
    const safeUpkeep = isFinite(upkeep) && upkeep >= 0 ? upkeep : 0;
    const safeLuxury = isFinite(luxuryCosts) && luxuryCosts >= 0 ? luxuryCosts : 0;
    const safePets = isFinite(petCosts) && petCosts >= 0 ? petCosts : 0;
    const safeSubscriptions = isFinite(subscriptionCosts) && subscriptionCosts >= 0 ? subscriptionCosts : 0;
    const safeLoanPayments = isFinite(loanPayments) && loanPayments >= 0 ? loanPayments : 0;
    const safeMiningPowerCosts = isFinite(miningPowerCosts) && miningPowerCosts >= 0 ? miningPowerCosts : 0;
    const safeVehicleCosts = isFinite(vehicleCosts) && vehicleCosts >= 0 ? vehicleCosts : 0;
    const safeDietPlanCosts = isFinite(dietPlanCosts) && dietPlanCosts >= 0 ? dietPlanCosts : 0;
    const safeRentCosts = isFinite(rentCosts) && rentCosts >= 0 ? rentCosts : 0;
    const safeStudentLoans = isFinite(studentLoanCosts) && studentLoanCosts >= 0 ? studentLoanCosts : 0;
    const safeIncomeTax = isFinite(incomeTaxCost) && incomeTaxCost >= 0 ? incomeTaxCost : 0;
    
    const total = safeUpkeep + safeLoanPayments + safeMiningPowerCosts + safeVehicleCosts
      + safeDietPlanCosts + safeRentCosts + safeStudentLoans + safeIncomeTax
      + safeLuxury + safePets + safeSubscriptions;
    
    // CRITICAL: Final validation - ensure total is always valid
    const safeTotal = isFinite(total) && total >= 0 ? total : 0;
    
    return { 
      total: safeTotal, 
      breakdown: { 
        upkeep: safeUpkeep, 
        loans: safeLoanPayments, 
        miningPower: safeMiningPowerCosts, 
        vehicles: safeVehicleCosts,
        dietPlans: safeDietPlanCosts,
        rent: safeRentCosts,
        studentLoans: safeStudentLoans,
        incomeTax: safeIncomeTax,
        luxury: safeLuxury,
        pets: safePets,
        subscriptions: safeSubscriptions,
      } 
    };
  } catch (error) {
    // CRITICAL: If any error occurs, return safe defaults to prevent crash
    logger.error('[calcWeeklyExpenses] Error calculating expenses:', error);
    return {
      total: 0,
      breakdown: {
        upkeep: 0,
        loans: 0,
        miningPower: 0,
        vehicles: 0,
        dietPlans: 0,
        rent: 0,
        studentLoans: 0,
        incomeTax: 0,
        luxury: 0,
        pets: 0,
        subscriptions: 0,
      },
    };
  }
}

export type { LoanLike as LoanLikeType };
