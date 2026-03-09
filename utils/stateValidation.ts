/**
 * State Validation Helpers
 * Utility functions to validate and clamp game state values
 */

/**
 * Clamp relationship score to valid range [0, 100]
 */
export function clampRelationshipScore(score: number): number {
  if (typeof score !== 'number' || isNaN(score) || !isFinite(score)) {
    return 50; // Default value
  }
  return Math.max(0, Math.min(100, score));
}

/**
 * Clamp hobby skill to valid range [>= 0]
 */
export function clampHobbySkill(skill: number): number {
  if (typeof skill !== 'number' || isNaN(skill) || !isFinite(skill)) {
    return 0; // Default value
  }
  return Math.max(0, skill);
}

/**
 * Clamp hobby skillLevel to valid range [>= 0]
 */
export function clampHobbySkillLevel(skillLevel: number): number {
  if (typeof skillLevel !== 'number' || isNaN(skillLevel) || !isFinite(skillLevel)) {
    return 1; // Default value
  }
  return Math.max(0, skillLevel);
}

/**
 * Validate and clamp a relationship object
 */
export function validateRelationship(rel: any): any {
  if (!rel || typeof rel !== 'object' || !rel.id) {
    return null;
  }
  return {
    ...rel,
    relationshipScore: clampRelationshipScore(rel.relationshipScore),
  };
}

/**
 * Validate and clamp a hobby object
 */
export function validateHobby(hobby: any): any {
  if (!hobby || typeof hobby !== 'object' || !hobby.id) {
    return null;
  }
  return {
    ...hobby,
    skill: clampHobbySkill(hobby.skill),
    skillLevel: clampHobbySkillLevel(hobby.skillLevel),
  };
}

