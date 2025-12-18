/**
 * Prestige system constants
 * 
 * These constants control prestige system behavior and should be adjusted
 * carefully as they affect game balance and progression.
 */

/**
 * Maximum prestige level for multiplier growth
 * After this level, multiplier stops growing to prevent exponential trivialization
 * 
 * Current value: 10 (provides 2.59x multiplier at max)
 * 
 * Formula: multiplier = 1.1^min(prestigeLevel, MAX_MULTIPLIER_LEVEL)
 */
export const MAX_MULTIPLIER_LEVEL = 10;

/**
 * Maximum number of prestige history records to keep
 * Older prestiges are rarely accessed, so keeping only recent history is sufficient
 * 
 * Current value: 50
 * 
 * Note: PrestigeHistoryModal displays history but doesn't require complete history
 */
export const MAX_PRESTIGE_HISTORY = 50;

