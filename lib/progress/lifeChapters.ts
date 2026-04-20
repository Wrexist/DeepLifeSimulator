/**
 * Life Chapters — Themed goal groups that unlock based on weeksLived.
 *
 * Replaces the linear goal system with parallel, chunked objectives
 * that give players clear direction and a sense of narrative progression.
 *
 * Psychology: Chunking goals into "chapters" makes grinding feel like
 * leveling up instead of chasing a distant number.
 */

import type { GameState } from '@/contexts/game/types';

export interface ChapterGoal {
  id: string;
  title: string;
  description: string;
  checkComplete: (state: GameState) => boolean;
  checkProgress: (state: GameState) => number; // 0-1
}

export interface LifeChapter {
  id: string;
  title: string;
  subtitle: string;
  weekRange: [number, number]; // [minWeeksLived, maxWeeksLived]
  goals: ChapterGoal[];
  completionReward: { money: number; gems: number };
  perGoalReward: { money: number; gems: number };
}

export const LIFE_CHAPTERS: LifeChapter[] = [
  {
    id: 'ch1_fresh_start',
    title: 'Chapter 1',
    subtitle: 'Fresh Start',
    weekRange: [0, 12],
    goals: [
      {
        id: 'ch1_earn_500',
        title: 'Earn $500',
        description: 'Accumulate $500 total',
        checkComplete: (s) => (s.stats?.money || 0) + (s.bankSavings || 0) >= 500,
        checkProgress: (s) => Math.min(1, ((s.stats?.money || 0) + (s.bankSavings || 0)) / 500),
      },
      {
        id: 'ch1_get_job',
        title: 'Get Hired',
        description: 'Get accepted into a career',
        checkComplete: (s) => !!s.currentJob,
        checkProgress: (s) => s.currentJob ? 1 : (s.careers?.some((c: any) => c.applied) ? 0.5 : 0),
      },
      {
        id: 'ch1_survive',
        title: 'Survive 4 Weeks',
        description: 'Live for 4 weeks',
        checkComplete: (s) => (s.weeksLived || 0) >= 4,
        checkProgress: (s) => Math.min(1, (s.weeksLived || 0) / 4),
      },
    ],
    completionReward: { money: 500, gems: 20 },
    perGoalReward: { money: 100, gems: 5 },
  },
  {
    id: 'ch2_settling_in',
    title: 'Chapter 2',
    subtitle: 'Settling In',
    weekRange: [5, 25],
    goals: [
      {
        id: 'ch2_promotion',
        title: 'Get Promoted',
        description: 'Reach career level 2',
        checkComplete: (s) => {
          const career = s.careers?.find((c: any) => c.id === s.currentJob);
          return (career?.level || 0) >= 1;
        },
        checkProgress: (s) => {
          const career = s.careers?.find((c: any) => c.id === s.currentJob);
          if (!career) return 0;
          return career.level >= 1 ? 1 : (career.progress || 0) / 100;
        },
      },
      {
        id: 'ch2_save_2k',
        title: 'Save $2,000',
        description: 'Have $2,000 in cash or savings',
        checkComplete: (s) => (s.stats?.money || 0) + (s.bankSavings || 0) >= 2000,
        checkProgress: (s) => Math.min(1, ((s.stats?.money || 0) + (s.bankSavings || 0)) / 2000),
      },
      {
        id: 'ch2_buy_phone',
        title: 'Buy a Smartphone',
        description: 'Purchase a smartphone from the market',
        checkComplete: (s) => !!s.hasPhone,
        checkProgress: (s) => s.hasPhone ? 1 : 0,
      },
      {
        id: 'ch2_make_friend',
        title: 'Make a Friend',
        description: 'Start a relationship with someone',
        checkComplete: (s) => (s.relationships?.length || 0) > 0,
        checkProgress: (s) => (s.relationships?.length || 0) > 0 ? 1 : 0,
      },
    ],
    completionReward: { money: 2000, gems: 50 },
    perGoalReward: { money: 200, gems: 10 },
  },
  {
    id: 'ch3_on_the_rise',
    title: 'Chapter 3',
    subtitle: 'On the Rise',
    weekRange: [15, 50],
    goals: [
      {
        id: 'ch3_save_10k',
        title: 'Save $10,000',
        description: 'Accumulate $10,000 in wealth',
        checkComplete: (s) => (s.stats?.money || 0) + (s.bankSavings || 0) >= 10000,
        checkProgress: (s) => Math.min(1, ((s.stats?.money || 0) + (s.bankSavings || 0)) / 10000),
      },
      {
        id: 'ch3_partner',
        title: 'Find a Partner',
        description: 'Start a romantic relationship',
        checkComplete: (s) => !!s.family?.spouse || s.relationships?.some((r: any) => r.type === 'romantic'),
        checkProgress: (s) => (s.family?.spouse || s.relationships?.some((r: any) => r.type === 'romantic')) ? 1 : 0,
      },
      {
        id: 'ch3_invest',
        title: 'First Investment',
        description: 'Buy your first stock or property',
        checkComplete: (s) => (s.stocks?.holdings?.length || 0) > 0 || s.realEstate?.some((p: any) => p.owned),
        checkProgress: (s) => ((s.stocks?.holdings?.length || 0) > 0 || s.realEstate?.some((p: any) => p.owned)) ? 1 : 0,
      },
      {
        id: 'ch3_career_3',
        title: 'Career Level 3',
        description: 'Reach career level 3',
        checkComplete: (s) => {
          const career = s.careers?.find((c: any) => c.id === s.currentJob);
          return (career?.level || 0) >= 2;
        },
        checkProgress: (s) => {
          const career = s.careers?.find((c: any) => c.id === s.currentJob);
          if (!career) return 0;
          if (career.level >= 2) return 1;
          return Math.min(1, (career.level + (career.progress || 0) / 100) / 2);
        },
      },
    ],
    completionReward: { money: 5000, gems: 75 },
    perGoalReward: { money: 500, gems: 15 },
  },
  {
    id: 'ch4_building_empire',
    title: 'Chapter 4',
    subtitle: 'Building an Empire',
    weekRange: [30, 100],
    goals: [
      {
        id: 'ch4_net_50k',
        title: 'Net Worth $50K',
        description: 'Reach $50,000 net worth',
        checkComplete: (s) => (s.stats?.money || 0) + (s.bankSavings || 0) >= 50000,
        checkProgress: (s) => Math.min(1, ((s.stats?.money || 0) + (s.bankSavings || 0)) / 50000),
      },
      {
        id: 'ch4_business',
        title: 'Start a Business',
        description: 'Own a company',
        checkComplete: (s) => (s.companies?.length || 0) > 0,
        checkProgress: (s) => (s.companies?.length || 0) > 0 ? 1 : 0,
      },
      {
        id: 'ch4_education',
        title: 'Get Educated',
        description: 'Complete an education program',
        checkComplete: (s) => s.educations?.some((e: any) => e.completed),
        checkProgress: (s) => {
          const active = s.educations?.find((e: any) => !e.completed && !e.paused);
          if (s.educations?.some((e: any) => e.completed)) return 1;
          if (!active) return 0;
          return 1 - (active.weeksRemaining || active.duration || 1) / (active.duration || 1);
        },
      },
      {
        id: 'ch4_career_5',
        title: 'Career Level 5',
        description: 'Reach career level 5',
        checkComplete: (s) => {
          const career = s.careers?.find((c: any) => c.id === s.currentJob);
          return (career?.level || 0) >= 4;
        },
        checkProgress: (s) => {
          const career = s.careers?.find((c: any) => c.id === s.currentJob);
          if (!career) return 0;
          if (career.level >= 4) return 1;
          return Math.min(1, (career.level + (career.progress || 0) / 100) / 4);
        },
      },
    ],
    completionReward: { money: 10000, gems: 100 },
    perGoalReward: { money: 1000, gems: 20 },
  },
  {
    id: 'ch5_legacy',
    title: 'Chapter 5',
    subtitle: 'Legacy',
    weekRange: [60, 999],
    goals: [
      {
        id: 'ch5_net_200k',
        title: 'Net Worth $200K',
        description: 'Reach $200,000 net worth',
        checkComplete: (s) => (s.stats?.money || 0) + (s.bankSavings || 0) >= 200000,
        checkProgress: (s) => Math.min(1, ((s.stats?.money || 0) + (s.bankSavings || 0)) / 200000),
      },
      {
        id: 'ch5_max_stat',
        title: 'Perfect Stat',
        description: 'Reach 100 in any stat',
        checkComplete: (s) => (s.stats?.health || 0) >= 100 || (s.stats?.happiness || 0) >= 100 || (s.stats?.fitness || 0) >= 100,
        checkProgress: (s) => Math.min(1, Math.max(s.stats?.health || 0, s.stats?.happiness || 0, s.stats?.fitness || 0) / 100),
      },
      {
        id: 'ch5_family',
        title: 'Start a Family',
        description: 'Have a child',
        checkComplete: (s) => (s.family?.children?.length || 0) > 0,
        checkProgress: (s) => (s.family?.children?.length || 0) > 0 ? 1 : (s.family?.spouse ? 0.5 : 0),
      },
      {
        id: 'ch5_prestige_ready',
        title: 'Prestige Ready',
        description: 'Reach prestige eligibility',
        checkComplete: (s) => !!s.prestigeAvailable,
        checkProgress: (s) => s.prestigeAvailable ? 1 : Math.min(0.9, ((s.stats?.money || 0) + (s.bankSavings || 0)) / 100_000_000),
      },
    ],
    completionReward: { money: 25000, gems: 200 },
    perGoalReward: { money: 2500, gems: 30 },
  },
];

/** Get the currently active chapter for a game state */
export function getActiveChapter(state: GameState): LifeChapter | undefined {
  const weeksLived = state.weeksLived || 0;
  const completedChapters = state.completedChapters || [];

  // Find the first incomplete chapter whose week range includes current time
  for (const chapter of LIFE_CHAPTERS) {
    if (completedChapters.includes(chapter.id)) continue;
    if (weeksLived >= chapter.weekRange[0]) {
      return chapter;
    }
  }
  return undefined;
}

/** Get progress for a chapter (number of completed goals out of total) */
export function getChapterProgress(chapter: LifeChapter, state: GameState): {
  completedGoals: number;
  totalGoals: number;
  isComplete: boolean;
  goals: { id: string; title: string; complete: boolean; progress: number }[];
} {
  const goals = chapter.goals.map(g => ({
    id: g.id,
    title: g.title,
    complete: g.checkComplete(state),
    progress: g.checkProgress(state),
  }));
  const completedGoals = goals.filter(g => g.complete).length;
  return {
    completedGoals,
    totalGoals: chapter.goals.length,
    isComplete: completedGoals >= chapter.goals.length,
    goals,
  };
}
