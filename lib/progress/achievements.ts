import { GameState } from '@/contexts/game/types';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';
import { getTotalLuxuryMarketValue } from '@/lib/luxury';

export interface AchievementProgress {
  id: string;
  name: string;
  desc: string;
  unlockedAt?: number; 
}

/**
 * @deprecated Legacy 7-entry achievement catalog, superseded by the unified
 * system in `src/features/onboarding/achievementsData.ts`. Reduced to an empty
 * stub — its only remaining consumer was the no-op `checkAchievements` path.
 * TODO(flawless-audit): remove with checkAchievements.
 */
export const ACHIEVEMENTS: AchievementProgress[] = [];

// Memoization cache for net worth
interface NetWorthCacheKey {
  money: number;
  bank: number;
  stocks: any;
  realEstate: any;
  companies: any;
  loans: any;
  vehicles: any;
  luxury: any;
  /** Holdings drift weekly through appreciation WITHOUT the id list changing,
   *  so keying on `luxuryItems` alone would serve a stale net worth forever. */
  luxuryHoldings: any;
  /** R3-M4: crypto and the modern banking slice were absent entirely. */
  cryptos: any;
  banking: any;
}

let lastCacheKey: NetWorthCacheKey | null = null;
let lastNetWorthValue: number = 0;

export const netWorth = (state: GameState): number => {
  // BUGFIX: state.stats may be undefined for partial states from cloud
  // download, prestige resets, or onboarding flows. Direct access crashed
  // the leaderboard score calculator with TypeError.
  const money = state?.stats?.money ?? 0;
  const bank = state?.bankSavings ?? 0;
  
  // Check if we can return cached value (fast path)
  if (lastCacheKey &&
      lastCacheKey.money === money &&
      lastCacheKey.bank === bank &&
      lastCacheKey.stocks === state.stocks &&
      lastCacheKey.realEstate === state.realEstate &&
      lastCacheKey.companies === state.companies &&
      lastCacheKey.loans === state.loans &&
      lastCacheKey.vehicles === state.vehicles &&
      lastCacheKey.luxury === state.luxuryItems &&
      lastCacheKey.luxuryHoldings === state.luxuryHoldings &&
      lastCacheKey.cryptos === state.cryptos &&
      lastCacheKey.banking === state.banking) {
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

  // Calculate real estate value. Skip SOLD properties — sellProperty keeps the
  // entry with owned:false, so summing every property ever owned permanently
  // inflated net worth and let players farm the prestige gate/points. Test
  // `owned === false` (not `!owned`) so legacy entries lacking the flag still
  // count. Prefer the live currentValue over the original purchase price.
  const realEstateValue = state.realEstate?.reduce((total, property) => {
    if (property?.owned === false) return total;
    const value = (property?.currentValue ?? property?.price ?? 0);
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

  // Luxury & Collectibles value — resale fraction of owned trophies (a sink, not
  // an investment, so it counts less than sticker). Reads the APPRECIATED value
  // per holding, falling back to the catalog price when a holding has never
  // drifted — so an untouched collection is valued exactly as it always was.
  // Null-safe for old saves (absent luxuryItems → 0). Clamp for overflow parity.
  let luxuryValue = getTotalLuxuryMarketValue(state.luxuryItems, state.luxuryHoldings);
  if (!isFinite(luxuryValue) || luxuryValue < 0) luxuryValue = 0;
  if (luxuryValue > MAX_SAFE_VALUE) luxuryValue = MAX_SAFE_VALUE;

  // Calculate loans (liabilities). Use the outstanding balance (remaining), not
  // the fixed origination principal, so paying a loan down actually raises net
  // worth (loans are removed at payoff). Fall back to principal on legacy saves.
  const loansValue = state.loans?.reduce((total, loan) => {
    return total + (loan.remaining ?? loan.principal ?? 0);
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
  /**
   * R3-M4: crypto and the modern banking slice were missing from this sum
   * entirely — `grep crypto lib/progress/achievements.ts` returned nothing, and
   * `bank` was only the legacy `bankSavings` pool, deprecated since
   * STATE_VERSION 14 in favour of `banking.accounts`.
   *
   * So converting $1M of cash to Bitcoin DROPPED reported net worth by $1M, and
   * every coin the mining warehouse ever produced was worth $0 on the
   * scoreboard. Depositing into a high-yield savings account did the same. This
   * is the canonical figure: it gates prestige, the ultra-rich passive-income
   * soft cap, bail cost, ad-reward scaling, the identity card and the statistics
   * history — so a crypto-heavy or deposit-heavy player could be locked out of
   * prestige indefinitely, while also dodging the >$10M passive-income cap.
   */
  const cryptoValue = (state.cryptos ?? []).reduce((sum, coin) => {
    const owned = Number(coin?.owned);
    const price = Number(coin?.price);
    if (!isFinite(owned) || !isFinite(price) || owned <= 0 || price <= 0) return sum;
    return sum + owned * price;
  }, 0);

  const bankAccountsValue = (state.banking?.accounts ?? []).reduce((sum, account) => {
    const balance = Number(account?.balance);
    return isFinite(balance) ? sum + balance : sum;
  }, 0);

  /**
   * R3-M5: money parked in a savings goal is still the player's. It was
   * invisible here AND had no withdraw path, so contributing destroyed it
   * twice over — gone from the balance sheet and gone from the game. The
   * withdraw path now exists (`withdrawFromGoal`); this makes it count.
   */
  const savingsGoalsValue = (state.banking?.savingsGoals ?? []).reduce((sum, goal) => {
    const amount = Number(goal?.currentAmount);
    return isFinite(amount) && amount > 0 ? sum + amount : sum;
  }, 0);

  const safeSavingsGoalsValue = isFinite(savingsGoalsValue) ? savingsGoalsValue : 0;

  const safeCryptoValue = isFinite(cryptoValue) ? cryptoValue : 0;
  const safeBankAccountsValue = isFinite(bankAccountsValue) ? bankAccountsValue : 0;
  const safeRealEstateValue = isFinite(realEstateValue) ? realEstateValue : 0;
  const safeCompanyValue = isFinite(companyValue) ? companyValue : 0;
  const safeVehicleValue = isFinite(vehicleValue) ? vehicleValue : 0;
  const safeLuxuryValue = isFinite(luxuryValue) ? luxuryValue : 0;
  const safeLoansValue = isFinite(loansValue) ? loansValue : 0;

  const total = safeMoney + safeBank + safeBankAccountsValue + safeSavingsGoalsValue + safeCryptoValue + safeStockValue + safeRealEstateValue + safeCompanyValue + safeVehicleValue + safeLuxuryValue - safeLoansValue;
  
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
    vehicles: state.vehicles,
    luxury: state.luxuryItems,
    luxuryHoldings: state.luxuryHoldings,
    cryptos: state.cryptos,
    banking: state.banking
  };
  lastNetWorthValue = clampedTotal;

  return clampedTotal;
};

/**
 * @deprecated Superseded by the unified achievement system in
 * `src/features/onboarding/achievementsData.ts`. Reduced to a no-op stub: its
 * only caller is the no-op `checkAchievements` in GameActionsContext (not
 * editable this wave), so it must stay exported but does nothing.
 * TODO(flawless-audit): remove with checkAchievements.
 */
export const evaluateAchievements = (_state: GameState): AchievementProgress[] => {
  return [];
};
