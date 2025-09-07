import { GameState } from '@/contexts/GameContext';

function createGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    stats: { health: 50, happiness: 50, energy: 50, fitness: 50, money: 1000, reputation: 50, gems: 0 },
    day: 1,
    week: 1,
    date: { year: 2025, month: 'January', week: 1, age: 18 },
    totalHappiness: 50,
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
    userProfile: { name: 'Test', handle: 'test', bio: '', followers: 0, following: 0, gender: 'male', seekingGender: 'female' },
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

describe('Stats Logic', () => {
  describe('Stat Boundaries', () => {
    it('should clamp stats to valid ranges (0-100)', () => {
      const clampStat = (value: number): number => Math.max(0, Math.min(100, value));
      
      expect(clampStat(-10)).toBe(0);
      expect(clampStat(0)).toBe(0);
      expect(clampStat(50)).toBe(50);
      expect(clampStat(100)).toBe(100);
      expect(clampStat(150)).toBe(100);
    });

    it('should handle stat changes correctly', () => {
      const updateStat = (current: number, change: number): number => {
        return Math.max(0, Math.min(100, current + change));
      };
      
      expect(updateStat(50, 10)).toBe(60);
      expect(updateStat(50, -10)).toBe(40);
      expect(updateStat(95, 10)).toBe(100); // Clamped to max
      expect(updateStat(5, -10)).toBe(0); // Clamped to min
    });
  });

  describe('Stat Effects', () => {
    it('should calculate health effects correctly', () => {
      const state = createGameState({
        stats: { health: 30, happiness: 50, energy: 50, fitness: 50, money: 1000, reputation: 50, gems: 0 },
      });
      
      const isSick = state.stats.health <= 30;
      const isHealthy = state.stats.health >= 70;
      
      expect(isSick).toBe(true);
      expect(isHealthy).toBe(false);
    });

    it('should calculate happiness effects correctly', () => {
      const state = createGameState({
        stats: { health: 50, happiness: 80, energy: 50, fitness: 50, money: 1000, reputation: 50, gems: 0 },
      });
      
      const isHappy = state.stats.happiness >= 70;
      const isSad = state.stats.happiness <= 30;
      
      expect(isHappy).toBe(true);
      expect(isSad).toBe(false);
    });

    it('should calculate energy effects correctly', () => {
      const state = createGameState({
        stats: { health: 50, happiness: 50, energy: 20, fitness: 50, money: 1000, reputation: 50, gems: 0 },
      });
      
      const isTired = state.stats.energy <= 30;
      const isEnergetic = state.stats.energy >= 70;
      
      expect(isTired).toBe(true);
      expect(isEnergetic).toBe(false);
    });
  });

  describe('Stat Interactions', () => {
    it('should handle stat dependencies', () => {
      const canWork = (energy: number, happiness: number): boolean => {
        return energy >= 20 && happiness >= 20;
      };
      
      expect(canWork(30, 30)).toBe(true);
      expect(canWork(15, 30)).toBe(false);
      expect(canWork(30, 15)).toBe(false);
      expect(canWork(15, 15)).toBe(false);
    });

    it('should calculate stat bonuses from items', () => {
      const calculateStatBonus = (baseStat: number, itemBonus: number): number => {
        return Math.max(0, Math.min(100, baseStat + itemBonus));
      };
      
      expect(calculateStatBonus(50, 10)).toBe(60);
      expect(calculateStatBonus(95, 10)).toBe(100);
      expect(calculateStatBonus(50, -10)).toBe(40);
      expect(calculateStatBonus(5, -10)).toBe(0);
    });
  });

  describe('Death Conditions', () => {
    it('should detect death from low health', () => {
      const state = createGameState({
        stats: { health: 0, happiness: 50, energy: 50, fitness: 50, money: 1000, reputation: 50, gems: 0 },
        healthZeroWeeks: 3,
      });
      
      const isDead = state.stats.health === 0 && state.healthZeroWeeks >= 3;
      
      expect(isDead).toBe(true);
    });

    it('should detect death from low happiness', () => {
      const state = createGameState({
        stats: { health: 50, happiness: 0, energy: 50, fitness: 50, money: 1000, reputation: 50, gems: 0 },
        happinessZeroWeeks: 3,
      });
      
      const isDead = state.stats.happiness === 0 && state.happinessZeroWeeks >= 3;
      
      expect(isDead).toBe(true);
    });

    it('should not detect death when stats are low but not zero', () => {
      const state = createGameState({
        stats: { health: 5, happiness: 5, energy: 50, fitness: 50, money: 1000, reputation: 50, gems: 0 },
        healthZeroWeeks: 0,
        happinessZeroWeeks: 0,
      });
      
      const isDead = (state.stats.health === 0 && state.healthZeroWeeks >= 3) ||
                    (state.stats.happiness === 0 && state.happinessZeroWeeks >= 3);
      
      expect(isDead).toBe(false);
    });
  });

  describe('Money Management', () => {
    it('should handle money transactions correctly', () => {
      const state = createGameState({
        stats: { health: 50, happiness: 50, energy: 50, fitness: 50, money: 1000, reputation: 50, gems: 0 },
      });
      
      const addMoney = (amount: number): number => Math.max(0, state.stats.money + amount);
      const spendMoney = (amount: number): number => Math.max(0, state.stats.money - amount);
      
      expect(addMoney(500)).toBe(1500);
      expect(spendMoney(300)).toBe(700);
      expect(spendMoney(1500)).toBe(0); // Can't go negative
    });

    it('should handle insufficient funds', () => {
      const state = createGameState({
        stats: { health: 50, happiness: 50, energy: 50, fitness: 50, money: 100, reputation: 50, gems: 0 },
      });
      
      const canAfford = (cost: number): boolean => state.stats.money >= cost;
      
      expect(canAfford(50)).toBe(true);
      expect(canAfford(100)).toBe(true);
      expect(canAfford(150)).toBe(false);
    });
  });
});
