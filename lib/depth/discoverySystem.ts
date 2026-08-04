/**
 * Discovery System
 * Tracks discovered systems and features, calculates depth score
 */

import type { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';

import { SystemUnlockRequirements } from '@/lib/types/requirements';

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
/**
 * Exported so a test can assert `reconcileDiscoveredSystems` never records an id
 * outside the catalogue — an unknown id would render as a raw slug in the
 * Discovery meter and inflate the denominator-free count.
 */
export const DISCOVERABLE_SYSTEMS: Record<string, {
  name: string;
  category: 'core' | 'advanced' | 'premium';
  unlockRequirements?: SystemUnlockRequirements;
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
    if ('minAge' in unlockReq && unlockReq.minAge) {
      requirements.push(`Age: ${unlockReq.minAge}+`);
    }
    if ('minMoney' in unlockReq && unlockReq.minMoney) {
      requirements.push(`Money: $${unlockReq.minMoney.toLocaleString()}+`);
    }
    if ('minReputation' in unlockReq && unlockReq.minReputation) {
      requirements.push(`Reputation: ${unlockReq.minReputation}+`);
    }
    if ('requiresSystem' in unlockReq && unlockReq.requiresSystem) {
      const reqSystem = DISCOVERABLE_SYSTEMS[unlockReq.requiresSystem];
      requirements.push(`Requires: ${reqSystem?.name || unlockReq.requiresSystem}`);
    }
    if ('requiresItem' in unlockReq && unlockReq.requiresItem) {
      requirements.push(`Requires: ${unlockReq.requiresItem}`);
    }
    if ('requiresEducation' in unlockReq && unlockReq.requiresEducation) {
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

  // Check age requirement. Optional-chain date/stats: this runs on the home tab
  // (DiscoveryIndicator) where a degraded/migrating save could leave them unset.
  if ('minAge' in unlockReq && unlockReq.minAge && (gameState.date?.age ?? 0) < unlockReq.minAge) {
    return false;
  }

  // Check money requirement
  if ('minMoney' in unlockReq && unlockReq.minMoney && (gameState.stats?.money ?? 0) < unlockReq.minMoney) {
    return false;
  }

  // Check reputation requirement
  if ('minReputation' in unlockReq && unlockReq.minReputation && (gameState.stats?.reputation || 0) < unlockReq.minReputation) {
    return false;
  }

  // Check required system
  if ('requiresSystem' in unlockReq && unlockReq.requiresSystem) {
    const hasSystem = checkSystemUnlocked(unlockReq.requiresSystem, gameState);
    if (!hasSystem) {
      return false;
    }
  }

  // Check required item
  if ('requiresItem' in unlockReq && unlockReq.requiresItem) {
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
  if ('requiresEducation' in unlockReq && unlockReq.requiresEducation) {
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


/**
 * Derive which systems this life has actually touched, from observable state.
 *
 * `markSystemDiscovered` had NO callers, and `updateSystemUsage` had exactly one
 * — hard-coded to `'streetJobs'`. So `discoveredSystems` could hold at most one
 * entry for the life of a save, while `DiscoveryIndicator` (mounted full-size on
 * the home feed after week 5) rendered "1 / 20" and `calculateDepthScore` drew
 * 40 of its 100 points from that ratio. A player running companies, stocks,
 * real estate, politics and R&D who had prestiged twice still saw 5%.
 * 2026-07-30 audit GP-7.
 *
 * Deliberately derived rather than sprinkled across ~9 action entry points:
 *
 *  - it CREDITS EXISTING SAVES. A per-call-site approach only counts systems
 *    touched after the update, so a 2000-week veteran would still read 1/20
 *    until they happened to re-do each thing.
 *  - a new system cannot forget to call it; it is one function to extend.
 *  - it is pure and idempotent, so the tick can run it every week.
 *
 * Only ever ADDS. Selling your last property does not un-discover real estate —
 * discovery is "you have seen this", not "you currently own this".
 */
export function reconcileDiscoveredSystems(gameState: GameState): GameState {
  const has = (v: unknown): boolean => Array.isArray(v) && v.length > 0;
  const s = gameState as unknown as Record<string, any>;

  const touched: string[] = [];
  const mark = (id: string, seen: unknown) => {
    if (seen) touched.push(id);
  };

  mark('career', !!gameState.currentJob || has(gameState.careers?.filter?.((c: any) => c?.accepted)));
  mark('relationships', has(gameState.relationships));
  mark('health', (gameState.stats?.fitness ?? 0) > 0 && (gameState.weeksLived ?? 0) > 0);
  mark('hobbies', has(gameState.hobbies) || has(s.pursuits));
  mark('education', has(gameState.educations));
  mark('items', has(gameState.items?.filter?.((i: any) => i?.owned)));
  mark('bank', (gameState.bankSavings ?? 0) > 0 || has(s.bankAccounts));
  mark('travel', has(s.visitedCountries) || !!s.currentTrip);
  mark('realEstate', has(gameState.realEstate));
  // `state.stocks` is an OBJECT (`{ holdings: [...] }`), never an array, so
  // `has(s.stocks)` could never be true — it was dead weight, not legacy-save
  // coverage. The real legacy shape is the `stocksOwned` map.
  mark('stocks', has(gameState.stocks?.holdings) || Object.keys(s.stocksOwned ?? {}).length > 0);
  mark('company', has(gameState.companies) || !!s.company);
  mark('politics', has(gameState.careers?.filter?.((c: any) => c?.id === 'political')));
  mark('rd', has(s.rdProjects) || has(s.research));
  mark('socialMedia', (gameState.socialMedia?.followers ?? 0) > 0 || has(s.socialMedia?.posts));
  mark('streetJobs', (s.streetJobsCompleted ?? 0) > 0);
  mark('darkWeb', (s.criminalLevel ?? 0) > 0 || has(s.darkWebPurchases));
  mark('gamingStreaming', has(s.gamingStreaming?.streams) || (s.gamingStreaming?.subscribers ?? 0) > 0);
  mark('prestige', (gameState.prestige?.prestigeLevel ?? 0) > 0);
  mark('dynasty', (gameState.generationNumber ?? 1) > 1);
  mark('legacy', has(gameState.ancestors) || has(gameState.family?.children));

  let next = gameState;
  for (const id of touched) {
    const already = (next.discoveredSystems || []).some((d) => d.systemId === id);
    if (already) continue;
    next = markSystemDiscovered(id, next);
  }
  return next;
}
