import { applyWeeklyInflation, getInflatedPrice, getWeeklyInflationRate } from '../inflation';
import { GameState } from '@/contexts/GameContext';

function createState(priceIndex: number, rate: number): GameState {
  return {
    stats: { health: 0, happiness: 0, energy: 0, fitness: 0, money: 0, reputation: 0, gems: 0 },
    day: 0,
    week: 1,
    date: { year: 2025, month: 'January', week: 1, age: 18 },
    totalHappiness: 0,
    weeksLived: 0,
    streetJobs: [],
    careers: [],
    hobbies: [],
    items: [],
    darkWebItems: [],
    hacks: [],
    relationships: [],
    pets: [],
    social: { relations: [] },
    hasPhone: false,
    foods: [],
    healthActivities: [],
    dietPlans: [],
    educations: [],
    companies: [],
    userProfile: { name: '', handle: '', bio: '', followers: 0, following: 0, gender: 'male', seekingGender: 'female' },
    currentJob: undefined,
    showWelcomePopup: true,
    settings: { darkMode: false, soundEnabled: true, notificationsEnabled: true, autoSave: true, language: 'English', maxStats: false },
    cryptos: [],
    diseases: [],
    realEstate: [],
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
    perks: {},
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
    economy: { inflationRateAnnual: rate, priceIndex },
    version: 5,
    pendingEvents: [],
    eventLog: [],
    progress: { achievements: [] },
    journal: [],
    healthWeeks: 0,
    dailyGifts: {
      currentStreak: 0,
      lastClaimDate: '',
      weeklyGifts: [],
      claimedToday: false,
      showDailyGiftModal: false,
    },
  } as GameState;
}

describe('inflation utilities', () => {
  it('updates price index by weekly inflation', () => {
    const state = createState(1, 0.52); // 52% annual -> 1% weekly
    const updated = applyWeeklyInflation(state);
    expect(updated.economy.priceIndex).toBeCloseTo(1.01);
  });

  it('scales prices by index', () => {
    expect(getInflatedPrice(100, 1.1)).toBe(110);
  });

  it('returns weekly inflation rate', () => {
    const state = createState(1, 0.52);
    expect(getWeeklyInflationRate(state)).toBeCloseTo(0.01);
  });
});
