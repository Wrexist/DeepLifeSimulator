/**
 * Advanced Career Definitions
 * 
 * High-level careers that require specific education, experience, or achievements
 */

import { Career } from '@/contexts/game/types';

export interface AdvancedCareer extends Career {
  unlockRequirements: {
    education?: string[]; // Required education IDs
    experience?: number; // Years of experience in related field
    reputation?: number; // Minimum reputation
    achievements?: string[]; // Required achievement IDs
    netWorth?: number; // Minimum net worth
  };
}

export const ADVANCED_CAREERS: AdvancedCareer[] = [
  {
    id: 'ceo',
    name: 'CEO',
    category: 'business',
    description: 'Chief Executive Officer - Lead a major corporation',
    levels: [
      {
        name: 'Junior Executive',
        salary: 200000,
        experienceRequired: 0,
        description: 'Entry-level executive position',
      },
      {
        name: 'Senior Executive',
        salary: 350000,
        experienceRequired: 104, // 2 years
        description: 'Senior management role',
      },
      {
        name: 'Vice President',
        salary: 500000,
        experienceRequired: 260, // 5 years
        description: 'VP of operations',
      },
      {
        name: 'CEO',
        salary: 1000000,
        experienceRequired: 520, // 10 years
        description: 'Chief Executive Officer',
      },
    ],
    level: 0,
    applied: false,
    accepted: false,
    unlockRequirements: {
      education: ['masters', 'mba'],
      experience: 260, // 5 years
      reputation: 50,
      netWorth: 500000,
    },
  },
  {
    id: 'research_scientist',
    name: 'Research Scientist',
    category: 'science',
    description: 'Conduct cutting-edge research and publish findings',
    levels: [
      {
        name: 'Research Assistant',
        salary: 60000,
        experienceRequired: 0,
        description: 'Assist with research projects',
      },
      {
        name: 'Research Associate',
        salary: 85000,
        experienceRequired: 104, // 2 years
        description: 'Lead research projects',
      },
      {
        name: 'Senior Researcher',
        salary: 120000,
        experienceRequired: 260, // 5 years
        description: 'Senior research position',
      },
      {
        name: 'Principal Investigator',
        salary: 180000,
        experienceRequired: 520, // 10 years
        description: 'Lead major research initiatives',
      },
    ],
    level: 0,
    applied: false,
    accepted: false,
    unlockRequirements: {
      education: ['phd'],
      reputation: 40,
      achievements: ['first_publication'],
    },
  },
  {
    id: 'creative_director',
    name: 'Creative Director',
    category: 'creative',
    description: 'Lead creative teams and develop brand strategies',
    levels: [
      {
        name: 'Junior Designer',
        salary: 55000,
        experienceRequired: 0,
        description: 'Entry-level design position',
      },
      {
        name: 'Senior Designer',
        salary: 80000,
        experienceRequired: 104, // 2 years
        description: 'Senior design role',
      },
      {
        name: 'Art Director',
        salary: 110000,
        experienceRequired: 260, // 5 years
        description: 'Lead design teams',
      },
      {
        name: 'Creative Director',
        salary: 150000,
        experienceRequired: 416, // 8 years
        description: 'Oversee all creative direction',
      },
    ],
    level: 0,
    applied: false,
    accepted: false,
    unlockRequirements: {
      education: ['bachelors'],
      experience: 156, // 3 years
      reputation: 35,
      achievements: ['artistic_achievement'],
    },
  },
  {
    id: 'investment_banker',
    name: 'Investment Banker',
    category: 'finance',
    description: 'High-stakes financial transactions and mergers',
    levels: [
      {
        name: 'Analyst',
        salary: 100000,
        experienceRequired: 0,
        description: 'Financial analysis and research',
      },
      {
        name: 'Associate',
        salary: 150000,
        experienceRequired: 104, // 2 years
        description: 'Deal execution and client relations',
      },
      {
        name: 'Vice President',
        salary: 250000,
        experienceRequired: 260, // 5 years
        description: 'Lead deal teams',
      },
      {
        name: 'Managing Director',
        salary: 500000,
        experienceRequired: 520, // 10 years
        description: 'Top-level investment banking',
      },
    ],
    level: 0,
    applied: false,
    accepted: false,
    unlockRequirements: {
      education: ['masters', 'mba'],
      reputation: 45,
      netWorth: 1000000,
    },
  },
  {
    id: 'surgeon',
    name: 'Surgeon',
    category: 'medical',
    description: 'Perform complex surgical procedures',
    levels: [
      {
        name: 'Resident',
        salary: 60000,
        experienceRequired: 0,
        description: 'Medical residency training',
      },
      {
        name: 'Fellow',
        salary: 80000,
        experienceRequired: 156, // 3 years
        description: 'Specialized surgical training',
      },
      {
        name: 'Attending Surgeon',
        salary: 300000,
        experienceRequired: 312, // 6 years
        description: 'Independent surgical practice',
      },
      {
        name: 'Chief of Surgery',
        salary: 500000,
        experienceRequired: 520, // 10 years
        description: 'Lead surgical department',
      },
    ],
    level: 0,
    applied: false,
    accepted: false,
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
    education: Array<{ id: string; completed: boolean }>;
    achievements: Array<{ id: string; completed: boolean }>;
    stats: { reputation: number; money: number };
    weeksLived: number;
    companies: Array<{ weeklyIncome: number }>;
    realEstate: Array<{ owned: boolean; value: number }>;
  }
): boolean {
  const req = career.unlockRequirements;

  // Check education
  if (req.education && req.education.length > 0) {
    const hasRequiredEducation = req.education.every(eduId =>
      gameState.education.some(edu => edu.id === eduId && edu.completed)
    );
    if (!hasRequiredEducation) return false;
  }

  // Check experience (weeks lived)
  if (req.experience && gameState.weeksLived < req.experience) {
    return false;
  }

  // Check reputation
  if (req.reputation && gameState.stats.reputation < req.reputation) {
    return false;
  }

  // Check achievements
  if (req.achievements && req.achievements.length > 0) {
    const hasRequiredAchievements = req.achievements.every(achId =>
      gameState.achievements.some(ach => ach.id === achId && ach.completed)
    );
    if (!hasRequiredAchievements) return false;
  }

  // Check net worth
  if (req.netWorth) {
    const companyValue = gameState.companies.reduce((sum, c) => sum + c.weeklyIncome * 10, 0);
    const realEstateValue = gameState.realEstate
      .filter(p => p.owned)
      .reduce((sum, p) => sum + p.value, 0);
    const netWorth = gameState.stats.money + companyValue + realEstateValue;
    if (netWorth < req.netWorth) return false;
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

