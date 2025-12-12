/**
 * Scenario Definitions
 * 
 * Pre-defined game scenarios with unique starting conditions and challenges
 */

import { ImageSourcePropType } from 'react-native';
import { GameState, GameStats } from '@/contexts/game/types';

export type ScenarioDifficulty = 'easy' | 'medium' | 'hard' | 'extreme';

export interface ScenarioGoal {
  id: string;
  description: string;
  target: number;
  type: 'money' | 'reputation' | 'happiness' | 'company_value' | 'followers' | 'properties';
}

export interface ScenarioModifier {
  type: 'income_multiplier' | 'expense_multiplier' | 'relationship_decay' | 'event_frequency';
  value: number;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  difficulty: ScenarioDifficulty;
  unlockRequirement?: string; // Achievement ID or condition
  
  // Starting conditions
  startingStats: Partial<GameStats>;
  startingAge: number;
  startingMoney: number;
  startingItems?: string[];
  startingEducation?: string[];
  startingJob?: string;
  startingReputation?: number;
  
  // Special conditions
  hasDebt?: number;
  hasChildren?: number;
  isHomeless?: boolean;
  hasCriminalRecord?: boolean;
  startingRelationships?: {
    type: 'parent' | 'friend' | 'partner' | 'child';
    count: number;
  }[];
  
  // Goals
  primaryGoal: ScenarioGoal;
  secondaryGoals?: ScenarioGoal[];
  
  // Modifiers during scenario
  modifiers?: ScenarioModifier[];
  
  // Rewards for completion
  rewards: {
    gems: number;
    achievementId?: string;
    unlocks?: string[];
  };
  
  // UI
  icon: ImageSourcePropType;
  color: string;
  gradient: [string, string];
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'rags_to_riches',
    name: 'Rags to Riches',
    description: 'Start with nothing and build a fortune. No money, no home, no education. Can you climb to the top?',
    difficulty: 'hard',
    
    startingStats: {
      health: 80,
      happiness: 30,
      energy: 70,
      fitness: 20,
      money: 0,
      reputation: 0,
      gems: 0,
    },
    startingAge: 18,
    startingMoney: 0,
    startingReputation: 0,
    isHomeless: true,
    
    primaryGoal: {
      id: 'become_millionaire',
      description: 'Accumulate $1,000,000 in net worth',
      target: 1000000,
      type: 'money',
    },
    secondaryGoals: [
      {
        id: 'own_home',
        description: 'Own at least one property',
        target: 1,
        type: 'properties',
      },
    ],
    
    modifiers: [
      { type: 'income_multiplier', value: 0.8 }, // 20% less income starting out
    ],
    
    rewards: {
      gems: 1000, // Awarded only on first prestige
      achievementId: 'rags_to_riches_complete',
    },
    
    icon: require('@/assets/images/Scenarios/Rags to Riches_final.png'),
    color: '#8B4513',
    gradient: ['#8B4513', '#A0522D'],
  },
  
  {
    id: 'trust_fund_baby',
    name: 'Trust Fund Baby',
    description: 'Born into wealth with $1,000,000, but with expensive tastes. Can you grow your fortune or will you squander it?',
    difficulty: 'medium',
    
    startingStats: {
      health: 100,
      happiness: 80,
      energy: 100,
      fitness: 30,
      money: 1000000,
      reputation: 30,
      gems: 0,
    },
    startingAge: 21,
    startingMoney: 1000000,
    startingReputation: 30,
    startingEducation: ['business_degree'],
    
    primaryGoal: {
      id: 'double_fortune',
      description: 'Double your starting fortune to $2,000,000',
      target: 2000000,
      type: 'money',
    },
    secondaryGoals: [
      {
        id: 'build_reputation',
        description: 'Reach 75 reputation',
        target: 75,
        type: 'reputation',
      },
    ],
    
    modifiers: [
      { type: 'expense_multiplier', value: 1.5 }, // 50% higher expenses (expensive tastes)
    ],
    
    rewards: {
      gems: 750, // Awarded only on first prestige
      achievementId: 'trust_fund_complete',
    },
    
    icon: require('@/assets/images/Scenarios/Trust Fund Baby_final.png'),
    color: '#FFD700',
    gradient: ['#FFD700', '#FFA500'],
  },
  
  {
    id: 'immigrant_story',
    name: 'Immigrant Story',
    description: 'Arrive in a new country with only $500 and no connections. Build a new life from scratch.',
    difficulty: 'hard',
    
    startingStats: {
      health: 90,
      happiness: 50,
      energy: 80,
      fitness: 40,
      money: 500,
      reputation: 0,
      gems: 0,
    },
    startingAge: 25,
    startingMoney: 500,
    startingReputation: 0,
    
    primaryGoal: {
      id: 'establish_life',
      description: 'Reach $100,000 and 50 reputation',
      target: 100000,
      type: 'money',
    },
    secondaryGoals: [
      {
        id: 'make_friends',
        description: 'Build 5 relationships',
        target: 5,
        type: 'reputation', // Using reputation as proxy
      },
    ],
    
    modifiers: [
      { type: 'relationship_decay', value: 1.5 }, // Harder to maintain relationships
    ],
    
    rewards: {
      gems: 1000, // Awarded only on first prestige
      achievementId: 'immigrant_story_complete',
    },
    
    icon: require('@/assets/images/Scenarios/Immigrant Story_final.png'),
    color: '#0EA5E9',
    gradient: ['#0EA5E9', '#0284C7'],
  },
  
  {
    id: 'single_parent',
    name: 'Single Parent',
    description: 'Raise 2 children alone while balancing work and family life. Start with $5,000 and big responsibilities.',
    difficulty: 'hard',
    
    startingStats: {
      health: 85,
      happiness: 60,
      energy: 60, // Tired from parenting
      fitness: 25,
      money: 5000,
      reputation: 15,
      gems: 0,
    },
    startingAge: 30,
    startingMoney: 5000,
    startingReputation: 15,
    hasChildren: 2,
    startingRelationships: [
      { type: 'child', count: 2 },
    ],
    
    primaryGoal: {
      id: 'provide_for_family',
      description: 'Accumulate $250,000 while maintaining 70+ happiness',
      target: 250000,
      type: 'money',
    },
    secondaryGoals: [
      {
        id: 'stay_happy',
        description: 'Keep happiness above 70',
        target: 70,
        type: 'happiness',
      },
    ],
    
    modifiers: [
      { type: 'expense_multiplier', value: 1.3 }, // 30% higher expenses (kids)
      { type: 'event_frequency', value: 1.2 }, // More random events (family chaos)
    ],
    
    rewards: {
      gems: 1000, // Awarded only on first prestige
      achievementId: 'single_parent_complete',
    },
    
    icon: require('@/assets/images/Scenarios/Single Parent_final.png'),
    color: '#EC4899',
    gradient: ['#EC4899', '#DB2777'],
  },
  
  {
    id: 'second_chance',
    name: 'Second Chance',
    description: 'At 40, fresh out of prison with a tarnished reputation. Rebuild your life and prove everyone wrong.',
    difficulty: 'extreme',
    
    startingStats: {
      health: 70,
      happiness: 25,
      energy: 60,
      fitness: 50, // Worked out in prison
      money: 200, // Gate money
      reputation: -20,
      gems: 0,
    },
    startingAge: 40,
    startingMoney: 200,
    startingReputation: -20,
    hasCriminalRecord: true,
    
    primaryGoal: {
      id: 'redemption',
      description: 'Reach 50 reputation and $500,000',
      target: 500000,
      type: 'money',
    },
    secondaryGoals: [
      {
        id: 'clear_name',
        description: 'Reach positive reputation (above 0)',
        target: 1,
        type: 'reputation',
      },
    ],
    
    modifiers: [
      { type: 'income_multiplier', value: 0.7 }, // 30% less income (discrimination)
      { type: 'relationship_decay', value: 1.3 }, // Trust issues
    ],
    
    rewards: {
      gems: 1500, // Awarded only on first prestige
      achievementId: 'second_chance_complete',
      unlocks: ['redemption_trait'],
    },
    
    icon: require('@/assets/images/Scenarios/Second Chance_final.png'),
    color: '#6B7280',
    gradient: ['#6B7280', '#4B5563'],
  },
];

/**
 * Get a scenario by ID
 */
export function getScenario(id: string): Scenario | undefined {
  return SCENARIOS.find(s => s.id === id);
}

/**
 * Get scenarios by difficulty
 */
export function getScenariosByDifficulty(difficulty: ScenarioDifficulty): Scenario[] {
  return SCENARIOS.filter(s => s.difficulty === difficulty);
}

/**
 * Check if a scenario goal is completed
 */
export function isGoalCompleted(goal: ScenarioGoal, state: GameState): boolean {
  switch (goal.type) {
    case 'money':
      return state.stats.money >= goal.target;
    case 'reputation':
      return state.stats.reputation >= goal.target;
    case 'happiness':
      return state.stats.happiness >= goal.target;
    case 'properties':
      return (state.realEstate?.length || 0) >= goal.target;
    case 'followers':
      return (state.socialMedia?.followers || 0) >= goal.target;
    case 'company_value':
      // Calculate total company value based on weekly income (estimate: 52 weeks * weekly income)
      const companyValue = (state.companies || []).reduce((sum, c) => {
        const estimatedValue = c.weeklyIncome * 52; // Rough estimate: 1 year of income
        return sum + estimatedValue;
      }, 0);
      return companyValue >= goal.target;
    default:
      return false;
  }
}

/**
 * Check if all scenario goals are completed
 */
export function isScenarioCompleted(scenarioId: string, state: GameState): boolean {
  const scenario = getScenario(scenarioId);
  if (!scenario) return false;

  // Check primary goal
  if (!isGoalCompleted(scenario.primaryGoal, state)) return false;

  // Check secondary goals if any
  if (scenario.secondaryGoals) {
    for (const goal of scenario.secondaryGoals) {
      if (!isGoalCompleted(goal, state)) return false;
    }
  }

  return true;
}

/**
 * Get scenario progress percentage
 */
export function getScenarioProgress(scenarioId: string, state: GameState): number {
  const scenario = getScenario(scenarioId);
  if (!scenario) return 0;

  const goals = [scenario.primaryGoal, ...(scenario.secondaryGoals || [])];
  const totalGoals = goals.length;
  let completedGoals = 0;

  for (const goal of goals) {
    if (isGoalCompleted(goal, state)) {
      completedGoals++;
    }
  }

  return Math.round((completedGoals / totalGoals) * 100);
}

/**
 * Get difficulty color
 */
export function getDifficultyColor(difficulty: ScenarioDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return '#22C55E';
    case 'medium':
      return '#F59E0B';
    case 'hard':
      return '#EF4444';
    case 'extreme':
      return '#7C3AED';
  }
}

/**
 * Get difficulty label
 */
export function getDifficultyLabel(difficulty: ScenarioDifficulty): string {
  switch (difficulty) {
    case 'easy':
      return 'Easy';
    case 'medium':
      return 'Medium';
    case 'hard':
      return 'Hard';
    case 'extreme':
      return 'Extreme';
  }
}

