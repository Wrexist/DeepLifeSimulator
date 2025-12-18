import { GameState } from '@/contexts/GameContext';
import { getUpgradeTier } from '@/lib/realEstate/housing';
import { calculateLifestyleCosts } from './lifestyle';

export interface ExpenseBreakdown {
  upkeep: number;
  loans: number;
  miningPower: number;
  vehicles: number;
  lifestyle: number;
}

interface LoanLike {
  weeklyPayment: number;
}

export function calcWeeklyExpenses(
  state: GameState & { loans?: LoanLike[] }
): { total: number; breakdown: ExpenseBreakdown } {
  const upkeep = state.realEstate.reduce((sum, p) => {
    // Only calculate upkeep for owned properties
    if (!p.owned) return sum;
    const upgradeLevel = p.upgradeLevel ?? 0;
    const tier = getUpgradeTier(upgradeLevel) || getUpgradeTier(0)!;
    return sum + (p.upkeep ?? 0) + tier.upkeepBonus;
  }, 0);
  const loans = state.loans ?? [];
  // BUG FIX: Calculate loan payments, but also ensure minimum payment for loans with zero weeklyPayment
  // For loans with 0 weeklyPayment (long terms), calculate minimum payment based on remaining debt
  const loanPayments = loans.reduce((sum, l) => {
    const weeklyPayment = l.weeklyPayment || 0;
    if (weeklyPayment > 0) {
      return sum + weeklyPayment;
    } else {
      // For loans with 0 weeklyPayment, calculate minimum payment to ensure debt is paid
      // Use remaining debt (or principal if remaining not set) divided by remaining weeks
      const remaining = (l as any).remaining ?? (l as any).principal ?? 0;
      const weeksRemaining = (l as any).weeksRemaining ?? (l as any).termWeeks ?? 520;
      if (remaining > 0 && weeksRemaining > 0) {
        // Minimum payment: at least 0.1% of remaining debt per week
        const minPayment = Math.max(remaining / weeksRemaining, remaining * 0.001);
        return sum + minPayment;
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
    if (company.miners && Object.keys(company.miners).length > 0) {
      const totalPower = Object.entries(company.miners).reduce(
        (sum, [id, count]) => sum + (companyMinerPower[id] || 0) * (count as number),
        0
      );
      if (totalPower > 0) {
        // ECONOMY FIX: Increased power costs by 67% to better balance mining profitability
        // Monthly bill: totalPower * 0.20 * 30, averaged to weekly (was 0.12, now 0.20)
        const monthlyBill = totalPower * 0.20 * 30;
        const weeklyBill = monthlyBill / 4; // Average monthly cost to weekly
        miningPowerCosts += Math.round(weeklyBill);
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
      (sum, [id, count]) => sum + (warehouseMinerPower[id] || 0) * (count as number),
      0
    );
    if (totalPower > 0) {
      // ECONOMY FIX: Increased power costs by 50% to better balance mining profitability
      // Weekly power cost: $0.60 per power unit per week (was 0.40, now 0.60)
      const weeklyPowerCost = totalPower * 0.60;
      miningPowerCosts += Math.round(weeklyPowerCost);
    }
  }
  
  // Vehicle costs (maintenance, fuel, insurance)
  let vehicleCosts = 0;
  if (state.vehicles && state.vehicles.length > 0) {
    state.vehicles.forEach(vehicle => {
      // Weekly maintenance cost (all vehicles)
      vehicleCosts += vehicle.weeklyMaintenanceCost || 0;
      
      // Weekly fuel cost (only for active vehicle)
      if (state.activeVehicleId === vehicle.id) {
        vehicleCosts += vehicle.weeklyFuelCost || 0;
      }
      
      // Insurance cost (monthly cost converted to weekly, only if active)
      if (vehicle.insurance?.active) {
        const weeklyInsuranceCost = (vehicle.insurance.monthlyCost || 0) / 4; // Convert monthly to weekly
        vehicleCosts += weeklyInsuranceCost;
      }
    });
  }
  
  // LIFESTYLE MAINTENANCE: Wealth requires ongoing lifestyle costs
  const lifestyleCosts = calculateLifestyleCosts(state);
  
  const total = upkeep + loanPayments + miningPowerCosts + vehicleCosts + lifestyleCosts;
  return { 
    total, 
    breakdown: { 
      upkeep, 
      loans: loanPayments, 
      miningPower: miningPowerCosts, 
      vehicles: vehicleCosts,
      lifestyle: lifestyleCosts,
    } 
  };
}

export type { LoanLike as LoanLikeType };
