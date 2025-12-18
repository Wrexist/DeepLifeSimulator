/**
 * Discovery System
 * Tracks discovered systems and features, calculates depth score
 */

import { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';

const log = logger.scope('DiscoverySystem');

export interface DiscoveredSystem {
  systemId: string;
  systemName: string;
  discoveredAt: number; // timestamp
  timesUsed: number;
  masteryLevel: number; // 0-100
  lastUsed: number; // timestamp
  category: 'core' | 'advanced' | 'premium';
}

export interface DiscoveryProgress {
  totalSystems: number;
  discoveredSystems: number;
  unlockedSystems: string[];
  lockedSystems: string[];
  depthScore: number; // 0-100 score of game depth engagement
  systemsByCategory: {
    core: number;
    advanced: number;
    premium: number;
  };
}

/**
 * All discoverable systems in the game
 */
const DISCOVERABLE_SYSTEMS: Record<string, {
  name: string;
  category: 'core' | 'advanced' | 'premium';
  unlockRequirements?: {
    minAge?: number;
    minMoney?: number;
    minReputation?: number;
    requiresSystem?: string;
    requiresItem?: string;
    requiresEducation?: string;
  };
}> = {
  // Core systems (always available)
  career: {
    name: 'Career',
    category: 'core',
  },
  relationships: {
    name: 'Relationships',
    category: 'core',
  },
  health: {
    name: 'Health',
    category: 'core',
  },
  hobbies: {
    name: 'Hobbies',
    category: 'core',
  },
  education: {
    name: 'Education',
    category: 'core',
  },
  items: {
    name: 'Items',
    category: 'core',
  },
  bank: {
    name: 'Bank',
    category: 'core',
  },
  
  // Advanced systems
  travel: {
    name: 'Travel',
    category: 'advanced',
    unlockRequirements: {
      minMoney: 1000,
      minAge: 18,
    },
  },
  realEstate: {
    name: 'Real Estate',
    category: 'advanced',
    unlockRequirements: {
      minMoney: 50000,
      minAge: 21,
    },
  },
  stocks: {
    name: 'Stock Market',
    category: 'advanced',
    unlockRequirements: {
      minMoney: 10000,
      minAge: 18,
    },
  },
  company: {
    name: 'Company',
    category: 'advanced',
    unlockRequirements: {
      minMoney: 100000,
      minReputation: 50,
      minAge: 25,
    },
  },
  politics: {
    name: 'Politics',
    category: 'advanced',
    unlockRequirements: {
      minReputation: 30,
      minAge: 25,
    },
  },
  rd: {
    name: 'R&D Lab',
    category: 'advanced',
    unlockRequirements: {
      requiresSystem: 'company',
      minMoney: 200000,
    },
  },
  socialMedia: {
    name: 'Social Media',
    category: 'advanced',
    unlockRequirements: {
      requiresItem: 'phone',
      minAge: 13,
    },
  },
  streetJobs: {
    name: 'Street Jobs',
    category: 'advanced',
    unlockRequirements: {
      minAge: 16,
    },
  },
  darkWeb: {
    name: 'Dark Web',
    category: 'advanced',
    unlockRequirements: {
      requiresItem: 'computer',
      minAge: 18,
    },
  },
  gamingStreaming: {
    name: 'Gaming & Streaming',
    category: 'advanced',
    unlockRequirements: {
      requiresItem: 'computer',
      minAge: 13,
    },
  },
  
  // Premium systems
  prestige: {
    name: 'Prestige',
    category: 'premium',
    unlockRequirements: {
      minMoney: 100000000, // $100M
    },
  },
  dynasty: {
    name: 'Dynasty',
    category: 'premium',
    unlockRequirements: {
      requiresSystem: 'prestige',
    },
  },
  legacy: {
    name: 'Legacy',
    category: 'premium',
    unlockRequirements: {
      requiresSystem: 'prestige',
    },
  },
};

/**
 * Mark a system as discovered
 */
export function markSystemDiscovered(
  systemId: string,
  gameState: GameState
): GameState {
  const discoveredSystems = gameState.discoveredSystems || [];
  
  // Check if already discovered
  if (discoveredSystems.find(s => s.systemId === systemId)) {
    return gameState;
  }

  const systemDef = DISCOVERABLE_SYSTEMS[systemId];
  if (!systemDef) {
    log.warn(`Unknown system: ${systemId}`);
    return gameState;
  }

  const discovered: DiscoveredSystem = {
    systemId,
    systemName: systemDef.name,
    discoveredAt: Date.now(),
    timesUsed: 0,
    masteryLevel: 0,
    lastUsed: Date.now(),
    category: systemDef.category,
  };

  return {
    ...gameState,
    discoveredSystems: [...discoveredSystems, discovered],
  };
}

/**
 * Update system usage
 */
export function updateSystemUsage(
  systemId: string,
  gameState: GameState
): GameState {
  const discoveredSystems = gameState.discoveredSystems || [];
  const system = discoveredSystems.find(s => s.systemId === systemId);
  
  if (!system) {
    // Auto-discover if not already discovered
    return markSystemDiscovered(systemId, {
      ...gameState,
      discoveredSystems: [...discoveredSystems, {
        systemId,
        systemName: DISCOVERABLE_SYSTEMS[systemId]?.name || systemId,
        discoveredAt: Date.now(),
        timesUsed: 1,
        masteryLevel: 1,
        lastUsed: Date.now(),
        category: DISCOVERABLE_SYSTEMS[systemId]?.category || 'core',
      }],
    });
  }

  // Update usage stats
  const updatedSystems = discoveredSystems.map(s => {
    if (s.systemId === systemId) {
      const newMasteryLevel = Math.min(100, s.masteryLevel + 0.5);
      return {
        ...s,
        timesUsed: s.timesUsed + 1,
        masteryLevel: newMasteryLevel,
        lastUsed: Date.now(),
      };
    }
    return s;
  });

  return {
    ...gameState,
    discoveredSystems: updatedSystems,
  };
}

/**
 * Get discovery progress
 */
export function getDiscoveryProgress(gameState: GameState): DiscoveryProgress {
  const discoveredSystems = gameState.discoveredSystems || [];
  const totalSystems = Object.keys(DISCOVERABLE_SYSTEMS).length;
  
  const unlockedSystems: string[] = [];
  const lockedSystems: string[] = [];

  // Check each system
  Object.keys(DISCOVERABLE_SYSTEMS).forEach(systemId => {
    const isUnlocked = checkSystemUnlocked(systemId, gameState);
    
    if (isUnlocked) {
      unlockedSystems.push(systemId);
    } else {
      lockedSystems.push(systemId);
    }
  });

  // Count by category
  const systemsByCategory = {
    core: 0,
    advanced: 0,
    premium: 0,
  };

  discoveredSystems.forEach(system => {
    systemsByCategory[system.category]++;
  });

  const depthScore = calculateDepthScore(gameState);

  return {
    totalSystems,
    discoveredSystems: discoveredSystems.length,
    unlockedSystems,
    lockedSystems,
    depthScore,
    systemsByCategory,
  };
}

/**
 * Calculate depth engagement score (0-100)
 */
export function calculateDepthScore(gameState: GameState): number {
  const discoveredSystems = gameState.discoveredSystems || [];
  
  if (discoveredSystems.length === 0) {
    return 0;
  }

  // Base score from number of systems discovered
  const discoveryScore = (discoveredSystems.length / Object.keys(DISCOVERABLE_SYSTEMS).length) * 40;

  // Mastery score from average mastery level
  const avgMastery = discoveredSystems.reduce((sum, s) => sum + s.masteryLevel, 0) / discoveredSystems.length;
  const masteryScore = (avgMastery / 100) * 30;

  // Engagement score from active systems
  const activeSystems = getActiveSystems(gameState);
  const engagementScore = (activeSystems.length / Object.keys(DISCOVERABLE_SYSTEMS).length) * 20;

  // Diversity score from using different categories
  const categoriesUsed = new Set(discoveredSystems.map(s => s.category));
  const diversityScore = (categoriesUsed.size / 3) * 10;

  const totalScore = discoveryScore + masteryScore + engagementScore + diversityScore;
  return Math.min(100, Math.round(totalScore));
}

/**
 * Get system unlock requirements
 */
export function getSystemUnlockRequirements(systemId: string): {
  name: string;
  requirements: string[];
  isUnlocked: boolean;
} | null {
  if (!DISCOVERABLE_SYSTEMS[systemId]) {
    return null;
  }

  const systemDef = DISCOVERABLE_SYSTEMS[systemId];
  const requirements: string[] = [];
  const unlockReq = systemDef.unlockRequirements;

  if (unlockReq) {
    if (unlockReq.minAge) {
      requirements.push(`Age: ${unlockReq.minAge}+`);
    }
    if (unlockReq.minMoney) {
      requirements.push(`Money: $${unlockReq.minMoney.toLocaleString()}+`);
    }
    if (unlockReq.minReputation) {
      requirements.push(`Reputation: ${unlockReq.minReputation}+`);
    }
    if (unlockReq.requiresSystem) {
      const reqSystem = DISCOVERABLE_SYSTEMS[unlockReq.requiresSystem];
      requirements.push(`Requires: ${reqSystem?.name || unlockReq.requiresSystem}`);
    }
    if (unlockReq.requiresItem) {
      requirements.push(`Requires: ${unlockReq.requiresItem}`);
    }
    if (unlockReq.requiresEducation) {
      requirements.push(`Requires: ${unlockReq.requiresEducation} education`);
    }
  }

  return {
    name: systemDef.name,
    requirements: requirements.length > 0 ? requirements : ['Always available'],
    isUnlocked: !unlockReq || requirements.length === 0,
  };
}

/**
 * Check if a system is unlocked
 */
export function checkSystemUnlocked(systemId: string, gameState: GameState): boolean {
  const systemDef = DISCOVERABLE_SYSTEMS[systemId];
  if (!systemDef) {
    return false;
  }

  const unlockReq = systemDef.unlockRequirements;
  if (!unlockReq) {
    return true; // Core systems are always unlocked
  }

  // Check age requirement
  if (unlockReq.minAge && gameState.date.age < unlockReq.minAge) {
    return false;
  }

  // Check money requirement
  if (unlockReq.minMoney && gameState.stats.money < unlockReq.minMoney) {
    return false;
  }

  // Check reputation requirement
  if (unlockReq.minReputation && (gameState.stats.reputation || 0) < unlockReq.minReputation) {
    return false;
  }

  // Check required system
  if (unlockReq.requiresSystem) {
    const hasSystem = checkSystemUnlocked(unlockReq.requiresSystem, gameState);
    if (!hasSystem) {
      return false;
    }
  }

  // Check required item
  if (unlockReq.requiresItem) {
    const hasItem = gameState.items?.find(i => i.id === unlockReq.requiresItem && i.owned);
    if (!hasItem) {
      // Special case for phone/computer
      if (unlockReq.requiresItem === 'phone' && !gameState.hasPhone) {
        return false;
      }
      if (unlockReq.requiresItem === 'computer' && !gameState.computerPreviouslyOwned) {
        return false;
      }
    }
  }

  // Check required education
  if (unlockReq.requiresEducation) {
    const hasEducation = gameState.educations?.find(e => e.id === unlockReq.requiresEducation && e.completed);
    if (!hasEducation) {
      return false;
    }
  }

  return true;
}

/**
 * Get all discoverable systems
 */
export function getAllDiscoverableSystems(): typeof DISCOVERABLE_SYSTEMS {
  return DISCOVERABLE_SYSTEMS;
}

// Helper functions

function getActiveSystems(gameState: GameState): string[] {
  const systems: string[] = [];

  if (gameState.careers && gameState.careers.length > 0) systems.push('career');
  if (gameState.relationships && gameState.relationships.length > 0) systems.push('relationships');
  if (gameState.healthActivities && gameState.healthActivities.length > 0) systems.push('health');
  if (gameState.hobbies && gameState.hobbies.length > 0) systems.push('hobbies');
  if (gameState.educations && gameState.educations.length > 0) systems.push('education');
  if (gameState.travel) systems.push('travel');
  if (gameState.politics) systems.push('politics');
  if (gameState.company?.rdLab) systems.push('rd');
  if (gameState.company) systems.push('company');
  if (gameState.realEstate && gameState.realEstate.length > 0) systems.push('realEstate');
  if (gameState.stocks && gameState.stocks.holdings && gameState.stocks.holdings.length > 0) systems.push('stocks');
  if (gameState.socialMedia) systems.push('socialMedia');
  if (gameState.streetJobs && gameState.streetJobs.length > 0) systems.push('streetJobs');
  if (gameState.darkWebItems && gameState.darkWebItems.length > 0) systems.push('darkWeb');
  if (gameState.gamingStreaming) systems.push('gamingStreaming');
  if (gameState.prestige) systems.push('prestige');
  if (gameState.ancestors && gameState.ancestors.length > 0) systems.push('dynasty');
  if (gameState.legacyBonuses) systems.push('legacy');

  return systems;
}

