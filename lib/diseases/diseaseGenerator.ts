import type { GameState, Disease } from '@/contexts/game/types';
import { DISEASE_DEFINITIONS, DiseaseTemplate, createDiseaseFromTemplate, getDiseaseTemplate } from './diseaseDefinitions';
import { ADULTHOOD_AGE } from '@/lib/config/gameConstants';
import { makeLifeRoll } from '@/utils/seededRoll';

/**
 * The weekly chance an illness arrives for a life whose overall risk
 * multiplier is exactly 1 (age 25, health ≥ 70, fitness 30-70). The Help copy
 * has always said "1-2% per week"; a young, fit, healthy life multiplies this
 * by 0.3-0.5 and lands there, an unfit 40-year-old by ~2.5, a frail 75-year-old
 * by 3-4. See `calculateDiseaseRisk`.
 */
export const DISEASE_BASE_WEEKLY_CHANCE = 0.03;
/** Safety ceiling on occurrence per eligible week. The multiplier's own cap (5.0) keeps it below this. */
export const DISEASE_OCCURRENCE_CAP = 0.35;

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
 * The OVERALL weekly disease-risk multiplier: health, fitness and age.
 *
 * Since Master Program 8 this is the number the occurrence roll uses -
 * `DISEASE_BASE_WEEKLY_CHANCE × calculateDiseaseRisk(state)` is the chance an
 * illness arrives this week - which is exactly what the Help copy has always
 * described ("the base chance is low, 1-2% per week, but risk factors multiply
 * it"). The per-template curves (`calculateDiseaseSpecificRisk`) decide WHICH
 * illness, not whether one arrives.
 *
 * Before, the occurrence roll was the SUM of every template's chance, and
 * that sum was ~16%/week before a single modifier - eight times the advertised
 * base - then multiplied by this function AND by each template's own age /
 * health / fitness terms. Any adult at the seeded fitness of 10 (0 within a
 * month) sat at the 35% cap with nothing left to do about it; a careful,
 * housed 40-year-old was ill 51 of 52 simulated weeks. Fitness is counted
 * here and only here for occurrence (Program 7 removed the double count).
 *
 * Age is CONTINUOUS at 50: the old "past 50" branch restarted from zero, so a
 * 49-year-old carried +0.8 and a 50-year-old +0.0.
 */
export function calculateDiseaseRisk(state: GameState): number {
  // BUGFIX: use ?? for health so a 0-health player is correctly treated as
  // high-risk. With `|| 100`, 0 was silently mapped to 100 (full health),
  // making severely sick players incorrectly disease-resistant.
  const health = state.stats.health ?? 100;
  const fitness = state.stats.fitness ?? 0;
  const age = state.date?.age ?? ADULTHOOD_AGE;
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

  // Fitness-based risk (lower fitness = higher risk, higher fitness = lower risk).
  // Counted here for OCCURRENCE only; the per-template fitness term below only
  // weights which illness is picked.
  if (fitness < 30) {
    const fitnessPenalty = (30 - fitness) / 30; // 0 to 1
    riskMultiplier += fitnessPenalty * 1.0; // Up to +1.0 at fitness 0
  } else if (fitness > 70) {
    const fitnessBonus = (fitness - 70) / 30; // 0 to 1 for fitness 70-100
    riskMultiplier -= fitnessBonus * 0.5; // Up to -0.5 at fitness 100
    riskMultiplier = Math.max(0.3, riskMultiplier);
  }

  // Age-based risk (scales dramatically with age)
  if (age < 25) {
    // Very low chance before 25 years old
    const youthProtection = (25 - age) / 25; // 0 to 1 for ages 0-25
    riskMultiplier *= (0.3 + youthProtection * 0.2); // 30-50% of base risk (very low)
  } else if (age >= 50) {
    // Steeper past 50, continuing from where the 25-50 ramp ends (+0.8).
    const agePenalty = (age - 50) / 50; // 0 to 1+ for ages 50-100+
    riskMultiplier += 0.8 + agePenalty * 2.5; // +0.8 at 50 → +3.3 at 100
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
 * A template's WEIGHT in the "which illness" pick: its base chance shaped by
 * the template's own age / health / fitness sensitivities, immunity and
 * vaccination. Relative, not absolute - whether an illness arrives at all is
 * `DISEASE_BASE_WEEKLY_CHANCE × calculateDiseaseRisk` (Program 8); this only
 * says that a low-fitness life is more likely to draw a heart condition than a
 * cold. Exported for the curve tests.
 */
export function calculateDiseaseSpecificRisk(
  template: DiseaseTemplate,
  state: GameState,
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
    // Continues from where the 25-50 ramp ends (0.8 × modifier) - see calculateDiseaseRisk.
    const agePenalty = (age - 50) / 50; // 0 to 1+ for ages 50-100+
    ageRisk = template.ageRiskModifier * (0.8 + agePenalty * 2.0);
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
  // Keyed on the LIFE and the week (`makeLifeRoll`), not the week alone. The
  // old seed was `weeksLived * 1000 + year * 100` - identical for every life at
  // the same age - so every Quick Start with health under 80 at week 7 rolled
  // Depression at week 7. Same life + same week still yields the same result
  // (reload-safe, StrictMode-safe); a different life gets its own. Program 8.
  const roll = makeLifeRoll(state, weeksLived);

  // The overall multiplier - health, fitness, age - drives OCCURRENCE (below).
  // The old "healthy and young" 2% fast path is gone with the summed model it
  // patched: a young, fit, healthy life now sits at ~1% through the multiplier
  // itself (0.3-0.5 × the base), which is what that gate approximated.
  const baseRiskMultiplier = calculateDiseaseRisk(state);
  const age = state.date?.age || ADULTHOOD_AGE;

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
  const diseaseRoll = roll('disease-pick');
  let cumulativeChance = 0;

  // Pick weights for every eligible template (immunity and vaccination fold in
  // here, so a cold you are immune to is rarely drawn).
  const diseaseChances = eligibleTemplates.map(template => ({
    template,
    chance: calculateDiseaseSpecificRisk(template, state),
  }));

  const totalChance = diseaseChances.reduce((sum, d) => sum + d.chance, 0);
  if (!(totalChance > 0)) {
    return null;
  }

  // Occurrence: ONE base chance × the overall multiplier, scaled down by how
  // much of the pool immunity and vaccines have covered (the ratio of the
  // weighted pool to the same pool unprotected). Program 8 - see the header
  // on `calculateDiseaseRisk` for why this replaced the summed-template gate.
  const unprotectedTotal = eligibleTemplates.reduce(
    (sum, template) => sum + calculateDiseaseSpecificRisk(template, { ...state, diseaseImmunities: [], vaccinations: [] }),
    0,
  );
  const coverage = unprotectedTotal > 0 ? Math.min(1, totalChance / unprotectedTotal) : 1;
  const occurrenceChance = Math.min(
    DISEASE_OCCURRENCE_CAP,
    DISEASE_BASE_WEEKLY_CHANCE * baseRiskMultiplier * coverage,
  );
  if (roll('disease-occurrence') >= occurrenceChance) {
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

