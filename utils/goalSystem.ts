import { DollarSign, Gem, Heart } from 'lucide-react-native';
import { resolveAbsoluteWeek } from '@/utils/weekCounters';

export interface GoalReward {
  type: 'money' | 'gems' | 'happiness' | 'energy' | 'health';
  amount: number;
  icon: React.ComponentType<any>;
  color: string;
}

export type GoalCategory = 'career' | 'health' | 'finance' | 'social' | 'education' | 'hobby';
export type GoalPriority = 'critical' | 'high' | 'medium' | 'low';
export type GoalStatus = 'active' | 'completed' | 'paused' | 'cancelled';

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
  status?: GoalStatus;
  category?: GoalCategory;
  priority?: GoalPriority;
  deadline?: number;
}

export interface GoalTemplate {
  id: string;
  title: string;
  description: string;
  category: GoalCategory;
  difficulty: GoalPriority;
  target: number;
  reward: GoalReward;
}

export const GOAL_CATEGORIES: Record<GoalCategory, { name: string; icon: string; color: string }> = {
  career: { name: 'Career', icon: '💼', color: '#3B82F6' },
  health: { name: 'Health', icon: '💪', color: '#10B981' },
  finance: { name: 'Finance', icon: '💰', color: '#F59E0B' },
  social: { name: 'Social', icon: '👥', color: '#EC4899' },
  education: { name: 'Education', icon: '📚', color: '#8B5CF6' },
  hobby: { name: 'Hobby', icon: '🎨', color: '#EF4444' },
};

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: 'get_first_job',
    title: 'Land Your First Job',
    description: 'Apply and get hired at any job',
    category: 'career',
    difficulty: 'low',
    target: 1,
    reward: { type: 'money', amount: 500, icon: DollarSign, color: '#10B981' },
  },
  {
    id: 'save_10k',
    title: 'Save $10,000',
    description: 'Accumulate $10,000 in your bank account',
    category: 'finance',
    difficulty: 'medium',
    target: 10000,
    reward: { type: 'gems', amount: 5, icon: Gem, color: '#8B5CF6' },
  },
  {
    id: 'save_100k',
    title: 'Six-Figure Savings',
    description: 'Save up $100,000',
    category: 'finance',
    difficulty: 'high',
    target: 100000,
    reward: { type: 'gems', amount: 20, icon: Gem, color: '#8B5CF6' },
  },
  {
    id: 'millionaire',
    title: 'Millionaire',
    description: 'Reach a net worth of $1,000,000',
    category: 'finance',
    difficulty: 'critical',
    target: 1000000,
    reward: { type: 'gems', amount: 50, icon: Gem, color: '#F59E0B' },
  },
  {
    id: 'get_married',
    title: 'Tie the Knot',
    description: 'Find a partner and get married',
    category: 'social',
    difficulty: 'medium',
    target: 1,
    reward: { type: 'happiness', amount: 20, icon: Heart, color: '#EC4899' },
  },
  {
    id: 'have_child',
    title: 'Start a Family',
    description: 'Have your first child',
    category: 'social',
    difficulty: 'medium',
    target: 1,
    reward: { type: 'happiness', amount: 25, icon: Heart, color: '#EC4899' },
  },
  {
    id: 'buy_house',
    title: 'Homeowner',
    description: 'Purchase your first property',
    category: 'finance',
    difficulty: 'high',
    target: 1,
    reward: { type: 'happiness', amount: 15, icon: Heart, color: '#3B82F6' },
  },
  {
    id: 'start_business',
    title: 'Entrepreneur',
    description: 'Start your own company',
    category: 'career',
    difficulty: 'high',
    target: 1,
    reward: { type: 'gems', amount: 15, icon: Gem, color: '#F59E0B' },
  },
  {
    id: 'max_health',
    title: 'Peak Fitness',
    description: 'Reach 100 health',
    category: 'health',
    difficulty: 'medium',
    target: 100,
    reward: { type: 'energy', amount: 30, icon: Heart, color: '#10B981' },
  },
  {
    id: 'get_promoted',
    title: 'Climb the Ladder',
    description: 'Get promoted at your job',
    category: 'career',
    difficulty: 'medium',
    target: 1,
    reward: { type: 'money', amount: 2000, icon: DollarSign, color: '#3B82F6' },
  },
  // Education goals
  {
    id: 'complete_education',
    title: 'Graduate',
    description: 'Complete any education program',
    category: 'education',
    difficulty: 'medium',
    target: 1,
    reward: { type: 'happiness', amount: 15, icon: Heart, color: '#8B5CF6' },
  },
  {
    id: 'complete_3_educations',
    title: 'Lifelong Learner',
    description: 'Complete 3 different education programs',
    category: 'education',
    difficulty: 'high',
    target: 3,
    reward: { type: 'gems', amount: 25, icon: Gem, color: '#8B5CF6' },
  },
  // Hobby goals
  {
    id: 'start_hobby',
    title: 'Find a Passion',
    description: 'Start practicing any hobby',
    category: 'hobby',
    difficulty: 'low',
    target: 1,
    reward: { type: 'happiness', amount: 10, icon: Heart, color: '#EF4444' },
  },
  {
    id: 'master_hobby',
    title: 'Master of Craft',
    description: 'Reach level 10 in any hobby',
    category: 'hobby',
    difficulty: 'high',
    target: 10,
    reward: { type: 'gems', amount: 20, icon: Gem, color: '#EF4444' },
  },
  // More health goals
  {
    id: 'survive_sickness',
    title: 'Road to Recovery',
    description: 'Recover from a serious illness',
    category: 'health',
    difficulty: 'medium',
    target: 1,
    reward: { type: 'happiness', amount: 20, icon: Heart, color: '#10B981' },
  },
  // More social goals
  {
    id: 'travel_5_countries',
    title: 'World Traveler',
    description: 'Visit 5 different countries',
    category: 'social',
    difficulty: 'high',
    target: 5,
    reward: { type: 'gems', amount: 15, icon: Gem, color: '#EC4899' },
  },
  {
    id: 'have_3_children',
    title: 'Big Family',
    description: 'Have 3 children',
    category: 'social',
    difficulty: 'high',
    target: 3,
    reward: { type: 'happiness', amount: 30, icon: Heart, color: '#EC4899' },
  },
  // More finance goals
  {
    id: 'invest_stocks',
    title: 'Wall Street Player',
    description: 'Own 5 different stocks',
    category: 'finance',
    difficulty: 'medium',
    target: 5,
    reward: { type: 'money', amount: 5000, icon: DollarSign, color: '#F59E0B' },
  },
  {
    id: 'billionaire',
    title: 'Billionaire',
    description: 'Reach a net worth of $1,000,000,000',
    category: 'finance',
    difficulty: 'critical',
    target: 1000000000,
    reward: { type: 'gems', amount: 100, icon: Gem, color: '#F59E0B' },
  },
  // More career goals
  {
    id: 'start_second_career',
    title: 'Career Switcher',
    description: 'Work in 2 different career fields',
    category: 'career',
    difficulty: 'medium',
    target: 2,
    reward: { type: 'money', amount: 3000, icon: DollarSign, color: '#3B82F6' },
  },
];

export function createGoalFromTemplate(template: GoalTemplate, customizations?: Partial<Goal>): Goal {
  return {
    id: `${template.id}_${Date.now()}`,
    title: template.title,
    description: template.description,
    type: 'general',
    target: template.target,
    current: 0,
    progress: 0,
    reward: template.reward,
    completed: false,
    status: 'active',
    category: template.category,
    priority: template.difficulty,
    ...customizations,
  };
}

export function calculateGoalProgress(goal: Goal): number {
  return goal.progress ?? Math.min(100, (goal.current / goal.target) * 100);
}

export function getGoalStatus(goal: Goal): GoalStatus {
  return goal.status ?? (goal.completed ? 'completed' : 'active');
}

export function getGoalPriorityColor(priority: GoalPriority): string {
  const colors: Record<GoalPriority, string> = {
    critical: '#EF4444',
    high: '#F59E0B',
    medium: '#3B82F6',
    low: '#6B7280',
  };
  return colors[priority] ?? colors.medium;
}

export function getGoalStatusColor(status: GoalStatus): string {
  const colors: Record<GoalStatus, string> = {
    active: '#10B981',
    completed: '#3B82F6',
    paused: '#F59E0B',
    cancelled: '#6B7280',
  };
  return colors[status] ?? colors.active;
}

export function formatGoalProgress(goal: Goal): string {
  return `${goal.current}/${goal.target}`;
}

export function getGoalTimeRemaining(goal: Goal): string {
  if (!goal.deadline) return 'No deadline';
  const now = Date.now();
  const remaining = goal.deadline - now;
  if (remaining <= 0) return 'Overdue';
  const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
  return `${days} days remaining`;
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
  weeksLived?: number;
  currentJob?: any;
  bankSavings?: number;
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
  const { stats, currentJob, bankSavings = 0, completedGoals = [] } = gameState;
  const absoluteWeek = resolveAbsoluteWeek(gameState.weeksLived, gameState.week);
  
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
        shouldShow = absoluteWeek <= 2 && stats.money < 200; // Updated to match new target
        break;
      case 'improve_happiness':
        current = stats.happiness;
        shouldShow = absoluteWeek <= 2 && stats.happiness < 80;
        break;
      case 'get_job':
        current = currentJob ? 1 : 0;
        shouldShow = absoluteWeek <= 10 && !currentJob;
        break;
      case 'save_1000':
        current = Math.max(stats.money, bankSavings);
        shouldShow = absoluteWeek <= 10 && current < 2000; // Updated to match new target
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

export function isGoalOverdue(_goal: Goal): boolean {
  // Goals don't have deadlines in this system, so they're never overdue
  return false;
}
