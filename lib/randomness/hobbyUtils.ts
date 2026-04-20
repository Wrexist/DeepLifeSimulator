/**
 * Hobby Utility Functions
 * 
 * Shared functions for hobby-related calculations.
 */

import {
  HOBBY_SKILL_THRESHOLD_HIGH,
  HOBBY_SKILL_THRESHOLD_MEDIUM,
  HOBBY_SKILL_THRESHOLD_LOW,
  GRADE_THRESHOLD_GOOD,
  GRADE_THRESHOLD_BAD,
  GRADE_THRESHOLD_TERRIBLE,
} from './randomnessConstants';

/**
 * Calculate minimum roll value based on effective skill level.
 * 
 * High skill should guarantee minimum grade to prevent frustrating low grades.
 * 
 * @param effectiveSkill - Effective skill level (skillLevel * 20 + skill)
 * @returns Minimum roll value (0 if no minimum)
 * 
 * @example
 * calculateMinRollForSkill(85) // Returns 90 (minimum "Good" grade)
 * calculateMinRollForSkill(65) // Returns 70 (minimum "Bad" grade)
 * calculateMinRollForSkill(45) // Returns 40 (minimum "Terrible" grade)
 */
export function calculateMinRollForSkill(effectiveSkill: number): number {
  if (effectiveSkill >= HOBBY_SKILL_THRESHOLD_HIGH) {
    return GRADE_THRESHOLD_GOOD; // Skill 80+ = minimum "Good" grade (roll >= 90)
  } else if (effectiveSkill >= HOBBY_SKILL_THRESHOLD_MEDIUM) {
    return GRADE_THRESHOLD_BAD; // Skill 60+ = minimum "Bad" grade (roll >= 70, prevents "Terrible")
  } else if (effectiveSkill >= HOBBY_SKILL_THRESHOLD_LOW) {
    return GRADE_THRESHOLD_TERRIBLE; // Skill 40+ = minimum "Terrible" grade (roll >= 40, prevents worse)
  }
  return 0; // No minimum for low skill
}

