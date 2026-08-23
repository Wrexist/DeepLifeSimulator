import { GameState } from '@/contexts/game/types';
import { completeAllPrograms } from '@/lib/education/operations';

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

  // Early education access - complete all educations.
  //
  // This used to map over `newState.educations`, which is the player's
  // ENROLMENT list — `[]` at the start of every life, because entries are only
  // appended when they enrol. Mapping an empty array completed nothing, so the
  // 3,000-point bonus advertised "Start with all educations completed" and
  // granted precisely zero for its entire life. `completeAllPrograms` sources
  // the programmes from the CATALOGUE instead, which is the only place the full
  // set exists. Reported by a tester 2026-08-23.
  if (unlockedBonuses.includes('early_education_access')) {
    newState.educations = completeAllPrograms(newState.educations);
  }


  /*
   * The `early_real_estate` and `early_company_access` branches that stood here
   * were empty — a condition, then two comments saying the check happens
   * somewhere else. For `early_company_access` that was TRUE
   * (`hasEarlyCompanyAccess` gates company creation in three places). For
   * `early_real_estate` it was not: the real-estate app has no age gate at all,
   * and never did, so there was nothing for the bonus to lift. An empty branch
   * that names a bonus reads as its implementation, which is why a 6,000-point
   * purchase went years without anyone noticing it did nothing.
   */

  return newState;
}

/**
 * Check if early career access is unlocked
 */
export function hasEarlyCareerAccess(unlockedBonuses: string[]): boolean {
  return unlockedBonuses.includes('early_career_access');
}

/*
 * DELETED 2026-08-21: `hasEarlyEducationAccess`, `hasEarlyItemAccess` and
 * `hasEarlyRealEstateAccess`.
 *
 * All three were exported, imported by `PrestigeInfoModal`, and CALLED BY
 * NOTHING. That is worse than absent: a predicate named for a bonus reads as
 * the bonus's wiring, and it is why two of these bonuses were sold for a
 * combined 10,000 points while doing nothing at all. `early_item_access` and
 * `early_real_estate` are now in `lib/prestige/inertBonuses.ts`, so the shop
 * warns before taking the points.
 *
 * `early_education_access` is the one that genuinely works — `applyUnlockBonuses`
 * above completes every education — so its predicate was simply redundant.
 *
 * If one of these is wired later, write the check where the gate actually is.
 */

/**
 * Check if early company access is unlocked
 */
export function hasEarlyCompanyAccess(unlockedBonuses: string[]): boolean {
  return unlockedBonuses.includes('early_company_access');
}

