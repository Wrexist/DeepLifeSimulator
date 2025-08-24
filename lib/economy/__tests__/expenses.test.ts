import { calcWeeklyExpenses } from '../expenses';
import { GameState, RealEstate } from '@/contexts/GameContext';

interface TestLoan {
  weeklyPayment: number;
}

function createState(overrides: Partial<GameState & { loans?: TestLoan[] }>): GameState & { loans?: TestLoan[] } {
  return {
    stats: { health: 0, happiness: 0, energy: 0, fitness: 0, money: 0, reputation: 0, goldBars: 0 },
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
    pets: [],
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
    economy: { inflationRateAnnual: 0.03, priceIndex: 1 },
    version: 5,
    pendingEvents: [],
    eventLog: [],
    progress: { achievements: [] },
    journal: [],
    ...overrides,
  } as GameState & { loans?: TestLoan[] };
}

describe('calcWeeklyExpenses', () => {
  it('sums upkeep and loan payments', () => {
    const properties: RealEstate[] = [
      {
        id: 'house',
        name: 'House',
        price: 100000,
        weeklyHappiness: 0,
        weeklyEnergy: 0,
        owned: true,
        interior: [],
        upgradeLevel: 1,
        rent: 500,
        upkeep: 100,
      },
    ];
    const state = createState({
      realEstate: properties,
      loans: [{ weeklyPayment: 50 }],
    });
    const result = calcWeeklyExpenses(state);
    expect(result.breakdown.upkeep).toBe(120);
    expect(result.breakdown.loans).toBe(50);
    expect(result.total).toBe(170);
  });
});
