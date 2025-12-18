/**
 * Progressive Information Disclosure
 * System to reveal complexity gradually based on player experience
 */

import { GameState } from '@/contexts/game/types';
import { logger } from '@/utils/logger';

const log = logger.scope('ProgressiveDisclosure');

export type DisclosureLevel = 'simple' | 'standard' | 'advanced';

export interface DisclosureSettings {
  level: DisclosureLevel;
  autoProgression: boolean;
  weeksPlayed: number;
  systemsDiscovered: number;
  depthScore: number;
}

/**
 * Calculate appropriate disclosure level based on player experience
 */
export function calculateDisclosureLevel(gameState: GameState): DisclosureLevel {
  const settings = gameState.settings;
  const manualLevel = gameState.progressiveDisclosureLevel;
  
  // If manual level is set and auto-progression is disabled, use manual
  if (manualLevel && !settings.autoProgression) {
    return manualLevel;
  }

  // Auto-calculate based on experience
  const weeksLived = gameState.weeksLived || 0;
  const discoveredSystems = gameState.discoveredSystems?.length || 0;
  const { calculateDepthScore } = require('@/lib/depth/discoverySystem');
  const depthScore = calculateDepthScore(gameState);

  // Simple: First 4 weeks or < 3 systems discovered
  if (weeksLived < 4 || discoveredSystems < 3) {
    return 'simple';
  }

  // Advanced: 20+ weeks, 10+ systems, depth score > 50
  if (weeksLived >= 20 && discoveredSystems >= 10 && depthScore > 50) {
    return 'advanced';
  }

  // Standard: Default for most players
  return 'standard';
}

/**
 * Get disclosure level for current game state
 */
export function getDisclosureLevel(gameState: GameState): DisclosureLevel {
  const manualLevel = gameState.progressiveDisclosureLevel;
  const settings = gameState.settings;

  // Check if auto-progression is enabled
  if (settings.autoProgression !== false) {
    // Auto-progression is enabled by default
    return calculateDisclosureLevel(gameState);
  }

  // Use manual level if set, otherwise calculate
  return manualLevel || calculateDisclosureLevel(gameState);
}

/**
 * Get content based on disclosure level
 */
export function getDisclosedContent<T extends { simple?: string; standard?: string; advanced?: string }>(
  content: T,
  level: DisclosureLevel
): string {
  switch (level) {
    case 'simple':
      return content.simple || content.standard || content.advanced || '';
    case 'standard':
      return content.standard || content.advanced || content.simple || '';
    case 'advanced':
      return content.advanced || content.standard || content.simple || '';
    default:
      return content.standard || content.advanced || content.simple || '';
  }
}

/**
 * Check if feature should be shown based on disclosure level
 */
export function shouldShowFeature(
  featureLevel: 'simple' | 'standard' | 'advanced',
  currentLevel: DisclosureLevel
): boolean {
  const levelOrder: Record<DisclosureLevel, number> = {
    simple: 1,
    standard: 2,
    advanced: 3,
  };

  return levelOrder[currentLevel] >= levelOrder[featureLevel];
}

/**
 * Get disclosure settings for display
 */
export function getDisclosureSettings(gameState: GameState): DisclosureSettings {
  const level = getDisclosureLevel(gameState);
  const discoveredSystems = gameState.discoveredSystems?.length || 0;
  const { calculateDepthScore } = require('@/lib/depth/discoverySystem');
  const depthScore = calculateDepthScore(gameState);

  return {
    level,
    autoProgression: gameState.settings.autoProgression !== false,
    weeksPlayed: gameState.weeksLived || 0,
    systemsDiscovered: discoveredSystems,
    depthScore,
  };
}

/**
 * Get next level requirements
 */
export function getNextLevelRequirements(
  currentLevel: DisclosureLevel,
  gameState: GameState
): {
  nextLevel: DisclosureLevel | null;
  requirements: string[];
  progress: number; // 0-100
} {
  if (currentLevel === 'advanced') {
    return {
      nextLevel: null,
      requirements: [],
      progress: 100,
    };
  }

  const weeksLived = gameState.weeksLived || 0;
  const discoveredSystems = gameState.discoveredSystems?.length || 0;
  const { calculateDepthScore } = require('@/lib/depth/discoverySystem');
  const depthScore = calculateDepthScore(gameState);

  if (currentLevel === 'simple') {
    const nextLevel: DisclosureLevel = 'standard';
    const requirements: string[] = [];
    let progress = 0;

    // Need 4 weeks or 3 systems
    if (weeksLived >= 4) {
      requirements.push('✓ 4 weeks played');
      progress += 50;
    } else {
      requirements.push(`${weeksLived}/4 weeks played`);
    }

    if (discoveredSystems >= 3) {
      requirements.push('✓ 3 systems discovered');
      progress += 50;
    } else {
      requirements.push(`${discoveredSystems}/3 systems discovered`);
    }

    return {
      nextLevel,
      requirements,
      progress,
    };
  }

  // Current level is standard, next is advanced
  const nextLevel: DisclosureLevel = 'advanced';
  const requirements: string[] = [];
  let progress = 0;

  // Need 20 weeks, 10 systems, depth score > 50
  if (weeksLived >= 20) {
    requirements.push('✓ 20 weeks played');
    progress += 33;
  } else {
    requirements.push(`${weeksLived}/20 weeks played`);
  }

  if (discoveredSystems >= 10) {
    requirements.push('✓ 10 systems discovered');
    progress += 33;
  } else {
    requirements.push(`${discoveredSystems}/10 systems discovered`);
  }

  if (depthScore > 50) {
    requirements.push(`✓ Depth score > 50 (${Math.round(depthScore)})`);
    progress += 34;
  } else {
    requirements.push(`Depth score > 50 (${Math.round(depthScore)}/50)`);
  }

  return {
    nextLevel,
    requirements,
    progress: Math.round(progress),
  };
}

