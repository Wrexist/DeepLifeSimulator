import { GameState } from '@/contexts/GameContext';

export interface DailyChallenge {
  id: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  reward: number;
  checkProgress: (gameState: GameState, initialState: GameState) => number;
  maxProgress: number;
}

// Easy Challenges (10 gems)
const easyChallenges: DailyChallenge[] = [
  {
    id: 'earn_500',
    name: 'Quick Cash',
    description: 'Earn $500 today',
    difficulty: 'easy',
    reward: 10,
    checkProgress: (state, initial) => {
      const earned = state.stats.money - initial.stats.money;
      return Math.min(earned, 500);
    },
    maxProgress: 500,
  },
  {
    id: 'increase_stat_10',
    name: 'Self Improvement',
    description: 'Increase any stat by 10 points',
    difficulty: 'easy',
    reward: 10,
    checkProgress: (state, initial) => {
      const healthGain = Math.max(0, state.stats.health - initial.stats.health);
      const happinessGain = Math.max(0, state.stats.happiness - initial.stats.happiness);
      const fitnessGain = Math.max(0, state.stats.fitness - initial.stats.fitness);
      const maxGain = Math.max(healthGain, happinessGain, fitnessGain);
      return Math.min(maxGain, 10);
    },
    maxProgress: 10,
  },
  {
    id: 'complete_1_job',
    name: 'Quick Gig',
    description: 'Complete 1 underground job',
    difficulty: 'easy',
    reward: 10,
    checkProgress: (state, initial) => {
      const completed = state.streetJobsCompleted - initial.streetJobsCompleted;
      return Math.min(completed, 1);
    },
    maxProgress: 1,
  },
  {
    id: 'work_career',
    name: 'Clock In',
    description: 'Work your career job (advance 1 week)',
    difficulty: 'easy',
    reward: 10,
    checkProgress: (state, initial) => {
      const weeksAdvanced = state.week - initial.week;
      return Math.min(weeksAdvanced, 1);
    },
    maxProgress: 1,
  },
  {
    id: 'buy_item',
    name: 'Shopaholic',
    description: 'Buy any item',
    difficulty: 'easy',
    reward: 10,
    checkProgress: (state, initial) => {
      const initialOwned = initial.items.filter(i => i.owned).length;
      const currentOwned = state.items.filter(i => i.owned).length;
      return currentOwned > initialOwned ? 1 : 0;
    },
    maxProgress: 1,
  },
];

// Medium Challenges (25 gems)
const mediumChallenges: DailyChallenge[] = [
  {
    id: 'earn_2000',
    name: 'Money Maker',
    description: 'Earn $2,000 today',
    difficulty: 'medium',
    reward: 25,
    checkProgress: (state, initial) => {
      const earned = state.stats.money - initial.stats.money;
      return Math.min(earned, 2000);
    },
    maxProgress: 2000,
  },
  {
    id: 'reach_80_stat',
    name: 'Peak Performance',
    description: 'Reach 80+ in any stat',
    difficulty: 'medium',
    reward: 25,
    checkProgress: (state) => {
      const maxStat = Math.max(
        state.stats.health,
        state.stats.happiness,
        state.stats.fitness
      );
      return maxStat >= 80 ? 1 : 0;
    },
    maxProgress: 1,
  },
  {
    id: 'complete_3_jobs',
    name: 'Busy Day',
    description: 'Complete 3 underground jobs',
    difficulty: 'medium',
    reward: 25,
    checkProgress: (state, initial) => {
      const completed = state.streetJobsCompleted - initial.streetJobsCompleted;
      return Math.min(completed, 3);
    },
    maxProgress: 3,
  },
  {
    id: 'level_skill',
    name: 'Skill Up',
    description: 'Increase a crime skill to level 2+',
    difficulty: 'medium',
    reward: 25,
    checkProgress: (state) => {
      const hasLevel2Skill = Object.values(state.crimeSkills).some(skill => skill.level >= 2);
      return hasLevel2Skill ? 1 : 0;
    },
    maxProgress: 1,
  },
  {
    id: 'make_friend',
    name: 'Social Butterfly',
    description: 'Make a new friend or improve a relationship',
    difficulty: 'medium',
    reward: 25,
    checkProgress: (state, initial) => {
      const currentFriends = state.relationships.length;
      const initialFriends = initial.relationships.length;
      return currentFriends > initialFriends ? 1 : 0;
    },
    maxProgress: 1,
  },
  {
    id: 'exercise_3_times',
    name: 'Fitness Fanatic',
    description: 'Exercise 3 times',
    difficulty: 'medium',
    reward: 25,
    checkProgress: (state, initial) => {
      // Track fitness gains as proxy for exercises
      const fitnessGain = Math.max(0, state.stats.fitness - initial.stats.fitness);
      return Math.min(Math.floor(fitnessGain / 5), 3); // Assume ~5 fitness per exercise
    },
    maxProgress: 3,
  },
];

// Hard Challenges (50 gems)
const hardChallenges: DailyChallenge[] = [
  {
    id: 'earn_10000',
    name: 'Big Earner',
    description: 'Earn $10,000 today',
    difficulty: 'hard',
    reward: 50,
    checkProgress: (state, initial) => {
      const earned = state.stats.money - initial.stats.money;
      return Math.min(earned, 10000);
    },
    maxProgress: 10000,
  },
  {
    id: 'all_stats_70',
    name: 'Well-Rounded',
    description: 'Have all stats above 70',
    difficulty: 'hard',
    reward: 50,
    checkProgress: (state) => {
      const allAbove70 = state.stats.health >= 70 && 
                        state.stats.happiness >= 70 && 
                        state.stats.fitness >= 70;
      return allAbove70 ? 1 : 0;
    },
    maxProgress: 1,
  },
  {
    id: 'complete_5_jobs',
    name: 'Grinder',
    description: 'Complete 5 underground jobs',
    difficulty: 'hard',
    reward: 50,
    checkProgress: (state, initial) => {
      const completed = state.streetJobsCompleted - initial.streetJobsCompleted;
      return Math.min(completed, 5);
    },
    maxProgress: 5,
  },
  {
    id: 'career_level_up',
    name: 'Promotion',
    description: 'Level up in your career',
    difficulty: 'hard',
    reward: 50,
    checkProgress: (state, initial) => {
      const currentCareer = state.careers.find(c => c.id === state.currentJob);
      const initialCareer = initial.careers.find(c => c.id === initial.currentJob);
      if (!currentCareer || !initialCareer) return 0;
      return currentCareer.level > initialCareer.level ? 1 : 0;
    },
    maxProgress: 1,
  },
  {
    id: 'buy_property',
    name: 'Real Estate',
    description: 'Purchase a property',
    difficulty: 'hard',
    reward: 50,
    checkProgress: (state, initial) => {
      const currentOwned = state.realEstate.filter(p => p.owned).length;
      const initialOwned = initial.realEstate.filter(p => p.owned).length;
      return currentOwned > initialOwned ? 1 : 0;
    },
    maxProgress: 1,
  },
  {
    id: 'all_stats_80',
    name: 'Perfect Day',
    description: 'Reach 80+ in all stats',
    difficulty: 'hard',
    reward: 50,
    checkProgress: (state) => {
      const allAbove80 = state.stats.health >= 80 && 
                        state.stats.happiness >= 80 && 
                        state.stats.fitness >= 80;
      return allAbove80 ? 1 : 0;
    },
    maxProgress: 1,
  },
];

// Get random challenge from array
function getRandomChallenge(challenges: DailyChallenge[]): DailyChallenge {
  return challenges[Math.floor(Math.random() * challenges.length)];
}

// Generate daily challenges (seeded by date for consistency)
export function generateDailyChallenges(date: Date = new Date()): {
  easy: DailyChallenge;
  medium: DailyChallenge;
  hard: DailyChallenge;
} {
  // Use date as seed for consistent daily challenges
  const dateString = date.toDateString();
  const seed = dateString.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // Simple seeded random
  const seededRandom = (index: number) => {
    const x = Math.sin(seed + index) * 10000;
    return x - Math.floor(x);
  };
  
  const easyIndex = Math.floor(seededRandom(1) * easyChallenges.length);
  const mediumIndex = Math.floor(seededRandom(2) * mediumChallenges.length);
  const hardIndex = Math.floor(seededRandom(3) * hardChallenges.length);
  
  return {
    easy: easyChallenges[easyIndex],
    medium: mediumChallenges[mediumIndex],
    hard: hardChallenges[hardIndex],
  };
}

// Check if challenges should reset (new day)
export function shouldResetChallenges(lastRefresh: number): boolean {
  const lastDate = new Date(lastRefresh);
  const now = new Date();
  
  // Reset at midnight UTC
  return lastDate.toDateString() !== now.toDateString();
}

// Calculate time until next reset
export function getTimeUntilReset(): { hours: number; minutes: number; seconds: number } {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(24, 0, 0, 0);
  
  const diff = tomorrow.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  return { hours, minutes, seconds };
}


