/**
 * Game balance configuration and validation
 */

export interface BalanceConfig {
  economy: {
    startingMoney: number;
    maxMoney: number;
    inflationRate: number;
    salaryMultiplier: number;
  };
  progression: {
    xpRequiredPerLevel: number;
    maxLevel: number;
    skillDecayRate: number;
  };
  gameplay: {
    maxEnergy: number;
    energyRegenRate: number;
    maxHealth: number;
    maxHappiness: number;
    statDecayRate: number;
  };
  rewards: {
    achievementReward: number;
    dailyReward: number;
    weeklyReward: number;
  };
}

export const DEFAULT_BALANCE: BalanceConfig = {
  economy: {
    startingMoney: 300, // Increased from 200 for better early game
    maxMoney: 1000000000, // 1 billion
    inflationRate: 0.015, // Reduced from 2% to 1.5% per year for better balance
    salaryMultiplier: 1.1, // 10% salary boost for better progression
  },
  progression: {
    xpRequiredPerLevel: 80, // Reduced from 100 for faster leveling
    maxLevel: 100,
    skillDecayRate: 0.005, // Reduced from 1% to 0.5% per week for less punishing decay
  },
  gameplay: {
    maxEnergy: 100,
    energyRegenRate: 12, // Increased from 10 for better energy management
    maxHealth: 100,
    maxHappiness: 100,
    statDecayRate: 4, // Reduced from 5 for less harsh stat decay
  },
  rewards: {
    achievementReward: 15, // Increased from 10 for better reward feeling
    dailyReward: 1,
    weeklyReward: 8, // Increased from 5 for better weekly progression
  },
};

export class GameBalance {
  private config: BalanceConfig;

  constructor(config: BalanceConfig = DEFAULT_BALANCE) {
    this.config = config;
  }

  /**
   * Validate game state against balance rules
   */
  validateGameState(gameState: any): {
    isValid: boolean;
    violations: string[];
    suggestions: string[];
  } {
    const violations: string[] = [];
    const suggestions: string[] = [];

    // Check money bounds
    if (gameState.stats.money < 0) {
      violations.push('Money cannot be negative');
    }
    // Temporarily disabled max money check to allow uncapped wealth progression
    // if (gameState.stats.money > this.config.economy.maxMoney) {
    //   violations.push(`Money exceeds maximum (${this.config.economy.maxMoney})`);
    // }

    // Check stat bounds
    const stats = gameState.stats;
    if (stats.health < 0 || stats.health > this.config.gameplay.maxHealth) {
      violations.push(`Health out of bounds (0-${this.config.gameplay.maxHealth})`);
    }
    if (stats.happiness < 0 || stats.happiness > this.config.gameplay.maxHappiness) {
      violations.push(`Happiness out of bounds (0-${this.config.gameplay.maxHappiness})`);
    }
    if (stats.energy < 0 || stats.energy > this.config.gameplay.maxEnergy) {
      violations.push(`Energy out of bounds (0-${this.config.gameplay.maxEnergy})`);
    }
    if (isNaN(stats.money)) {
      violations.push('Money is NaN');
    }
    if (isNaN(stats.health) || isNaN(stats.happiness) || isNaN(stats.energy)) {
      violations.push('One or more stats are NaN');
    }

    // Check progression bounds
    if (gameState.level > this.config.progression.maxLevel) {
      violations.push(`Level exceeds maximum (${this.config.progression.maxLevel})`);
    }

    // Generate suggestions
    if (stats.money < 100) {
      suggestions.push('Consider earning more money through jobs or activities');
    }
    if (stats.health < 50) {
      suggestions.push('Focus on health activities to improve your condition');
    }
    if (stats.happiness < 50) {
      suggestions.push('Engage in activities that boost happiness');
    }
    if (stats.energy < 30) {
      suggestions.push('Rest to restore energy before taking on new tasks');
    }

    return {
      isValid: violations.length === 0,
      violations,
      suggestions,
    };
  }

  /**
   * Calculate balanced rewards for actions
   */
  calculateReward(actionType: string, level: number = 1): number {
    const baseRewards: Record<string, number> = {
      'work': 50,
      'crime': 100,
      'hobby': 25,
      'education': 15,
      'social': 10,
    };

    const baseReward = baseRewards[actionType] || 50;
    const levelMultiplier = 1 + (level - 1) * 0.1;
    
    return Math.round(baseReward * levelMultiplier);
  }

  /**
   * Calculate balanced costs for items
   */
  calculateCost(itemType: string, quality: number = 1): number {
    const baseCosts: Record<string, number> = {
      'food': 10,
      'item': 100,
      'upgrade': 500,
      'property': 10000,
      'vehicle': 5000,
    };

    const baseCost = baseCosts[itemType] || 100;
    const qualityMultiplier = Math.pow(2, quality - 1);
    
    return Math.round(baseCost * qualityMultiplier);
  }

  /**
   * Calculate experience required for level
   */
  calculateXPRequired(level: number): number {
    return Math.round(this.config.progression.xpRequiredPerLevel * Math.pow(1.2, level - 1));
  }

  /**
   * Calculate time required for actions
   */
  calculateActionTime(actionType: string, difficulty: number = 1): number {
    const baseTimes: Record<string, number> = {
      'work': 8, // hours
      'crime': 2,
      'hobby': 4,
      'education': 6,
      'social': 3,
    };

    const baseTime = baseTimes[actionType] || 4;
    return Math.round(baseTime * difficulty);
  }

  /**
   * Get balance recommendations
   */
  getBalanceRecommendations(gameState: any): string[] {
    const recommendations: string[] = [];
    const stats = gameState.stats;

    // Money recommendations
    if (stats.money < 100) {
      recommendations.push('Start with street jobs or part-time work to build capital');
    } else if (stats.money < 1000) {
      recommendations.push('Save for essential items like Phone or Computer');
    } else if (stats.money > 100000) {
      recommendations.push('Consider investing in assets, businesses, or real estate');
    }

    // Health recommendations
    if (stats.health < 70) {
      recommendations.push('Prioritize health activities and medical care');
    }

    // Happiness recommendations
    if (stats.happiness < 60) {
      recommendations.push('Engage in social activities and hobbies');
    }

    // Energy recommendations
    if (stats.energy < 40) {
      recommendations.push('Take breaks and rest to restore energy');
    }

    return recommendations;
  }

  /**
   * Update balance configuration
   */
  updateConfig(newConfig: Partial<BalanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get current balance configuration
   */
  getConfig(): BalanceConfig {
    return { ...this.config };
  }
}

export const gameBalance = new GameBalance();
