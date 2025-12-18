/**
 * Economy balance constants
 * 
 * These constants control diminishing returns and caps for various income sources.
 * Adjust these values to tune game balance.
 */

/**
 * Real Estate diminishing returns thresholds
 * 
 * Managing many properties becomes harder (management overhead).
 * Penalties apply after PROPERTY_THRESHOLD_1 properties.
 */
export const PROPERTY_THRESHOLD_1 = 10;  // First penalty tier (10% reduction)
export const PROPERTY_THRESHOLD_2 = 15;  // Second penalty tier (20% reduction)
export const PROPERTY_THRESHOLD_3 = 20;  // Third penalty tier (30% reduction)

/**
 * Real Estate efficiency multipliers
 */
export const PROPERTY_EFFICIENCY_TIER_1 = 0.9;  // 10% penalty for 11-15 properties
export const PROPERTY_EFFICIENCY_TIER_2 = 0.8;  // 20% penalty for 16-20 properties
export const PROPERTY_EFFICIENCY_TIER_3 = 0.7;  // 30% penalty for 21+ properties

/**
 * Patent income diminishing returns thresholds
 * 
 * Too many patents create management overhead and market saturation.
 * Penalties apply after PATENT_THRESHOLD_1 active patents (across ALL companies).
 */
export const PATENT_THRESHOLD_1 = 20;  // First penalty tier (10% reduction)
export const PATENT_THRESHOLD_2 = 40;  // Second penalty tier (20% reduction)
export const PATENT_THRESHOLD_3 = 60;  // Third penalty tier (30% reduction)

/**
 * Patent efficiency multipliers
 */
export const PATENT_EFFICIENCY_TIER_1 = 0.9;  // 10% penalty for 21-40 patents
export const PATENT_EFFICIENCY_TIER_2 = 0.8;  // 20% penalty for 41-60 patents
export const PATENT_EFFICIENCY_TIER_3 = 0.7;  // 30% penalty for 61+ patents

/**
 * Relationship system limits
 */
export const MAX_ACTIVE_RELATIONSHIPS = 30;  // Maximum active relationships (score > 0)
export const MAX_RELATIONSHIP_INCOME = 1000;  // Maximum total relationship income per week
export const MAX_RELATIONSHIPS_FOR_INCOME = 20;  // Top N relationships contribute to income cap

