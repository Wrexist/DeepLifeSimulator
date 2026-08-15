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
import { netWorth } from '@/lib/progress/achievements';
import { getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { outstandingDebt } from '@/lib/progress/wealthRatchet';
import { logger } from '@/utils/logger';

const num = (v: unknown): number =>
  typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;

/** One log line per session for a throwing `netWorth` — see `wealthMark`. */
let netWorthFailureLogged = false;

/**
 * The wealth figure the chapter goals and the unlock tiers both read.
 *
 * Every money goal here used to be `stats.money + bankSavings` — the CURRENT
 * liquid balance — under a title that promised something cumulative ("Earn
 * $500", "Net Worth $50K"). Two things went wrong with that:
 *
 *   1. It is not monotonic. `applyChapterProgress` completes a chapter only
 *      when EVERY goal is true in the same tick, so a player who spends as
 *      they earn can pass each goal in a different week and never complete the
 *      chapter. The same figure feeds `unlockTier`'s milestone fallback, where
 *      the consequence is worse: buying a $200k property drops the balance and
 *      PADLOCKS the Real Estate app that manages it, which is exactly the
 *      takeaway `featureUnlocks.ts` Rule 2 says can never happen.
 *   2. It ignores assets outright. A player holding $1M in stocks with an empty
 *      current account read as broke.
 *
 * The high-water mark fixes both. `lifetimeStatistics.peakNetWorth` is already
 * persisted and already `max(previous, thisWeek)` in `applyLifetimeStatistics`,
 * so this stays DERIVED, with no new field and no migration. Live net worth is
 * folded in so a purchase made this week counts before the next tick stamps the
 * peak, and the liquid balance is kept so a save whose statistics have not been
 * written yet still tiers up.
 *
 * All three terms are net of outstanding loans. They did not use to be: the
 * liquid one was a raw balance, and `LoanActions` credits the whole principal to
 * `stats.money`, so borrowing read as getting richer. It satisfied "Save $2,000"
 * outright and bought unlock tiers — and once the ratchet made the mark
 * permanent, it bought them for good.
 *
 * Note what the `max` does and does not give you. Only the `peak` term is
 * monotonic, so the result is monotonic only DOWN TO `peak` — while a live term
 * is the maximum, spending still lowers this figure. That was the whole of the
 * 2026-08-14 report: the tick stamped `peak` once a week from the balance at the
 * start of the tick, so money earned and spent in between was never marked, and
 * a player who bought a computer dropped a tier. `peak` is now also stamped on
 * every state write by `lib/progress/wealthRatchet.ts`, which is what makes the
 * floor track the balance instead of sampling it.
 *
 * Each term is sanitised independently: `Math.max` propagates NaN, and a single
 * corrupt field must not zero the whole signal.
 */
/**
 * Weeks lived in THIS life, not since age 18.
 *
 * `weeksLived` is absolute and seeded from the starting age
 * (`computeWeeksLived` = `(age - 18) * 52`), so an age-20 character begins at
 * 104 and an age-25 one at 364. Comparing it to a small number asks "is this
 * character over 18 by more than N weeks", which is true at birth for every
 * scenario except the age-18 ones — the goal below read complete on week 1.
 *
 * `lifeStartWeek` (v43) is stamped when the life is built. Absent on older
 * saves, where 0 keeps exactly the behaviour they already have.
 */
export function weeksInThisLife(state: GameState | undefined | null): number {
  const now = Number(state?.weeksLived);
  if (!Number.isFinite(now) || now < 0) return 0;
  const start = Number(state?.lifeStartWeek);
  if (!Number.isFinite(start) || start < 0) return now;
  return Math.max(0, now - start);
}

/** Money EARNED in this life. Starts at 0 every life; only increases. */
export function earnedThisLife(state: GameState | undefined | null): number {
  const earned = Number(state?.lifetimeStatistics?.totalMoneyEarned);
  return Number.isFinite(earned) && earned > 0 ? earned : 0;
}

export function wealthMark(state: GameState | undefined | null): number {
  if (!state) return 0;

  // Net of outstanding loans. `LoanActions` credits the full principal to
  // `stats.money`, so a raw balance counted borrowed cash as progress: a loan
  // satisfied "Save $2,000" and bought unlock tiers outright. The other two
  // terms were already debt-adjusted — `netWorth` subtracts the same
  // `remaining ?? principal` figure, and the ratchet now does too — so this was
  // the last place borrowed money read as wealth.
  const liquid = Math.max(0, num(state.stats?.money) + num(state.bankSavings) - outstandingDebt(state));
  const peak = num(state.lifetimeStatistics?.peakNetWorth);

  // `netWorth` walks holdings, property, luxury and debt. It is pure, but this
  // runs on the app-grid render path, where a throw would blank the grid rather
  // than degrade one number.
  //
  // Degrading is not the same as hiding. A throw here silently lowers chapter
  // progress and the unlock tier, which is indistinguishable from a player who
  // simply has less money — the exact class of bug this whole change exists to
  // fix — so it is logged. Once per session: the caller runs on every render of
  // the app grid, and a state that throws would throw every time.
  let live = 0;
  try {
    live = num(netWorth(state));
  } catch (err) {
    if (!netWorthFailureLogged) {
      netWorthFailureLogged = true;
      logger.error('[wealthMark] netWorth threw; treating live wealth as 0', err);
    }
    live = 0;
  }

  return Math.max(liquid, live, peak);
}

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
        description: 'Earn $500 of your own',
        // `totalMoneyEarned`, not net worth. Every scenario starts with cash —
        // Food Courier begins on $1,500 — so a wealth check was satisfied
        // before the player did anything, and the tutorial chapter opened at
        // 2 of 3 with a reward already banked. This counter starts at 0 for
        // every life and only ever increases, the same property that makes
        // Legacy Contracts safe to leave unstored (CLAUDE.md §7, v33).
        checkComplete: (s) => earnedThisLife(s) >= 500,
        checkProgress: (s) => Math.min(1, earnedThisLife(s) / 500),
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
        checkComplete: (s) => weeksInThisLife(s) >= 4,
        checkProgress: (s) => Math.min(1, weeksInThisLife(s) / 4),
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
        description: 'Have $2,000 more than you owe',
        checkComplete: (s) => wealthMark(s) >= 2000,
        checkProgress: (s) => Math.min(1, wealthMark(s) / 2000),
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
        /**
         * Counts EVERY relationship, including the Mom and Dad `initialState`
         * seeds — so this reads as complete on a brand-new life. That looks
         * like a bug, and the sibling ambition system tightened the equivalent
         * check for exactly that reason (`lib/ambitions/catalog.ts`: "Exclude
         * the starting parents ... so 'Make a Connection' doesn't auto-complete
         * at birth"). Do not copy it here.
         *
         * The permissive count is LOAD-BEARING. A chosen relationship comes
         * from Spark (tier 2) or a network-favour introduction, and
         * `FAVOR_KIND_BY_CONTACT` only offers an intro on a `business` contact
         * — personal kinds are excluded on purpose. A player working on chapter
         * 2 is at tier 1 with two parents and no business contacts, so Spark is
         * the only route, and finishing chapter 2 is what UNLOCKS Spark.
         * Tightening this deadlocks the chapter: rule 3 in `featureUnlocks.ts`,
         * and the trap a player was stranded in on 2026-08-13.
         *
         * Making it a real goal means shipping a visible tier-1 way to meet
         * someone in the same change. Pinned by
         * `__tests__/onboarding/wealthRatchet.test.ts`.
         */
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
        checkComplete: (s) => wealthMark(s) >= 10000,
        checkProgress: (s) => Math.min(1, wealthMark(s) / 10000),
      },
      {
        id: 'ch3_partner',
        title: 'Find a Partner',
        description: 'Start a romantic relationship',
        checkComplete: (s) => !!s.family?.spouse || (s.relationships?.some((r: any) => r.type === 'partner' || r.type === 'spouse') ?? false),
        checkProgress: (s) => (s.family?.spouse || s.relationships?.some((r: any) => r.type === 'partner' || r.type === 'spouse')) ? 1 : 0,
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
        checkComplete: (s) => wealthMark(s) >= 50000,
        checkProgress: (s) => Math.min(1, wealthMark(s) / 50000),
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
        checkComplete: (s) => wealthMark(s) >= 200000,
        checkProgress: (s) => Math.min(1, wealthMark(s) / 200000),
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
        // DERIVED, not read from a stored flag. `prestigeAvailable` is only ever
        // written FALSE (prestigeExecution resets it; nothing sets it true
        // outside DevTools), so this goal could never complete, its reward was
        // permanently unclaimable, and the home PrestigeButton behind the same
        // flag was dead. Deriving it from the same threshold the prestige system
        // itself uses is what makes it true. 2026-07-28 audit UX-1.
        checkComplete: (s) =>
          !!s.prestigeAvailable || netWorth(s) >= getPrestigeThreshold(s.prestige?.prestigeLevel ?? 0),
        checkProgress: (s) => {
          if (s.prestigeAvailable) return 1;
          const threshold = getPrestigeThreshold(s.prestige?.prestigeLevel ?? 0);
          if (!(threshold > 0)) return 0;
          // The old formula divided by a hardcoded $100M — 10x the real $10M
          // threshold — and capped at 0.9, so the bar could never fill either.
          return Math.max(0, Math.min(1, netWorth(s) / threshold));
        },
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
