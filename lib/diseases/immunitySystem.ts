import type { GameState } from '@/contexts/game/types';

/**
 * Diseases that grant immunity after being cured
 * Common diseases like cold and flu grant immunity
 */
const IMMUNITY_GRANTING_DISEASES = [
  'common_cold',
  'flu',
  'minor_infection',
];

/**
 * Check if a disease grants immunity after being cured
 */
export function doesDiseaseGrantImmunity(diseaseId: string): boolean {
  return IMMUNITY_GRANTING_DISEASES.includes(diseaseId);
}

/**
 * Add immunity to a disease after it's been cured
 */
export function addDiseaseImmunity(state: GameState, diseaseId: string): GameState {
  if (!doesDiseaseGrantImmunity(diseaseId)) {
    return state;
  }

  const currentImmunities = state.diseaseImmunities || [];
  
  // Don't add if already immune
  if (currentImmunities.includes(diseaseId)) {
    return state;
  }

  return {
    ...state,
    diseaseImmunities: [...currentImmunities, diseaseId],
  };
}

/**
 * Check if player has immunity to a disease
 */
export function hasImmunity(state: GameState, diseaseId: string): boolean {
  const immunities = state.diseaseImmunities || [];
  return immunities.includes(diseaseId);
}

/**
 * Get immunity reduction factor for a disease
 * Returns a multiplier (0.1 = 90% reduction in risk)
 */
export function getImmunityReduction(diseaseId: string): number {
  if (doesDiseaseGrantImmunity(diseaseId)) {
    return 0.1; // 90% reduction in risk
  }
  return 1.0; // No reduction
}

