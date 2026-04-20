import { GameState } from '@/contexts/game/types';

/**
 * Apply unlock bonuses to game state
 * @param gameState Game state to modify
 * @param unlockedBonuses Array of unlocked bonus IDs
 * @returns Modified game state
 */
export function applyUnlockBonuses(
  gameState: GameState,
  unlockedBonuses: string[]
): GameState {
  const newState = { ...gameState };

  // Early career access - unlock all careers
  if (unlockedBonuses.includes('early_career_access')) {
    // All careers are already available, but we can mark them as unlocked
    // This is more of a flag for UI purposes
    newState.hasSeenJobTutorial = true;
  }

  // Early education access - complete all educations
  if (unlockedBonuses.includes('early_education_access')) {
    newState.educations = (newState.educations || []).map(edu => ({
      ...edu,
      completed: true,
      weeksRemaining: undefined,
    }));
  }

  // Early item access - unlock premium items
  if (unlockedBonuses.includes('early_item_access')) {
    // Items are already in the game state, this is more of a flag
    // The shop UI can check this to show premium items early
  }

  // Early real estate access - can access at age 18
  if (unlockedBonuses.includes('early_real_estate')) {
    // This is checked in the real estate app to allow access at age 18
    // No state change needed, just a flag
  }

  // Early company access - can start companies without education
  if (unlockedBonuses.includes('early_company_access')) {
    // This is checked when creating companies
    // No state change needed, just a flag
  }

  return newState;
}

/**
 * Check if early career access is unlocked
 */
export function hasEarlyCareerAccess(unlockedBonuses: string[]): boolean {
  return unlockedBonuses.includes('early_career_access');
}

/**
 * Check if early education access is unlocked
 */
export function hasEarlyEducationAccess(unlockedBonuses: string[]): boolean {
  return unlockedBonuses.includes('early_education_access');
}

/**
 * Check if early item access is unlocked
 */
export function hasEarlyItemAccess(unlockedBonuses: string[]): boolean {
  return unlockedBonuses.includes('early_item_access');
}

/**
 * Check if early real estate access is unlocked
 */
export function hasEarlyRealEstateAccess(unlockedBonuses: string[]): boolean {
  return unlockedBonuses.includes('early_real_estate');
}

/**
 * Check if early company access is unlocked
 */
export function hasEarlyCompanyAccess(unlockedBonuses: string[]): boolean {
  return unlockedBonuses.includes('early_company_access');
}

