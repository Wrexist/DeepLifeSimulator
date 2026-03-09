import { GameState } from '@/contexts/game/types';
import { getBonusLevel } from './prestigeBonuses';

/**
 * Apply starting bonuses to game state
 * @param gameState Game state to modify
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Modified game state
 */
export function applyStartingBonuses(
  gameState: GameState,
  unlockedBonuses: string[]
): GameState {
  const newState = { ...gameState };

  // Starting money bonuses
  const money1Level = getBonusLevel('starting_money_1', unlockedBonuses);
  const money2Level = getBonusLevel('starting_money_2', unlockedBonuses);
  const money3Level = getBonusLevel('starting_money_3', unlockedBonuses);
  
  let moneyBonus = 0;
  if (money1Level > 0) moneyBonus += 10000 * money1Level;
  if (money2Level > 0) moneyBonus += 50000 * money2Level;
  if (money3Level > 0) moneyBonus += 250000 * money3Level;

  newState.stats.money = (newState.stats.money || 0) + moneyBonus;

  // Starting stat bonuses
  const stats1Level = getBonusLevel('starting_stats_1', unlockedBonuses);
  const stats2Level = getBonusLevel('starting_stats_2', unlockedBonuses);
  const stats3Level = getBonusLevel('starting_stats_3', unlockedBonuses);

  let statBonus = 0;
  if (stats1Level > 0) statBonus += 5 * stats1Level;
  if (stats2Level > 0) statBonus += 10 * stats2Level;
  if (stats3Level > 0) statBonus += 20 * stats3Level;

  let finalStatBonus = statBonus;
  
  // Synergy: Life Master (requires 3+ starting bonuses)
  const startingBonusCount = money1Level + money2Level + money3Level + stats1Level + stats2Level + stats3Level;
  if (unlockedBonuses.includes('synergy_life_master') && startingBonusCount >= 3) {
    finalStatBonus = Math.floor(statBonus * 1.25); // +25% effectiveness
  }

  newState.stats.health = Math.min(100, (newState.stats.health || 100) + finalStatBonus);
  newState.stats.happiness = Math.min(100, (newState.stats.happiness || 100) + finalStatBonus);
  newState.stats.energy = Math.min(100, (newState.stats.energy || 100) + finalStatBonus);
  newState.stats.fitness = Math.min(100, (newState.stats.fitness || 10) + finalStatBonus);

  // Starting reputation bonus
  if (unlockedBonuses.includes('starting_reputation')) {
    newState.stats.reputation = (newState.stats.reputation || 0) + 10;
  }

  // Starting energy bonus
  if (unlockedBonuses.includes('starting_energy')) {
    newState.stats.energy = Math.min(100, (newState.stats.energy || 100) + 20);
  }

  // Perfect start bonus
  if (unlockedBonuses.includes('perfect_start')) {
    newState.stats.health = 100;
    newState.stats.happiness = 100;
    newState.stats.energy = 100;
    newState.stats.fitness = 100;
  }

  // Starting investment portfolio bonus
  if (unlockedBonuses.includes('starting_investment_portfolio')) {
    const portfolioValue = 50000;
    // Initialize stocks if not present
    if (!newState.stocks) {
      newState.stocks = {
        holdings: [],
        watchlist: [],
        realizedGains: 0,
      };
    }
    // Add diversified stock holdings (simplified - add to a few major stocks)
    const { getStockInfo } = require('@/lib/economy/stockMarket');
    const majorStocks = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA'];
    const sharesPerStock = Math.floor(portfolioValue / majorStocks.length / 100); // Rough estimate
    
    majorStocks.forEach(symbol => {
      const stockInfo = getStockInfo(symbol);
      if (stockInfo && stockInfo.currentPrice > 0) {
        const shares = Math.floor(portfolioValue / majorStocks.length / stockInfo.currentPrice);
        if (shares > 0) {
          const existingHolding = newState.stocks.holdings.find(h => h.symbol === symbol);
          if (existingHolding) {
            existingHolding.shares += shares;
            existingHolding.averagePrice = (existingHolding.averagePrice * existingHolding.shares + stockInfo.currentPrice * shares) / (existingHolding.shares + shares);
          } else {
            newState.stocks.holdings.push({
              symbol,
              shares,
              averagePrice: stockInfo.currentPrice,
              currentPrice: stockInfo.currentPrice,
            });
          }
        }
      }
    });
    // Deduct the portfolio cost from money (already included in starting money)
  }

  // Starting real estate bonus
  if (unlockedBonuses.includes('starting_real_estate')) {
    // Find a basic rental property to give
    const basicProperties = (newState.realEstate || []).filter(
      prop => prop.type === 'apartment' && !prop.owned && (prop.price || 0) <= 150000
    );
    if (basicProperties.length > 0) {
      const property = basicProperties[0];
      property.owned = true;
      property.purchaseDate = newState.date;
    }
  }

  // Starting company bonus
  if (unlockedBonuses.includes('starting_company')) {
    // Create a small basic factory company
    if (!newState.companies) {
      newState.companies = [];
    }
    // Check if player already has a company
    if (newState.companies.length === 0) {
      const newCompany: any = {
        id: 'factory',
        name: 'Family Business',
        type: 'factory',
        weeklyIncome: 2000,
        baseWeeklyIncome: 2000,
        upgrades: [],
        employees: 0,
        workerSalary: 500,
        workerMultiplier: 1.1,
        marketingLevel: 1,
        miners: {},
        warehouseLevel: 0,
      };
      newState.companies.push(newCompany);
      newState.company = newCompany;
    }
  }

  // Starting vehicle bonus
  if (unlockedBonuses.includes('starting_vehicle')) {
    // Add a basic vehicle
    if (!newState.vehicles) {
      newState.vehicles = [];
    }
    // Check if player already has a vehicle
    if (newState.vehicles.length === 0) {
      newState.vehicles.push({
        id: 'starting_vehicle',
        name: 'Basic Car',
        type: 'car',
        price: 15000,
        owned: true,
        speedBonus: 0,
        reputationBonus: 0,
        insurance: undefined,
      });
      newState.hasDriversLicense = true; // Give license with vehicle
    }
  }

  return newState;
}

/**
 * Get income multiplier from prestige bonuses
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Total income multiplier (1.0 = no bonus)
 */
export function getIncomeMultiplier(unlockedBonuses: string[]): number {
  let multiplier = 1.0;

  const income1Level = getBonusLevel('income_multiplier_1', unlockedBonuses);
  const income2Level = getBonusLevel('income_multiplier_2', unlockedBonuses);
  const income3Level = getBonusLevel('income_multiplier_3', unlockedBonuses);

  if (income1Level > 0) multiplier += 0.05 * income1Level;
  if (income2Level > 0) multiplier += 0.10 * income2Level;
  if (income3Level > 0) multiplier += 0.25 * income3Level;

  // Wealth magnet bonus
  if (unlockedBonuses.includes('wealth_magnet')) {
    multiplier += 1.0; // +100% passive income
  }

  // Synergy: Wealth Master (requires 2+ income bonuses)
  const incomeBonusCount = income1Level + income2Level + income3Level;
  if (unlockedBonuses.includes('synergy_wealth_master') && incomeBonusCount >= 2) {
    multiplier += 0.15; // +15% bonus
  }

  // ANTI-EXPLOIT: Cap total income multiplier at 1.5x (50% bonus max)
  // Without cap, stacking all bonuses gives 2.35x+ which makes each prestige cycle faster
  // than the last, creating an exponential snowball
  return Math.min(1.5, multiplier);
}

/**
 * Get experience multiplier from prestige bonuses
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Total experience multiplier (1.0 = no bonus)
 */
export function getExperienceMultiplier(unlockedBonuses: string[]): number {
  let multiplier = 1.0;

  const exp1Level = getBonusLevel('experience_multiplier_1', unlockedBonuses);
  const exp2Level = getBonusLevel('experience_multiplier_2', unlockedBonuses);
  const exp3Level = getBonusLevel('experience_multiplier_3', unlockedBonuses);

  if (exp1Level > 0) multiplier += 0.10 * exp1Level;
  if (exp2Level > 0) multiplier += 0.25 * exp2Level;
  if (exp3Level > 0) multiplier += 0.50 * exp3Level;

  // Genius bonus
  if (unlockedBonuses.includes('genius')) {
    multiplier += 1.0; // +100% learning speed
  }

  // Synergy: Learning Master (requires 2+ experience bonuses)
  const expBonusCount = exp1Level + exp2Level + exp3Level;
  if (unlockedBonuses.includes('synergy_learning_master') && expBonusCount >= 2) {
    multiplier += 0.20; // +20% bonus
  }

  return multiplier;
}

/**
 * Get skill gain multiplier from prestige bonuses
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Total skill gain multiplier (1.0 = no bonus)
 */
export function getSkillGainMultiplier(unlockedBonuses: string[]): number {
  if (unlockedBonuses.includes('skill_gain_multiplier')) {
    return 1.2; // +20% skill gain
  }
  return 1.0;
}

/**
 * Get stat decay reduction from prestige bonuses
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Stat decay multiplier (1.0 = no reduction, 0.75 = 25% reduction)
 */
export function getStatDecayMultiplier(unlockedBonuses: string[]): number {
  if (unlockedBonuses.includes('stat_decay_reduction')) {
    return 0.75; // -25% stat decay
  }
  return 1.0;
}

/**
 * Get energy regeneration multiplier from prestige bonuses
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Energy regeneration multiplier (1.0 = no bonus)
 */
export function getEnergyRegenMultiplier(unlockedBonuses: string[]): number {
  if (unlockedBonuses.includes('increased_energy_regen')) {
    return 1.5; // +50% energy regeneration
  }
  return 1.0;
}

/**
 * Get relationship gain multiplier from prestige bonuses
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Relationship gain multiplier (1.0 = no bonus)
 */
export function getRelationshipGainMultiplier(unlockedBonuses: string[]): number {
  let multiplier = 1.0;
  
  if (unlockedBonuses.includes('social_master')) {
    multiplier += 0.5; // +50% relationship gains
  }
  
  const reputationGainLevel = getBonusLevel('reputation_gain_multiplier', unlockedBonuses);
  if (reputationGainLevel > 0) {
    multiplier += 0.30 * reputationGainLevel; // +30% per level
  }
  
  return multiplier;
}

/**
 * Get event frequency modifier (for positive events)
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Event frequency multiplier (1.0 = normal, 1.25 = +25% positive events)
 */
export function getEventFrequencyBoost(unlockedBonuses: string[]): number {
  const eventBoostLevel = getBonusLevel('event_frequency_boost', unlockedBonuses);
  if (eventBoostLevel > 0) {
    return 1.0 + (0.25 * eventBoostLevel); // +25% per level
  }
  return 1.0;
}

/**
 * Get achievement progress multiplier
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Achievement progress multiplier (1.0 = normal, 1.2 = +20% progress)
 */
export function getAchievementProgressMultiplier(unlockedBonuses: string[]): number {
  const achievementLevel = getBonusLevel('achievement_progress_multiplier', unlockedBonuses);
  if (achievementLevel > 0) {
    return 1.0 + (0.20 * achievementLevel); // +20% per level
  }
  return 1.0;
}

/**
 * Check if immortality bonus is active
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns True if immortality is active
 */
export function hasImmortality(unlockedBonuses: string[]): boolean {
  return unlockedBonuses.includes('immortality');
}

/**
 * Apply legacy bonuses to game state (from previous generations)
 * @param gameState Game state to modify
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @param previousNetWorth Net worth from previous life (for generational wealth)
 * @param previousState Previous game state (for legacy data)
 * @returns Modified game state
 */
export function applyLegacyBonuses(
  gameState: GameState,
  unlockedBonuses: string[],
  previousNetWorth: number = 0,
  previousState?: GameState
): GameState {
  const newState = { ...gameState };

  // Generational wealth bonus
  if (unlockedBonuses.includes('legacy_wealth') && previousNetWorth > 0) {
    const inheritance = Math.floor(previousNetWorth * 0.10); // 10% of previous net worth
    newState.stats.money = (newState.stats.money || 0) + inheritance;
  }

  // Educational legacy bonus
  if (unlockedBonuses.includes('legacy_education') && previousState) {
    // Mark all educations as completed
    newState.educations = (newState.educations || []).map(edu => ({
      ...edu,
      completed: true,
      weeksRemaining: undefined,
    }));
  }

  // Family reputation bonus
  if (unlockedBonuses.includes('legacy_reputation')) {
    newState.stats.reputation = (newState.stats.reputation || 0) + 20;
  }

  // Family business legacy bonus
  if (unlockedBonuses.includes('legacy_business') && previousState) {
    // Inherit family businesses (simplified - add a flag that the company system can check)
    newState.hasFamilyBusinessLegacy = true;
    // Could also transfer specific companies if needed
  }

  return newState;
}

