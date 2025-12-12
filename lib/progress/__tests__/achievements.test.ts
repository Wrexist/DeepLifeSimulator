import { evaluateAchievements, ACHIEVEMENTS, AchievementProgress } from '../achievements';
import { GameState, GameStats, GameDate, Relationship, GameSettings } from '@/contexts/GameContext';

const baseStats: GameStats = {
  health: 100,
  happiness: 100,
  energy: 100,
  fitness: 10,
  money: 0,
  reputation: 0,
  gems: 0,
};

const baseDate: GameDate = { year: 2025, month: 'January', week: 1, age: 18 };

const settings: GameSettings = {
  darkMode: false,
  soundEnabled: true,
  notificationsEnabled: true,
  autoSave: true,
  language: 'en',
  maxStats: false,
  hapticFeedback: true,
  weeklySummaryEnabled: true,
  showDecimalsInStats: false,
};

const createState = (overrides: Partial<GameState>): GameState => ({
  version: 5,
  stats: baseStats,
  totalHappiness: 0,
  weeksLived: 0,
  week: 1,
  date: baseDate,
  streetJobs: [],
  careers: [],
  hobbies: [],
  items: [],
  darkWebItems: [],
  hacks: [],
  relationships: [],
  pets: [],
  hasPhone: false,
  foods: [],
  healthActivities: [],
  dietPlans: [],
  educations: [],
  companies: [],
  userProfile: { name: '', handle: '', bio: '', followers: 0, following: 0, gender: 'male', seekingGender: 'female' },
  showWelcomePopup: false,
  settings,
  cryptos: [],
  diseases: [],
  realEstate: [],
  social: { relations: [] },
  economy: { inflationRateAnnual: 0.03, priceIndex: 1 },
  family: { children: [] },
  lifeStage: 'adult',
  wantedLevel: 0,
  jailWeeks: 0,
  escapedFromJail: false,
  jailActivities: [],
  criminalXp: 0,
  criminalLevel: 1,
  crimeSkills: {
    stealth: { xp: 0, level: 1 },
    hacking: { xp: 0, level: 1 },
    lockpicking: { xp: 0, level: 1 },
  },
  bankSavings: 0,
  stocksOwned: {},
  achievements: [],
  claimedProgressAchievements: [],
  lastLogin: Date.now(),
  streetJobsCompleted: 0,
  happinessZeroWeeks: 0,
  healthZeroWeeks: 0,
  showZeroStatPopup: false,
  zeroStatType: undefined,
  showDeathPopup: false,
  deathReason: undefined,
  day: 1,
  dailySummary: undefined,
  pendingEvents: [],
  eventLog: [],
  progress: { achievements: [] },
  journal: [],
  healthWeeks: 0,
  ...overrides,
});

describe('evaluateAchievements', () => {
  it('unlocks first million when net worth reaches threshold', () => {
    const state = createState({ stats: { ...baseStats, money: 1_000_000 } });
    const result = evaluateAchievements(state);
    expect(result.some(a => a.id === 'first_million')).toBe(true);
  });

  it('unlocks top health at 100 health', () => {
    const state = createState({ stats: { ...baseStats, health: 100 } });
    const result = evaluateAchievements(state);
    expect(result.some(a => a.id === 'top_health')).toBe(true);
  });

  it('unlocks social star with enough relationships', () => {
    const relationships: Relationship[] = Array.from({ length: 10 }).map((_, i) => ({
      id: `r${i}`,
      name: `Friend ${i}`,
      type: 'friend',
      relationshipScore: 80,
      personality: 'nice',
      gender: 'male',
      age: 20,
    }));
    const state = createState({ relationships });
    const result = evaluateAchievements(state);
    expect(result.some(a => a.id === 'social_star')).toBe(true);
  });

  it('does not unlock already achieved milestones', () => {
    const progress: AchievementProgress[] = [{ ...ACHIEVEMENTS[0], unlockedAt: 1 }];
    const state = createState({ progress: { achievements: progress }, stats: { ...baseStats, money: 1_000_000 } });
    const result = evaluateAchievements(state);
    expect(result.some(a => a.id === 'first_million')).toBe(false);
  });
});
