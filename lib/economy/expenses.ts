import { GameState } from '@/contexts/GameContext';
import { getUpgradeTier } from '@/lib/realEstate/housing';
import type { Loan } from '@/contexts/game/types';
import { PLAYER_RENT_RATE_WEEKLY } from '@/lib/economy/constants';
import { WEEKS_PER_MONTH } from '@/lib/config/gameConstants';

// Type guard helpers for Loan properties
function hasLoanRemaining(loan: Loan | unknown): loan is Loan & { remaining: number } {
  return typeof loan === 'object' && loan !== null && 'remaining' in loan && typeof (loan as { remaining?: unknown }).remaining === 'number' && isFinite((loan as { remaining: number }).remaining) && (loan as { remaining: number }).remaining >= 0;
}

function hasLoanPrincipal(loan: Loan | unknown): loan is Loan & { principal: number } {
  return typeof loan === 'object' && loan !== null && 'principal' in loan && typeof (loan as { principal?: unknown }).principal === 'number' && isFinite((loan as { principal: number }).principal) && (loan as { principal: number }).principal >= 0;
}

function hasLoanWeeksRemaining(loan: Loan | unknown): loan is Loan & { weeksRemaining: number } {
  return typeof loan === 'object' && loan !== null && 'weeksRemaining' in loan && typeof (loan as { weeksRemaining?: unknown }).weeksRemaining === 'number' && isFinite((loan as { weeksRemaining: number }).weeksRemaining) && (loan as { weeksRemaining: number }).weeksRemaining > 0;
}

function hasLoanTermWeeks(loan: Loan | unknown): loan is Loan & { termWeeks: number } {
  return typeof loan === 'object' && loan !== null && 'termWeeks' in loan && typeof (loan as { termWeeks?: unknown }).termWeeks === 'number' && isFinite((loan as { termWeeks: number }).termWeeks) && (loan as { termWeeks: number }).termWeeks > 0;
}

export interface ExpenseBreakdown {
  upkeep: number;
  loans: number;
  miningPower: number;
  vehicles: number;
  dietPlans: number;
  rent: number;
}

interface LoanLike {
  weeklyPayment: number;
}

export function calcWeeklyExpenses(
  state: GameState & { loans?: LoanLike[] }
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
        // Use remaining debt (or principal if remaining not set) divided by remaining weeks
        const remaining = hasLoanRemaining(l) ? l.remaining : (hasLoanPrincipal(l) ? l.principal : 0);
        if (remaining <= 0) return sum; // Skip fully paid or corrupted loans
        const weeksRemaining = hasLoanWeeksRemaining(l) ? l.weeksRemaining : (hasLoanTermWeeks(l) ? l.termWeeks : 520);

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
  
  // Mining power costs
  let miningPowerCosts = 0;
  
  // Company miner power costs (monthly, averaged to weekly)
  const companyMinerPower: Record<string, number> = {
    basic: 10,
    advanced: 35,
    pro: 100,
    industrial: 250,
    quantum: 500,
  };
  
    (state.companies || []).forEach(company => {
      if (!company) return; // Skip invalid companies
      if (company.miners && Object.keys(company.miners).length > 0) {
        const totalPower = Object.entries(company.miners).reduce(
          (sum, [id, count]) => {
            const minerPower = companyMinerPower[id] || 0;
            const minerCount = typeof count === 'number' && isFinite(count) && count >= 0 ? count : 0;
            const power = minerPower * minerCount;
            if (isFinite(power) && power > 0) {
              return sum + power;
            }
            return sum;
          },
          0
        );
        if (totalPower > 0 && isFinite(totalPower)) {
          // ECONOMY FIX: Increased power costs by 67% to better balance mining profitability
          // Monthly bill: totalPower * 0.20 * 30, averaged to weekly (was 0.12, now 0.20)
          const monthlyBill = totalPower * 0.20 * 30;
          if (isFinite(monthlyBill) && monthlyBill > 0) {
            const weeklyBill = monthlyBill / WEEKS_PER_MONTH; // Average monthly cost to weekly
            if (isFinite(weeklyBill) && weeklyBill > 0) {
              miningPowerCosts += Math.round(weeklyBill);
            }
          }
        }
      }
    });
  
  // Warehouse miner power costs (weekly)
  const warehouseMinerPower: Record<string, number> = {
    basic: 10,
    advanced: 35,
    pro: 100,
    industrial: 250,
    quantum: 500,
    mega: 2000,
    giga: 5000,
    tera: 15000,
  };
  
    if (state.warehouse?.miners && Object.keys(state.warehouse.miners).length > 0) {
      const totalPower = Object.entries(state.warehouse.miners).reduce(
        (sum, [id, count]) => {
          const minerPower = warehouseMinerPower[id] || 0;
          const minerCount = typeof count === 'number' && isFinite(count) && count >= 0 ? count : 0;
          const power = minerPower * minerCount;
          if (isFinite(power) && power > 0) {
            return sum + power;
          }
          return sum;
        },
        0
      );
      if (totalPower > 0 && isFinite(totalPower)) {
        // ECONOMY FIX: Increased power costs by 50% to better balance mining profitability
        // Weekly power cost: $0.60 per power unit per week (was 0.40, now 0.60)
        const weeklyPowerCost = totalPower * 0.60;
        if (isFinite(weeklyPowerCost) && weeklyPowerCost > 0) {
          miningPowerCosts += Math.round(weeklyPowerCost);
        }
      }
    }
    // Final validation
    if (!isFinite(miningPowerCosts) || miningPowerCosts < 0) miningPowerCosts = 0;
  
    // Vehicle costs (maintenance, fuel, insurance)
    let vehicleCosts = 0;
    const vehicles = Array.isArray(state.vehicles) ? state.vehicles : [];
    if (vehicles.length > 0) {
      vehicles.forEach(vehicle => {
        if (!vehicle) return; // Skip invalid vehicles
        
        // Weekly maintenance cost (all vehicles)
        const maintenanceCost = typeof vehicle.weeklyMaintenanceCost === 'number' && isFinite(vehicle.weeklyMaintenanceCost) && vehicle.weeklyMaintenanceCost >= 0 ? vehicle.weeklyMaintenanceCost : 0;
        if (maintenanceCost > 0) {
          vehicleCosts += maintenanceCost;
        }
        
        // ANTI-EXPLOIT: Charge fuel for active vehicle, and a reduced storage/idle cost for all others
        // Prevents owning 100 vehicles with none active to avoid all fuel costs
        if (state.activeVehicleId === vehicle.id) {
          const fuelCost = typeof vehicle.weeklyFuelCost === 'number' && isFinite(vehicle.weeklyFuelCost) && vehicle.weeklyFuelCost >= 0 ? vehicle.weeklyFuelCost : 0;
          if (fuelCost > 0) {
            vehicleCosts += fuelCost;
          }
        } else {
          // Storage/idle cost: 25% of fuel cost for non-active vehicles
          const fuelCost = typeof vehicle.weeklyFuelCost === 'number' && isFinite(vehicle.weeklyFuelCost) && vehicle.weeklyFuelCost >= 0 ? vehicle.weeklyFuelCost : 0;
          if (fuelCost > 0) {
            vehicleCosts += Math.round(fuelCost * 0.25);
          }
        }
        
        // Insurance cost (monthly cost converted to weekly, only if active)
        if (vehicle.insurance?.active) {
          const monthlyCost = typeof vehicle.insurance.monthlyCost === 'number' && isFinite(vehicle.insurance.monthlyCost) && vehicle.insurance.monthlyCost >= 0 ? vehicle.insurance.monthlyCost : 0;
          if (monthlyCost > 0) {
            const weeklyInsuranceCost = monthlyCost / WEEKS_PER_MONTH; // Convert monthly to weekly
            if (isFinite(weeklyInsuranceCost) && weeklyInsuranceCost > 0) {
              vehicleCosts += weeklyInsuranceCost;
            }
          }
        }
      });
    }
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
    // Final validation
    if (!isFinite(rentCosts) || rentCosts < 0) rentCosts = 0;
    
    // CRITICAL: Validate all components before summing to prevent NaN propagation
    const safeUpkeep = isFinite(upkeep) && upkeep >= 0 ? upkeep : 0;
    const safeLoanPayments = isFinite(loanPayments) && loanPayments >= 0 ? loanPayments : 0;
    const safeMiningPowerCosts = isFinite(miningPowerCosts) && miningPowerCosts >= 0 ? miningPowerCosts : 0;
    const safeVehicleCosts = isFinite(vehicleCosts) && vehicleCosts >= 0 ? vehicleCosts : 0;
    const safeDietPlanCosts = isFinite(dietPlanCosts) && dietPlanCosts >= 0 ? dietPlanCosts : 0;
    const safeRentCosts = isFinite(rentCosts) && rentCosts >= 0 ? rentCosts : 0;
    
    const total = safeUpkeep + safeLoanPayments + safeMiningPowerCosts + safeVehicleCosts + safeDietPlanCosts + safeRentCosts;
    
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
      } 
    };
  } catch (error) {
    // CRITICAL: If any error occurs, return safe defaults to prevent crash
    const logger = require('@/utils/logger').logger;
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
      },
    };
  }
}

export type { LoanLike as LoanLikeType };
