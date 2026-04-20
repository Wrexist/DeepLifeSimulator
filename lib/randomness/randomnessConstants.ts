/**
 * Randomness System Constants
 * 
 * These constants control pity systems, soft guarantees, and bounds for random actions.
 * Adjust these values to tune game balance and fairness.
 */

/**
 * Pity System Thresholds
 * 
 * Guaranteed success after N consecutive failures.
 * Prevents infinite failure streaks that feel unfair.
 */
export const PITY_THRESHOLD_CHILDREN = 15; // Having children: guaranteed after 15 attempts
export const PITY_THRESHOLD_MONEY_REQUEST = 5; // Asking for money: guaranteed after 5 attempts
export const PITY_THRESHOLD_STREET_JOB = 5; // Street jobs: guaranteed after 5 failures
export const PITY_THRESHOLD_JOB_APPLICATION = 3; // Job applications: guaranteed after 3 attempts
export const PITY_THRESHOLD_WEEKLY_EVENTS = 24; // Weekly events: guaranteed after 24 weeks without (was 12 — events should feel rare)

/**
 * Soft Guarantee Thresholds
 * 
 * 100% success if calculated chance >= threshold.
 * Prevents frustrating failures at high success rates.
 */
export const SOFT_GUARANTEE_PROPOSAL = 95; // Marriage proposals: 100% success if rate >= 95%
export const SOFT_GUARANTEE_MOVE_IN = 80; // Move in together: 100% success if chance >= 80%
export const SOFT_GUARANTEE_TOURNAMENT = 0.9; // Hobby tournaments: 100% success if chance >= 90% (0.9)

/**
 * Hobby Upload Minimum Grade Bounds
 * 
 * Skill thresholds for minimum grade guarantees.
 * Prevents frustrating low grades at high skill levels.
 */
export const HOBBY_SKILL_THRESHOLD_HIGH = 80; // Skill 80+ = minimum "Good" grade
export const HOBBY_SKILL_THRESHOLD_MEDIUM = 60; // Skill 60+ = minimum "Bad" grade (not terrible)
export const HOBBY_SKILL_THRESHOLD_LOW = 40; // Skill 40+ = minimum "Terrible" grade (but not worse)

/**
 * Hobby Upload Grade Thresholds
 * 
 * Roll thresholds for grade determination.
 * Must align with minRoll values in calculateMinRollForSkill.
 */
export const GRADE_THRESHOLD_TERRIBLE = 40; // < 40 = Terrible
export const GRADE_THRESHOLD_BAD = 70; // 40-70 = Bad
export const GRADE_THRESHOLD_NORMAL = 90; // 70-90 = Normal
export const GRADE_THRESHOLD_GOOD = 110; // 90-110 = Good
export const GRADE_THRESHOLD_GREAT = 130; // 110-130 = Great
// > 130 = Incredible

/**
 * Relationship Decay Distribution
 * 
 * Weighted distribution for partner/spouse relationship decay.
 * Single roll with weighted outcomes (prevents double randomness).
 */
export const DECAY_NO_DECAY_CHANCE = 0.5; // 50% no decay
export const DECAY_MINUS_ONE_CHANCE = 0.3; // 30% -1 decay
export const DECAY_MINUS_TWO_CHANCE = 0.2; // 20% -2 decay
// Total: 1.0 (100%)

