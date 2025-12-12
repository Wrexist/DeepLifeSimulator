/**
 * Political Career Definitions
 * 
 * Career progression from local council member to president
 */
import { Career } from '@/contexts/game/types';

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

export const POLITICAL_CAREER_REQUIREMENTS = {
  council_member: {
    minAge: 25,
    minReputation: 30,
    education: ['business_degree'],
  },
  mayor: {
    minAge: 30,
    minReputation: 50,
    previousLevel: 'council_member',
    minWeeksInPrevious: 52, // 1 year
  },
  state_representative: {
    minAge: 35,
    minReputation: 70,
    previousLevel: 'mayor',
    minWeeksInPrevious: 104, // 2 years
  },
  governor: {
    minAge: 40,
    minReputation: 85,
    previousLevel: 'state_representative',
    minWeeksInPrevious: 208, // 4 years
  },
  senator: {
    minAge: 45,
    minReputation: 90,
    previousLevel: 'governor',
    minWeeksInPrevious: 208, // 4 years
  },
  president: {
    minAge: 50,
    minReputation: 95,
    previousLevel: 'senator',
    minWeeksInPrevious: 260, // 5 years
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
  
  if (requirements.education) {
    if (!requirements.education.every(edu => hasEducation(edu))) return false;
  }
  
  if (requirements.previousLevel) {
    const previousLevelIndex = POLITICAL_CAREER.levels.findIndex(
      l => l.name.toLowerCase().includes(requirements.previousLevel!.split('_')[0])
    );
    if (currentLevel <= previousLevelIndex) return false;
    if (weeksInCurrentLevel < requirements.minWeeksInPrevious) return false;
  }
  
  return true;
}

