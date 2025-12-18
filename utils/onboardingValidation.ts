import { GameState } from '@/contexts/game/types';
import { initialGameState } from '@/contexts/game/initialState';
import { logger } from '@/utils/logger';

const log = logger.scope('OnboardingValidation');

/**
 * Validation result for onboarding state
 */
export interface OnboardingValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  missingFields: string[];
  invalidFields: string[];
}

/**
 * Required invariants for a valid new game state after onboarding
 * This ensures all critical systems are properly initialized
 */
interface RequiredInvariants {
  // Character identity
  hasFirstName: boolean;
  hasLastName: boolean;
  hasValidSex: boolean;
  hasValidSexuality: boolean;
  
  // Scenario selection
  hasScenario: boolean;
  hasValidScenarioId: boolean;
  
  // Core stats
  hasStats: boolean;
  statsAreValid: boolean;
  
  // Date/time tracking
  hasDate: boolean;
  dateIsValid: boolean;
  hasWeek: boolean;
  hasWeeksLived: boolean;
  
  // User profile
  hasUserProfile: boolean;
  userProfileIsValid: boolean;
  
  // Required arrays (must exist, can be empty)
  hasRequiredArrays: boolean;
  
  // Settings
  hasSettings: boolean;
  settingsAreValid: boolean;
  
  // Version
  hasVersion: boolean;
  versionIsValid: boolean;
}

/**
 * Validates that a game state created during onboarding has all required fields
 * This is called BEFORE the game is saved to ensure correctness
 */
export function validateOnboardingState(state: any): OnboardingValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const missingFields: string[] = [];
  const invalidFields: string[] = [];

  // Check if state exists
  if (!state || typeof state !== 'object') {
    errors.push('Game state is null or undefined');
    return {
      valid: false,
      errors,
      warnings,
      missingFields: ['state'],
      invalidFields: [],
    };
  }

  const invariants: RequiredInvariants = {
    hasFirstName: false,
    hasLastName: false,
    hasValidSex: false,
    hasValidSexuality: false,
    hasScenario: false,
    hasValidScenarioId: false,
    hasStats: false,
    statsAreValid: false,
    hasDate: false,
    dateIsValid: false,
    hasWeek: false,
    hasWeeksLived: false,
    hasUserProfile: false,
    userProfileIsValid: false,
    hasRequiredArrays: false,
    hasSettings: false,
    settingsAreValid: false,
    hasVersion: false,
    versionIsValid: false,
  };

  // 1. Validate character identity (firstName, lastName, sex, sexuality)
  if (!state.userProfile) {
    errors.push('Missing userProfile object');
    missingFields.push('userProfile');
  } else {
    invariants.hasUserProfile = true;
    
    // First name validation
    if (typeof state.userProfile.firstName !== 'string' || state.userProfile.firstName.trim().length === 0) {
      errors.push('firstName must be a non-empty string');
      invalidFields.push('userProfile.firstName');
    } else {
      invariants.hasFirstName = true;
    }
    
    // Last name validation
    if (typeof state.userProfile.lastName !== 'string' || state.userProfile.lastName.trim().length === 0) {
      errors.push('lastName must be a non-empty string');
      invalidFields.push('userProfile.lastName');
    } else {
      invariants.hasLastName = true;
    }
    
    // Sex validation
    const validSexes = ['male', 'female'];
    if (!state.userProfile.sex || !validSexes.includes(state.userProfile.sex)) {
      errors.push(`sex must be one of: ${validSexes.join(', ')}`);
      invalidFields.push('userProfile.sex');
    } else {
      invariants.hasValidSex = true;
    }
    
    // Sexuality validation
    const validSexualities = ['straight', 'gay', 'bi'];
    if (!state.userProfile.sexuality || !validSexualities.includes(state.userProfile.sexuality)) {
      errors.push(`sexuality must be one of: ${validSexualities.join(', ')}`);
      invalidFields.push('userProfile.sexuality');
    } else {
      invariants.hasValidSexuality = true;
    }
    
    // Gender should match sex
    if (state.userProfile.gender !== state.userProfile.sex) {
      warnings.push(`gender (${state.userProfile.gender}) does not match sex (${state.userProfile.sex})`);
    }
    
    // Seeking gender should be valid
    const validSeekingGenders = ['male', 'female'];
    if (!state.userProfile.seekingGender || !validSeekingGenders.includes(state.userProfile.seekingGender)) {
      warnings.push(`seekingGender (${state.userProfile.seekingGender}) may be invalid`);
    }
    
    invariants.userProfileIsValid = invariants.hasFirstName && invariants.hasLastName && 
                                     invariants.hasValidSex && invariants.hasValidSexuality;
  }

  // 2. Validate scenario selection
  if (typeof state.scenarioId !== 'string' || state.scenarioId.trim().length === 0) {
    errors.push('scenarioId must be a non-empty string');
    missingFields.push('scenarioId');
  } else {
    invariants.hasScenario = true;
    invariants.hasValidScenarioId = true;
  }

  // 3. Validate core stats
  if (!state.stats || typeof state.stats !== 'object') {
    errors.push('Missing stats object');
    missingFields.push('stats');
  } else {
    invariants.hasStats = true;
    
    const requiredStats = ['health', 'happiness', 'energy', 'fitness', 'money', 'reputation', 'gems'];
    const statRanges: Record<string, [number, number]> = {
      health: [0, 100],
      happiness: [0, 100],
      energy: [0, 100],
      fitness: [0, 100],
      reputation: [0, 100],
    };
    
    for (const stat of requiredStats) {
      if (!(stat in state.stats)) {
        errors.push(`Missing stat: ${stat}`);
        missingFields.push(`stats.${stat}`);
        continue;
      }
      
      const value = state.stats[stat];
      
      if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) {
        errors.push(`Invalid ${stat} value: expected number, got ${typeof value}`);
        invalidFields.push(`stats.${stat}`);
        continue;
      }
      
      // Check ranges for bounded stats
      if (stat in statRanges) {
        const [min, max] = statRanges[stat];
        if (value < min || value > max) {
          errors.push(`${stat} out of range: ${value} (expected ${min}-${max})`);
          invalidFields.push(`stats.${stat}`);
        }
      }
      
      // Money and gems must be non-negative
      if ((stat === 'money' || stat === 'gems') && value < 0) {
        errors.push(`${stat} cannot be negative: ${value}`);
        invalidFields.push(`stats.${stat}`);
      }
    }
    
    invariants.statsAreValid = requiredStats.every(stat => {
      if (!(stat in state.stats)) return false;
      const value = state.stats[stat];
      if (typeof value !== 'number' || isNaN(value) || !isFinite(value)) return false;
      if (stat in statRanges) {
        const [min, max] = statRanges[stat];
        if (value < min || value > max) return false;
      }
      if ((stat === 'money' || stat === 'gems') && value < 0) return false;
      return true;
    });
  }

  // 4. Validate date/time tracking
  if (!state.date || typeof state.date !== 'object') {
    errors.push('Missing date object');
    missingFields.push('date');
  } else {
    invariants.hasDate = true;
    
    const requiredDateFields = ['year', 'month', 'week', 'age'];
    for (const field of requiredDateFields) {
      if (!(field in state.date)) {
        errors.push(`Missing date.${field}`);
        missingFields.push(`date.${field}`);
      } else if (field === 'month') {
        if (typeof state.date.month !== 'string' || state.date.month.length === 0) {
          errors.push(`Invalid date.month: must be a non-empty string`);
          invalidFields.push(`date.${field}`);
        }
      } else {
        const value = state.date[field];
        if (typeof value !== 'number' || isNaN(value) || !isFinite(value) || value < 0) {
          errors.push(`Invalid date.${field}: ${value} (must be non-negative number)`);
          invalidFields.push(`date.${field}`);
        }
      }
    }
    
    // Validate age is reasonable (18-150)
    if (state.date.age && (state.date.age < 18 || state.date.age > 150)) {
      warnings.push(`Age ${state.date.age} is outside typical range (18-150)`);
    }
    
    invariants.dateIsValid = requiredDateFields.every(field => {
      if (!(field in state.date)) return false;
      if (field === 'month') {
        return typeof state.date.month === 'string' && state.date.month.length > 0;
      }
      const value = state.date[field];
      return typeof value === 'number' && !isNaN(value) && isFinite(value) && value >= 0;
    });
  }

  if (typeof state.week !== 'number' || isNaN(state.week) || !isFinite(state.week) || state.week < 1) {
    errors.push(`Invalid week: ${state.week} (must be >= 1)`);
    invalidFields.push('week');
  } else {
    invariants.hasWeek = true;
  }

  if (typeof state.weeksLived !== 'number' || isNaN(state.weeksLived) || !isFinite(state.weeksLived) || state.weeksLived < 0) {
    errors.push(`Invalid weeksLived: ${state.weeksLived} (must be >= 0)`);
    invalidFields.push('weeksLived');
  } else {
    invariants.hasWeeksLived = true;
  }

  // 5. Validate required arrays exist (can be empty)
  const requiredArrays = [
    'careers', 'hobbies', 'items', 'relationships', 'achievements', 
    'educations', 'pets', 'companies', 'realEstate', 'cryptos', 
    'diseases', 'streetJobs', 'jailActivities', 'foods', 
    'healthActivities', 'dietPlans', 'darkWebItems', 'hacks'
  ];
  
  const missingArrays: string[] = [];
  for (const field of requiredArrays) {
    if (!Array.isArray(state[field])) {
      errors.push(`${field} must be an array`);
      missingArrays.push(field);
    }
  }
  
  invariants.hasRequiredArrays = missingArrays.length === 0;

  // 6. Validate settings
  if (!state.settings || typeof state.settings !== 'object') {
    errors.push('Missing settings object');
    missingFields.push('settings');
  } else {
    invariants.hasSettings = true;
    
    // Check critical settings fields
    if (typeof state.settings.darkMode !== 'boolean') {
      warnings.push('settings.darkMode should be a boolean');
    }
    if (typeof state.settings.autoSave !== 'boolean') {
      warnings.push('settings.autoSave should be a boolean');
    }
    
    invariants.settingsAreValid = true; // Settings are mostly optional
  }

  // 7. Validate version
  if (typeof state.version !== 'number' || isNaN(state.version) || !isFinite(state.version) || state.version < 1) {
    errors.push(`Invalid version: ${state.version} (must be >= 1)`);
    invalidFields.push('version');
  } else {
    invariants.hasVersion = true;
    invariants.versionIsValid = true;
  }

  // 8. Validate critical optional fields that should exist
  if (state.perks === undefined) {
    warnings.push('perks object is undefined (should be initialized as {})');
  }
  
  if (state.bankSavings === undefined) {
    warnings.push('bankSavings is undefined (should be initialized as 0)');
  }
  
  if (state.stocks === undefined) {
    warnings.push('stocks object is undefined (should be initialized)');
  }
  
  // Validate critical system objects
  if (!state.social || typeof state.social !== 'object') {
    warnings.push('social object is missing or invalid (will be initialized)');
  } else if (!Array.isArray(state.social.relations)) {
    warnings.push('social.relations must be an array');
  }
  
  if (!state.economy || typeof state.economy !== 'object') {
    warnings.push('economy object is missing or invalid (will be initialized)');
  } else {
    if (typeof state.economy.inflationRateAnnual !== 'number') {
      warnings.push('economy.inflationRateAnnual should be a number');
    }
    if (typeof state.economy.priceIndex !== 'number') {
      warnings.push('economy.priceIndex should be a number');
    }
  }
  
  if (!state.travel || typeof state.travel !== 'object') {
    warnings.push('travel object is missing or invalid (will be initialized)');
  } else if (!Array.isArray(state.travel.visitedDestinations)) {
    warnings.push('travel.visitedDestinations must be an array');
  }
  
  if (!state.politics || typeof state.politics !== 'object') {
    warnings.push('politics object is missing or invalid (will be initialized)');
  }
  
  if (!state.socialMedia || typeof state.socialMedia !== 'object') {
    warnings.push('socialMedia object is missing or invalid (will be initialized)');
  }

  // 9. Validate items array structure (if items exist)
  if (Array.isArray(state.items)) {
    for (let i = 0; i < state.items.length; i++) {
      const item = state.items[i];
      if (!item || typeof item !== 'object' || !item.id || typeof item.id !== 'string') {
        errors.push(`Item at index ${i} is invalid (missing id)`);
        invalidFields.push(`items[${i}]`);
      }
    }
  }

  // 10. Validate that week and weeksLived are consistent with age
  if (invariants.hasDate && invariants.hasWeek && invariants.hasWeeksLived) {
    const baseAge = 18;
    const weeksPerYear = 52;
    const expectedWeeksLived = Math.max(0, Math.floor((state.date.age - baseAge) * weeksPerYear));
    
    if (Math.abs(state.weeksLived - expectedWeeksLived) > 1) {
      warnings.push(
        `weeksLived (${state.weeksLived}) may be inconsistent with age (${state.date.age}). ` +
        `Expected approximately ${expectedWeeksLived} weeks.`
      );
    }
  }

  // Determine overall validity
  const valid = errors.length === 0;

  log.info('Onboarding validation completed', {
    valid,
    errorCount: errors.length,
    warningCount: warnings.length,
    missingFields: missingFields.length,
    invalidFields: invalidFields.length,
    invariants,
  });

  return {
    valid,
    errors,
    warnings,
    missingFields,
    invalidFields,
  };
}

/**
 * Applies safe defaults to a game state if fields are missing
 * This should only be used as a last resort - validation should catch issues first
 */
export function applySafeDefaults(state: any): { applied: boolean; defaults: string[] } {
  const defaults: string[] = [];
  let applied = false;

  // Apply defaults from initialGameState for missing critical fields
  if (!state.userProfile) {
    state.userProfile = { ...initialGameState.userProfile };
    defaults.push('userProfile');
    applied = true;
  }

  if (!state.stats) {
    state.stats = { ...initialGameState.stats };
    defaults.push('stats');
    applied = true;
  }

  if (!state.date) {
    state.date = { ...initialGameState.date };
    defaults.push('date');
    applied = true;
  }

  if (!state.settings) {
    state.settings = { ...initialGameState.settings };
    defaults.push('settings');
    applied = true;
  }

  if (state.perks === undefined) {
    state.perks = {};
    defaults.push('perks');
    applied = true;
  }

  if (state.bankSavings === undefined) {
    state.bankSavings = 0;
    defaults.push('bankSavings');
    applied = true;
  }

  if (state.stocks === undefined) {
    state.stocks = { holdings: [], watchlist: [] };
    defaults.push('stocks');
    applied = true;
  }

  // Initialize critical system objects if missing
  if (!state.social || typeof state.social !== 'object') {
    state.social = { relations: [] };
    defaults.push('social');
    applied = true;
  } else if (!Array.isArray(state.social.relations)) {
    state.social.relations = [];
    defaults.push('social.relations');
    applied = true;
  }

  if (!state.economy || typeof state.economy !== 'object') {
    state.economy = { inflationRateAnnual: 0.03, priceIndex: 1 };
    defaults.push('economy');
    applied = true;
  } else {
    if (typeof state.economy.inflationRateAnnual !== 'number') {
      state.economy.inflationRateAnnual = 0.03;
      defaults.push('economy.inflationRateAnnual');
      applied = true;
    }
    if (typeof state.economy.priceIndex !== 'number') {
      state.economy.priceIndex = 1;
      defaults.push('economy.priceIndex');
      applied = true;
    }
  }

  if (!state.travel || typeof state.travel !== 'object') {
    state.travel = { visitedDestinations: [], passportOwned: false, businessOpportunities: {}, travelHistory: [] };
    defaults.push('travel');
    applied = true;
  } else if (!Array.isArray(state.travel.visitedDestinations)) {
    state.travel.visitedDestinations = [];
    defaults.push('travel.visitedDestinations');
    applied = true;
  }

  if (!state.politics || typeof state.politics !== 'object') {
    state.politics = {
      activePolicyEffects: undefined,
      careerLevel: 0,
      approvalRating: 50,
      policyInfluence: 0,
      electionsWon: 0,
      policiesEnacted: [],
      lobbyists: [],
      alliances: [],
      campaignFunds: 0,
    };
    defaults.push('politics');
    applied = true;
  }

  if (!state.socialMedia || typeof state.socialMedia !== 'object') {
    state.socialMedia = {
      followers: 0,
      influenceLevel: 'novice',
      totalPosts: 0,
      viralPosts: 0,
      brandPartnerships: 0,
      engagementRate: 0,
      lastPostTime: undefined,
      lastPostDay: undefined,
      lastPostTimes: undefined,
      lastPostWeeks: undefined,
      totalLiveStreams: 0,
      totalLiveViewers: 0,
      totalLiveDuration: 0,
      peakLiveViewers: 0,
      totalEarnings: 0,
      activeBrandDeals: [],
      recentPosts: [],
    };
    defaults.push('socialMedia');
    applied = true;
  }

  // Ensure required arrays exist
  const requiredArrays = [
    'careers', 'hobbies', 'items', 'relationships', 'achievements', 
    'educations', 'pets', 'companies', 'realEstate', 'cryptos', 
    'diseases', 'streetJobs', 'jailActivities', 'foods', 
    'healthActivities', 'dietPlans', 'darkWebItems', 'hacks'
  ];
  
  for (const field of requiredArrays) {
    if (!Array.isArray(state[field])) {
      state[field] = [];
      defaults.push(field);
      applied = true;
    }
  }

  if (applied) {
    log.warn('Applied safe defaults to game state', { defaults });
  }

  return { applied, defaults };
}

