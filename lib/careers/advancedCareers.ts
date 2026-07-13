/**
 * Advanced Career Definitions
 * 
 * High-level careers that require specific education, experience, or achievements
 */

import { Career } from '@/contexts/game/types';
import { AdvancedCareerUnlockRequirements } from '@/lib/types/requirements';

export interface AdvancedCareer extends Career {
  unlockRequirements: AdvancedCareerUnlockRequirements;
}

export const ADVANCED_CAREERS: AdvancedCareer[] = [
  {
    id: 'ceo',
    description: 'Chief Executive Officer - Lead a major corporation',
    levels: [
      {
        name: 'Junior Executive',
        salary: 3850, // ~$200k/yr
        experienceRequired: 0,
        description: 'Entry-level executive position',
      },
      {
        name: 'Senior Executive',
        salary: 6725, // ~$350k/yr
        experienceRequired: 104, // 2 years
        description: 'Senior management role',
      },
      {
        name: 'Vice President',
        salary: 9625, // ~$500k/yr
        experienceRequired: 260, // 5 years
        description: 'VP of operations',
      },
      {
        name: 'CEO',
        salary: 19225, // ~$1M/yr
        experienceRequired: 520, // 10 years
        description: 'Chief Executive Officer',
      },
    ],
    level: 0,
    applied: false,
    accepted: false,
    requirements: {
      education: ['masters', 'mba'],
      reputation: 50,
    },
    progress: 0,
    unlockRequirements: {
      education: ['masters', 'mba'],
      experience: 260, // 5 years
      reputation: 50,
      netWorth: 500000,
    },
  },
  {
    id: 'research_scientist',
    description: 'Conduct cutting-edge research and publish findings',
    levels: [
      {
        name: 'Research Assistant',
        salary: 1150, // ~$60k/yr
        experienceRequired: 0,
        description: 'Assist with research projects',
      },
      {
        name: 'Research Associate',
        salary: 1625, // ~$85k/yr
        experienceRequired: 104, // 2 years
        description: 'Lead research projects',
      },
      {
        name: 'Senior Researcher',
        salary: 2300, // ~$120k/yr
        experienceRequired: 260, // 5 years
        description: 'Senior research position',
      },
      {
        name: 'Principal Investigator',
        salary: 3450, // ~$180k/yr
        experienceRequired: 520, // 10 years
        description: 'Lead major research initiatives',
      },
    ],
    level: 0,
    applied: false,
    accepted: false,
    requirements: {
      education: ['phd'],
      reputation: 40,
    },
    progress: 0,
    unlockRequirements: {
      education: ['phd'],
      reputation: 40,
      achievements: ['scholar'],
    },
  },
  {
    id: 'creative_director',
    description: 'Lead creative teams and develop brand strategies',
    levels: [
      {
        name: 'Junior Designer',
        salary: 1050, // ~$55k/yr
        experienceRequired: 0,
        description: 'Entry-level design position',
      },
      {
        name: 'Senior Designer',
        salary: 1550, // ~$80k/yr
        experienceRequired: 104, // 2 years
        description: 'Senior design role',
      },
      {
        name: 'Art Director',
        salary: 2125, // ~$110k/yr
        experienceRequired: 260, // 5 years
        description: 'Lead design teams',
      },
      {
        name: 'Creative Director',
        salary: 2875, // ~$150k/yr
        experienceRequired: 416, // 8 years
        description: 'Oversee all creative direction',
      },
    ],
    level: 0,
    applied: false,
    accepted: false,
    requirements: {
      education: ['bachelors'],
      reputation: 35,
    },
    progress: 0,
    unlockRequirements: {
      education: ['bachelors'],
      experience: 156, // 3 years
      reputation: 35,
      achievements: ['social_celebrity'],
    },
  },
  {
    id: 'investment_banker',
    description: 'High-stakes financial transactions and mergers',
    levels: [
      {
        name: 'Analyst',
        salary: 1925, // ~$100k/yr
        experienceRequired: 0,
        description: 'Financial analysis and research',
      },
      {
        name: 'Associate',
        salary: 2875, // ~$150k/yr
        experienceRequired: 104, // 2 years
        description: 'Deal execution and client relations',
      },
      {
        name: 'Vice President',
        salary: 4800, // ~$250k/yr
        experienceRequired: 260, // 5 years
        description: 'Lead deal teams',
      },
      {
        name: 'Managing Director',
        salary: 9625, // ~$500k/yr
        experienceRequired: 520, // 10 years
        description: 'Top-level investment banking',
      },
    ],
    level: 0,
    applied: false,
    accepted: false,
    requirements: {
      education: ['masters', 'mba'],
      reputation: 45,
    },
    progress: 0,
    unlockRequirements: {
      education: ['masters', 'mba'],
      reputation: 45,
      netWorth: 1000000,
    },
  },
  {
    id: 'surgeon',
    description: 'Perform complex surgical procedures',
    levels: [
      {
        name: 'Resident',
        salary: 1150, // ~$60k/yr
        experienceRequired: 0,
        description: 'Medical residency training',
      },
      {
        name: 'Fellow',
        salary: 1550, // ~$80k/yr
        experienceRequired: 156, // 3 years
        description: 'Specialized surgical training',
      },
      {
        name: 'Attending Surgeon',
        salary: 5775, // ~$300k/yr
        experienceRequired: 312, // 6 years
        description: 'Independent surgical practice',
      },
      {
        name: 'Chief of Surgery',
        salary: 9625, // ~$500k/yr
        experienceRequired: 520, // 10 years
        description: 'Lead surgical department',
      },
    ],
    level: 0,
    applied: false,
    accepted: false,
    requirements: {
      education: ['medical_school'],
      reputation: 60,
    },
    progress: 0,
    unlockRequirements: {
      education: ['medical_school'],
      experience: 312, // 6 years (residency + fellowship)
      reputation: 60,
    },
  },
];

/**
 * Check if a career is unlocked based on game state
 */
export function isCareerUnlocked(
  career: AdvancedCareer,
  gameState: {
    education: { id: string; completed: boolean }[];
    /** Live claimed-achievement IDs (state.claimedProgressAchievements). */
    claimedAchievements: string[];
    stats: { reputation: number };
    weeksLived: number;
    /** Precomputed via the shared calculateNetWorth helper (task #64). */
    netWorth: number;
  }
): boolean {
  const req = career.unlockRequirements;

  // Check education
  if ('education' in req && req.education && req.education.length > 0) {
    const hasRequiredEducation = req.education.every(eduId =>
      gameState.education.some(edu => edu.id === eduId && edu.completed)
    );
    if (!hasRequiredEducation) return false;
  }

  // Check experience (weeks lived)
  if ('experience' in req && req.experience && gameState.weeksLived < req.experience) {
    return false;
  }

  // Check reputation
  if ('reputation' in req && req.reputation && gameState.stats.reputation < req.reputation) {
    return false;
  }

  // Check achievements — read the LIVE claimed-achievement store. The old code
  // read `achievements[].completed`, a flag never set in normal play (task #65),
  // so every achievement-gated career was permanently locked.
  if ('achievements' in req && req.achievements && req.achievements.length > 0) {
    const hasRequiredAchievements = req.achievements.every(achId =>
      gameState.claimedAchievements.includes(achId)
    );
    if (!hasRequiredAchievements) return false;
  }

  // Check net worth — use the caller-precomputed shared net worth (includes
  // savings/stocks/crypto/vehicles), not a cash+company+realEstate subset.
  if ('netWorth' in req && req.netWorth) {
    if (gameState.netWorth < req.netWorth) return false;
  }

  return true;
}

/**
 * Get all unlocked advanced careers
 */
export function getUnlockedAdvancedCareers(
  gameState: Parameters<typeof isCareerUnlocked>[1]
): AdvancedCareer[] {
  return ADVANCED_CAREERS.filter(career => isCareerUnlocked(career, gameState));
}

