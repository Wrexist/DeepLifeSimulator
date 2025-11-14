import { DollarSign, Gem, Heart, Zap, Shield } from 'lucide-react-native';

export interface GoalReward {
  type: 'money' | 'gems' | 'happiness' | 'energy' | 'health';
  amount: number;
  icon: React.ComponentType<any>;
  color: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  type: 'money' | 'happiness' | 'career' | 'gems' | 'general';
  target: number;
  current: number;
  progress: number;
  reward: GoalReward;
  completed: boolean;
}

export interface GameState {
  stats: {
    money: number;
    gems: number;
    happiness: number;
    energy: number;
    health: number;
  };
  week: number;
  currentJob: any;
  bankSavings: number;
  completedGoals: string[];
}

export const GOAL_DEFINITIONS = [
  {
    id: 'earn_100',
    title: 'Earn Your First $200',
    description: 'Get a job or do street work to earn money',
    type: 'money' as const,
    target: 200, // Doubled from 100 to 200
    reward: {
      type: 'money' as const,
      amount: 100, // Doubled from 50 to 100
      icon: DollarSign,
      color: '#10B981'
    }
  },
  {
    id: 'improve_happiness',
    title: 'Improve Your Happiness',
    description: 'Do activities that make you happy',
    type: 'happiness' as const,
    target: 80,
    reward: {
      type: 'happiness' as const,
      amount: 10,
      icon: Heart,
      color: '#EC4899'
    }
  },
  {
    id: 'get_job',
    title: 'Get a Job',
    description: 'Find employment to earn steady income',
    type: 'career' as const,
    target: 1,
    reward: {
      type: 'money' as const,
      amount: 100,
      icon: DollarSign,
      color: '#10B981'
    }
  },
  {
    id: 'save_1000',
    title: 'Save $2,000',
    description: 'Build your savings for future investments',
    type: 'money' as const,
    target: 2000, // Doubled from 1000 to 2000
    reward: {
      type: 'gems' as const,
      amount: 10, // Doubled from 5 to 10
      icon: Gem,
      color: '#8B5CF6'
    }
  },
  {
    id: 'build_wealth',
    title: 'Build Wealth',
    description: 'Accumulate $20,000 for major investments',
    type: 'money' as const,
    target: 20000, // Doubled from 10000 to 20000
    reward: {
      type: 'gems' as const,
      amount: 30, // Doubled from 15 to 30
      icon: Gem,
      color: '#8B5CF6'
    }
  },
  {
    id: 'collect_gems',
    title: 'Collect 200 Gems',
    description: 'Complete achievements to earn gems',
    type: 'gems' as const,
    target: 200, // Doubled from 100 to 200
    reward: {
      type: 'money' as const,
      amount: 1000, // Doubled from 500 to 1000
      icon: DollarSign,
      color: '#10B981'
    }
  }
];

export function getNextGoal(gameState: GameState): Goal | null {
  const { stats, week, currentJob, bankSavings, completedGoals = [] } = gameState;
  
  const availableGoals = GOAL_DEFINITIONS.filter(goal => !completedGoals.includes(goal.id));
  
  const priorityOrder = [
    'earn_100',
    'improve_happiness', 
    'get_job',
    'save_1000',
    'build_wealth',
    'collect_gems'
  ];
  
  for (const goalId of priorityOrder) {
    const goalDef = availableGoals.find(g => g.id === goalId);
    if (!goalDef) continue;
    
    let current = 0;
    let shouldShow = false;
    
    switch (goalDef.id) {
      case 'earn_100':
        current = stats.money;
        shouldShow = week <= 2 && stats.money < 200; // Updated to match new target
        break;
      case 'improve_happiness':
        current = stats.happiness;
        shouldShow = week <= 2 && stats.happiness < 80;
        break;
      case 'get_job':
        current = currentJob ? 1 : 0;
        shouldShow = week <= 10 && !currentJob;
        break;
      case 'save_1000':
        current = Math.max(stats.money, bankSavings);
        shouldShow = week <= 10 && current < 2000; // Updated to match new target
        break;
      case 'build_wealth':
        current = Math.max(stats.money, bankSavings);
        shouldShow = current < 20000; // Updated to match new target
        break;
      case 'collect_gems':
        current = stats.gems;
        shouldShow = stats.gems < 200; // Updated to match new target
        break;
    }
    
    if (shouldShow) {
      const progress = Math.min(100, (current / goalDef.target) * 100);
      return {
        ...goalDef,
        current,
        progress,
        completed: progress >= 100
      };
    }
  }
  
  return null;
}

export function checkGoalCompletion(gameState: GameState): { completedGoal: Goal | null; nextGoal: Goal | null } {
  const currentGoal = getNextGoal(gameState);
  
  if (!currentGoal || !currentGoal.completed) {
    return { completedGoal: null, nextGoal: currentGoal };
  }
  
  const completedGoal = currentGoal;
  
  const nextGameState = {
    ...gameState,
    completedGoals: [...(gameState.completedGoals || []), completedGoal.id]
  };
  const nextGoal = getNextGoal(nextGameState);
  
  return { completedGoal, nextGoal };
}