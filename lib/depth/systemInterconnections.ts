/**
 * System Interconnection Tracker
 * Tracks and calculates how game systems affect each other
 */

import { GameState } from '@/contexts/game/types';

export interface SystemInterconnection {
  sourceSystem: string;
  targetSystem: string;
  effectType: 'positive' | 'negative';
  magnitude: number;
  description: string;
  isActive: boolean;
}

export interface StatChange {
  health?: number;
  happiness?: number;
  energy?: number;
  fitness?: number;
  money?: number;
  reputation?: number;
  gems?: number;
}

export interface ActionImpact {
  actionId: string;
  actionName: string;
  directEffects: StatChange;
  systemEffects: SystemInterconnection[];
  chainReactions: string[];
  modifiers: {
    commitmentBonus?: number;
    prestigeBonus?: number;
    lifestyleModifier?: number;
    mindsetModifier?: number;
  };
  calculatedValues: {
    baseValue: number;
    finalValue: number;
    modifierBreakdown: string[];
  };
}

export interface SystemHealth {
  systemId: string;
  systemName: string;
  health: number; // 0-100
  trend: 'improving' | 'declining' | 'stable';
  engagement: number; // 0-100, how actively used
  lastActivity: number; // timestamp
}

/**
 * System definitions with their interconnections
 */
const SYSTEM_DEFINITIONS: Record<string, {
  name: string;
  affects: { system: string; effect: 'positive' | 'negative'; description: string }[];
  affectedBy: string[];
}> = {
  career: {
    name: 'Career',
    affects: [
      { system: 'money', effect: 'positive', description: 'Career provides income' },
      { system: 'reputation', effect: 'positive', description: 'Career success builds reputation' },
      { system: 'relationships', effect: 'negative', description: 'Focus on career reduces relationship time' },
      { system: 'health', effect: 'negative', description: 'Work stress affects health' },
      { system: 'happiness', effect: 'positive', description: 'Career satisfaction affects happiness' },
    ],
    affectedBy: ['education', 'reputation', 'relationships', 'health'],
  },
  relationships: {
    name: 'Relationships',
    affects: [
      { system: 'happiness', effect: 'positive', description: 'Relationships increase happiness' },
      { system: 'health', effect: 'positive', description: 'Social connections improve health' },
      { system: 'career', effect: 'positive', description: 'Networking helps career' },
      { system: 'money', effect: 'negative', description: 'Social activities cost money' },
    ],
    affectedBy: ['career', 'health', 'money'],
  },
  health: {
    name: 'Health',
    affects: [
      { system: 'energy', effect: 'positive', description: 'Good health increases energy' },
      { system: 'career', effect: 'positive', description: 'Health enables better work performance' },
      { system: 'happiness', effect: 'positive', description: 'Health contributes to happiness' },
      { system: 'money', effect: 'negative', description: 'Healthcare costs money' },
    ],
    affectedBy: ['career', 'relationships', 'money'],
  },
  hobbies: {
    name: 'Hobbies',
    affects: [
      { system: 'happiness', effect: 'positive', description: 'Hobbies increase happiness' },
      { system: 'energy', effect: 'negative', description: 'Hobbies consume energy' },
      { system: 'money', effect: 'negative', description: 'Hobbies can cost money' },
      { system: 'reputation', effect: 'positive', description: 'Hobby achievements build reputation' },
    ],
    affectedBy: ['money', 'energy', 'career'],
  },
  education: {
    name: 'Education',
    affects: [
      { system: 'career', effect: 'positive', description: 'Education unlocks better careers' },
      { system: 'money', effect: 'negative', description: 'Education costs money' },
      { system: 'reputation', effect: 'positive', description: 'Education builds reputation' },
    ],
    affectedBy: ['money', 'career'],
  },
  travel: {
    name: 'Travel',
    affects: [
      { system: 'happiness', effect: 'positive', description: 'Travel increases happiness' },
      { system: 'money', effect: 'negative', description: 'Travel costs money' },
      { system: 'energy', effect: 'negative', description: 'Travel is tiring' },
      { system: 'reputation', effect: 'positive', description: 'Travel experiences build reputation' },
    ],
    affectedBy: ['money', 'energy'],
  },
  politics: {
    name: 'Politics',
    affects: [
      { system: 'reputation', effect: 'positive', description: 'Political success builds reputation' },
      { system: 'money', effect: 'positive', description: 'Politics can generate income' },
      { system: 'relationships', effect: 'positive', description: 'Political networking builds relationships' },
      { system: 'happiness', effect: 'negative', description: 'Political stress affects happiness' },
    ],
    affectedBy: ['reputation', 'money', 'relationships'],
  },
  rd: {
    name: 'R&D',
    affects: [
      { system: 'money', effect: 'positive', description: 'R&D can generate income' },
      { system: 'reputation', effect: 'positive', description: 'R&D achievements build reputation' },
      { system: 'energy', effect: 'negative', description: 'R&D consumes energy' },
      { system: 'career', effect: 'positive', description: 'R&D enhances career opportunities' },
    ],
    affectedBy: ['money', 'education', 'career'],
  },
  company: {
    name: 'Company',
    affects: [
      { system: 'money', effect: 'positive', description: 'Company generates income' },
      { system: 'reputation', effect: 'positive', description: 'Company success builds reputation' },
      { system: 'energy', effect: 'negative', description: 'Running a company is tiring' },
      { system: 'happiness', effect: 'positive', description: 'Business success increases happiness' },
    ],
    affectedBy: ['money', 'reputation', 'career'],
  },
  realEstate: {
    name: 'Real Estate',
    affects: [
      { system: 'money', effect: 'positive', description: 'Real estate generates passive income' },
      { system: 'happiness', effect: 'positive', description: 'Owning property increases happiness' },
      { system: 'money', effect: 'negative', description: 'Property maintenance costs money' },
    ],
    affectedBy: ['money'],
  },
  stocks: {
    name: 'Stocks',
    affects: [
      { system: 'money', effect: 'positive', description: 'Stocks can generate income' },
      { system: 'happiness', effect: 'positive', description: 'Investment success increases happiness' },
      { system: 'happiness', effect: 'negative', description: 'Investment losses affect happiness' },
    ],
    affectedBy: ['money'],
  },
  socialMedia: {
    name: 'Social Media',
    affects: [
      { system: 'reputation', effect: 'positive', description: 'Social media builds reputation' },
      { system: 'money', effect: 'positive', description: 'Social media can generate income' },
      { system: 'happiness', effect: 'positive', description: 'Social engagement increases happiness' },
      { system: 'energy', effect: 'negative', description: 'Social media consumes energy' },
    ],
    affectedBy: ['reputation', 'relationships'],
  },
};

/**
 * Calculate action impact including system interconnections
 */
export function calculateActionImpact(
  actionId: string,
  actionName: string,
  directEffects: StatChange,
  gameState: GameState
): ActionImpact {
  const systemEffects: SystemInterconnection[] = [];
  const chainReactions: string[] = [];
  const modifiers: ActionImpact['modifiers'] = {};

  // Calculate commitment bonuses
  if (gameState.activityCommitments) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getCommitmentBonuses } = require('@/lib/commitments/commitmentSystem');
      const bonuses = getCommitmentBonuses(gameState, getSystemFromAction(actionId));
      if (bonuses.progressBonus > 0) {
        modifiers.commitmentBonus = bonuses.progressBonus;
      }
    } catch {
      // Commitment system may not be available
    }
  }

  // Calculate prestige bonuses
  if (gameState.prestige?.prestigeLevel) {
    modifiers.prestigeBonus = gameState.prestige.prestigeLevel * 2; // 2% per prestige level
  }

  // Calculate lifestyle modifiers
  // Lifestyle level is calculated from net worth, not stored directly
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { calculateLifestyleLevel } = require('@/lib/economy/lifestyle');
    const lifestyleLevel = calculateLifestyleLevel(gameState);
    // Map lifestyle level to numeric value for calculation
    const lifestyleLevels: Record<string, number> = {
      minimal: 1,
      modest: 2,
      comfortable: 3,
      affluent: 4,
      luxury: 5,
      elite: 6,
    };
    const levelNum = lifestyleLevels[lifestyleLevel] || 1;
    if (levelNum >= 3) {
      modifiers.lifestyleModifier = (levelNum - 2) * 5; // 5% per level above 2
    }
    } catch {
      // Lifestyle system may not be available
    }

  // Calculate mindset modifiers
  if (gameState.mindset?.activeTraitId) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { applyMindsetEffects } = require('@/lib/mindset/config');
      const mindsetResult = applyMindsetEffects(gameState, directEffects);
      if (mindsetResult.feedback) {
        modifiers.mindsetModifier = mindsetResult.feedback.type === 'bonus' ? 10 : -10;
      }
    } catch {
      // Mindset system may not be available
    }
  }

  // Determine affected systems from direct effects
  const affectedSystems = new Set<string>();
  if (directEffects.money) affectedSystems.add('money');
  if (directEffects.health) affectedSystems.add('health');
  if (directEffects.happiness) affectedSystems.add('happiness');
  if (directEffects.energy) affectedSystems.add('energy');
  if (directEffects.reputation) affectedSystems.add('reputation');

  // Calculate system interconnections
  const sourceSystem = getSystemFromAction(actionId);
  if (sourceSystem && SYSTEM_DEFINITIONS[sourceSystem]) {
    const systemDef = SYSTEM_DEFINITIONS[sourceSystem];
    
  systemDef.affects.forEach(affect => {
    if (affectedSystems.has(affect.system) || shouldShowInterconnection(affect.system, gameState)) {
      systemEffects.push({
        sourceSystem,
        targetSystem: affect.system,
        effectType: affect.effect === 'positive' ? 'positive' : 'negative',
        magnitude: calculateMagnitude(affect.effect, directEffects, affect.system),
        description: affect.description,
        isActive: true,
      });
    }
  });

    // Check for chain reactions
    systemDef.affects.forEach(affect => {
      if (SYSTEM_DEFINITIONS[affect.system]) {
        const targetSystemDef = SYSTEM_DEFINITIONS[affect.system];
        targetSystemDef.affects.forEach(chainAffect => {
          if (chainAffect.system !== sourceSystem && chainAffect.system !== affect.system) {
            chainReactions.push(`${affect.system} → ${chainAffect.system}`);
          }
        });
      }
    });
  }

  // Calculate modifier breakdown
  const modifierBreakdown: string[] = [];
  if (modifiers.commitmentBonus) {
    modifierBreakdown.push(`Commitment Bonus: +${modifiers.commitmentBonus}%`);
  }
  if (modifiers.prestigeBonus) {
    modifierBreakdown.push(`Prestige Bonus: +${modifiers.prestigeBonus}%`);
  }
  if (modifiers.lifestyleModifier) {
    modifierBreakdown.push(`Lifestyle Modifier: +${modifiers.lifestyleModifier}%`);
  }
  if (modifiers.mindsetModifier) {
    modifierBreakdown.push(`Mindset Modifier: ${modifiers.mindsetModifier > 0 ? '+' : ''}${modifiers.mindsetModifier}%`);
  }

  // Calculate base and final values
  const baseValue = Object.values(directEffects).reduce((sum, val) => sum + (val || 0), 0);
  const totalModifier = Object.values(modifiers).reduce((sum, val) => sum + (val || 0), 0);
  const finalValue = baseValue * (1 + totalModifier / 100);

  return {
    actionId,
    actionName,
    directEffects,
    systemEffects,
    chainReactions: [...new Set(chainReactions)],
    modifiers,
    calculatedValues: {
      baseValue,
      finalValue,
      modifierBreakdown,
    },
  };
}

/**
 * Get active system interconnections
 */
export function getSystemInterconnections(gameState: GameState): SystemInterconnection[] {
  const interconnections: SystemInterconnection[] = [];
  const activeSystems = getActiveSystems(gameState);

  activeSystems.forEach(systemId => {
    const systemDef = SYSTEM_DEFINITIONS[systemId];
    if (systemDef) {
      systemDef.affects.forEach(affect => {
        if (shouldShowInterconnection(affect.system, gameState)) {
          interconnections.push({
            sourceSystem: systemId,
            targetSystem: affect.system,
            effectType: affect.effect,
            magnitude: 1, // Default magnitude
            description: affect.description,
            isActive: true,
          });
        }
      });
    }
  });

  return interconnections;
}

/**
 * Calculate system health metrics
 */
export function getSystemHealth(gameState: GameState): SystemHealth[] {
  const systems: SystemHealth[] = [];
  const activeSystems = getActiveSystems(gameState);

  activeSystems.forEach(systemId => {
    const systemDef = SYSTEM_DEFINITIONS[systemId];
    if (systemDef) {
      const health = calculateSystemHealth(systemId, gameState);
      const engagement = calculateSystemEngagement(systemId, gameState);
      const trend = calculateSystemTrend(systemId, gameState);

      systems.push({
        systemId,
        systemName: systemDef.name,
        health,
        trend,
        engagement,
        lastActivity: getLastActivity(systemId, gameState),
      });
    }
  });

  return systems;
}

/**
 * Track system engagement
 */
export function trackSystemEngagement(gameState: GameState): Record<string, number> {
  const engagement: Record<string, number> = {};
  const activeSystems = getActiveSystems(gameState);

  activeSystems.forEach(systemId => {
    engagement[systemId] = calculateSystemEngagement(systemId, gameState);
  });

  return engagement;
}

// Helper functions

function getSystemFromAction(actionId: string): string | null {
  if (actionId.includes('work') || actionId.includes('career') || actionId.includes('job')) {
    return 'career';
  }
  if (actionId.includes('relationship') || actionId.includes('social') || actionId.includes('contact')) {
    return 'relationships';
  }
  if (actionId.includes('health') || actionId.includes('gym') || actionId.includes('diet')) {
    return 'health';
  }
  if (actionId.includes('hobby') || actionId.includes('train')) {
    return 'hobbies';
  }
  if (actionId.includes('education') || actionId.includes('study')) {
    return 'education';
  }
  if (actionId.includes('travel')) {
    return 'travel';
  }
  if (actionId.includes('political') || actionId.includes('policy')) {
    return 'politics';
  }
  if (actionId.includes('rd') || actionId.includes('research')) {
    return 'rd';
  }
  if (actionId.includes('company') || actionId.includes('business')) {
    return 'company';
  }
  if (actionId.includes('realEstate') || actionId.includes('property')) {
    return 'realEstate';
  }
  if (actionId.includes('stock') || actionId.includes('invest')) {
    return 'stocks';
  }
  if (actionId.includes('socialMedia') || actionId.includes('post')) {
    return 'socialMedia';
  }
  return null;
}

function shouldShowInterconnection(systemId: string, gameState: GameState): boolean {
  // Only show interconnections for systems that are active or relevant
  const activeSystems = getActiveSystems(gameState);
  return activeSystems.includes(systemId) || isSystemRelevant(systemId, gameState);
}

function isSystemRelevant(systemId: string, gameState: GameState): boolean {
  switch (systemId) {
    case 'money':
      return true; // Always relevant
    case 'health':
      return gameState.stats.health < 80;
    case 'happiness':
      return gameState.stats.happiness < 80;
    case 'energy':
      return gameState.stats.energy < 50;
    case 'reputation':
      return (gameState.stats.reputation || 0) > 0;
    default:
      return false;
  }
}

function calculateMagnitude(
  _effectType: 'positive' | 'negative',
  directEffects: StatChange,
  targetSystem: string
): number {
  const value = directEffects[targetSystem as keyof StatChange] || 0;
  return Math.abs(value) / 10; // Normalize to 0-10 scale
}

function getActiveSystems(gameState: GameState): string[] {
  const systems: string[] = [];

  if (gameState.careers && gameState.careers.length > 0 && gameState.currentJob) {
    systems.push('career');
  }
  if (gameState.relationships && gameState.relationships.length > 0) {
    systems.push('relationships');
  }
  if (gameState.healthActivities && gameState.healthActivities.length > 0) {
    systems.push('health');
  }
  if (gameState.hobbies && gameState.hobbies.length > 0) {
    systems.push('hobbies');
  }
  if (gameState.educations && gameState.educations.length > 0) {
    systems.push('education');
  }
  if (gameState.travel) {
    systems.push('travel');
  }
  if (gameState.politics) {
    systems.push('politics');
  }
  if (gameState.company?.rdLab) {
    systems.push('rd');
  }
  if (gameState.company) {
    systems.push('company');
  }
  if (gameState.realEstate && gameState.realEstate.length > 0) {
    systems.push('realEstate');
  }
  if (gameState.stocks && gameState.stocks.holdings && gameState.stocks.holdings.length > 0) {
    systems.push('stocks');
  }
  if (gameState.socialMedia) {
    systems.push('socialMedia');
  }

  return systems;
}

function calculateSystemHealth(systemId: string, gameState: GameState): number {
  switch (systemId) {
    case 'career':
      const career = gameState.careers?.find(c => c.id === gameState.currentJob);
      if (!career) return 0;
      return Math.min(100, (career.level / (career.levels?.length || 10)) * 100 + (career.progress || 0));
    case 'relationships':
      const avgRelationship = gameState.relationships?.reduce((sum, r) => sum + (r.relationshipScore || 0), 0) / (gameState.relationships?.length || 1);
      return Math.min(100, avgRelationship);
    case 'health':
      return gameState.stats.health;
    case 'hobbies':
      const avgHobbySkill = gameState.hobbies?.reduce((sum, h) => sum + (h.skill || 0), 0) / (gameState.hobbies?.length || 1);
      return Math.min(100, avgHobbySkill);
    default:
      return 50; // Default health
  }
}

function calculateSystemEngagement(systemId: string, gameState: GameState): number {
  // Calculate based on recent activity
  let engagement = 0;

  switch (systemId) {
    case 'career':
      if (gameState.currentJob) engagement = 80;
      break;
    case 'relationships':
      engagement = Math.min(100, (gameState.relationships?.length || 0) * 10);
      break;
    case 'health':
      engagement = gameState.healthActivities?.length ? 70 : 30;
      break;
    case 'hobbies':
      engagement = gameState.hobbies?.length ? 60 : 20;
      break;
  }

  return engagement;
}

function calculateSystemTrend(systemId: string, gameState: GameState): 'improving' | 'declining' | 'stable' {
  // Simple trend calculation - can be enhanced with historical data
  const health = calculateSystemHealth(systemId, gameState);
  if (health > 70) return 'improving';
  if (health < 40) return 'declining';
  return 'stable';
}

function getLastActivity(_systemId: string, gameState: GameState): number {
  // Return current timestamp as placeholder - can be enhanced with actual tracking
  // Use week as approximation
  return gameState.week ? gameState.week * 7 * 24 * 60 * 60 * 1000 : Date.now();
}

