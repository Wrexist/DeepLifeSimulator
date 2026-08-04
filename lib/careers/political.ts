/**
 * Political Career Definitions
 * 
 * Career progression from local council member to president
 */
import { Career } from '@/contexts/game/types';
import { PoliticalOfficeRequirements } from '@/lib/types/requirements';
import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export const POLITICAL_CAREER: Career = {
  id: 'political',
  levels: [
    { name: 'Local Council Member', salary: 800 },
    { name: 'Mayor', salary: 2000 },
    { name: 'State Representative', salary: 5000 },
    { name: 'Governor', salary: 15000 },
    { name: 'Senator', salary: 25000 },
    { name: 'President', salary: 100000 },
  ],
  level: 0,
  description: 'Serve the public through politics and governance',
  requirements: {
    reputation: 30,
    education: ['business_degree'],
  },
  progress: 0,
  applied: false,
  accepted: false,
};

export const POLITICAL_CAREER_REQUIREMENTS: Record<string, PoliticalOfficeRequirements> = {
  council_member: {
    minAge: 25,
    minReputation: 30,
    education: ['business_degree'],
  },
  mayor: {
    minAge: 30,
    minReputation: 50,
    previousLevel: 'council_member',
    minWeeksInPrevious: WEEKS_PER_YEAR, // 1 year
  },
  state_representative: {
    minAge: 35,
    minReputation: 70,
    previousLevel: 'mayor',
    minWeeksInPrevious: WEEKS_PER_YEAR * 2, // 2 years
  },
  governor: {
    minAge: 40,
    minReputation: 85,
    previousLevel: 'state_representative',
    minWeeksInPrevious: WEEKS_PER_YEAR * 4, // 4 years
  },
  senator: {
    minAge: 45,
    minReputation: 90,
    previousLevel: 'governor',
    minWeeksInPrevious: WEEKS_PER_YEAR * 4, // 4 years
  },
  president: {
    minAge: 35, // STABILITY FIX: Lowered from 50 to 35 to make "President by 30" goal achievable (with some buffer)
    minReputation: 95,
    previousLevel: 'senator',
    minWeeksInPrevious: WEEKS_PER_YEAR * 5, // 5 years
    specialEvent: true, // Requires special election event
  },
};

export function canRunForOffice(
  office: keyof typeof POLITICAL_CAREER_REQUIREMENTS,
  age: number,
  reputation: number,
  currentLevel: number,
  weeksInCurrentLevel: number,
  hasEducation: (id: string) => boolean
): boolean {
  const requirements = POLITICAL_CAREER_REQUIREMENTS[office];
  
  if (age < requirements.minAge) return false;
  if (reputation < requirements.minReputation) return false;
  
  // Type guard: check if requirements has education property
  if ('education' in requirements && requirements.education) {
    if (!requirements.education.every((edu: string) => hasEducation(edu))) return false;
  }
  
  // Type guard: check if requirements has previousLevel property
  if ('previousLevel' in requirements && requirements.previousLevel) {
    const previousLevelIndex = POLITICAL_CAREER.levels.findIndex(
      l => l.name.toLowerCase().includes(requirements.previousLevel!.split('_')[0])
    );
    // Must have REACHED the prerequisite level (index), not exceeded it. Using
    // <= rejected a sitting Council Member (level 0) from running for Mayor
    // (previousLevel 'council' → index 0, 0 <= 0), making the whole ladder above
    // Council unwinnable.
    if (currentLevel < previousLevelIndex) return false;
    if ('minWeeksInPrevious' in requirements && requirements.minWeeksInPrevious !== undefined && weeksInCurrentLevel < requirements.minWeeksInPrevious) return false;
  }
  
  return true;
}


/**
 * Office keys in ladder order — index matches `POLITICAL_CAREER.levels`.
 *
 * The two were always parallel and never actually joined, which is the bug
 * below.
 */
export const POLITICAL_OFFICE_ORDER = [
  'council_member',
  'mayor',
  'state_representative',
  'governor',
  'senator',
  'president',
] as const;

/** The office a given 0-based career level corresponds to. */
export function officeForLevel(level: number): (typeof POLITICAL_OFFICE_ORDER)[number] | undefined {
  return POLITICAL_OFFICE_ORDER[level];
}

/**
 * Why a political promotion is refused, or `null` when it is allowed.
 *
 * PLAYER REPORT (1.4 bug-reports): "Able to promote political on the career
 * page when the political page stops you due to age. After promotion the career
 * page will list you as mayor, state rep, etc; while political page says you're
 * a council member."
 *
 * `promoteCareer` gated on `getPromotionEligibility` — accepted, progress 100%,
 * performance, tenure — and knew nothing about `POLITICAL_CAREER_REQUIREMENTS`.
 * So the Politics app correctly refused a 27-year-old running for Mayor
 * ("You must be at least 30 years old") while the Work tab happily promoted
 * them into the same office, and `politics.careerLevel` was left behind because
 * only `runForOffice` maintains it. Two ladders, one of them with no gates.
 *
 * Returns the SAME kind of message the Politics app shows, so the two screens
 * agree about the reason as well as the answer.
 */
export function politicalPromotionBlocker(input: {
  targetLevel: number;
  age: number;
  reputation: number;
  currentLevel: number;
  weeksInCurrentLevel: number;
  hasEducation: (id: string) => boolean;
}): string | null {
  const office = officeForLevel(input.targetLevel);
  if (!office) return null; // Not a political rung — nothing to enforce.

  const requirements = POLITICAL_CAREER_REQUIREMENTS[office];
  if (!requirements) return null;

  if (input.age < requirements.minAge) {
    return `You must be at least ${requirements.minAge} years old to hold this office. You are ${Math.floor(input.age)}.`;
  }
  if (input.reputation < requirements.minReputation) {
    return `This office needs ${requirements.minReputation} reputation. You have ${Math.floor(input.reputation)}.`;
  }

  const ok = canRunForOffice(
    office,
    input.age,
    input.reputation,
    input.currentLevel,
    input.weeksInCurrentLevel,
    input.hasEducation,
  );
  if (!ok) {
    if ('minWeeksInPrevious' in requirements && requirements.minWeeksInPrevious !== undefined) {
      const years = Math.round(requirements.minWeeksInPrevious / WEEKS_PER_YEAR);
      return `You need ${years} year${years === 1 ? '' : 's'} in your current office before running for this one.`;
    }
    return 'You do not meet the requirements for this office yet.';
  }

  return null;
}
