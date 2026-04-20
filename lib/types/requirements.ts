/**
 * Centralized Requirement Type Definitions
 * 
 * This file provides type-safe definitions for all requirement variants
 * used throughout the codebase. All requirement access should use type guards
 * or discriminated unions to ensure type safety.
 */

/**
 * Base requirement interface with all possible optional fields
 * Used for Career requirements
 */
export interface CareerRequirements {
  fitness?: number;
  items?: string[];
  education?: string[];
  reputation?: number;
}

/**
 * Advanced career unlock requirements
 * Used for AdvancedCareer unlockRequirements
 */
export interface AdvancedCareerUnlockRequirements {
  education?: string[]; // Required education IDs
  experience?: number; // Years of experience in related field (as weeks)
  reputation?: number; // Minimum reputation
  achievements?: string[]; // Required achievement IDs
  netWorth?: number; // Minimum net worth
}

/**
 * Political career office requirements
 * Different offices have different requirement shapes
 */
export interface PoliticalOfficeRequirements {
  minAge: number;
  minReputation: number;
  education?: string[];
  previousLevel?: string;
  minWeeksInPrevious?: number;
  specialEvent?: boolean;
}

/**
 * Travel destination requirements
 */
export interface TravelDestinationRequirements {
  money?: number;
  happiness?: number;
  items?: string[]; // e.g. passport
}

/**
 * System unlock requirements
 * Used for discoverable systems
 */
export interface SystemUnlockRequirements {
  minAge?: number;
  minMoney?: number;
  minReputation?: number;
  requiresSystem?: string;
  requiresItem?: string;
  requiresEducation?: string;
}

/**
 * Competition requirements
 */
export interface CompetitionRequirements {
  minTechnologies?: number;
  minPatents?: number;
  companyType?: string;
}

/**
 * Type guard functions for safe property access
 */

export function hasEducationRequirement(
  requirements: CareerRequirements | AdvancedCareerUnlockRequirements | PoliticalOfficeRequirements | SystemUnlockRequirements
): requirements is CareerRequirements | AdvancedCareerUnlockRequirements | PoliticalOfficeRequirements {
  return 'education' in requirements && requirements.education !== undefined;
}

export function hasItemsRequirement(
  requirements: CareerRequirements | TravelDestinationRequirements
): requirements is CareerRequirements | TravelDestinationRequirements {
  return 'items' in requirements && requirements.items !== undefined;
}

export function hasFitnessRequirement(
  requirements: CareerRequirements
): requirements is CareerRequirements & { fitness: number } {
  return 'fitness' in requirements && requirements.fitness !== undefined;
}

export function hasReputationRequirement(
  requirements: CareerRequirements | AdvancedCareerUnlockRequirements | PoliticalOfficeRequirements | SystemUnlockRequirements
): requirements is CareerRequirements | AdvancedCareerUnlockRequirements | PoliticalOfficeRequirements | SystemUnlockRequirements {
  return ('reputation' in requirements && requirements.reputation !== undefined) ||
         ('minReputation' in requirements && requirements.minReputation !== undefined);
}

export function hasExperienceRequirement(
  requirements: AdvancedCareerUnlockRequirements
): requirements is AdvancedCareerUnlockRequirements & { experience: number } {
  return 'experience' in requirements && requirements.experience !== undefined;
}

export function hasAchievementsRequirement(
  requirements: AdvancedCareerUnlockRequirements
): requirements is AdvancedCareerUnlockRequirements & { achievements: string[] } {
  return 'achievements' in requirements && requirements.achievements !== undefined;
}

export function hasNetWorthRequirement(
  requirements: AdvancedCareerUnlockRequirements
): requirements is AdvancedCareerUnlockRequirements & { netWorth: number } {
  return 'netWorth' in requirements && requirements.netWorth !== undefined;
}

export function hasPreviousLevelRequirement(
  requirements: PoliticalOfficeRequirements
): requirements is PoliticalOfficeRequirements & { previousLevel: string } {
  return 'previousLevel' in requirements && requirements.previousLevel !== undefined;
}

export function hasMoneyRequirement(
  requirements: TravelDestinationRequirements | SystemUnlockRequirements
): requirements is TravelDestinationRequirements | SystemUnlockRequirements {
  return ('money' in requirements && requirements.money !== undefined) ||
         ('minMoney' in requirements && requirements.minMoney !== undefined);
}

export function hasHappinessRequirement(
  requirements: TravelDestinationRequirements
): requirements is TravelDestinationRequirements & { happiness: number } {
  return 'happiness' in requirements && requirements.happiness !== undefined;
}

export function hasRequiresEducation(
  requirements: SystemUnlockRequirements
): requirements is SystemUnlockRequirements & { requiresEducation: string } {
  return 'requiresEducation' in requirements && requirements.requiresEducation !== undefined;
}

export function hasRequiresItem(
  requirements: SystemUnlockRequirements | TravelDestinationRequirements
): requirements is SystemUnlockRequirements | TravelDestinationRequirements {
  return ('requiresItem' in requirements && requirements.requiresItem !== undefined) ||
         ('items' in requirements && requirements.items !== undefined);
}

export function hasRequiresSystem(
  requirements: SystemUnlockRequirements
): requirements is SystemUnlockRequirements & { requiresSystem: string } {
  return 'requiresSystem' in requirements && requirements.requiresSystem !== undefined;
}

export function hasMinAge(
  requirements: SystemUnlockRequirements | PoliticalOfficeRequirements
): requirements is SystemUnlockRequirements | PoliticalOfficeRequirements {
  return ('minAge' in requirements && requirements.minAge !== undefined);
}

