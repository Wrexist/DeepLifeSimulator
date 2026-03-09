import type { GameState, Disease } from '@/contexts/game/types';
import { DISEASE_DEFINITIONS, DiseaseTemplate, createDiseaseFromTemplate, getDiseaseTemplate } from './diseaseDefinitions';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';

/**
 * Deterministic seeded random function for consistency
 * Uses the same pattern as the event system
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Cache for disease risk calculations
 * Key: `${weeksLived}_${health}_${fitness}_${age}`
 */
const riskCache = new Map<string, number>();
const CACHE_MAX_SIZE = 100;

/**
 * Clear old cache entries to prevent memory leaks
 */
function clearOldCacheEntries() {
  if (riskCache.size > CACHE_MAX_SIZE) {
    // Remove oldest 20% of entries
    const entriesToRemove = Math.floor(CACHE_MAX_SIZE * 0.2);
    const keys = Array.from(riskCache.keys());
    for (let i = 0; i < entriesToRemove; i++) {
      riskCache.delete(keys[i]);
    }
  }
}

/**
 * Calculate base disease risk based on player stats
 * Returns a risk multiplier (0-1)
 * Uses caching for performance
 */
export function calculateDiseaseRisk(state: GameState): number {
  const health = state.stats.health || 100;
  const fitness = state.stats.fitness || 0;
  const age = state.date?.age || ADULTHOOD_AGE;
  const weeksLived = state.weeksLived || 0;

  // Check cache first
  const cacheKey = `${weeksLived}_${Math.round(health)}_${Math.round(fitness)}_${age}`;
  const cachedRisk = riskCache.get(cacheKey);
  if (cachedRisk !== undefined) {
    return cachedRisk;
  }

  // Base risk starts at 1.0 (normal)
  let riskMultiplier = 1.0;

  // Health-based risk (lower health = higher risk)
  if (health < 50) {
    // Exponential increase as health drops
    const healthPenalty = (50 - health) / 50; // 0 to 1
    riskMultiplier += healthPenalty * 2.0; // Up to 3x risk at 0 health
  } else if (health < 70) {
    // Moderate increase for health 50-70
    const healthPenalty = (70 - health) / 20; // 0 to 1
    riskMultiplier += healthPenalty * 0.5; // Up to 1.5x risk
  }

  // Fitness-based risk (lower fitness = higher risk, higher fitness = lower risk)
  if (fitness < 30) {
    const fitnessPenalty = (30 - fitness) / 30; // 0 to 1
    riskMultiplier += fitnessPenalty * 1.0; // Up to 2x additional risk
  } else if (fitness > 70) {
    // High fitness provides protection (reduces risk)
    const fitnessBonus = (fitness - 70) / 30; // 0 to 1 for fitness 70-100
    riskMultiplier -= fitnessBonus * 0.5; // Up to 0.5x reduction (50% less risk at 100 fitness)
    riskMultiplier = Math.max(0.3, riskMultiplier); // Minimum 30% of base risk
  }

  // Age-based risk (scales dramatically with age)
  if (age < 25) {
    // Very low chance before 25 years old
    const youthProtection = (25 - age) / 25; // 0 to 1 for ages 0-25
    riskMultiplier *= (0.3 + youthProtection * 0.2); // 30-50% of base risk (very low)
  } else if (age >= 50) {
    // Drastic increase after 50
    const agePenalty = (age - 50) / 50; // 0 to 1+ for ages 50-100+
    riskMultiplier += agePenalty * 2.5; // Very significant increase (up to 3.5x additional risk)
  } else {
    // Gradual increase from 25 to 50
    const ageProgress = (age - 25) / 25; // 0 to 1 for ages 25-50
    riskMultiplier += ageProgress * 0.8; // Gradual increase from 0 to 0.8x additional risk
  }

  // Cap maximum risk multiplier
  const finalRisk = Math.min(riskMultiplier, 5.0);
  
  // Cache the result
  riskCache.set(cacheKey, finalRisk);
  clearOldCacheEntries();
  
  return finalRisk;
}

/**
 * Check if a disease should be generated this week
 * Enforces cooldown (max 1 disease per 4 weeks)
 */
export function shouldGenerateDisease(state: GameState): boolean {
  const weeksLived = state.weeksLived || 0;
  // If lastDiseaseWeek is undefined (old save or new game), treat as if cooldown is already met
  // by defaulting to a value far enough in the past. Using 0 would make old saves at week 50+
  // bypass cooldown every single week (since 50 - 0 = 50 > 4).
  const lastDiseaseWeek =
    state.lastDiseaseWeek !== undefined && state.lastDiseaseWeek !== null
      ? state.lastDiseaseWeek
      : Math.max(0, weeksLived - 4); // Pretend last disease was exactly 4 weeks ago
  const weeksSinceLastDisease = weeksLived - lastDiseaseWeek;

  // Cooldown: max 1 disease per 4 weeks
  if (weeksSinceLastDisease < 4) {
    return false;
  }

  return true;
}

/**
 * Calculate individual disease risk based on template and player state
 */
function calculateDiseaseSpecificRisk(
  template: DiseaseTemplate,
  state: GameState,
  baseRiskMultiplier: number
): number {
  const health = state.stats.health || 100;
  const fitness = state.stats.fitness || 0;
  const age = state.date?.age || ADULTHOOD_AGE;

  // Start with base chance
  let chance = template.baseChance;

  // Apply age risk modifier (scales with age)
  let ageRisk = 0;
  if (age < 25) {
    // Very low chance before 25 - reduce base chance significantly
    const youthProtection = (25 - age) / 25; // 0 to 1 for ages 0-25
    ageRisk = -(0.5 + youthProtection * 0.3); // 50-80% reduction in chance
  } else if (age >= 50) {
    // Drastic increase after 50
    const agePenalty = (age - 50) / 50; // 0 to 1+ for ages 50-100+
    ageRisk = agePenalty * template.ageRiskModifier * 2.0; // Very significant increase
  } else {
    // Gradual increase from 25 to 50
    const ageProgress = (age - 25) / 25; // 0 to 1 for ages 25-50
    ageRisk = ageProgress * template.ageRiskModifier * 0.8; // Gradual increase
  }
  chance *= (1 + ageRisk);

  // Apply health risk modifier
  const healthRisk = health < 50
    ? (50 - health) / 50 * template.healthRiskModifier
    : 0;
  chance *= (1 + healthRisk);

  // Apply fitness risk modifier (low fitness increases risk, high fitness reduces risk)
  let fitnessRisk = 0;
  if (fitness < 30) {
    fitnessRisk = (30 - fitness) / 30 * template.fitnessRiskModifier;
  } else if (fitness > 70) {
    // High fitness reduces disease risk
    const fitnessProtection = (fitness - 70) / 30; // 0 to 1 for fitness 70-100
    fitnessRisk = -fitnessProtection * 0.4; // Up to 40% reduction at 100 fitness
  }
  chance *= (1 + fitnessRisk);

  // Apply base risk multiplier from overall health
  chance *= baseRiskMultiplier;

  // Check for immunity (if implemented)
  if ('diseaseImmunities' in state && Array.isArray(state.diseaseImmunities)) {
    if (state.diseaseImmunities.includes(template.id)) {
      chance *= 0.1; // 90% reduction if immune
    }
  }

  // Check for vaccinations (if implemented)
  if ('vaccinations' in state && Array.isArray(state.vaccinations)) {
    // Some diseases can be prevented by vaccinations
    if (template.id === 'flu' && state.vaccinations.includes('flu_shot')) {
      chance *= 0.2; // 80% reduction with flu shot
    }
    if (template.id === 'pneumonia' && state.vaccinations.includes('pneumonia_vaccine')) {
      chance *= 0.3; // 70% reduction with pneumonia vaccine
    }
  }

  return Math.min(chance, 0.5); // Cap at 50% max chance
}

/**
 * Generate a random disease based on player state
 * Returns null if no disease should be generated
 */
export function generateRandomDisease(state: GameState): Disease | null {
  // Check cooldown
  if (!shouldGenerateDisease(state)) {
    return null;
  }

  const weeksLived = state.weeksLived || 0;
  const year = state.date?.year || 2025;
  const weekSeed = weeksLived * 1000 + year * 100;

  // Calculate base risk
  const baseRiskMultiplier = calculateDiseaseRisk(state);
  const age = state.date?.age || ADULTHOOD_AGE;

  // If risk is very low and health is good, reduce chance further (but less so for older players)
  if (baseRiskMultiplier < 1.2 && (state.stats.health || 100) > 80 && age < 30) {
    // Very low chance when healthy and young
    const healthyRoll = seededRandom(weekSeed + 10000);
    if (healthyRoll > 0.02) { // 2% chance even when healthy and young
      return null;
    }
  }

  // Roll for each disease type
  let diseaseRoll = seededRandom(weekSeed + 20000);
  let cumulativeChance = 0;

  // Calculate chances for all diseases
  const diseaseChances = DISEASE_DEFINITIONS.map(template => ({
    template,
    chance: calculateDiseaseSpecificRisk(template, state, baseRiskMultiplier),
  }));

  // Normalize chances (sum should be reasonable)
  const totalChance = diseaseChances.reduce((sum, d) => sum + d.chance, 0);

  // If total chance is very low, likely no disease
  if (totalChance < 0.01) {
    return null;
  }

  // Select disease based on weighted random
  for (const { template, chance } of diseaseChances) {
    cumulativeChance += chance / totalChance;
    if (diseaseRoll < cumulativeChance) {
      return createDiseaseFromTemplate(template, weeksLived);
    }
  }

  return null;
}

/**
 * Generate a disease from an event
 * Used when events trigger specific diseases
 */
export function generateEventDisease(eventId: string, state: GameState): Disease | null {
  const weeksLived = state.weeksLived || 0;

  // Map event IDs to potential diseases
  const eventDiseaseMap: Record<string, string[]> = {
    medical_emergency: ['pneumonia', 'heart_disease', 'stroke', 'organ_failure'],
    accident: ['minor_infection', 'organ_failure'],
    stress_event: ['stress', 'depression'],
  };

  const possibleDiseaseIds = eventDiseaseMap[eventId];
  if (!possibleDiseaseIds || possibleDiseaseIds.length === 0) {
    return null;
  }

  // Use deterministic random based on event and week
  const eventSeed = weeksLived * 1000 + eventId.charCodeAt(0) * 100;
  const diseaseIndex = Math.floor(seededRandom(eventSeed) * possibleDiseaseIds.length);
  const diseaseId = possibleDiseaseIds[diseaseIndex];

  const template = getDiseaseTemplate(diseaseId);
  if (!template) {
    return null;
  }

  return createDiseaseFromTemplate(template, weeksLived);
}

/**
 * Generate a specific disease by ID
 * Useful for testing or special events
 */
export function generateSpecificDisease(diseaseId: string, state: GameState): Disease | null {
  const template = getDiseaseTemplate(diseaseId);
  if (!template) {
    return null;
  }

  const weeksLived = state.weeksLived || 0;
  return createDiseaseFromTemplate(template, weeksLived);
}

