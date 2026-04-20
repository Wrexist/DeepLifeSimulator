import { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export interface AchievementProgress {
  id: string;
  name: string;
  desc: string;
  unlockedAt?: number; 
}

export const ACHIEVEMENTS: AchievementProgress[] = [
  {
    id: 'first_million',
    name: 'First Million',
    desc: 'Reach a net worth of $1,000,000.',
  },
  {
    id: 'debt_free',
    name: 'Debt Free',
    desc: 'Have no outstanding debts.',
  },
  {
    id: 'healthy_lifestyle',
    name: 'Healthy Lifestyle',
    desc: 'Maintain 90+ health for 10 consecutive weeks.',
  },
  {
    id: 'social_star',
    name: 'Social Star',
    desc: 'Maintain 10 relationships with affection over 70.',
  },
  {
    id: 'politician_legend',
    name: 'Political Legend',
    desc: 'Reach the highest level in the politician career.',
  },
  {
    id: 'celebrity_icon',
    name: 'Celebrity Icon',
    desc: 'Reach the highest level in the celebrity career.',
  },
  {
    id: 'athletic_champion',
    name: 'Athletic Champion',
    desc: 'Reach the highest level in the athlete career.',
  },
];

const hasAchievement = (progress: AchievementProgress[], id: string): boolean =>
  progress.some(a => a.id === id);

// Memoization cache for net worth
interface NetWorthCacheKey {
  money: number;
  bank: number;
  stocks: any;
  realEstate: any;
  companies: any;
  loans: any;
  vehicles: any;
}

let lastCacheKey: NetWorthCacheKey | null = null;
let lastNetWorthValue: number = 0;

export const netWorth = (state: GameState): number => {
  const money = state.stats.money;
  const bank = state.bankSavings ?? 0;
  
  // Check if we can return cached value (fast path)
  if (lastCacheKey &&
      lastCacheKey.money === money &&
      lastCacheKey.bank === bank &&
      lastCacheKey.stocks === state.stocks &&
      lastCacheKey.realEstate === state.realEstate &&
      lastCacheKey.companies === state.companies &&
      lastCacheKey.loans === state.loans &&
      lastCacheKey.vehicles === state.vehicles) {
    return lastNetWorthValue;
  }

  // Calculate stock value from modern holdings structure
  // CRITICAL FIX: Add overflow protection for very large numbers
  //
  // SAFETY: This is safe because:
  // - All calculations check for overflow before and after operations
  // - Clamping to MAX_SAFE_INTEGER prevents integer overflow (which causes negative numbers)
  // - isFinite() checks catch NaN and Infinity values
  //
  // FRAGILE LOGIC WARNING:
  // - If a single holding exceeds MAX_SAFE_VALUE, the entire stockValue becomes MAX_SAFE_VALUE.
  //   This means one very large holding caps the total, which might not be intended.
  //   However, this is better than overflow causing negative values.
  // - The clamp happens per-holding AND per-total, which is redundant but safe.
  //
  // FUTURE BUG RISK:
  // - If holding.shares or holding.currentPrice are very large but their product is just under
  //   MAX_SAFE_VALUE, but total + value exceeds it, we clamp. This is correct but might cause
  //   net worth to be slightly inaccurate for ultra-rich players.
  // - If multiple holdings each approach MAX_SAFE_VALUE, total will be capped even if sum
  //   would be valid. This is acceptable as it prevents overflow.
  // - TODO: Consider using BigInt for net worth calculations if ultra-high precision is needed
  const MAX_SAFE_VALUE = Number.MAX_SAFE_INTEGER; // 2^53 - 1
  let stockValue = 0;
  if (state.stocks?.holdings) {
    stockValue = state.stocks.holdings.reduce((total, holding) => {
      const value = (holding.shares || 0) * (holding.currentPrice || 0);
      // Prevent overflow: if value would exceed safe limit, clamp it
      if (!isFinite(value) || value > MAX_SAFE_VALUE) {
        return MAX_SAFE_VALUE;
      }
      const newTotal = total + value;
      // Prevent total from exceeding safe limit
      return newTotal > MAX_SAFE_VALUE ? MAX_SAFE_VALUE : newTotal;
    }, 0);
  } else if (state.stocksOwned) {
    // Fallback for legacy data
    stockValue = Object.values(state.stocksOwned).reduce((a, b) => {
      const sum = a + (b || 0);
      return sum > MAX_SAFE_VALUE ? MAX_SAFE_VALUE : sum;
    }, 0);
  }

  // Calculate real estate value
  const realEstateValue = state.realEstate?.reduce((total, property) => {
    const value = (property.price || 0);
    const sum = total + value;
    return sum > MAX_SAFE_VALUE ? MAX_SAFE_VALUE : sum;
  }, 0) || 0;

  // Calculate companies value
  // CRITICAL FIX: Add overflow protection for weeklyIncome * 52
  const companyValue = state.companies?.reduce((total, company) => {
    const weeklyIncome = company.weeklyIncome || 0;
    const annualIncome = weeklyIncome * WEEKS_PER_YEAR;
    // Prevent overflow: if calculation would exceed safe limit, clamp it
    if (!isFinite(annualIncome) || annualIncome > MAX_SAFE_VALUE) {
      return MAX_SAFE_VALUE;
    }
    const sum = total + annualIncome;
    return sum > MAX_SAFE_VALUE ? MAX_SAFE_VALUE : sum;
  }, 0) || 0;

  // Calculate vehicle value (depreciated)
  let vehicleValue = 0;
  if (state.vehicles && Array.isArray(state.vehicles)) {
    state.vehicles.forEach(vehicle => {
      if (!vehicle) return; // Skip invalid vehicles
      
      // CRITICAL: Validate all vehicle values before calculation
      const price = typeof vehicle.price === 'number' && isFinite(vehicle.price) && vehicle.price >= 0 ? vehicle.price : 0;
      const condition = typeof vehicle.condition === 'number' && isFinite(vehicle.condition) && vehicle.condition >= 0 && vehicle.condition <= 100 ? vehicle.condition : 100;
      const mileage = typeof vehicle.mileage === 'number' && isFinite(vehicle.mileage) && vehicle.mileage >= 0 ? vehicle.mileage : 0;
      
      if (price > 0) {
        // Use same depreciation logic as sell price
        const baseSellPercent = 0.8;
        const conditionMultiplier = 0.2 + (condition / 100) * 0.8;
        const mileagePenalty = Math.min(0.3, mileage / 500000);
        const depreciatedValue = price * baseSellPercent * conditionMultiplier * (1 - mileagePenalty);
        
        // CRITICAL: Validate result before adding
        if (isFinite(depreciatedValue) && depreciatedValue > 0) {
          vehicleValue += Math.floor(depreciatedValue);
        }
      }
    });
  }
  // Final validation
  if (!isFinite(vehicleValue) || vehicleValue < 0) vehicleValue = 0;

  // Calculate loans (liabilities)
  const loansValue = state.loans?.reduce((total, loan) => {
    return total + (loan.principal || 0);
  }, 0) || 0;

  // CRITICAL FIX: Validate all components and prevent overflow in final calculation
  //
  // SAFETY: This is safe because:
  // - Each component is validated independently, preventing NaN/Infinity propagation
  // - Final sum is clamped to prevent overflow (both positive and negative)
  // - Negative net worth is allowed (debt > assets) but clamped to prevent extreme values
  //
  // FRAGILE LOGIC WARNING:
  // - If one component is MAX_SAFE_VALUE and others are positive, total will be clamped.
  //   This means net worth might be slightly inaccurate for ultra-rich players, but prevents
  //   overflow which would cause much worse issues (negative net worth, NaN, etc.).
  // - Negative net worth is clamped to -MAX_SAFE_VALUE, which is a very large debt.
  //   This is acceptable as it prevents integer underflow.
  //
  // FUTURE BUG RISK:
  // - If all components are valid but their sum exceeds MAX_SAFE_VALUE, total is clamped.
  //   This is correct but might cause prestige thresholds to fail for ultra-rich players.
  //   Consider: If net worth is clamped to MAX_SAFE_VALUE but should be higher, prestige
  //   system might not work correctly.
  // - If loansValue is very large (close to MAX_SAFE_VALUE), subtracting it from total
  //   might cause underflow. The clamp to -MAX_SAFE_VALUE prevents this.
  // - TODO: Consider logging when net worth is clamped, so we can track if this happens
  const safeMoney = isFinite(money) ? money : 0;
  const safeBank = isFinite(bank) ? bank : 0;
  const safeStockValue = isFinite(stockValue) ? stockValue : 0;
  const safeRealEstateValue = isFinite(realEstateValue) ? realEstateValue : 0;
  const safeCompanyValue = isFinite(companyValue) ? companyValue : 0;
  const safeVehicleValue = isFinite(vehicleValue) ? vehicleValue : 0;
  const safeLoansValue = isFinite(loansValue) ? loansValue : 0;
  
  const total = safeMoney + safeBank + safeStockValue + safeRealEstateValue + safeCompanyValue + safeVehicleValue - safeLoansValue;
  
  // CRITICAL FIX: Clamp final total to prevent overflow or negative corruption
  // Note: Negative net worth is allowed (debt > assets) but clamped to prevent extreme values
  const clampedTotal = isFinite(total) 
    ? Math.max(-MAX_SAFE_VALUE, Math.min(MAX_SAFE_VALUE, total))
    : 0;
  
  // Update cache
  lastCacheKey = {
    money,
    bank,
    stocks: state.stocks,
    realEstate: state.realEstate,
    companies: state.companies,
    loans: state.loans,
    vehicles: state.vehicles
  };
  lastNetWorthValue = clampedTotal;

  return clampedTotal;
};

/**
 * @deprecated Use the comprehensive achievement system from src/features/onboarding/achievementsData.ts
 * This function is kept for backward compatibility but now uses the unified system
 */
export const evaluateAchievements = (state: GameState): AchievementProgress[] => {
  // Import the comprehensive achievement system
  const { achievements } = require('@/src/features/onboarding/achievementsData');
  const claimed = new Set(state.claimedProgressAchievements || []);
  const legacyProgress = state.progress?.achievements ?? [];
  
  const unlocked: AchievementProgress[] = [];
  
  // Legacy achievement IDs that need to be checked
  const legacyIds = ['first_million', 'debt_free', 'healthy_lifestyle', 'social_star', 'politician_legend', 'celebrity_icon', 'athletic_champion'];
  
  legacyIds.forEach(id => {
    // Check if already claimed in new system
    if (claimed.has(id)) return;
    
    // Check if already in legacy progress
    if (hasAchievement(legacyProgress, id)) return;
    
    // Find achievement in comprehensive system
    const achievement = achievements.find((a: any) => a.id === id);
    if (!achievement) return;
    
    // Evaluate achievement
    let isUnlocked = false;
    if (achievement.progressSpec.kind === 'boolean') {
      isUnlocked = achievement.progressSpec.met(state);
    } else if (achievement.progressSpec.kind === 'counter') {
      const current = achievement.progressSpec.current(state);
      isUnlocked = current >= achievement.progressSpec.goal;
    }
    
    if (isUnlocked) {
      unlocked.push({
        id: achievement.id,
        name: achievement.title,
        desc: achievement.description,
      });
    }
  });
  
  return unlocked;
};
