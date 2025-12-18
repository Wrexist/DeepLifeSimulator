/**
 * Action Impact Enhancer
 * Wraps action results with system interconnection and impact data
 */

import { GameState } from '@/contexts/game/types';
import { calculateActionImpact, ActionImpact, StatChange } from './systemInterconnections';
import { updateSystemUsage } from './discoverySystem';

/**
 * Enhance action result with impact data
 */
export function enhanceActionResult(
  actionId: string,
  actionName: string,
  directEffects: StatChange,
  gameState: GameState,
  originalResult?: { success: boolean; message: string; [key: string]: any }
): { 
  success: boolean; 
  message: string; 
  impact?: ActionImpact;
  [key: string]: any;
} {
  // Calculate action impact
  const impact = calculateActionImpact(actionId, actionName, directEffects, gameState);

  // Update system usage for discovery
  const systemId = getSystemFromAction(actionId);
  if (systemId) {
    updateSystemUsage(systemId, gameState);
  }

  return {
    ...(originalResult || { success: true, message: '' }),
    impact,
  };
}

/**
 * Get system ID from action ID
 */
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
  if (actionId.includes('streetJob') || actionId.includes('street_job')) {
    return 'streetJobs';
  }
  return null;
}

