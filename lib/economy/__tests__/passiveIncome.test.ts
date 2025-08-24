import { calcWeeklyPassiveIncome } from '../passiveIncome';
import { GameState, RealEstate } from '@/contexts/GameContext';

function createState(overrides: Partial<GameState>): GameState {
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
  } as GameState;
}

describe('calcWeeklyPassiveIncome', () => {
  it('calculates income from stocks and real estate', () => {
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
      stocksOwned: { aapl: 10 },
      realEstate: properties,
      hobbies: [
        {
          id: 'music',
          name: 'Music',
          description: '',
          energyCost: 0,
          skill: 0,
          skillLevel: 1,
          tournamentReward: 0,
          songs: [{ id: 's1', grade: 'Good', weeklyIncome: 50 }],
          upgrades: [],
        },
        {
          id: 'art',
          name: 'Art',
          description: '',
          energyCost: 0,
          skill: 0,
          skillLevel: 1,
          tournamentReward: 0,
          artworks: [{ id: 'a1', grade: 'Good', weeklyIncome: 30 }],
          upgrades: [],
        },
        {
          id: 'football',
          name: 'Football',
          description: '',
          energyCost: 0,
          skill: 0,
          skillLevel: 1,
          tournamentReward: 0,
          contracts: [
            {
              id: 'c1',
              team: 'Lions FC',
              matchPay: 40,
              weeksRemaining: 10,
              totalWeeks: 40,
              division: 0,
              goal: 1,
            },
          ],
          sponsors: [{ id: 's1', name: 'Nyke', weeklyPay: 20, weeksRemaining: 5 }],
          upgrades: [],
        },
      ],
    });
    const result = calcWeeklyPassiveIncome(state);
    expect(result.breakdown.stocks).toBeCloseTo((178.2 * 0.006 * 10) / 52, 5);
    expect(result.breakdown.realEstate).toBe(480);
    expect(result.breakdown.songs).toBe(50);
    expect(result.breakdown.art).toBe(30);
    expect(result.breakdown.contracts).toBe(0);
    expect(result.breakdown.sponsors).toBe(20);
    expect(result.total).toBeCloseTo(result.breakdown.stocks + 480 + 50 + 30 + 0 + 20, 5);
  });
});
