/**
 * System Interconnection Tracker
 * Tracks and calculates how game systems affect each other
 */

import type { GameState } from '@/contexts/game/types';
import { MS_PER_WEEK } from '@/lib/config/gameConstants';

export interface SystemInterconnection {
  sourceSystem: string;
  targetSystem: string;
  effectType: 'positive' | 'negative';
  magnitude: number;
  description: string;
  isActive: boolean;
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
  // Use weeksLived for a game-time approximation (week cycles 1-4, weeksLived is absolute)
  return gameState.weeksLived ? gameState.weeksLived * MS_PER_WEEK : Date.now();
}

