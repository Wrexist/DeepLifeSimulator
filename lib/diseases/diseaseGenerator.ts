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
 * Key: `${weeksLived}_${health}_${age}`
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
 *
 * HEALTH and AGE only. Fitness used to be in here as well (+1.0 at fitness 0,
 * −0.5 above 70) AND in `calculateDiseaseSpecificRisk`, which multiplies each
 * template's chance by its own `fitnessRiskModifier` (1.2-1.8 at fitness 0)
 * and then by THIS multiplier - so the same number was charged twice. For a
 * fresh 25-year-old at the seeded fitness of 10 that was ×1.67 here times
 * ×2.5 there: the disease chance of a 60-year-old, and enough to fail the
 * "healthy and young" gate below (`< 1.2`) that every 18-24 start passes.
 * Measured on the real tick (Master Program 7, 2026-09-02): a careful
 * age-25 start - housed, one walk and one meditation a week - caught four
 * illnesses in 17 weeks and reached health 0 at week 18; with fitness
 * counted once it ends week 20 at health 96. The per-template term is the
 * one kept: it is disease-specific (a heart condition cares more about
 * fitness than a cold does) and still bites - fitness 0 raises every chance
 * by 120-180% and fitness 100 lowers it by 40%.
 */
export function calculateDiseaseRisk(state: GameState): number {
  // BUGFIX: use ?? for health so a 0-health player is correctly treated as
  // high-risk. With `|| 100`, 0 was silently mapped to 100 (full health),
  // making severely sick players incorrectly disease-resistant.
  const health = state.stats.health ?? 100;
  const age = state.date?.age ?? ADULTHOOD_AGE;
  const weeksLived = state.weeksLived || 0;

  // Check cache first
  const cacheKey = `${weeksLived}_${Math.round(health)}_${age}`;
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

  // Fitness is deliberately NOT here - see the header. It is applied once,
  // per disease, in `calculateDiseaseSpecificRisk`.

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
 * Calculate individual disease risk based on template and player state.
 * Exported for the fitness-monotonicity test: this is the ONE place fitness
 * moves a disease chance.
 */
export function calculateDiseaseSpecificRisk(
  template: DiseaseTemplate,
  state: GameState,
  baseRiskMultiplier: number
): number {
  // BUGFIX: `||` treats health=0 as falsy and inflates it to 100, masking a
  // dying player as healthy in disease-risk calc.
  const health = state.stats?.health ?? 100;
  const fitness = state.stats?.fitness ?? 0;
  const age = state.date?.age ?? ADULTHOOD_AGE;

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
  // BUGFIX: use ?? so a 0-health player is correctly excluded from the
  // "healthy young → low disease chance" path. Previously, 0 was silently
  // treated as 100, making sick players inadvertently disease-resistant.
  if (baseRiskMultiplier < 1.2 && (state.stats.health ?? 100) > 80 && age < 30) {
    // Very low chance when healthy and young
    const healthyRoll = seededRandom(weekSeed + 10000);
    if (healthyRoll > 0.02) { // 2% chance even when healthy and young
      return null;
    }
  }

  // Filter the pool before rolling:
  //  - minAge keeps age-related conditions (heart disease, stroke, dementia…)
  //    from hitting implausibly young players;
  //  - no duplicates of an already-active disease;
  //  - at most 2 concurrent non-mild conditions - beyond that only mild
  //    diseases can still occur;
  //  - never stack a second terminal (weeksUntilDeath) illness.
  const activeDiseases = Array.isArray(state.diseases) ? state.diseases : [];
  const activeSeriousCount = activeDiseases.filter(d => d && d.severity !== 'mild').length;
  const hasTerminal = activeDiseases.some(d => d && typeof d.weeksUntilDeath === 'number');
  const eligibleTemplates = DISEASE_DEFINITIONS.filter(template => {
    if (template.minAge != null && age < template.minAge) return false;
    if (activeDiseases.some(d => d && d.id === template.id)) return false;
    if (activeSeriousCount >= 2 && template.severity !== 'mild') return false;
    if (hasTerminal && template.weeksUntilDeath != null) return false;
    return true;
  });

  // Roll for each disease type
  let diseaseRoll = seededRandom(weekSeed + 20000);
  let cumulativeChance = 0;

  // Calculate chances for all diseases
  const diseaseChances = eligibleTemplates.map(template => ({
    template,
    chance: calculateDiseaseSpecificRisk(template, state, baseRiskMultiplier),
  }));

  const totalChance = diseaseChances.reduce((sum, d) => sum + d.chance, 0);

  // If total chance is very low, likely no disease
  if (totalChance < 0.01) {
    return null;
  }

  // Occurrence gate: roll against the summed absolute risk. Previously the
  // per-disease chances were only normalized into a "which disease" pick, so
  // once past the gates above a disease landed EVERY cooldown window (~13 a
  // year) regardless of how small the individual chances were.
  const occurrenceChance = Math.min(totalChance, 0.35);
  if (seededRandom(weekSeed + 30000) >= occurrenceChance) {
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

  // Respect the same guards as the weekly roll: age gates, no duplicates,
  // and never stack a second terminal illness via an event.
  const age = state.date?.age ?? ADULTHOOD_AGE;
  const activeDiseases = Array.isArray(state.diseases) ? state.diseases : [];
  const hasTerminal = activeDiseases.some(d => d && typeof d.weeksUntilDeath === 'number');
  const possibleDiseaseIds = (eventDiseaseMap[eventId] || []).filter(id => {
    const template = getDiseaseTemplate(id);
    if (!template) return false;
    if (template.minAge != null && age < template.minAge) return false;
    if (activeDiseases.some(d => d && d.id === id)) return false;
    if (hasTerminal && template.weeksUntilDeath != null) return false;
    return true;
  });
  if (possibleDiseaseIds.length === 0) {
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

