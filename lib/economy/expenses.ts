import { GameState } from '@/contexts/GameContext';
import { getUpgradeTier } from '@/lib/realEstate/housing';

export interface ExpenseBreakdown {
  upkeep: number;
  loans: number;
  miningPower: number;
  vehicles: number;
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
  const loanPayments = loans.reduce((sum, l) => sum + l.weeklyPayment, 0);
  
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
        // Monthly bill: totalPower * 0.12 * 30, averaged to weekly
        const monthlyBill = totalPower * 0.12 * 30;
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
      // Weekly power cost: $0.40 per power unit per week
      const weeklyPowerCost = totalPower * 0.40;
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
  
  const total = upkeep + loanPayments + miningPowerCosts + vehicleCosts;
  return { total, breakdown: { upkeep, loans: loanPayments, miningPower: miningPowerCosts, vehicles: vehicleCosts } };
}

export type { LoanLike as LoanLikeType };
