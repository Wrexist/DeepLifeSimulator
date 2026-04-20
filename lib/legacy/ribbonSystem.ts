/**
 * Life Ribbon System
 *
 * At death, each life earns exactly ONE ribbon based on how the player lived.
 * Ribbons are checked in priority order — the first match wins.
 * Hidden ribbons show as "???" until discovered, driving completionism.
 *
 * Persists across prestiges in ribbonCollection.
 */
import type { GameState } from '@/contexts/game/types';

export interface RibbonDefinition {
  id: string;
  name: string;
  emoji: string;
  color: string;
  description: string;
  hidden: boolean;
  priority: number; // Lower = checked first (rare ribbons should have low priority)
  condition: (state: GameState) => boolean;
}

// Helper: rough net worth calculation
function getNetWorth(s: GameState): number {
  const cash = s.stats?.money ?? 0;
  const bank = s.bankSavings ?? 0;
  const holdings = Array.isArray(s.stocks) ? s.stocks : (s.stocks?.holdings ?? []);
  const stocks = Array.isArray(holdings)
    ? holdings.reduce(
        (sum: number, st: any) => sum + (st.shares ?? 0) * (st.currentPrice ?? 0),
        0
      )
    : 0;
  const realEstate = Array.isArray(s.realEstate)
    ? s.realEstate.reduce((sum: number, r: any) => sum + (r.value ?? 0), 0)
    : 0;
  return cash + bank + stocks + realEstate;
}

const getAge = (s: GameState) => Math.floor(s.date?.age ?? 18);

const getAchievementCount = (s: GameState) =>
  Array.isArray(s.achievements)
    ? s.achievements.filter((a: any) => a.completed).length
    : 0;

const getChildrenCount = (s: GameState) =>
  s.family?.children?.length ?? 0;

const getRelationshipCount = (s: GameState) =>
  (s.relationships ?? []).length;

const getPetCount = (s: GameState) =>
  (s.pets ?? []).length;

const getPropertyCount = (s: GameState) =>
  (s.realEstate ?? []).length;

const getCompanyCount = (s: GameState) =>
  (s.companies ?? []).length;

const getCareerCount = (s: GameState) =>
  (s.careers ?? []).filter((c: any) => c?.accepted).length;

// ─── Ribbon Definitions (priority-ordered) ───────────────────────

export const RIBBONS: RibbonDefinition[] = [
  // ── HIDDEN / ULTRA-RARE (priority 1-5) ──
  {
    id: 'ribbon_mediocre',
    name: 'Mediocre',
    emoji: '😐',
    color: '#9CA3AF',
    description: 'Lived an entirely unremarkable life. No achievements, no family, no fortune.',
    hidden: true,
    priority: 1,
    condition: (s) => {
      const nw = getNetWorth(s);
      return (
        nw < 5000 &&
        !s.family?.spouse &&
        getChildrenCount(s) === 0 &&
        getAchievementCount(s) < 3 &&
        getCareerCount(s) <= 1
      );
    },
  },
  {
    id: 'ribbon_centenarian',
    name: 'Centenarian',
    emoji: '🎂',
    color: '#F59E0B',
    description: 'Lived to 100 years old or beyond.',
    hidden: true,
    priority: 2,
    condition: (s) => getAge(s) >= 100,
  },
  {
    id: 'ribbon_lucky_7',
    name: 'Lucky Seven',
    emoji: '🍀',
    color: '#10B981',
    description: 'Died with exactly $777,777 in cash.',
    hidden: true,
    priority: 2,
    condition: (s) => Math.floor(s.stats?.money ?? 0) === 777777,
  },
  {
    id: 'ribbon_perfectionist',
    name: 'Perfectionist',
    emoji: '✨',
    color: '#8B5CF6',
    description: 'Had all stats above 90 at time of death.',
    hidden: true,
    priority: 3,
    condition: (s) =>
      (s.stats?.health ?? 0) >= 90 &&
      (s.stats?.happiness ?? 0) >= 90 &&
      (s.stats?.energy ?? 0) >= 90,
  },
  {
    id: 'ribbon_speedrunner',
    name: 'Speedrunner',
    emoji: '⚡',
    color: '#EF4444',
    description: 'Became a millionaire before age 25.',
    hidden: true,
    priority: 3,
    condition: (s) => getAge(s) <= 25 && getNetWorth(s) >= 1_000_000,
  },

  // ── LIFESTYLE (priority 10-15) ──
  {
    id: 'ribbon_cat_person',
    name: 'Cat Person',
    emoji: '🐱',
    color: '#F97316',
    description: 'Owned 3 or more pets at once.',
    hidden: false,
    priority: 10,
    condition: (s) => getPetCount(s) >= 3,
  },
  {
    id: 'ribbon_hermit',
    name: 'Hermit',
    emoji: '🏔️',
    color: '#6B7280',
    description: 'Lived with zero relationships and no spouse.',
    hidden: false,
    priority: 10,
    condition: (s) =>
      !s.family?.spouse &&
      getRelationshipCount(s) === 0 &&
      getAge(s) >= 40,
  },
  {
    id: 'ribbon_globetrotter',
    name: 'Globetrotter',
    emoji: '✈️',
    color: '#06B6D4',
    description: 'Visited 5 or more countries.',
    hidden: false,
    priority: 10,
    condition: (s) => {
      // Count unique destinations from travel history
      const history = s.travel?.travelHistory ?? [];
      const uniqueDestinations = new Set(history.map((t: any) => t.destinationId));
      return uniqueDestinations.size >= 5 || (s.travel?.visitedDestinations ?? []).length >= 5;
    },
  },
  {
    id: 'ribbon_family_first',
    name: 'Family First',
    emoji: '👨‍👩‍👧‍👦',
    color: '#EC4899',
    description: 'Raised 5 or more children.',
    hidden: false,
    priority: 10,
    condition: (s) => getChildrenCount(s) >= 5,
  },

  // ── ACHIEVEMENT-BASED (priority 20-30) ──
  {
    id: 'ribbon_hero',
    name: 'Hero',
    emoji: '🛡️',
    color: '#3B82F6',
    description: 'Lived a heroic life of generosity and integrity.',
    hidden: false,
    priority: 20,
    condition: (s) => (s.karma?.score ?? 0) > 70,
  },
  {
    id: 'ribbon_villain',
    name: 'Villain',
    emoji: '💀',
    color: '#EF4444',
    description: 'Lived a life of crime and villainy.',
    hidden: false,
    priority: 20,
    condition: (s) =>
      (s.karma?.score ?? 0) < -50 || (s.criminalLevel ?? 0) >= 4,
  },
  {
    id: 'ribbon_mogul',
    name: 'Mogul',
    emoji: '🏢',
    color: '#F59E0B',
    description: 'Built a business empire with 3+ companies.',
    hidden: false,
    priority: 20,
    condition: (s) => getCompanyCount(s) >= 3,
  },
  {
    id: 'ribbon_scholar',
    name: 'Scholar',
    emoji: '🎓',
    color: '#8B5CF6',
    description: 'Earned a PhD or completed 3+ degrees.',
    hidden: false,
    priority: 20,
    condition: (s) => {
      const educations = s.educations || [];
      const completed = educations.filter((e: any) => e?.completed);
      const hasPhD = completed.some(
        (e: any) =>
          e?.name?.toLowerCase()?.includes('phd') ||
          e?.name?.toLowerCase()?.includes('doctorate')
      );
      return hasPhD || completed.length >= 3;
    },
  },
  {
    id: 'ribbon_jailbird',
    name: 'Jailbird',
    emoji: '⛓️',
    color: '#6B7280',
    description: 'Spent significant time behind bars.',
    hidden: false,
    priority: 20,
    condition: (s) => (s.jailWeeks ?? 0) > 0 || (s.totalJailTime ?? 0) >= 26,
  },
  {
    id: 'ribbon_famous',
    name: 'Famous',
    emoji: '⭐',
    color: '#A855F7',
    description: 'Became a celebrity with massive influence.',
    hidden: false,
    priority: 25,
    condition: (s) =>
      s.socialMedia?.influenceLevel === 'celebrity' ||
      (s.stats?.reputation ?? 0) >= 85,
  },
  {
    id: 'ribbon_real_estate',
    name: 'Landlord',
    emoji: '🏠',
    color: '#059669',
    description: 'Owned 5 or more properties.',
    hidden: false,
    priority: 25,
    condition: (s) => getPropertyCount(s) >= 5,
  },
  {
    id: 'ribbon_politician',
    name: 'Politician',
    emoji: '🏛️',
    color: '#1D4ED8',
    description: 'Held political office.',
    hidden: false,
    priority: 25,
    condition: (s) => (s.politics?.careerLevel ?? 0) > 0 || (s.politics?.electionsWon ?? 0) > 0,
  },

  // ── WEALTH-BASED (priority 30-40) ──
  {
    id: 'ribbon_billionaire',
    name: 'Billionaire',
    emoji: '💎',
    color: '#F59E0B',
    description: 'Amassed a net worth of $1 billion.',
    hidden: false,
    priority: 30,
    condition: (s) => getNetWorth(s) >= 1_000_000_000,
  },
  {
    id: 'ribbon_loaded',
    name: 'Loaded',
    emoji: '💰',
    color: '#F59E0B',
    description: 'Amassed a net worth of $10 million.',
    hidden: false,
    priority: 32,
    condition: (s) => getNetWorth(s) >= 10_000_000,
  },
  {
    id: 'ribbon_comfortable',
    name: 'Comfortable',
    emoji: '🏡',
    color: '#10B981',
    description: 'Built a comfortable life with $1M+ net worth.',
    hidden: false,
    priority: 35,
    condition: (s) => getNetWorth(s) >= 1_000_000,
  },

  // ── GENERAL (priority 50+) ──
  {
    id: 'ribbon_lover',
    name: 'Lover',
    emoji: '❤️',
    color: '#EC4899',
    description: 'Maintained a loving marriage until death.',
    hidden: false,
    priority: 50,
    condition: (s) => !!s.family?.spouse && getAge(s) >= 50,
  },
  {
    id: 'ribbon_hustler',
    name: 'Hustler',
    emoji: '💪',
    color: '#F97316',
    description: 'Worked hard across 5+ different careers.',
    hidden: false,
    priority: 50,
    condition: (s) => getCareerCount(s) >= 5,
  },
  {
    id: 'ribbon_achiever',
    name: 'Achiever',
    emoji: '🏆',
    color: '#F59E0B',
    description: 'Unlocked 15+ achievements in a single life.',
    hidden: false,
    priority: 50,
    condition: (s) => getAchievementCount(s) >= 15,
  },
  {
    id: 'ribbon_survivor',
    name: 'Survivor',
    emoji: '🔥',
    color: '#EF4444',
    description: 'Survived past age 80 despite low health.',
    hidden: false,
    priority: 50,
    condition: (s) => getAge(s) >= 80 && (s.stats?.health ?? 100) < 30,
  },
  {
    id: 'ribbon_adventurer',
    name: 'Adventurer',
    emoji: '🗺️',
    color: '#06B6D4',
    description: 'Lived an adventurous life full of events.',
    hidden: false,
    priority: 55,
    condition: (s) => (s.eventLog ?? []).length >= 30,
  },

  // ── FALLBACK (priority 100) ──
  {
    id: 'ribbon_ordinary',
    name: 'Ordinary',
    emoji: '🧑',
    color: '#9CA3AF',
    description: 'Lived an ordinary life.',
    hidden: false,
    priority: 100,
    condition: () => true, // Always matches — fallback
  },
];

/**
 * Classify a life into its ribbon. Returns the first matching ribbon
 * by priority order.
 */
export function classifyLife(state: GameState): RibbonDefinition {
  const sorted = [...RIBBONS].sort((a, b) => a.priority - b.priority);
  for (const ribbon of sorted) {
    try {
      if (ribbon.condition(state)) return ribbon;
    } catch {
      // Skip broken conditions
      continue;
    }
  }
  // Fallback should always match, but just in case:
  return RIBBONS.find((r) => r.id === 'ribbon_ordinary')!;
}

/**
 * Add a newly earned ribbon to the collection.
 */
export function addRibbonToCollection(
  collection: GameState['ribbonCollection'],
  ribbon: RibbonDefinition,
  state: GameState
): NonNullable<GameState['ribbonCollection']> {
  const existing = collection ?? { earned: [], discoveredIds: [] };

  const earned = [
    ...existing.earned,
    {
      ribbonId: ribbon.id,
      generation: state.generationNumber ?? 1,
      earnedTimestamp: Date.now(),
      lifeAge: getAge(state),
      lifeName: state.userProfile?.name ?? 'Unknown',
    },
  ];

  const discoveredIds = existing.discoveredIds.includes(ribbon.id)
    ? existing.discoveredIds
    : [...existing.discoveredIds, ribbon.id];

  return { earned, discoveredIds };
}
