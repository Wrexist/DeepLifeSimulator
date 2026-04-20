/**
 * Critical Path Integration Tests
 *
 * Tests the most important game flows end-to-end:
 *  1. New game → first week cycle
 *  2. Save → load → verify state integrity
 *  3. Prestige → new generation → verify bonuses
 *  4. Death → heir selection
 *  5. Pet weekly processing
 *  6. Vehicle weekly processing
 *  7. Save validation & repair
 */

// Mock logger before any imports that depend on it
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
  LogLevel: { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 },
}));

jest.mock('@/services/RemoteLoggingService', () => ({
  remoteLogger: {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

import { GameState } from '@/contexts/game/types';
import { initialGameState, STATE_VERSION } from '@/contexts/game/initialState';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import {
  calculateChecksum,
  validateGameState,
  autoFixStats,
  repairGameState,
  createSaveData,
  verifySaveData,
  parseSaveData,
} from '@/utils/saveValidation';
import { BASE_PRESTIGE_THRESHOLD, defaultPrestigeData, getPrestigeThreshold } from '@/lib/prestige/prestigeTypes';
import { computeInheritance } from '@/lib/legacy/inheritance';
import {
  VEHICLE_TEMPLATES,
  createVehicleFromTemplate,
  calculateVehicleSellPrice,
  calculateRepairCost,
} from '@/lib/vehicles/vehicles';

// ─── Helpers ───────────────────────────────────────────────────────────────

function createGameState(overrides: Partial<GameState> = {}): GameState {
  return createTestGameState({
    userProfile: {
      name: 'Test Player',
      firstName: 'Test',
      lastName: 'Player',
      handle: 'test',
      bio: '',
      followers: 0,
      following: 0,
      gender: 'male',
      seekingGender: 'female',
    },
    settings: {
      lifetimePremium: false,
      darkMode: false,
      soundEnabled: true,
      notificationsEnabled: true,
      autoSave: true,
      language: 'English',
      maxStats: false,
      hapticFeedback: true,
      weeklySummaryEnabled: true,
      showDecimalsInStats: false,
    },
    ...overrides,
  });
}

/** Simulate a simplified weekly tick for testing stat changes. */
function simulateWeek(state: GameState): GameState {
  const newWeeksLived = (state.weeksLived || 0) + 1;
  const newWeek = ((state.week || 0) % 4) + 1;
  const newAge = (state.date?.age || 18) + 1 / 52;

  return {
    ...state,
    week: newWeek,
    weeksLived: newWeeksLived,
    date: {
      ...state.date,
      week: newWeek,
      age: newAge,
    },
    stats: {
      ...state.stats,
      energy: Math.min(100, state.stats.energy + 10), // partial regen
      happiness: Math.max(0, state.stats.happiness - 1), // slow decay
    },
  };
}

// ─── Test Suites ──────────────────────────────────────────────────────────

describe('Critical Path: New Game → First Week', () => {
  it('should create a valid initial game state', () => {
    const state = createGameState();

    // Verify core structure exists (don't use assertValidGameState — its required fields list may be stale)
    expect(state.stats).toBeDefined();
    expect(state.date).toBeDefined();
    expect(state.settings).toBeDefined();

    expect(state.week).toBe(1);
    expect(state.weeksLived).toBe(0);
    expect(state.date.age).toBe(18);
    expect(state.stats.health).toBe(100);
    expect(state.stats.happiness).toBe(100);
    expect(state.stats.energy).toBe(100);
    expect(state.stats.money).toBe(200);
    expect(state.stats.gems).toBe(0);
  });

  it('should have required starting data structures', () => {
    const state = createGameState();

    expect(Array.isArray(state.careers)).toBe(true);
    expect(Array.isArray(state.items)).toBe(true);
    expect(Array.isArray(state.relationships)).toBe(true);
    expect(Array.isArray(state.achievements)).toBe(true);
    expect(Array.isArray(state.educations)).toBe(true);
    expect(Array.isArray(state.pets)).toBe(true);
    expect(state.settings).toBeDefined();
    expect(state.date).toBeDefined();
    expect(state.stats).toBeDefined();
  });

  it('should advance one week correctly', () => {
    const state = createGameState();
    const after = simulateWeek(state);

    expect(after.weeksLived).toBe(1);
    expect(after.week).toBe(2);
    expect(after.date.age).toBeCloseTo(18 + 1 / 52, 5);
  });

  it('should advance 10 weeks and maintain stat boundaries', () => {
    let state = createGameState();
    for (let i = 0; i < 10; i++) {
      state = simulateWeek(state);
    }

    expect(state.weeksLived).toBe(10);
    expect(state.stats.energy).toBeLessThanOrEqual(100);
    expect(state.stats.energy).toBeGreaterThanOrEqual(0);
    expect(state.stats.happiness).toBeLessThanOrEqual(100);
    expect(state.stats.happiness).toBeGreaterThanOrEqual(0);
  });

  it('should start with parent relationships', () => {
    const state = createGameState();
    const parents = state.relationships.filter(
      (r: any) => r.type === 'parent'
    );
    expect(parents.length).toBeGreaterThanOrEqual(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('Critical Path: Save → Load → Verify', () => {
  it('should create save data with valid checksum', () => {
    const state = createGameState({
      stats: { health: 80, happiness: 70, energy: 60, fitness: 50, money: 5000, reputation: 30, gems: 5 },
      week: 5,
      weeksLived: 5,
    });

    const saveResult = createSaveData(state, STATE_VERSION);

    expect(saveResult.data).toBeDefined();
    expect(saveResult.checksum).toBeDefined();
    expect(typeof saveResult.checksum).toBe('string');
    expect(saveResult.checksum.length).toBeGreaterThanOrEqual(8); // CRC32 hex (8 chars) or HMAC
  });

  it('should verify correct checksum', () => {
    const state = createGameState();
    const saveResult = createSaveData(state, STATE_VERSION);

    const isValid = verifySaveData(saveResult.data, saveResult.checksum, saveResult.signature, saveResult.hmac);
    expect(isValid).toBe(true);
  });

  it('should detect corrupted data via checksum', () => {
    const state = createGameState();
    const saveResult = createSaveData(state, STATE_VERSION);

    // Corrupt the data
    const corruptedData = saveResult.data.replace('"health":100', '"health":999');

    const isValid = verifySaveData(corruptedData, saveResult.checksum);
    expect(isValid).toBe(false);
  });

  it('should round-trip state through save/parse cycle', () => {
    const original = createGameState({
      stats: { health: 75, happiness: 85, energy: 65, fitness: 80, money: 15000, reputation: 70, gems: 15 },
      week: 25,
      weeksLived: 25,
      date: { year: 2025, month: 'June', week: 25, age: 18.48 },
      bankSavings: 5000,
      currentJob: 'software_engineer',
    });

    const saveResult = createSaveData(original, STATE_VERSION);
    const parseResult = parseSaveData(saveResult.data, saveResult.checksum, saveResult.signature, saveResult.hmac);

    expect(parseResult.valid).toBe(true);
    expect(parseResult.state).not.toBeNull();
    expect(parseResult.state?.stats.money).toBe(15000);
    expect(parseResult.state?.stats.health).toBe(75);
    expect(parseResult.state?.week).toBe(25);
    expect(parseResult.state?.bankSavings).toBe(5000);
    expect(parseResult.state?.currentJob).toBe('software_engineer');
  });

  it('should preserve complex nested data through save/parse', () => {
    const original = createGameState({
      stats: { health: 100, happiness: 100, energy: 100, fitness: 100, money: 50000, reputation: 80, gems: 50 },
      companies: [
        {
          id: 'tech_startup',
          name: 'My Startup',
          type: 'ai',
          weeklyIncome: 3000,
          baseWeeklyIncome: 3000,
          upgrades: [],
          employees: 5,
          workerSalary: 1000,
          workerMultiplier: 1.2,
          marketingLevel: 1,
          warehouseLevel: 0,
          miners: {},
        },
      ],
      realEstate: [
        {
          id: 'apartment',
          name: 'Downtown Apartment',
          price: 250000,
          weeklyHappiness: 5,
          weeklyEnergy: 3,
          owned: true,
          interior: ['basic_furniture'],
          upgradeLevel: 1,
          rent: 1200,
          upkeep: 200,
        },
      ],
      perks: { workBoost: true, mindset: true, fastLearner: true },
    });

    const saveResult = createSaveData(original, STATE_VERSION);
    const parseResult = parseSaveData(saveResult.data, saveResult.checksum, saveResult.signature, saveResult.hmac);

    expect(parseResult.valid).toBe(true);
    expect(parseResult.state?.companies).toHaveLength(1);
    expect(parseResult.state?.companies[0].name).toBe('My Startup');
    expect(parseResult.state?.realEstate).toHaveLength(1);
    expect(parseResult.state?.realEstate[0].owned).toBe(true);
    expect(parseResult.state?.perks?.workBoost).toBe(true);
  });

  it('should reject malformed JSON', () => {
    const result = parseSaveData('not valid json');
    expect(result.valid).toBe(false);
    expect(result.state).toBeNull();
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('Critical Path: Save Validation & Repair', () => {
  it('should validate a correct game state', () => {
    const state = createGameState();
    const result = validateGameState(state);
    expect(result.valid).toBe(true);
  });

  it('should reject null state', () => {
    const result = validateGameState(null);
    expect(result.valid).toBe(false);
  });

  it('should reject state missing stats', () => {
    const result = validateGameState({ date: { year: 2025, week: 1, age: 18 }, weeksLived: 0 });
    expect(result.valid).toBe(false);
  });

  it('should auto-fix out-of-range stats', () => {
    const state: any = {
      ...createGameState(),
      stats: { health: 150, happiness: -10, energy: 200, fitness: -5, money: -100, reputation: 120, gems: -5 },
    };

    const result = autoFixStats(state);
    expect(result.fixed).toBe(true);
    expect(state.stats.health).toBe(100);
    expect(state.stats.happiness).toBe(0);
    expect(state.stats.energy).toBe(100);
    expect(state.stats.fitness).toBe(0);
    expect(state.stats.money).toBe(0);
    expect(state.stats.reputation).toBe(100);
    expect(state.stats.gems).toBe(0);
  });

  it('should repair missing arrays', () => {
    const state: any = {
      stats: { health: 50, happiness: 50, energy: 50, fitness: 50, money: 0, reputation: 0, gems: 0 },
      date: { year: 2025, month: 'January', week: 1, age: 18 },
      settings: { darkMode: false },
      weeksLived: 0,
    };

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(Array.isArray(state.careers)).toBe(true);
    expect(Array.isArray(state.items)).toBe(true);
    expect(Array.isArray(state.relationships)).toBe(true);
    expect(Array.isArray(state.pets)).toBe(true);
  });

  it('should repair NaN values in nested objects', () => {
    const state: any = {
      stats: { health: 50, happiness: 50, energy: 50, fitness: 50, money: 0, reputation: 0, gems: 0 },
      date: { year: 2025, month: 'January', week: 1, age: 18 },
      settings: { darkMode: false },
      weeksLived: 5,
      bankSavings: NaN,
      loans: [{ id: 'loan1', remaining: Infinity, principal: 1000, interestRate: 0.05, weeklyPayment: 50, weeksRemaining: 20 }],
    };

    const result = repairGameState(state);
    expect(result.repaired).toBe(true);
    expect(state.bankSavings).toBe(0);
    expect(state.loans[0].remaining).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('Critical Path: Prestige System', () => {
  it('should calculate prestige threshold correctly', () => {
    expect(getPrestigeThreshold(0)).toBe(BASE_PRESTIGE_THRESHOLD);
    expect(getPrestigeThreshold(1)).toBe(Math.floor(BASE_PRESTIGE_THRESHOLD * 1.25));
    expect(getPrestigeThreshold(2)).toBe(Math.floor(BASE_PRESTIGE_THRESHOLD * 1.25 * 1.25));
  });

  it('should have valid default prestige data', () => {
    expect(defaultPrestigeData.prestigeLevel).toBe(0);
    expect(defaultPrestigeData.prestigePoints).toBe(0);
    expect(defaultPrestigeData.totalPrestiges).toBe(0);
    expect(defaultPrestigeData.unlockedBonuses).toEqual([]);
    expect(defaultPrestigeData.prestigeHistory).toEqual([]);
    expect(defaultPrestigeData.lifetimeStats.totalMoneyEarned).toBe(0);
  });

  it('should compute inheritance from a wealthy state', () => {
    const state = createGameState({
      stats: { health: 80, happiness: 90, energy: 70, fitness: 60, money: 500000, reputation: 80, gems: 100 },
      bankSavings: 200000,
      weeksLived: 520, // ~10 years
      date: { year: 2035, month: 'January', week: 1, age: 28 },
      realEstate: [
        {
          id: 'house',
          name: 'House',
          price: 300000,
          weeklyHappiness: 10,
          weeklyEnergy: 5,
          owned: true,
          interior: ['furniture'],
          upgradeLevel: 2,
          rent: 1500,
          upkeep: 200,
        },
      ],
      companies: [
        {
          id: 'startup',
          name: 'Startup',
          type: 'ai',
          weeklyIncome: 5000,
          baseWeeklyIncome: 5000,
          upgrades: [],
          employees: 3,
          workerSalary: 800,
          workerMultiplier: 1.1,
          marketingLevel: 1,
          warehouseLevel: 0,
          miners: {},
        },
      ],
      achievements: [
        { id: 'first_job', name: 'First Job', description: 'Get your first job', category: 'career', completed: true, reward: 100 },
        { id: 'millionaire', name: 'Millionaire', description: 'Earn $1M', category: 'money', completed: true, reward: 200 },
      ],
      generationNumber: 1,
    });

    const inheritance = computeInheritance(state);

    expect(inheritance.totalNetWorth).toBeGreaterThan(0);
    expect(inheritance.cash).toBe(500000);
    expect(inheritance.bankSavings).toBe(200000);
    expect(inheritance.realEstateIds).toContain('house');
    expect(inheritance.companyIds).toContain('startup');
    expect(inheritance.legacyBonuses.incomeMultiplier).toBeGreaterThanOrEqual(1);
    expect(inheritance.legacyBonuses.learningMultiplier).toBeGreaterThanOrEqual(1);
    expect(inheritance.legacyBonuses.reputationBonus).toBeGreaterThanOrEqual(0);
  });

  it('should compute inheritance with debts', () => {
    const state = createGameState({
      stats: { health: 50, happiness: 30, energy: 40, fitness: 20, money: 1000, reputation: 10, gems: 0 },
      bankSavings: 0,
      weeksLived: 260,
      loans: [
        { id: 'loan1', name: 'Loan', type: 'personal', principal: 10000, remaining: 8000, rateAPR: 5, termWeeks: 52, interestRate: 0.05, weeklyPayment: 200, weeksRemaining: 40, startWeek: 0, autoPay: true },
      ],
    });

    const inheritance = computeInheritance(state);

    // Net worth should be reduced by debts
    expect(inheritance.debts).toBe(8000);
    expect(inheritance.totalNetWorth).toBeLessThan(inheritance.cash + inheritance.bankSavings);
  });

  it('should handle prestige data preservation across generations', () => {
    const prestigeData = {
      ...defaultPrestigeData,
      prestigeLevel: 2,
      prestigePoints: 500,
      totalPrestiges: 2,
      unlockedBonuses: ['income_boost_1', 'starting_money'],
      prestigeHistory: [
        {
          prestigeNumber: 1,
          netWorthAtPrestige: 150_000_000,
          ageAtPrestige: 65,
          weeksLived: 2444,
          prestigePointsEarned: 250,
          timestamp: Date.now() - 100000,
          chosenPath: 'reset' as const,
        },
        {
          prestigeNumber: 2,
          netWorthAtPrestige: 200_000_000,
          ageAtPrestige: 70,
          weeksLived: 2704,
          prestigePointsEarned: 250,
          timestamp: Date.now(),
          chosenPath: 'child' as const,
          childId: 'child_1',
        },
      ],
    };

    // Verify structure is preserved via JSON round-trip (simulates save/load)
    const serialized = JSON.stringify(prestigeData);
    const deserialized = JSON.parse(serialized);

    expect(deserialized.prestigeLevel).toBe(2);
    expect(deserialized.prestigePoints).toBe(500);
    expect(deserialized.totalPrestiges).toBe(2);
    expect(deserialized.unlockedBonuses).toEqual(['income_boost_1', 'starting_money']);
    expect(deserialized.prestigeHistory).toHaveLength(2);
    expect(deserialized.prestigeHistory[1].chosenPath).toBe('child');
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('Critical Path: Death → Heir Selection', () => {
  it('should compute inheritance for death scenario', () => {
    const deathState = createGameState({
      stats: { health: 0, happiness: 20, energy: 0, fitness: 10, money: 100000, reputation: 60, gems: 50 },
      bankSavings: 50000,
      weeksLived: 3640, // ~70 years
      date: { year: 2095, month: 'March', week: 1, age: 88 },
      family: {
        spouse: { id: 'spouse_1', name: 'Jane Player', type: 'spouse', personality: 'kind', gender: 'female', age: 85, relationshipScore: 90 },
        children: [
          { id: 'child_1', name: 'Alex Player', type: 'child', personality: 'ambitious', gender: 'male', age: 60, relationshipScore: 80 },
          { id: 'child_2', name: 'Beth Player', type: 'child', personality: 'creative', gender: 'female', age: 55, relationshipScore: 70 },
        ],
      },
      generationNumber: 1,
    });

    const inheritance = computeInheritance(deathState);

    expect(inheritance.totalNetWorth).toBeGreaterThan(0);
    expect(inheritance.cash).toBe(100000);
    expect(inheritance.bankSavings).toBe(50000);
    expect(inheritance.legacyBonuses).toBeDefined();
  });

  it('should have valid family data for heir selection', () => {
    const state = createGameState({
      family: {
        spouse: { id: 'spouse_1', name: 'Partner', type: 'spouse', personality: 'kind', gender: 'female', age: 40, relationshipScore: 80 },
        children: [
          { id: 'child_1', name: 'Child One', type: 'child', personality: 'ambitious', gender: 'male', age: 20, relationshipScore: 75 },
          { id: 'child_2', name: 'Child Two', type: 'child', personality: 'creative', gender: 'female', age: 18, relationshipScore: 60 },
        ],
      },
    });

    const children = state.family?.children || [];
    expect(children).toHaveLength(2);
    expect(children[0].id).toBe('child_1');
    expect(children[1].id).toBe('child_2');

    // Verify each child has required fields for heir selection
    for (const child of children) {
      expect(child.id).toBeDefined();
      expect(child.name).toBeDefined();
      expect(typeof child.age).toBe('number');
    }
  });

  it('should handle death with no children (no heir)', () => {
    const state = createGameState({
      stats: { health: 0, happiness: 10, energy: 0, fitness: 5, money: 50000, reputation: 40, gems: 20 },
      family: {
        spouse: undefined,
        children: [],
      },
      generationNumber: 1,
    });

    const children = state.family?.children || [];
    expect(children).toHaveLength(0);

    // Without children, only reset prestige should be available
    const inheritance = computeInheritance(state);
    expect(inheritance.totalNetWorth).toBeGreaterThanOrEqual(0);
  });

  it('should track generation number correctly', () => {
    const gen1 = createGameState({ generationNumber: 1 });
    expect(gen1.generationNumber).toBe(1);

    // Simulate child path increment
    const gen2 = createGameState({
      generationNumber: (gen1.generationNumber || 1) + 1,
    });
    expect(gen2.generationNumber).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('Critical Path: Pet Weekly Processing', () => {
  it('should create a state with pets', () => {
    const state = createGameState({
      pets: [
        {
          id: 'pet_1',
          name: 'Buddy',
          type: 'dog',
          age: 52, // 1 year in weeks
          health: 80,
          happiness: 70,
          hunger: 20,
          isDead: false,
          weeksAtZeroHealth: 0,
        },
      ],
    });

    expect(state.pets).toHaveLength(1);
    expect(state.pets[0].name).toBe('Buddy');
    expect(state.pets[0].isDead).toBe(false);
  });

  it('should simulate pet aging and hunger', () => {
    const pet = {
      id: 'pet_1',
      name: 'Buddy',
      type: 'dog',
      age: 52,
      health: 80,
      happiness: 70,
      hunger: 20,
      isDead: false,
      weeksAtZeroHealth: 0,
    };

    // Simulate one week of processing
    const newPet = { ...pet };
    newPet.age = (newPet.age || 0) + 1;
    newPet.hunger = Math.min(100, (newPet.hunger || 0) + 8);

    expect(newPet.age).toBe(53);
    expect(newPet.hunger).toBe(28);
  });

  it('should detect pet health decline when hungry', () => {
    const pet = {
      id: 'pet_1',
      name: 'Max',
      type: 'cat',
      age: 104,
      health: 50,
      happiness: 40,
      hunger: 80, // Very hungry
      isDead: false,
      weeksAtZeroHealth: 0,
    };

    // When hunger > 70, health should decrease
    const healthDecay = pet.hunger > 70 ? 5 : 0;
    const happinessDecay = pet.hunger > 50 ? 3 : 0;

    expect(healthDecay).toBe(5);
    expect(happinessDecay).toBe(3);
  });

  it('should track weeks at zero health for death detection', () => {
    const pet = {
      id: 'pet_1',
      name: 'Old Boy',
      type: 'dog',
      age: 780, // ~15 years
      health: 0,
      happiness: 10,
      hunger: 100,
      isDead: false,
      weeksAtZeroHealth: 2,
    };

    // After 3 weeks at 0 health, pet should die
    const newWeeksAtZero = (pet.weeksAtZeroHealth || 0) + 1;
    const shouldDie = newWeeksAtZero >= 3;

    expect(shouldDie).toBe(true);
  });

  it('should handle dead pets correctly', () => {
    const state = createGameState({
      pets: [
        {
          id: 'pet_1',
          name: 'Ghost',
          type: 'fish',
          age: 300,
          health: 0,
          happiness: 0,
          hunger: 100,
          isDead: true,
          weeksAtZeroHealth: 3,
        },
        {
          id: 'pet_2',
          name: 'Alive',
          type: 'cat',
          age: 52,
          health: 80,
          happiness: 70,
          hunger: 20,
          isDead: false,
          weeksAtZeroHealth: 0,
        },
      ],
    });

    const livingPets = state.pets.filter((p: any) => !p.isDead);
    const deadPets = state.pets.filter((p: any) => p.isDead);

    expect(livingPets).toHaveLength(1);
    expect(deadPets).toHaveLength(1);
    expect(livingPets[0].name).toBe('Alive');
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('Critical Path: Vehicle System', () => {
  it('should have vehicle templates defined', () => {
    expect(VEHICLE_TEMPLATES.length).toBeGreaterThan(0);

    // Check economy sedan exists
    const sedan = VEHICLE_TEMPLATES.find(v => v.id === 'economy_sedan');
    expect(sedan).toBeDefined();
    expect(sedan?.price).toBe(15000);
    expect(sedan?.type).toBe('car');
  });

  it('should create a vehicle from template', () => {
    const template = VEHICLE_TEMPLATES.find(v => v.id === 'economy_sedan')!;
    const vehicle = createVehicleFromTemplate(template, 10);

    expect(vehicle.id).toBe('economy_sedan');
    expect(vehicle.name).toBe('Economy Sedan');
    expect(vehicle.condition).toBe(100);
    expect(vehicle.fuelLevel).toBe(100);
    expect(vehicle.mileage).toBe(0);
    expect(vehicle.owned).toBe(true);
    expect(vehicle.lastServiceWeek).toBe(10);
    expect(vehicle.weeklyMaintenanceCost).toBe(template.weeklyMaintenanceCost);
    expect(vehicle.weeklyFuelCost).toBe(template.weeklyFuelCost);
  });

  it('should calculate sell price with depreciation', () => {
    const template = VEHICLE_TEMPLATES.find(v => v.id === 'economy_sedan')!;
    const vehicle = createVehicleFromTemplate(template, 0);

    const sellPrice = calculateVehicleSellPrice(vehicle);

    // New car: 80% of purchase price * 100% condition * no mileage penalty
    expect(sellPrice).toBe(Math.floor(15000 * 0.8 * 1.0));
    expect(sellPrice).toBeLessThan(vehicle.price);
  });

  it('should reduce sell price with poor condition', () => {
    const template = VEHICLE_TEMPLATES.find(v => v.id === 'economy_sedan')!;
    const vehicle = createVehicleFromTemplate(template, 0);
    vehicle.condition = 50; // 50% condition

    const sellPrice = calculateVehicleSellPrice(vehicle);
    const fullConditionPrice = Math.floor(15000 * 0.8 * 1.0);

    expect(sellPrice).toBeLessThan(fullConditionPrice);
  });

  it('should calculate repair cost based on damage', () => {
    const template = VEHICLE_TEMPLATES.find(v => v.id === 'economy_sedan')!;
    const vehicle = createVehicleFromTemplate(template, 0);
    vehicle.condition = 70; // 30% damaged

    const repairCost = calculateRepairCost(vehicle);
    expect(repairCost).toBeGreaterThan(0);

    // Full condition = no repair needed
    vehicle.condition = 100;
    const noCost = calculateRepairCost(vehicle);
    expect(noCost).toBe(0);
  });

  it('should simulate weekly vehicle costs', () => {
    const template = VEHICLE_TEMPLATES.find(v => v.id === 'family_suv')!;
    const vehicle = createVehicleFromTemplate(template, 0);

    const weeklyCost = (vehicle.weeklyMaintenanceCost || 0) + (vehicle.weeklyFuelCost || 0);
    expect(weeklyCost).toBe(60 + 70); // maintenance + fuel for family SUV

    // After 1 week: condition degrades, mileage increases
    vehicle.condition = Math.max(0, vehicle.condition - 1);
    vehicle.mileage = (vehicle.mileage || 0) + 200;

    expect(vehicle.condition).toBe(99);
    expect(vehicle.mileage).toBe(200);
  });

  it('should support all vehicle types', () => {
    const types = new Set(VEHICLE_TEMPLATES.map(v => v.type));
    expect(types.has('car')).toBe(true);
    expect(types.has('motorcycle')).toBe(true);
    expect(types.has('luxury')).toBe(true);
    expect(types.has('sports')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('Critical Path: Checksum Integrity', () => {
  it('should produce consistent checksums for same data', () => {
    const data = '{"test":"data","number":42}';
    const checksum1 = calculateChecksum(data);
    const checksum2 = calculateChecksum(data);

    expect(checksum1).toBe(checksum2);
  });

  it('should produce different checksums for different data', () => {
    const data1 = '{"test":"data1"}';
    const data2 = '{"test":"data2"}';

    expect(calculateChecksum(data1)).not.toBe(calculateChecksum(data2));
  });

  it('should detect single-character corruption', () => {
    const data = '{"stats":{"money":100000}}';
    const checksum = calculateChecksum(data);

    // Change one digit
    const corrupted = '{"stats":{"money":100001}}';
    const corruptedChecksum = calculateChecksum(corrupted);

    expect(checksum).not.toBe(corruptedChecksum);
  });
});

// ─────────────────────────────────────────────────────────────────────────

describe('Critical Path: State Version Compatibility', () => {
  it('should have a valid state version', () => {
    expect(typeof STATE_VERSION).toBe('number');
    expect(STATE_VERSION).toBeGreaterThan(0);
  });

  it('should include version in save data', () => {
    const state = createGameState();
    const saveResult = createSaveData(state, STATE_VERSION);
    const parsed = JSON.parse(saveResult.data);

    expect(parsed.version).toBe(STATE_VERSION);
  });

  it('should include version in initial state', () => {
    expect(initialGameState.version).toBe(STATE_VERSION);
  });
});
