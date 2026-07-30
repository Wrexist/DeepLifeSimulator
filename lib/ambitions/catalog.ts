/**
 * Life Ambitions — the catalogue.
 *
 * ~8 lifelong aspirations, each a themed 3–5 milestone path against real
 * GameState fields plus a one-time payoff. Milestone predicates are pure and
 * null-safe so they never crash on partial/legacy states.
 */

import type { GameState } from '@/contexts/game/types';
import { netWorth } from '@/lib/progress/achievements';
import type { LifeAmbition } from './types';

// ---------------------------------------------------------------------------
// Null-safe GameState readers (shared by the milestone predicates)
// ---------------------------------------------------------------------------

const clamp01 = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0);

/** Full net worth (companies, property, stocks, minus debt). Falls back to cash. */
const wealth = (s: GameState): number => {
  try {
    const nw = netWorth(s);
    return Number.isFinite(nw) ? nw : 0;
  } catch {
    return (s.stats?.money ?? 0) + (s.bankSavings ?? 0);
  }
};

/** 0..1 ramp toward a wealth target (for partial progress bars). */
const wealthRamp = (s: GameState, target: number): number => clamp01(wealth(s) / target);

const companyCount = (s: GameState): number => s.companies?.length ?? 0;
const childCount = (s: GameState): number => s.family?.children?.length ?? 0;
const hasSpouse = (s: GameState): boolean => !!s.family?.spouse;
const relationshipCount = (s: GameState): number =>
  // Exclude the starting parents (type 'parent') and children so "Make a
  // Connection" doesn't auto-complete at birth — count chosen relationships.
  s.relationships?.filter((r: any) => r?.type !== 'parent' && r?.type !== 'child').length ?? 0;
const hasRomantic = (s: GameState): boolean =>
  // Dating partners are type 'partner' (promoted to 'spouse' on marriage);
  // no relationship is ever type 'romantic', so the old check collapsed this
  // into hasSpouse and the "Fall in Love" milestone only flipped on marriage.
  hasSpouse(s) || (s.relationships?.some((r: any) => r?.type === 'partner' || r?.type === 'spouse') ?? false);
const educationsCompleted = (s: GameState): number =>
  s.educations?.filter((e: any) => e?.completed).length ?? 0;
const ownsInvestment = (s: GameState): boolean =>
  (s.stocks?.holdings?.length ?? 0) > 0 ||
  (s.realEstate?.some((p: any) => p?.owned !== false && (p?.currentValue ?? p?.price ?? 0) > 0) ?? false);
const happiness = (s: GameState): number => s.stats?.happiness ?? 0;
const reputation = (s: GameState): number => s.stats?.reputation ?? 0;
const fitness = (s: GameState): number => s.stats?.fitness ?? 0;
const criminalLevel = (s: GameState): number => s.criminalLevel ?? 0;
const criminalXp = (s: GameState): number => s.criminalXp ?? 0;
const streetJobs = (s: GameState): number => s.streetJobsCompleted ?? 0;

const careerById = (s: GameState, id: string): any =>
  s.careers?.find((c: any) => c?.id === id);
/** True once the player has actually taken the given career (not just its catalog entry). */
const inCareer = (s: GameState, id: string): boolean => {
  const c = careerById(s, id);
  return !!c && (c.accepted === true || s.currentJob === id);
};
const careerAtLeast = (s: GameState, id: string, lvl: number): boolean => {
  const c = careerById(s, id);
  return inCareer(s, id) && (c?.level ?? 0) >= lvl;
};
/** True when a taken career sits at (or above) its final ladder rung. */
const careerAtTop = (s: GameState, id: string): boolean => {
  const c = careerById(s, id);
  if (!inCareer(s, id) || !Array.isArray(c?.levels) || c.levels.length === 0) return false;
  return (c.level ?? 0) >= c.levels.length - 1;
};
/** Highest level reached in ANY taken career. */
const bestCareerLevel = (s: GameState): number => {
  let best = 0;
  for (const c of s.careers ?? []) {
    if ((c as any)?.accepted === true || (c as any)?.id === s.currentJob) {
      best = Math.max(best, (c as any)?.level ?? 0);
    }
  }
  return best;
};
/** True when ANY taken career sits at its final ladder rung. */
const anyCareerAtTop = (s: GameState): boolean =>
  (s.careers ?? []).some((c: any) => c?.id && careerAtTop(s, c.id));

/** "Spotlight" careers for the celebrity ambition. */
// Only real career ids — 'actor'/'influencer' don't exist (Influencer is a
// level name inside the celebrity ladder), so they never matched.
const FAME_CAREERS = ['celebrity', 'musician'];
/**
 * BOTH political ladders. There are two: `POLITICAL_CAREER` (id `'political'`,
 * Council Member -> ... -> President) is what the Politics app drives —
 * `runForOffice` finds/creates it and sets `currentJob: 'political'` — while
 * `'politician'` is the separate job-board career (Campaign Volunteer ->
 * National Party Leader). These milestones checked only `'politician'`, so a
 * player who ran the whole election ladder and became PRESIDENT scored zero
 * progress and forfeited $120,000 + 240 gems + 750 prestige points.
 * 2026-07-30 audit GP-5.
 */
const POLITICS_CAREERS = ['political', 'politician'];
const inAnyPoliticsCareer = (s: GameState): boolean => POLITICS_CAREERS.some((id) => inCareer(s, id));
const politicsCareerAtLeast = (s: GameState, lvl: number): boolean =>
  POLITICS_CAREERS.some((id) => careerAtLeast(s, id, lvl));
const politicsCareerAtTop = (s: GameState): boolean => POLITICS_CAREERS.some((id) => careerAtTop(s, id));
const inAnyFameCareer = (s: GameState): boolean => FAME_CAREERS.some((id) => inCareer(s, id));
const fameCareerAtLeast = (s: GameState, lvl: number): boolean =>
  FAME_CAREERS.some((id) => careerAtLeast(s, id, lvl));
const fameCareerAtTop = (s: GameState): boolean => FAME_CAREERS.some((id) => careerAtTop(s, id));

// ---------------------------------------------------------------------------
// The catalogue
// ---------------------------------------------------------------------------

export const LIFE_AMBITIONS: LifeAmbition[] = [
  {
    id: 'business_empire',
    name: 'Build a Business Empire',
    emoji: '🏢',
    tagline: 'Turn one company into an unstoppable corporate dynasty.',
    hint: 'Found a company early and reinvest every profit back into growth.',
    color: '#3B82F6',
    milestones: [
      {
        id: 'be_found',
        title: 'Found Your First Company',
        description: 'Own a company.',
        checkComplete: (s) => companyCount(s) >= 1,
        checkProgress: (s) => (companyCount(s) >= 1 ? 1 : 0),
      },
      {
        id: 'be_conglomerate',
        title: 'Run a Conglomerate',
        description: 'Own 3 companies at once.',
        checkComplete: (s) => companyCount(s) >= 3,
        checkProgress: (s) => clamp01(companyCount(s) / 3),
      },
      {
        id: 'be_networth_5m',
        title: 'Five-Comma Founder',
        description: 'Reach $5,000,000 net worth.',
        checkComplete: (s) => wealth(s) >= 5_000_000,
        checkProgress: (s) => wealthRamp(s, 5_000_000),
      },
      {
        id: 'be_empire_25m',
        title: 'Empire Secured',
        description: 'Reach $25,000,000 net worth.',
        checkComplete: (s) => wealth(s) >= 25_000_000,
        checkProgress: (s) => wealthRamp(s, 25_000_000),
      },
    ],
    payoff: { money: 250_000, gems: 250, prestigePoints: 800, badge: 'Empire Builder' },
  },
  {
    id: 'global_celebrity',
    name: 'Become a Global Celebrity',
    emoji: '🌟',
    tagline: 'Chase fame until the whole world knows your name.',
    hint: 'Build your reputation first, then pursue a spotlight career.',
    color: '#EC4899',
    milestones: [
      {
        id: 'gc_reputation',
        title: 'Get Noticed',
        description: 'Reach 70 reputation.',
        checkComplete: (s) => reputation(s) >= 70,
        checkProgress: (s) => clamp01(reputation(s) / 70),
      },
      {
        id: 'gc_break_in',
        title: 'Break Into the Spotlight',
        description: 'Land a celebrity, musician, or acting career.',
        checkComplete: (s) => inAnyFameCareer(s),
        checkProgress: (s) => (inAnyFameCareer(s) ? 1 : 0),
      },
      {
        id: 'gc_rising_star',
        title: 'Rising Star',
        description: 'Reach level 3 in a spotlight career.',
        checkComplete: (s) => fameCareerAtLeast(s, 3),
        checkProgress: (s) => (fameCareerAtLeast(s, 3) ? 1 : 0),
      },
      {
        id: 'gc_icon',
        title: 'Global Icon',
        description: 'Reach the top of a spotlight career.',
        checkComplete: (s) => fameCareerAtTop(s),
        checkProgress: (s) => (fameCareerAtTop(s) ? 1 : 0),
      },
    ],
    payoff: { money: 150_000, gems: 220, prestigePoints: 700, badge: 'Household Name' },
  },
  {
    id: 'raise_dynasty',
    name: 'Raise a Dynasty',
    emoji: '👑',
    tagline: 'Build a bloodline that outlives you and inherits it all.',
    hint: 'Find a partner, grow a family, and leave them a fortune.',
    color: '#F59E0B',
    milestones: [
      {
        id: 'dy_marry',
        title: 'Marry',
        description: 'Get married.',
        checkComplete: (s) => hasSpouse(s),
        checkProgress: (s) => (hasSpouse(s) ? 1 : 0),
      },
      {
        id: 'dy_firstborn',
        title: 'Firstborn',
        description: 'Have a child.',
        checkComplete: (s) => childCount(s) >= 1,
        checkProgress: (s) => (childCount(s) >= 1 ? 1 : 0),
      },
      {
        id: 'dy_full_house',
        title: 'Full House',
        description: 'Raise 3 children.',
        checkComplete: (s) => childCount(s) >= 3,
        checkProgress: (s) => clamp01(childCount(s) / 3),
      },
      {
        id: 'dy_inheritance',
        title: 'Secure the Inheritance',
        description: 'Reach $1,000,000 net worth to leave behind.',
        checkComplete: (s) => wealth(s) >= 1_000_000,
        checkProgress: (s) => wealthRamp(s, 1_000_000),
      },
    ],
    payoff: { money: 100_000, gems: 200, prestigePoints: 600, badge: 'Dynasty Founder' },
  },
  {
    id: 'rule_politics',
    name: 'Rule in Politics',
    emoji: '🏛️',
    tagline: 'Climb from local campaigns to the seat of power.',
    hint: 'Grow your reputation, then enter the political ladder.',
    color: '#6366F1',
    milestones: [
      {
        id: 'po_reputation',
        title: 'Public Figure',
        description: 'Reach 60 reputation.',
        checkComplete: (s) => reputation(s) >= 60,
        checkProgress: (s) => clamp01(reputation(s) / 60),
      },
      {
        id: 'po_enter',
        title: 'Run for Office',
        description: 'Enter the politician career.',
        checkComplete: (s) => inAnyPoliticsCareer(s),
        checkProgress: (s) => (inAnyPoliticsCareer(s) ? 1 : 0),
      },
      {
        id: 'po_rising',
        title: 'Career Politician',
        description: 'Reach level 3 as a politician.',
        checkComplete: (s) => politicsCareerAtLeast(s, 3),
        checkProgress: (s) => (politicsCareerAtLeast(s, 3) ? 1 : 0),
      },
      {
        id: 'po_top_office',
        title: 'Highest Office',
        description: 'Reach the top of the political ladder.',
        checkComplete: (s) => politicsCareerAtTop(s),
        checkProgress: (s) => (politicsCareerAtTop(s) ? 1 : 0),
      },
    ],
    payoff: { money: 120_000, gems: 240, prestigePoints: 750, badge: 'Head of State' },
  },
  {
    id: 'master_craft',
    name: 'Master Your Craft',
    emoji: '🎓',
    tagline: 'Out-study and out-work everyone to reach the very top.',
    hint: 'Invest in education, then climb a single career to its summit.',
    color: '#14B8A6',
    milestones: [
      {
        id: 'mc_educated',
        title: 'Get Educated',
        description: 'Complete an education program.',
        checkComplete: (s) => educationsCompleted(s) >= 1,
        checkProgress: (s) => (educationsCompleted(s) >= 1 ? 1 : 0),
      },
      {
        id: 'mc_scholar',
        title: 'Lifelong Scholar',
        description: 'Complete 2 education programs.',
        checkComplete: (s) => educationsCompleted(s) >= 2,
        checkProgress: (s) => clamp01(educationsCompleted(s) / 2),
      },
      {
        id: 'mc_senior',
        title: 'Senior Expert',
        description: 'Reach career level 4 in any career.',
        checkComplete: (s) => bestCareerLevel(s) >= 4,
        checkProgress: (s) => clamp01(bestCareerLevel(s) / 4),
      },
      {
        id: 'mc_master',
        title: 'Master of the Field',
        description: 'Reach the top level of any career.',
        checkComplete: (s) => anyCareerAtTop(s),
        checkProgress: (s) => (anyCareerAtTop(s) ? 1 : 0),
      },
    ],
    payoff: { money: 90_000, gems: 210, prestigePoints: 650, badge: 'Grandmaster' },
  },
  {
    id: 'amass_fortune',
    name: 'Amass a Fortune',
    emoji: '💰',
    tagline: 'Let money make money until you are set for life.',
    hint: 'Invest consistently and let compounding do the heavy lifting.',
    color: '#22C55E',
    milestones: [
      {
        id: 'fo_nest_egg',
        title: 'Nest Egg',
        description: 'Reach $50,000 net worth.',
        checkComplete: (s) => wealth(s) >= 50_000,
        checkProgress: (s) => wealthRamp(s, 50_000),
      },
      {
        id: 'fo_investor',
        title: 'First Investment',
        description: 'Own a stock or a property.',
        checkComplete: (s) => ownsInvestment(s),
        checkProgress: (s) => (ownsInvestment(s) ? 1 : 0),
      },
      {
        id: 'fo_millionaire',
        title: 'Millionaire',
        description: 'Reach $1,000,000 net worth.',
        checkComplete: (s) => wealth(s) >= 1_000_000,
        checkProgress: (s) => wealthRamp(s, 1_000_000),
      },
      {
        id: 'fo_ten_million',
        title: 'Financially Immortal',
        description: 'Reach $10,000,000 net worth.',
        checkComplete: (s) => wealth(s) >= 10_000_000,
        checkProgress: (s) => wealthRamp(s, 10_000_000),
      },
    ],
    payoff: { money: 300_000, gems: 260, prestigePoints: 900, badge: 'Tycoon' },
  },
  {
    id: 'life_of_crime',
    name: 'Live a Life of Crime',
    emoji: '🕵️',
    tagline: 'Rise through the underworld to become a feared kingpin.',
    hint: 'Take risks in the shadows — but keep an eye on your heat.',
    color: '#EF4444',
    milestones: [
      {
        id: 'cr_first_job',
        title: 'First Score',
        description: 'Pull off your first street job or crime.',
        checkComplete: (s) => criminalXp(s) > 0 || streetJobs(s) > 0 || criminalLevel(s) > 0,
        checkProgress: (s) =>
          criminalXp(s) > 0 || streetJobs(s) > 0 || criminalLevel(s) > 0 ? 1 : 0,
      },
      {
        id: 'cr_made',
        title: 'Made',
        description: 'Reach criminal level 3.',
        checkComplete: (s) => criminalLevel(s) >= 3,
        checkProgress: (s) => clamp01(criminalLevel(s) / 3),
      },
      {
        id: 'cr_dirty_money',
        title: 'Dirty Money',
        description: 'Amass $500,000 net worth.',
        checkComplete: (s) => wealth(s) >= 500_000,
        checkProgress: (s) => wealthRamp(s, 500_000),
      },
      {
        id: 'cr_kingpin',
        title: 'Kingpin',
        description: 'Reach criminal level 6.',
        checkComplete: (s) => criminalLevel(s) >= 6,
        checkProgress: (s) => clamp01(criminalLevel(s) / 6),
      },
    ],
    payoff: { money: 200_000, gems: 230, prestigePoints: 700, badge: 'Crime Lord' },
  },
  {
    id: 'true_love',
    name: 'Find True Love & Family',
    emoji: '❤️',
    tagline: 'Build a life rich in love, connection, and contentment.',
    hint: 'Nurture your relationships and protect your happiness.',
    color: '#F43F5E',
    milestones: [
      {
        id: 'tl_friend',
        title: 'Make a Connection',
        description: 'Start your first relationship.',
        checkComplete: (s) => relationshipCount(s) >= 1,
        checkProgress: (s) => (relationshipCount(s) >= 1 ? 1 : 0),
      },
      {
        id: 'tl_romance',
        title: 'Fall in Love',
        description: 'Find a romantic partner.',
        checkComplete: (s) => hasRomantic(s),
        checkProgress: (s) => (hasRomantic(s) ? 1 : 0),
      },
      {
        id: 'tl_marry',
        title: 'Tie the Knot',
        description: 'Get married.',
        checkComplete: (s) => hasSpouse(s),
        checkProgress: (s) => (hasSpouse(s) ? 1 : 0),
      },
      {
        id: 'tl_bliss',
        title: 'Wedded Bliss',
        description: 'Reach 90 happiness while married.',
        checkComplete: (s) => hasSpouse(s) && happiness(s) >= 90,
        checkProgress: (s) => (hasSpouse(s) ? clamp01(happiness(s) / 90) : 0),
      },
    ],
    payoff: { money: 60_000, gems: 200, prestigePoints: 550, badge: 'Soulmate' },
  },
];
