import { GameState } from '@/contexts/GameContext';

// Performance measurement utilities
class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();

  startTimer(label: string): () => void {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (!this.measurements.has(label)) {
        this.measurements.set(label, []);
      }
      this.measurements.get(label)!.push(duration);
    };
  }

  getAverageTime(label: string): number {
    const times = this.measurements.get(label);
    if (!times || times.length === 0) return 0;
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  getMinTime(label: string): number {
    const times = this.measurements.get(label);
    if (!times || times.length === 0) return 0;
    return Math.min(...times);
  }

  getMaxTime(label: string): number {
    const times = this.measurements.get(label);
    if (!times || times.length === 0) return 0;
    return Math.max(...times);
  }

  clearMeasurements(): void {
    this.measurements.clear();
  }

  getAllMeasurements(): Map<string, number[]> {
    return new Map(this.measurements);
  }
}

// Mock game state generator
function createLargeGameState(): GameState {
  const generateItems = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `item_${i}`,
      name: `Item ${i}`,
      price: Math.floor(Math.random() * 1000) + 100,
      owned: Math.random() > 0.5,
      dailyBonus: { energy: Math.floor(Math.random() * 10) },
    }));
  };

  const generateCompanies = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `company_${i}`,
      name: `Company ${i}`,
      type: ['factory', 'ai', 'restaurant', 'realestate', 'bank'][Math.floor(Math.random() * 5)] as any,
      weeklyIncome: Math.floor(Math.random() * 10000) + 1000,
      baseWeeklyIncome: Math.floor(Math.random() * 10000) + 1000,
      upgrades: [],
      employees: Math.floor(Math.random() * 20) + 1,
      workerSalary: Math.floor(Math.random() * 1000) + 500,
      workerMultiplier: 1 + Math.random() * 0.5,
      marketingLevel: Math.floor(Math.random() * 5) + 1,
      warehouseLevel: 0,
      miners: {},
    }));
  };

  const generateRealEstate = (count: number) => {
    return Array.from({ length: count }, (_, i) => ({
      id: `property_${i}`,
      name: `Property ${i}`,
      price: Math.floor(Math.random() * 500000) + 50000,
      weeklyHappiness: Math.floor(Math.random() * 20),
      weeklyEnergy: Math.floor(Math.random() * 10),
      owned: Math.random() > 0.7,
      interior: ['furniture', 'electronics', 'art'],
      upgradeLevel: Math.floor(Math.random() * 5) + 1,
      rent: Math.floor(Math.random() * 2000) + 500,
      upkeep: Math.floor(Math.random() * 500) + 100,
    }));
  };

  return {
    stats: { health: 50, happiness: 50, energy: 50, fitness: 50, money: 100000, reputation: 50, gems: 100 },
    day: 1,
    week: 100,
    date: { year: 2025, month: 'December', week: 100, age: 20 },
    totalHappiness: 50,
    weeksLived: 100,
    streetJobs: [],
    careers: [],
    hobbies: [],
    items: generateItems(100),
    darkWebItems: [],
    hacks: [],
    relationships: [],
    social: { relations: [] },
    hasPhone: true,
    foods: [],
    healthActivities: [],
    dietPlans: [],
    educations: [],
    companies: generateCompanies(50),
    userProfile: { name: 'Test Player', handle: 'test', bio: '', followers: 1000, following: 500, gender: 'male', seekingGender: 'female' },
    currentJob: 'software_engineer',
    showWelcomePopup: false,
    settings: { darkMode: false, soundEnabled: true, notificationsEnabled: true, autoSave: true, language: 'English', maxStats: false },
    cryptos: [],
    diseases: [],
    realEstate: generateRealEstate(25),
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
    bankSavings: 50000,
    stocksOwned: {},
    perks: { workBoost: true, mindset: true, fastLearner: true },
    achievements: [],
    claimedProgressAchievements: [],
    lastLogin: Date.now(),
    streetJobsCompleted: 50,
    happinessZeroWeeks: 0,
    healthZeroWeeks: 0,
    showZeroStatPopup: false,
    zeroStatType: undefined,
    showDeathPopup: false,
    deathReason: undefined,
    economy: { inflationRateAnnual: 0.03, priceIndex: 1.5 },
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

// Performance test utilities
const measureFunction = (fn: () => void, iterations: number = 1000): number => {
  const startTime = performance.now();
  
  for (let i = 0; i < iterations; i++) {
    fn();
  }
  
  const endTime = performance.now();
  return (endTime - startTime) / iterations; // Average time per iteration
};

describe('Performance Tests', () => {
  let monitor: PerformanceMonitor;
  let largeGameState: GameState;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    largeGameState = createLargeGameState();
  });

  describe('Game State Operations', () => {
    it('should measure game state serialization performance', () => {
      const iterations = 100;
      
      const stopTimer = monitor.startTimer('serialization');
      
      for (let i = 0; i < iterations; i++) {
        JSON.stringify(largeGameState);
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('serialization');
      expect(avgTime).toBeLessThan(10); // Should be under 10ms per serialization
    });

    it('should measure game state deserialization performance', () => {
      const serializedState = JSON.stringify(largeGameState);
      const iterations = 100;
      
      const stopTimer = monitor.startTimer('deserialization');
      
      for (let i = 0; i < iterations; i++) {
        JSON.parse(serializedState);
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('deserialization');
      expect(avgTime).toBeLessThan(5); // Should be under 5ms per deserialization
    });

    it('should measure game state cloning performance', () => {
      const iterations = 100;
      
      const stopTimer = monitor.startTimer('cloning');
      
      for (let i = 0; i < iterations; i++) {
        JSON.parse(JSON.stringify(largeGameState));
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('cloning');
      expect(avgTime).toBeLessThan(15); // Should be under 15ms per clone
    });
  });

  describe('Array Operations', () => {
    it('should measure large array filtering performance', () => {
      const items = largeGameState.items;
      const iterations = 1000;
      
      const stopTimer = monitor.startTimer('array_filter');
      
      for (let i = 0; i < iterations; i++) {
        items.filter(item => item.owned);
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('array_filter');
      expect(avgTime).toBeLessThan(0.1); // Should be under 0.1ms per filter
    });

    it('should measure large array mapping performance', () => {
      const items = largeGameState.items;
      const iterations = 1000;
      
      const stopTimer = monitor.startTimer('array_map');
      
      for (let i = 0; i < iterations; i++) {
        items.map(item => ({ ...item, price: item.price * 1.1 }));
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('array_map');
      expect(avgTime).toBeLessThan(0.2); // Should be under 0.2ms per map
    });

    it('should measure large array reduce performance', () => {
      const items = largeGameState.items;
      const iterations = 1000;
      
      const stopTimer = monitor.startTimer('array_reduce');
      
      for (let i = 0; i < iterations; i++) {
        items.reduce((sum, item) => sum + item.price, 0);
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('array_reduce');
      expect(avgTime).toBeLessThan(0.1); // Should be under 0.1ms per reduce
    });
  });

  describe('Object Operations', () => {
    it('should measure object property access performance', () => {
      const iterations = 10000;
      
      const stopTimer = monitor.startTimer('property_access');
      
      for (let i = 0; i < iterations; i++) {
        const money = largeGameState.stats.money;
        const health = largeGameState.stats.health;
        const happiness = largeGameState.stats.happiness;
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('property_access');
      expect(avgTime).toBeLessThan(0.01); // Should be under 0.01ms per access
    });

    it('should measure object spread performance', () => {
      const iterations = 1000;
      
      const stopTimer = monitor.startTimer('object_spread');
      
      for (let i = 0; i < iterations; i++) {
        const newStats = { ...largeGameState.stats, money: largeGameState.stats.money + 100 };
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('object_spread');
      expect(avgTime).toBeLessThan(0.1); // Should be under 0.1ms per spread
    });
  });

  describe('Memory Usage', () => {
    it('should measure memory allocation for large objects', () => {
      const iterations = 100;
      const objects: GameState[] = [];
      
      const stopTimer = monitor.startTimer('memory_allocation');
      
      for (let i = 0; i < iterations; i++) {
        objects.push(createLargeGameState());
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('memory_allocation');
      expect(avgTime).toBeLessThan(50); // Should be under 50ms per allocation
      
      // Clean up
      objects.length = 0;
    });

    it('should measure garbage collection impact', () => {
      const iterations = 1000;
      
      const stopTimer = monitor.startTimer('gc_impact');
      
      for (let i = 0; i < iterations; i++) {
        const tempState = createLargeGameState();
        // Force garbage collection by not keeping reference
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('gc_impact');
      expect(avgTime).toBeLessThan(10); // Should be under 10ms per iteration
    });
  });

  describe('Game Logic Performance', () => {
    it('should measure stat calculation performance', () => {
      const iterations = 10000;
      
      const stopTimer = monitor.startTimer('stat_calculation');
      
      for (let i = 0; i < iterations; i++) {
        const totalStats = Object.values(largeGameState.stats).reduce((sum, stat) => sum + stat, 0);
        const averageStats = totalStats / Object.keys(largeGameState.stats).length;
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('stat_calculation');
      expect(avgTime).toBeLessThan(0.01); // Should be under 0.01ms per calculation
    });

    it('should measure item filtering performance', () => {
      const iterations = 1000;
      
      const stopTimer = monitor.startTimer('item_filtering');
      
      for (let i = 0; i < iterations; i++) {
        const ownedItems = largeGameState.items.filter(item => item.owned);
        const expensiveItems = largeGameState.items.filter(item => item.price > 500);
        const affordableItems = largeGameState.items.filter(item => item.price <= largeGameState.stats.money);
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('item_filtering');
      expect(avgTime).toBeLessThan(0.5); // Should be under 0.5ms per filtering operation
    });

    it('should measure company income calculation performance', () => {
      const iterations = 1000;
      
      const stopTimer = monitor.startTimer('income_calculation');
      
      for (let i = 0; i < iterations; i++) {
        const totalIncome = largeGameState.companies.reduce((sum, company) => sum + company.weeklyIncome, 0);
        const averageIncome = totalIncome / largeGameState.companies.length;
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('income_calculation');
      expect(avgTime).toBeLessThan(0.1); // Should be under 0.1ms per calculation
    });
  });

  describe('Rendering Performance', () => {
    it('should measure component render preparation performance', () => {
      const iterations = 1000;
      
      const stopTimer = monitor.startTimer('render_preparation');
      
      for (let i = 0; i < iterations; i++) {
        // Simulate preparing data for rendering
        const renderData = {
          stats: largeGameState.stats,
          items: largeGameState.items.filter(item => item.owned),
          companies: largeGameState.companies,
          realEstate: largeGameState.realEstate.filter(property => property.owned),
        };
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('render_preparation');
      expect(avgTime).toBeLessThan(1); // Should be under 1ms per preparation
    });

    it('should measure list rendering performance', () => {
      const iterations = 100;
      
      const stopTimer = monitor.startTimer('list_rendering');
      
      for (let i = 0; i < iterations; i++) {
        // Simulate rendering a list of items
        const itemList = largeGameState.items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          owned: item.owned,
        }));
      }
      
      stopTimer();
      
      const avgTime = monitor.getAverageTime('list_rendering');
      expect(avgTime).toBeLessThan(0.5); // Should be under 0.5ms per list preparation
    });
  });

  describe('Performance Benchmarks', () => {
    it('should meet performance benchmarks for critical operations', () => {
      const benchmarks = {
        'game_state_serialization': 10, // ms
        'game_state_deserialization': 5, // ms
        'array_filter_100_items': 0.1, // ms
        'array_map_100_items': 0.2, // ms
        'object_spread': 0.1, // ms
        'stat_calculation': 0.01, // ms
        'item_filtering': 0.5, // ms
        'income_calculation': 0.1, // ms
      };

      // Run all performance tests
      const testResults = new Map<string, number>();

      // Game state serialization
      testResults.set('game_state_serialization', measureFunction(() => {
        JSON.stringify(largeGameState);
      }, 100));

      // Game state deserialization
      const serializedState = JSON.stringify(largeGameState);
      testResults.set('game_state_deserialization', measureFunction(() => {
        JSON.parse(serializedState);
      }, 100));

      // Array operations
      testResults.set('array_filter_100_items', measureFunction(() => {
        largeGameState.items.filter(item => item.owned);
      }, 1000));

      testResults.set('array_map_100_items', measureFunction(() => {
        largeGameState.items.map(item => ({ ...item, price: item.price * 1.1 }));
      }, 1000));

      // Object operations
      testResults.set('object_spread', measureFunction(() => {
        const newStats = { ...largeGameState.stats, money: largeGameState.stats.money + 100 };
      }, 1000));

      // Game logic
      testResults.set('stat_calculation', measureFunction(() => {
        const totalStats = Object.values(largeGameState.stats).reduce((sum, stat) => sum + stat, 0);
      }, 10000));

      testResults.set('item_filtering', measureFunction(() => {
        const ownedItems = largeGameState.items.filter(item => item.owned);
        const expensiveItems = largeGameState.items.filter(item => item.price > 500);
      }, 1000));

      testResults.set('income_calculation', measureFunction(() => {
        const totalIncome = largeGameState.companies.reduce((sum, company) => sum + company.weeklyIncome, 0);
      }, 1000));

      // Check all benchmarks
      for (const [operation, benchmark] of Object.entries(benchmarks)) {
        const actualTime = testResults.get(operation) || 0;
        expect(actualTime).toBeLessThan(benchmark);
      }
    });
  });
});
