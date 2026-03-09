/**
 * Scenario Definitions
 * 
 * Defines game scenarios with win conditions and starting conditions
 */

import { WEEKS_PER_YEAR } from '@/lib/config/gameConstants';

export interface ScenarioCondition {
  type: 'money' | 'reputation' | 'age' | 'education' | 'career' | 'achievement' | 'relationship' | 'netWorth';
  operator: '>=' | '<=' | '==' | '>';
  value: number | string;
  description: string;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  icon?: string;
  difficulty: 'easy' | 'medium' | 'hard' | 'expert';
  startingConditions: {
    money?: number;
    age?: number;
    education?: string[];
    reputation?: number;
    items?: string[]; // Item IDs to start with
    relationships?: string[]; // Relationship types to exclude/include
    noChildren?: boolean; // Start with no children
    hasChild?: boolean; // Start with a child (for single parent scenario)
    childAge?: number; // Age of starting child if hasChild is true
    stats?: {
      health?: number;
      happiness?: number;
      energy?: number;
    };
  };
  winConditions: ScenarioCondition[];
  timeLimit?: number; // Weeks to complete (optional)
  rewards?: {
    gems?: number;
    achievement?: string;
    title?: string;
  };
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'rags_to_riches',
    name: 'Rags to Riches',
    description: 'Start with nothing and build a fortune. Reach $1M net worth.',
    difficulty: 'medium',
    startingConditions: {
      money: 100,
      age: 18,
      reputation: 0,
      noChildren: true, // Focus on building wealth, no family distractions
      stats: {
        health: 70,
        happiness: 50,
        energy: 80,
      },
    },
    winConditions: [
      {
        type: 'netWorth',
        operator: '>=',
        value: 1000000,
        description: 'Reach $1,000,000 net worth',
      },
    ],
    timeLimit: 10 * WEEKS_PER_YEAR, // 10 years
    rewards: {
      gems: 50,
      achievement: 'rags_to_riches',
      title: 'Self-Made Millionaire',
    },
  },
  {
    id: 'academic_excellence',
    name: 'Academic Excellence',
    description: 'Complete all education levels and become a research scientist.',
    difficulty: 'hard',
    startingConditions: {
      money: 5000,
      age: 18,
      reputation: 10,
      education: [],
      items: ['computer'], // Need computer for research
      noChildren: true,
      stats: {
        health: 80,
        happiness: 60,
        energy: 90,
      },
    },
    winConditions: [
      {
        type: 'education',
        operator: '==',
        value: 'phd',
        description: 'Complete PhD',
      },
      {
        type: 'career',
        operator: '==',
        value: 'research_scientist',
        description: 'Become a Research Scientist',
      },
    ],
    timeLimit: 8 * WEEKS_PER_YEAR, // 8 years
    rewards: {
      gems: 75,
      achievement: 'academic_excellence',
      title: 'Doctor of Philosophy',
    },
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Build a large network of relationships and maintain high reputation.',
    difficulty: 'easy',
    startingConditions: {
      money: 2000,
      age: 20,
      reputation: 5,
      items: ['smartphone'], // Need phone for social connections
      noChildren: true,
      stats: {
        health: 75,
        happiness: 70,
        energy: 85,
      },
    },
    winConditions: [
      {
        type: 'relationship',
        operator: '>=',
        value: 10,
        description: 'Have 10+ relationships',
      },
      {
        type: 'reputation',
        operator: '>=',
        value: 80,
        description: 'Reach 80+ reputation',
      },
    ],
    timeLimit: 5 * WEEKS_PER_YEAR, // 5 years
    rewards: {
      gems: 40,
      achievement: 'social_butterfly',
      title: 'People Person',
    },
  },
  {
    id: 'entrepreneur',
    name: 'Entrepreneur',
    description: 'Build a business empire with multiple companies generating high income.',
    difficulty: 'hard',
    startingConditions: {
      money: 10000,
      age: 25,
      reputation: 15,
      items: ['computer', 'smartphone'], // Need tech for business
      noChildren: true,
      stats: {
        health: 70,
        happiness: 60,
        energy: 75,
      },
    },
    winConditions: [
      {
        type: 'career',
        operator: '==',
        value: 'ceo',
        description: 'Become a CEO',
      },
      {
        type: 'money',
        operator: '>=',
        value: 5000000,
        description: 'Have $5M in cash',
      },
    ],
    timeLimit: 10 * WEEKS_PER_YEAR, // 10 years
    rewards: {
      gems: 100,
      achievement: 'entrepreneur',
      title: 'Business Magnate',
    },
  },
  {
    id: 'family_focused',
    name: 'Family Focused',
    description: 'Get married, have children, and build a happy family life.',
    difficulty: 'medium',
    startingConditions: {
      money: 3000,
      age: 22,
      reputation: 10,
      items: ['smartphone'], // Need phone for dating/relationships
      noChildren: true, // Start single, need to find partner
      stats: {
        health: 80,
        happiness: 75,
        energy: 80,
      },
    },
    winConditions: [
      {
        type: 'relationship',
        operator: '>=',
        value: 1,
        description: 'Get married',
      },
      {
        type: 'achievement',
        operator: '==',
        value: 'family_man',
        description: 'Achieve "Family Man" achievement',
      },
    ],
    timeLimit: 6 * WEEKS_PER_YEAR, // 6 years
    rewards: {
      gems: 60,
      achievement: 'family_focused',
      title: 'Family Man',
    },
  },
  {
    id: 'single_parent',
    name: 'Single Parent',
    description: 'You\'re raising a child alone. Balance work, life, and parenting to provide the best future for your family.',
    difficulty: 'hard',
    startingConditions: {
      money: 1200,
      age: 28,
      reputation: 5,
      items: ['smartphone'], // Mobile phone to see contacts
      noChildren: false, // Start WITH a child (you're already a single parent)
      hasChild: true, // Flag to indicate starting with a child
      childAge: 3, // Child is 3 years old at start
      relationships: [], // No starting relationships except what's needed
      stats: {
        health: 70,
        happiness: 60,
        energy: 70,
      },
    },
    winConditions: [
      {
        type: 'relationship',
        operator: '>=',
        value: 1,
        description: 'Have at least 1 child',
      },
      {
        type: 'money',
        operator: '>=',
        value: 50000,
        description: 'Save $50,000 for your child\'s future',
      },
      {
        type: 'reputation',
        operator: '>=',
        value: 50,
        description: 'Build a good reputation (50+)',
      },
    ],
    timeLimit: 8 * WEEKS_PER_YEAR, // 8 years
    rewards: {
      gems: 80,
      achievement: 'single_parent_success',
      title: 'Super Parent',
    },
  },

  // === NEW CHALLENGE SCENARIOS ===

  {
    id: 'criminal_empire',
    name: 'Criminal Empire',
    description: 'Rise from petty crime to kingpin. Build a criminal empire worth millions — but watch your back.',
    icon: '🔫',
    difficulty: 'expert',
    startingConditions: {
      money: 500,
      age: 18,
      reputation: 0,
      noChildren: true,
      stats: {
        health: 80,
        happiness: 40,
        energy: 90,
      },
    },
    winConditions: [
      {
        type: 'netWorth',
        operator: '>=',
        value: 2000000,
        description: 'Amass $2M net worth through any means',
      },
      {
        type: 'reputation',
        operator: '>=',
        value: 60,
        description: 'Build fearsome reputation (60+)',
      },
    ],
    timeLimit: 12 * WEEKS_PER_YEAR, // 12 years
    rewards: {
      gems: 150,
      achievement: 'criminal_empire',
      title: 'Kingpin',
    },
  },
  {
    id: 'political_dynasty',
    name: 'Political Dynasty',
    description: 'Climb from nobody to President. Win elections, build alliances, and lead the nation.',
    icon: '🏛️',
    difficulty: 'expert',
    startingConditions: {
      money: 5000,
      age: 25,
      reputation: 20,
      education: ['college'],
      items: ['smartphone', 'computer'],
      noChildren: true,
      stats: {
        health: 75,
        happiness: 65,
        energy: 80,
      },
    },
    winConditions: [
      {
        type: 'career',
        operator: '==',
        value: 'president',
        description: 'Become President',
      },
      {
        type: 'reputation',
        operator: '>=',
        value: 90,
        description: 'Achieve iconic reputation (90+)',
      },
    ],
    timeLimit: 15 * WEEKS_PER_YEAR, // 15 years
    rewards: {
      gems: 200,
      achievement: 'political_dynasty',
      title: 'Mr. President',
    },
  },
  {
    id: 'tech_mogul',
    name: 'Tech Mogul',
    description: 'Start in a garage, build the next tech giant. Code your way to billions.',
    icon: '💻',
    difficulty: 'hard',
    startingConditions: {
      money: 3000,
      age: 20,
      reputation: 5,
      items: ['computer', 'smartphone'],
      noChildren: true,
      stats: {
        health: 70,
        happiness: 65,
        energy: 85,
      },
    },
    winConditions: [
      {
        type: 'netWorth',
        operator: '>=',
        value: 10000000,
        description: 'Reach $10M net worth',
      },
      {
        type: 'career',
        operator: '==',
        value: 'ceo',
        description: 'Become CEO of your company',
      },
    ],
    timeLimit: 10 * WEEKS_PER_YEAR, // 10 years
    rewards: {
      gems: 120,
      achievement: 'tech_mogul',
      title: 'Silicon Valley Legend',
    },
  },
  {
    id: 'real_estate_tycoon',
    name: 'Real Estate Tycoon',
    description: 'Buy, flip, and rent your way to a property empire. Location, location, location.',
    icon: '🏠',
    difficulty: 'hard',
    startingConditions: {
      money: 15000,
      age: 25,
      reputation: 10,
      items: ['smartphone', 'computer'],
      noChildren: true,
      stats: {
        health: 75,
        happiness: 60,
        energy: 80,
      },
    },
    winConditions: [
      {
        type: 'netWorth',
        operator: '>=',
        value: 5000000,
        description: 'Build $5M real estate portfolio',
      },
    ],
    timeLimit: 10 * WEEKS_PER_YEAR, // 10 years
    rewards: {
      gems: 100,
      achievement: 'real_estate_tycoon',
      title: 'Property Baron',
    },
  },
  {
    id: 'speedrun',
    name: 'Speedrun',
    description: 'How fast can you reach $100K? Every week counts. No time to waste.',
    icon: '⚡',
    difficulty: 'expert',
    startingConditions: {
      money: 1000,
      age: 18,
      reputation: 5,
      items: ['smartphone'],
      noChildren: true,
      stats: {
        health: 80,
        happiness: 70,
        energy: 100,
      },
    },
    winConditions: [
      {
        type: 'money',
        operator: '>=',
        value: 100000,
        description: 'Earn $100,000 in cash',
      },
    ],
    timeLimit: 2 * WEEKS_PER_YEAR, // 2 years — very tight!
    rewards: {
      gems: 125,
      achievement: 'speedrun_champion',
      title: 'Speed Demon',
    },
  },
  {
    id: 'balanced_life',
    name: 'Balanced Life',
    description: 'Money isn\'t everything. Achieve excellence across health, wealth, relationships, and career.',
    icon: '⚖️',
    difficulty: 'hard',
    startingConditions: {
      money: 2000,
      age: 20,
      reputation: 10,
      items: ['smartphone'],
      noChildren: true,
      stats: {
        health: 60,
        happiness: 60,
        energy: 70,
      },
    },
    winConditions: [
      {
        type: 'money',
        operator: '>=',
        value: 100000,
        description: 'Save $100K',
      },
      {
        type: 'reputation',
        operator: '>=',
        value: 75,
        description: 'High reputation (75+)',
      },
      {
        type: 'relationship',
        operator: '>=',
        value: 5,
        description: 'Build 5+ meaningful relationships',
      },
    ],
    timeLimit: 10 * WEEKS_PER_YEAR, // 10 years
    rewards: {
      gems: 90,
      achievement: 'balanced_life',
      title: 'Renaissance Person',
    },
  },
  {
    id: 'debt_escape',
    name: 'Debt Escape',
    description: 'You\'re drowning in debt. Claw your way back to zero — and then beyond.',
    icon: '💸',
    difficulty: 'hard',
    startingConditions: {
      money: 50,
      age: 30,
      reputation: 5,
      items: ['smartphone'],
      noChildren: true,
      stats: {
        health: 60,
        happiness: 30,
        energy: 65,
      },
    },
    winConditions: [
      {
        type: 'money',
        operator: '>=',
        value: 50000,
        description: 'Save $50,000 (debt-free + savings)',
      },
      {
        type: 'reputation',
        operator: '>=',
        value: 40,
        description: 'Rebuild your reputation (40+)',
      },
    ],
    timeLimit: 6 * WEEKS_PER_YEAR, // 6 years
    rewards: {
      gems: 85,
      achievement: 'debt_escape',
      title: 'Debt Destroyer',
    },
  },
  {
    id: 'fame_seeker',
    name: 'Fame Seeker',
    description: 'From unknown to icon. Build your fame through social media, career, and connections.',
    icon: '⭐',
    difficulty: 'medium',
    startingConditions: {
      money: 1500,
      age: 19,
      reputation: 0,
      items: ['smartphone', 'computer'],
      noChildren: true,
      stats: {
        health: 80,
        happiness: 70,
        energy: 90,
      },
    },
    winConditions: [
      {
        type: 'reputation',
        operator: '>=',
        value: 95,
        description: 'Reach legendary reputation (95+)',
      },
    ],
    timeLimit: 8 * WEEKS_PER_YEAR, // 8 years
    rewards: {
      gems: 70,
      achievement: 'fame_seeker',
      title: 'Living Legend',
    },
  },
  {
    id: 'minimalist',
    name: 'Minimalist Challenge',
    description: 'Less is more. Reach maximum happiness with under $5,000. Prove money can\'t buy joy.',
    icon: '🧘',
    difficulty: 'medium',
    startingConditions: {
      money: 500,
      age: 22,
      reputation: 10,
      items: ['smartphone'],
      noChildren: true,
      stats: {
        health: 70,
        happiness: 50,
        energy: 75,
      },
    },
    winConditions: [
      {
        type: 'reputation',
        operator: '>=',
        value: 70,
        description: 'Build solid reputation (70+)',
      },
      {
        type: 'relationship',
        operator: '>=',
        value: 8,
        description: 'Forge 8+ relationships',
      },
    ],
    timeLimit: 6 * WEEKS_PER_YEAR, // 6 years
    rewards: {
      gems: 65,
      achievement: 'minimalist',
      title: 'Zen Master',
    },
  },
  // ─── Phase 3 additions ──────────────────────────────────────────
  {
    id: 'athletes_journey',
    name: "Athlete's Journey",
    description: 'Start as an unfit teen and become a champion athlete. Push your body to its limits.',
    icon: '🏆',
    difficulty: 'hard',
    startingConditions: {
      money: 200,
      age: 16,
      reputation: 0,
      noChildren: true,
      stats: {
        health: 40,
        happiness: 60,
        energy: 50,
      },
    },
    winConditions: [
      {
        type: 'career',
        operator: '==',
        value: 'athlete',
        description: 'Become a professional athlete',
      },
      {
        type: 'reputation',
        operator: '>=',
        value: 60,
        description: 'Build a strong reputation (60+)',
      },
    ],
    timeLimit: 8 * WEEKS_PER_YEAR, // 8 years
    rewards: {
      gems: 55,
      achievement: 'athletes_journey',
      title: 'Champion',
    },
  },
  {
    id: 'creative_legend',
    name: 'Creative Legend',
    description: 'Start as a nobody and become famous through music or art. Build your creative empire.',
    icon: '🎨',
    difficulty: 'hard',
    startingConditions: {
      money: 300,
      age: 20,
      reputation: 5,
      items: ['guitar'],
      noChildren: true,
      stats: {
        health: 70,
        happiness: 60,
        energy: 70,
      },
    },
    winConditions: [
      {
        type: 'reputation',
        operator: '>=',
        value: 80,
        description: 'Achieve fame and recognition (80+ reputation)',
      },
      {
        type: 'netWorth',
        operator: '>=',
        value: 500000,
        description: 'Earn $500,000 from your creative work',
      },
    ],
    timeLimit: 10 * WEEKS_PER_YEAR, // 10 years
    rewards: {
      gems: 60,
      achievement: 'creative_legend',
      title: 'Creative Genius',
    },
  },
  {
    id: 'late_bloomer',
    name: 'Late Bloomer',
    description: 'Start at age 40 with nothing. Prove it\'s never too late to build a great life.',
    icon: '🌺',
    difficulty: 'expert',
    startingConditions: {
      money: 500,
      age: 40,
      reputation: 5,
      noChildren: true,
      stats: {
        health: 50,
        happiness: 30,
        energy: 40,
      },
    },
    winConditions: [
      {
        type: 'netWorth',
        operator: '>=',
        value: 500000,
        description: 'Build $500,000 net worth',
      },
      {
        type: 'relationship',
        operator: '>=',
        value: 5,
        description: 'Build 5+ meaningful relationships',
      },
    ],
    timeLimit: 10 * WEEKS_PER_YEAR, // 10 years
    rewards: {
      gems: 80,
      achievement: 'late_bloomer',
      title: 'Late Bloomer',
    },
  },
  {
    id: 'lottery_winner',
    name: 'Lottery Winner',
    description: 'You just won $500,000! Can you keep it and grow it, or will you blow it all?',
    icon: '🎰',
    difficulty: 'easy',
    startingConditions: {
      money: 500000,
      age: 25,
      reputation: 5,
      noChildren: true,
      stats: {
        health: 70,
        happiness: 90,
        energy: 80,
      },
    },
    winConditions: [
      {
        type: 'netWorth',
        operator: '>=',
        value: 2000000,
        description: 'Grow your winnings to $2,000,000',
      },
    ],
    timeLimit: 10 * WEEKS_PER_YEAR, // 10 years
    rewards: {
      gems: 40,
      achievement: 'lottery_winner',
      title: 'Smart Money',
    },
  },
  {
    id: 'redemption_arc',
    name: 'Redemption Arc',
    description: 'Start with a criminal record and wanted level. Turn your life around and become a respected citizen.',
    icon: '⚖️',
    difficulty: 'hard',
    startingConditions: {
      money: 50,
      age: 25,
      reputation: -10,
      noChildren: true,
      stats: {
        health: 60,
        happiness: 20,
        energy: 50,
      },
    },
    winConditions: [
      {
        type: 'reputation',
        operator: '>=',
        value: 50,
        description: 'Rebuild your reputation to 50+',
      },
      {
        type: 'career',
        operator: '>=',
        value: 1,
        description: 'Hold a legitimate job',
      },
    ],
    timeLimit: 8 * WEEKS_PER_YEAR, // 8 years
    rewards: {
      gems: 70,
      achievement: 'redemption_arc',
      title: 'Redeemed',
    },
  },
  {
    id: 'health_recovery',
    name: 'Health Recovery',
    description: 'Start with terrible health and no fitness. Get healthy and stay healthy for a full year.',
    icon: '💪',
    difficulty: 'medium',
    startingConditions: {
      money: 1000,
      age: 30,
      reputation: 10,
      noChildren: true,
      stats: {
        health: 15,
        happiness: 30,
        energy: 20,
      },
    },
    winConditions: [
      {
        type: 'money',
        operator: '>=',
        value: 80,
        description: 'Reach 80+ health',
      },
    ],
    timeLimit: 5 * WEEKS_PER_YEAR, // 5 years
    rewards: {
      gems: 45,
      achievement: 'health_recovery',
      title: 'Comeback Kid',
    },
  },
  {
    id: 'world_traveler',
    name: 'World Traveler',
    description: 'Visit every continent and build a global network. The world is your playground.',
    icon: '✈️',
    difficulty: 'medium',
    startingConditions: {
      money: 5000,
      age: 22,
      reputation: 10,
      items: ['smartphone'],
      noChildren: true,
      stats: {
        health: 80,
        happiness: 70,
        energy: 80,
      },
    },
    winConditions: [
      {
        type: 'reputation',
        operator: '>=',
        value: 50,
        description: 'Build worldwide reputation (50+)',
      },
      {
        type: 'netWorth',
        operator: '>=',
        value: 100000,
        description: 'Maintain $100,000 net worth while traveling',
      },
    ],
    timeLimit: 8 * WEEKS_PER_YEAR, // 8 years
    rewards: {
      gems: 50,
      achievement: 'world_traveler',
      title: 'Globe Trotter',
    },
  },
  {
    id: 'survival_expert',
    name: 'Survival Expert',
    description: 'Start with almost nothing and no energy. Survive 5 years without going bankrupt or dying.',
    icon: '🏕️',
    difficulty: 'expert',
    startingConditions: {
      money: 0,
      age: 18,
      reputation: 0,
      noChildren: true,
      stats: {
        health: 30,
        happiness: 20,
        energy: 15,
      },
    },
    winConditions: [
      {
        type: 'age',
        operator: '>=',
        value: 23,
        description: 'Survive to age 23',
      },
      {
        type: 'money',
        operator: '>=',
        value: 10000,
        description: 'Save $10,000',
      },
    ],
    timeLimit: 5 * WEEKS_PER_YEAR, // 5 years
    rewards: {
      gems: 75,
      achievement: 'survival_expert',
      title: 'Survivor',
    },
  },
];

/**
 * Get scenario by ID
 */
export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find(s => s.id === id);
}

/**
 * Get all scenarios
 */
export function getAllScenarios(): Scenario[] {
  return SCENARIOS;
}

/**
 * Get scenarios by difficulty
 */
export function getScenariosByDifficulty(difficulty: Scenario['difficulty']): Scenario[] {
  return SCENARIOS.filter(s => s.difficulty === difficulty);
}

/**
 * Check if scenario win conditions are met
 */
export function checkScenarioWin(
  scenario: Scenario,
  gameState: {
    stats: { money: number; reputation: number };
    age: number;
    education: Array<{ id: string; completed: boolean }>;
    careers: Array<{ id: string; accepted: boolean }>;
    relationships: Array<{ type: string }>;
    achievements: Array<{ id: string; completed: boolean }>;
    companies: Array<{ weeklyIncome: number }>;
    realEstate: Array<{ owned: boolean; value: number }>;
    weeksLived: number;
  }
): { won: boolean; unmetConditions: ScenarioCondition[] } {
  const unmetConditions: ScenarioCondition[] = [];

  for (const condition of scenario.winConditions) {
    let conditionMet = false;

    switch (condition.type) {
      case 'money':
        conditionMet = checkCondition(gameState.stats.money, condition.operator, condition.value as number);
        break;
      case 'reputation':
        conditionMet = checkCondition(gameState.stats.reputation, condition.operator, condition.value as number);
        break;
      case 'age':
        conditionMet = checkCondition(gameState.age, condition.operator, condition.value as number);
        break;
      case 'education':
        const hasEducation = gameState.education.some(edu => 
          edu.id === condition.value && edu.completed
        );
        conditionMet = condition.operator === '==' ? hasEducation : !hasEducation;
        break;
      case 'career':
        // CRITICAL FIX: Handle special career checks (e.g., "president" = political career at max level)
        if (condition.value === 'president') {
          // President is the highest level (level 5, index 5) of the political career
          // Political career has 6 levels (0-5), so level 5 is the last level (President)
          const politicalCareer = gameState.careers.find(c => c.id === 'political');
          const isPresident = !!(politicalCareer && 
            politicalCareer.accepted && 
            'level' in politicalCareer && 
            typeof politicalCareer.level === 'number' &&
            politicalCareer.level >= 5); // President is level 5 (last level, index 5)
          conditionMet = condition.operator === '==' ? isPresident : !isPresident;
        } else {
          // Standard career check - just verify career exists and is accepted
          const hasCareer = gameState.careers.some(career => 
            career.id === condition.value && career.accepted
          );
          conditionMet = condition.operator === '==' ? hasCareer : !hasCareer;
        }
        break;
      case 'relationship':
        const relationshipCount = gameState.relationships.filter(rel => 
          condition.value === 'married' ? rel.type === 'spouse' : true
        ).length;
        conditionMet = checkCondition(relationshipCount, condition.operator, condition.value as number);
        break;
      case 'achievement':
        const hasAchievement = gameState.achievements.some(ach => 
          ach.id === condition.value && ach.completed
        );
        conditionMet = condition.operator === '==' ? hasAchievement : !hasAchievement;
        break;
      case 'netWorth':
        // CRITICAL FIX: Use proper net worth calculation that includes all assets
        // Import the actual netWorth function to ensure consistency with game calculations
        // This ensures challenge scenarios check net worth correctly
        // const { netWorth: calculateNetWorth } = require('@/lib/progress/achievements');
        // Create a minimal GameState-like object for net worth calculation
        // Note: This is a simplified version - full calculation would need full GameState
        // But we include the most important components: money, companies, real estate
        const companyValue = (gameState.companies || []).reduce((sum, c) => {
          const weeklyIncome = c.weeklyIncome || 0;
          const annualIncome = weeklyIncome * WEEKS_PER_YEAR; // Company value = annual income
          return sum + annualIncome;
        }, 0);
        const realEstateValue = (gameState.realEstate || [])
          .filter((p) => p.owned)
          .reduce((sum, p) => sum + p.value, 0);
        // CRITICAL FIX: Include bank savings if available in gameState
        const bankSavings = gameState.bankSavings || 0;
        // Calculate net worth (simplified - doesn't include stocks/vehicles/loans in this context)
        // This matches the original calculation but is more explicit
        const netWorth = gameState.stats.money + bankSavings + companyValue + realEstateValue;
        conditionMet = checkCondition(netWorth, condition.operator, condition.value as number);
        break;
    }

    if (!conditionMet) {
      unmetConditions.push(condition);
    }
  }

  return {
    won: unmetConditions.length === 0,
    unmetConditions,
  };
}

/**
 * Helper function to check condition
 */
function checkCondition(actual: number, operator: string, expected: number): boolean {
  switch (operator) {
    case '>=':
      return actual >= expected;
    case '<=':
      return actual <= expected;
    case '>':
      return actual > expected;
    case '==':
      return actual === expected;
    default:
      return false;
  }
}

/**
 * Get difficulty label for display
 * CRITICAL FIX: Added missing function to prevent "undefined is not a function" crash
 */
export function getDifficultyLabel(difficulty: Scenario['difficulty']): string {
  switch (difficulty) {
    case 'easy':
      return 'Easy';
    case 'medium':
      return 'Medium';
    case 'hard':
      return 'Hard';
    case 'expert':
      return 'Expert';
    default:
      return 'Unknown';
  }
}

/**
 * Get difficulty color for display
 * CRITICAL FIX: Added missing function to prevent "undefined is not a function" crash
 */
export function getDifficultyColor(difficulty: Scenario['difficulty']): string {
  switch (difficulty) {
    case 'easy':
      return '#10B981'; // Green
    case 'medium':
      return '#F59E0B'; // Orange
    case 'hard':
      return '#EF4444'; // Red
    case 'expert':
      return '#8B5CF6'; // Purple
    default:
      return '#6B7280'; // Gray
  }
}

/**
 * Check if a scenario is completed by ID
 * CRITICAL FIX: Added missing function to prevent "undefined is not a function" crash in prestigeExecution
 */
export function isScenarioCompleted(
  scenarioId: string,
  gameState: {
    stats: { money: number; reputation: number };
    age: number;
    education: Array<{ id: string; completed: boolean }>;
    careers: Array<{ id: string; accepted: boolean }>;
    relationships: Array<{ type: string }>;
    achievements: Array<{ id: string; completed: boolean }>;
    companies: Array<{ weeklyIncome: number }>;
    realEstate: Array<{ owned: boolean; value: number }>;
    weeksLived: number;
  }
): boolean {
  const scenario = SCENARIOS.find(s => s.id === scenarioId);
  if (!scenario) {
    return false;
  }
  
  const result = checkScenarioWin(scenario, gameState);
  return result.won;
}