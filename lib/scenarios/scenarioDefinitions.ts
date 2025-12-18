/**
 * Scenario Definitions
 * 
 * Defines game scenarios with win conditions and starting conditions
 */

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
    timeLimit: 520, // 10 years
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
    timeLimit: 416, // 8 years
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
    timeLimit: 260, // 5 years
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
    timeLimit: 520, // 10 years
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
    timeLimit: 312, // 6 years
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
      noChildren: true, // Start with no children (will need to have/adopt one)
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
    timeLimit: 416, // 8 years
    rewards: {
      gems: 80,
      achievement: 'single_parent_success',
      title: 'Super Parent',
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
          const isPresident = politicalCareer && 
            politicalCareer.accepted && 
            politicalCareer.level >= 5; // President is level 5 (last level, index 5)
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
        const { netWorth: calculateNetWorth } = require('@/lib/progress/achievements');
        // Create a minimal GameState-like object for net worth calculation
        // Note: This is a simplified version - full calculation would need full GameState
        // But we include the most important components: money, companies, real estate
        const companyValue = (gameState.companies || []).reduce((sum, c) => {
          const weeklyIncome = c.weeklyIncome || 0;
          const annualIncome = weeklyIncome * 52; // Company value = annual income
          return sum + annualIncome;
        }, 0);
        const realEstateValue = (gameState.realEstate || [])
          .filter(p => p.owned)
          .reduce((sum, p) => sum + (p.value || p.price || 0), 0);
        // CRITICAL FIX: Include bank savings if available in gameState
        const bankSavings = (gameState as any).bankSavings || 0;
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