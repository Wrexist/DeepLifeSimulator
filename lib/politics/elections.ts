/**
 * Election Schedule System
 * 
 * Manages election timing and scheduling for political offices
 */

import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export type OfficeLevel = 0 | 1 | 2 | 3 | 4 | 5;

// Election timing constants (in weeks)
export const ELECTION_TIMING = {
  LOCAL: WEEKS_PER_YEAR,      // Every 1 year
  STATE: WEEKS_PER_YEAR * 2,  // Every 2 years
  NATIONAL: WEEKS_PER_YEAR * 4, // Every 4 years
};

/**
 * Get the next election week based on current week and office level
 * @param currentWeek Current game week
 * @param officeLevel Political office level (0-5)
 * @param lastElectionWeek Optional last election week (if known)
 * @returns Next election week
 */
export function getNextElectionWeek(
  currentWeek: number,
  officeLevel: OfficeLevel,
  lastElectionWeek?: number
): number {
  // Determine election frequency based on office level
  let electionFrequency: number;
  
  if (officeLevel <= 1) {
    // Local offices (Council Member, Mayor) - every 1 year
    electionFrequency = ELECTION_TIMING.LOCAL;
  } else if (officeLevel <= 3) {
    // State offices (State Representative, Governor) - every 2 years
    electionFrequency = ELECTION_TIMING.STATE;
  } else {
    // National offices (Senator, President) - every 4 years
    electionFrequency = ELECTION_TIMING.NATIONAL;
  }

  // If we know the last election week, calculate from there
  if (lastElectionWeek !== undefined) {
    return lastElectionWeek + electionFrequency;
  }

  // Otherwise, calculate from current week
  // Round up to the next election cycle
  const cyclesSinceStart = Math.floor(currentWeek / electionFrequency);
  return (cyclesSinceStart + 1) * electionFrequency;
}

/**
 * Get weeks until next election
 * @param currentWeek Current game week
 * @param nextElectionWeek Next election week
 * @returns Weeks until next election
 */
export function getWeeksUntilElection(currentWeek: number, nextElectionWeek: number): number {
  return Math.max(0, nextElectionWeek - currentWeek);
}

/**
 * Get election type name based on office level
 * @param officeLevel Political office level
 * @returns Election type name
 */
export function getElectionType(officeLevel: OfficeLevel): string {
  if (officeLevel <= 1) {
    return 'Local Election';
  } else if (officeLevel <= 3) {
    return 'State Election';
  } else {
    return 'National Election';
  }
}

