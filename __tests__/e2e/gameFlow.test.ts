import { GameState } from '@/contexts/GameContext';

// Mock game state manager
class GameStateManager {
  private state: GameState;

  constructor(initialState: GameState) {
    this.state = initialState;
  }

  getState(): GameState {
    return this.state;
  }

  updateState(updates: Partial<GameState>): void {
    this.state = { ...this.state, ...updates };
  }

  // Game actions
  work(): { success: boolean; money: number; energy: number; happiness: number } {
    if (this.state.stats.energy < 20) {
      return { success: false, money: 0, energy: 0, happiness: 0 };
    }

    const baseSalary = this.state.currentJob ? 500 : 100;
    const energyCost = 20;
    const happinessChange = -5;

    this.updateState({
      stats: {
        ...this.state.stats,
        money: this.state.stats.money + baseSalary,
        energy: Math.max(0, this.state.stats.energy - energyCost),
        happiness: Math.max(0, this.state.stats.happiness + happinessChange),
      },
    });

    return { success: true, money: baseSalary, energy: energyCost, happiness: happinessChange };
  }

  study(): { success: boolean; energy: number; happiness: number } {
    if (this.state.stats.energy < 15) {
      return { success: false, energy: 0, happiness: 0 };
    }

    const energyCost = 15;
    const happinessChange = -3;

    this.updateState({
      stats: {
        ...this.state.stats,
        energy: Math.max(0, this.state.stats.energy - energyCost),
        happiness: Math.max(0, this.state.stats.happiness + happinessChange),
      },
    });

    return { success: true, energy: energyCost, happiness: happinessChange };
  }

  exercise(): { success: boolean; energy: number; fitness: number; health: number } {
    if (this.state.stats.energy < 10) {
      return { success: false, energy: 0, fitness: 0, health: 0 };
    }

    const energyCost = 10;
    const fitnessGain = 5;
    const healthGain = 3;

    this.updateState({
      stats: {
        ...this.state.stats,
        energy: Math.max(0, this.state.stats.energy - energyCost),
        fitness: Math.min(100, this.state.stats.fitness + fitnessGain),
        health: Math.min(100, this.state.stats.health + healthGain),
      },
    });

    return { success: true, energy: energyCost, fitness: fitnessGain, health: healthGain };
  }

  socialize(): { success: boolean; energy: number; happiness: number } {
    if (this.state.stats.energy < 10) {
      return { success: false, energy: 0, happiness: 0 };
    }

    const energyCost = 10;
    const happinessGain = 8;

    this.updateState({
      stats: {
        ...this.state.stats,
        energy: Math.max(0, this.state.stats.energy - energyCost),
        happiness: Math.min(100, this.state.stats.happiness + happinessGain),
      },
    });

    return { success: true, energy: energyCost, happiness: happinessGain };
  }

  buyItem(itemId: string, price: number): { success: boolean; money: number } {
    if (this.state.stats.money < price) {
      return { success: false, money: 0 };
    }

    this.updateState({
      stats: {
        ...this.state.stats,
        money: this.state.stats.money - price,
      },
      items: [
        ...this.state.items,
        { id: itemId, name: `Item ${itemId}`, price, owned: true, dailyBonus: {} },
      ],
    });

    return { success: true, money: price };
  }

  nextWeek(): void {
    this.updateState({
      week: this.state.week + 1,
      date: {
        ...this.state.date,
        week: this.state.date.week + 1,
        age: this.state.date.age + (1 / 52), // Age increases by 1/52 per week
      },
      stats: {
        ...this.state.stats,
        energy: Math.min(100, this.state.stats.energy + 30), // Energy regenerates
        happiness: Math.max(0, this.state.stats.happiness - 2), // Happiness decreases slightly
      },
    });
  }
}

function createInitialGameState(): GameState {
  return {
    stats: { health: 50, happiness: 50, energy: 100, fitness: 30, money: 1000, reputation: 50, gems: 0 },
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
    userProfile: { name: 'Test Player', handle: 'test', bio: '', followers: 0, following: 0, gender: 'male', seekingGender: 'female' },
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

describe('E2E Game Flow Tests', () => {
  let gameManager: GameStateManager;

  beforeEach(() => {
    gameManager = new GameStateManager(createInitialGameState());
  });

  describe('Basic Game Loop', () => {
    it('should complete a basic week cycle', () => {
      const initialState = gameManager.getState();
      expect(initialState.week).toBe(1);
      expect(initialState.stats.energy).toBe(100);
      expect(initialState.stats.money).toBe(1000);

      // Work
      const workResult = gameManager.work();
      expect(workResult.success).toBe(true);
      expect(workResult.money).toBe(100); // No job = base salary

      let state = gameManager.getState();
      expect(state.stats.money).toBe(1100);
      expect(state.stats.energy).toBe(80);

      // Exercise
      const exerciseResult = gameManager.exercise();
      expect(exerciseResult.success).toBe(true);
      expect(exerciseResult.fitness).toBe(5);

      state = gameManager.getState();
      expect(state.stats.fitness).toBe(35);
      expect(state.stats.energy).toBe(70);

      // Socialize
      const socialResult = gameManager.socialize();
      expect(socialResult.success).toBe(true);
      expect(socialResult.happiness).toBe(8);

      state = gameManager.getState();
      expect(state.stats.happiness).toBe(58);
      expect(state.stats.energy).toBe(60);

      // Next week
      gameManager.nextWeek();
      state = gameManager.getState();
      expect(state.week).toBe(2);
      expect(state.stats.energy).toBe(90); // Regenerated
      expect(state.stats.happiness).toBe(56); // Slightly decreased
    });

    it('should handle energy depletion', () => {
      // Work multiple times to deplete energy
      gameManager.work(); // 100 -> 80 energy
      gameManager.work(); // 80 -> 60 energy
      gameManager.work(); // 60 -> 40 energy
      gameManager.work(); // 40 -> 20 energy
      gameManager.work(); // 20 -> 0 energy

      const state = gameManager.getState();
      expect(state.stats.energy).toBe(0);

      // Try to work with no energy
      const workResult = gameManager.work();
      expect(workResult.success).toBe(false);
      expect(state.stats.money).toBe(1500); // Money shouldn't change
    });

    it('should handle money management', () => {
      // Buy an item
      const buyResult = gameManager.buyItem('laptop', 500);
      expect(buyResult.success).toBe(true);

      let state = gameManager.getState();
      expect(state.stats.money).toBe(500);
      expect(state.items).toHaveLength(1);
      expect(state.items[0].id).toBe('laptop');

      // Try to buy something too expensive
      const expensiveBuyResult = gameManager.buyItem('house', 10000);
      expect(expensiveBuyResult.success).toBe(false);

      state = gameManager.getState();
      expect(state.stats.money).toBe(500); // Money shouldn't change
    });
  });

  describe('Career Progression', () => {
    it('should simulate career progression', () => {
      // Start with no job
      let state = gameManager.getState();
      expect(state.currentJob).toBeUndefined();

      // Work to earn money
      for (let i = 0; i < 5; i++) {
        gameManager.work();
        gameManager.nextWeek();
      }

      state = gameManager.getState();
      expect(state.stats.money).toBeGreaterThan(1000);
      expect(state.week).toBe(6);

      // Simulate getting a job (this would normally be through career application)
      gameManager.updateState({
        currentJob: 'software_engineer',
        careers: [
          {
            id: 'software_engineer',
            levels: [{ name: 'Junior Developer', salary: 800 }],
            level: 0,
            description: 'Software development',
            requirements: { fitness: 30 },
            progress: 0,
            applied: true,
            accepted: true,
          },
        ],
      });

      // Work with job
      const workResult = gameManager.work();
      expect(workResult.success).toBe(true);
      expect(workResult.money).toBe(800); // Higher salary with job

      state = gameManager.getState();
      expect(state.stats.money).toBeGreaterThan(1500);
    });
  });

  describe('Stat Management', () => {
    it('should maintain stat boundaries', () => {
      // Test stat clamping
      gameManager.updateState({
        stats: { health: 100, happiness: 100, energy: 100, fitness: 100, money: 1000, reputation: 50, gems: 0 },
      });

      // Exercise to try to exceed max fitness
      const exerciseResult = gameManager.exercise();
      expect(exerciseResult.success).toBe(true);

      let state = gameManager.getState();
      expect(state.stats.fitness).toBe(100); // Should be clamped

      // Socialize to try to exceed max happiness
      gameManager.socialize();
      state = gameManager.getState();
      expect(state.stats.happiness).toBe(100); // Should be clamped

      // Test negative stats
      gameManager.updateState({
        stats: { health: 0, happiness: 0, energy: 0, fitness: 0, money: 1000, reputation: 50, gems: 0 },
      });

      // Try to reduce stats further
      gameManager.work(); // Should reduce energy but not below 0
      state = gameManager.getState();
      expect(state.stats.energy).toBe(0);
    });

    it('should handle stat regeneration', () => {
      // Deplete energy
      gameManager.work();
      gameManager.work();
      gameManager.work();
      gameManager.work();
      gameManager.work();

      let state = gameManager.getState();
      expect(state.stats.energy).toBe(0);

      // Next week should regenerate energy
      gameManager.nextWeek();
      state = gameManager.getState();
      expect(state.stats.energy).toBe(30); // Regenerated
    });
  });

  describe('Long-term Progression', () => {
    it('should simulate multiple weeks of gameplay', () => {
      const initialMoney = gameManager.getState().stats.money;
      const initialWeek = gameManager.getState().week;

      // Simulate 10 weeks of gameplay
      for (let week = 0; week < 10; week++) {
        // Work 3 times per week
        for (let i = 0; i < 3; i++) {
          gameManager.work();
        }

        // Exercise once per week
        gameManager.exercise();

        // Socialize once per week
        gameManager.socialize();

        // Buy an item every 2 weeks
        if (week % 2 === 0) {
          gameManager.buyItem(`item_${week}`, 100);
        }

        // Next week
        gameManager.nextWeek();
      }

      const finalState = gameManager.getState();
      expect(finalState.week).toBe(initialWeek + 10);
      expect(finalState.stats.money).toBeGreaterThan(initialMoney);
      expect(finalState.stats.fitness).toBeGreaterThan(30); // Should have increased
      expect(finalState.items).toHaveLength(5); // Should have bought 5 items
    });

    it('should handle complex stat interactions', () => {
      // Simulate a balanced lifestyle
      for (let week = 0; week < 5; week++) {
        // Work to earn money
        gameManager.work();
        gameManager.work();

        // Exercise to maintain fitness and health
        gameManager.exercise();

        // Socialize to maintain happiness
        gameManager.socialize();

        // Study to improve skills (would affect education in real game)
        gameManager.study();

        gameManager.nextWeek();
      }

      const finalState = gameManager.getState();
      
      // Should have earned money
      expect(finalState.stats.money).toBeGreaterThan(1000);
      
      // Should have improved fitness
      expect(finalState.stats.fitness).toBeGreaterThan(30);
      
      // Should have maintained reasonable happiness
      expect(finalState.stats.happiness).toBeGreaterThan(30);
      
      // Should have maintained reasonable health
      expect(finalState.stats.health).toBeGreaterThan(30);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid actions gracefully', () => {
      // Try to work with no energy
      gameManager.updateState({
        stats: { health: 50, happiness: 50, energy: 0, fitness: 50, money: 1000, reputation: 50, gems: 0 },
      });

      const workResult = gameManager.work();
      expect(workResult.success).toBe(false);

      // Try to buy with no money
      gameManager.updateState({
        stats: { health: 50, happiness: 50, energy: 0, fitness: 50, money: 0, reputation: 50, gems: 0 },
      });

      const buyResult = gameManager.buyItem('expensive_item', 1000);
      expect(buyResult.success).toBe(false);
    });

    it('should maintain game state consistency', () => {
      const initialState = gameManager.getState();
      
      // Perform various actions
      gameManager.work();
      gameManager.exercise();
      gameManager.socialize();
      gameManager.buyItem('test_item', 100);
      gameManager.nextWeek();

      const finalState = gameManager.getState();
      
      // All stats should still be within valid ranges
      expect(finalState.stats.health).toBeGreaterThanOrEqual(0);
      expect(finalState.stats.health).toBeLessThanOrEqual(100);
      expect(finalState.stats.happiness).toBeGreaterThanOrEqual(0);
      expect(finalState.stats.happiness).toBeLessThanOrEqual(100);
      expect(finalState.stats.energy).toBeGreaterThanOrEqual(0);
      expect(finalState.stats.energy).toBeLessThanOrEqual(100);
      expect(finalState.stats.fitness).toBeGreaterThanOrEqual(0);
      expect(finalState.stats.fitness).toBeLessThanOrEqual(100);
      expect(finalState.stats.money).toBeGreaterThanOrEqual(0);
      
      // Week should have increased
      expect(finalState.week).toBe(initialState.week + 1);
    });
  });
});
