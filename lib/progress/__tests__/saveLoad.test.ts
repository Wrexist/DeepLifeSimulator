import { GameState } from '@/contexts/GameContext';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

// Mock AsyncStorage
const mockAsyncStorage: { [key: string]: string } = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn((key: string, value: string) => {
    mockAsyncStorage[key] = value;
    return Promise.resolve();
  }),
  getItem: jest.fn((key: string) => {
    return Promise.resolve(mockAsyncStorage[key] || null);
  }),
  removeItem: jest.fn((key: string) => {
    delete mockAsyncStorage[key];
    return Promise.resolve();
  }),
  clear: jest.fn(() => {
    Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
    return Promise.resolve();
  }),
}));

function createGameState(overrides: Partial<GameState> = {}): GameState {
  return createTestGameState({
    userProfile: { name: 'Test', handle: 'test', bio: '', followers: 0, following: 0, gender: 'male', seekingGender: 'female' },
    settings: { lifetimePremium: false, darkMode: false, soundEnabled: true, notificationsEnabled: true, autoSave: true, language: 'English', maxStats: false, hapticFeedback: true, weeklySummaryEnabled: true, showDecimalsInStats: false },
    ...overrides,
  });
}

// Mock save/load functions
const saveGame = async (slotId: string, gameState: GameState): Promise<boolean> => {
  try {
    const serializedState = JSON.stringify(gameState);
    mockAsyncStorage[`game_save_${slotId}`] = serializedState;
    return true;
  } catch (error) {
    console.error('Save failed:', error);
    return false;
  }
};

const loadGame = async (slotId: string): Promise<GameState | null> => {
  try {
    const serializedState = mockAsyncStorage[`game_save_${slotId}`];
    if (!serializedState) return null;
    
    const gameState = JSON.parse(serializedState) as GameState;
    return gameState;
  } catch (error) {
    console.error('Load failed:', error);
    return null;
  }
};

const deleteSave = async (slotId: string): Promise<boolean> => {
  try {
    delete mockAsyncStorage[`game_save_${slotId}`];
    return true;
  } catch (error) {
    console.error('Delete failed:', error);
    return false;
  }
};

const listSaves = async (): Promise<string[]> => {
  try {
    const saveKeys = Object.keys(mockAsyncStorage).filter(key => key.startsWith('game_save_'));
    return saveKeys.map(key => key.replace('game_save_', ''));
  } catch (error) {
    console.error('List saves failed:', error);
    return [];
  }
};

describe('Save/Load Integration Tests', () => {
  beforeEach(() => {
    // Clear mock storage before each test
    Object.keys(mockAsyncStorage).forEach(key => delete mockAsyncStorage[key]);
  });

  describe('Save Game', () => {
    it('should save game state successfully', async () => {
      const gameState = createGameState({
        stats: { health: 75, happiness: 80, energy: 60, fitness: 70, money: 5000, reputation: 60, gems: 10 },
        week: 10,
        date: { year: 2025, month: 'March', week: 10, age: 18 },
      });

      const result = await saveGame('slot1', gameState);
      
      expect(result).toBe(true);
      expect(mockAsyncStorage['game_save_slot1']).toBeDefined();
      
      const savedData = JSON.parse(mockAsyncStorage['game_save_slot1']);
      expect(savedData.week).toBe(10);
      expect(savedData.stats.money).toBe(5000);
    });

    it('should handle save with complex game state', async () => {
      const complexGameState = createGameState({
        stats: { health: 100, happiness: 100, energy: 100, fitness: 100, money: 100000, reputation: 100, gems: 100 },
        careers: [
          {
            id: 'software_engineer',
            levels: [{ name: 'Senior Developer', salary: 2000 }],
            level: 0,
            description: 'Test career',
            requirements: { fitness: 30 },
            progress: 50,
            applied: true,
            accepted: true,
          }
        ],
        items: [
          { id: 'laptop', name: 'Laptop', price: 1000, owned: true, dailyBonus: { energy: 5 } }
        ],
        companies: [
          {
            id: 'tech_company',
            name: 'Tech Company',
            type: 'ai',
            weeklyIncome: 5000,
            baseWeeklyIncome: 5000,
            upgrades: [],
            employees: 5,
            workerSalary: 1000,
            workerMultiplier: 1.2,
            marketingLevel: 1,
            warehouseLevel: 0,
            miners: {},
          }
        ],
        realEstate: [
          {
            id: 'house',
            name: 'House',
            price: 200000,
            weeklyHappiness: 10,
            weeklyEnergy: 5,
            owned: true,
            interior: ['furniture'],
            upgradeLevel: 2,
            rent: 1000,
            upkeep: 200,
          }
        ],
      });

      const result = await saveGame('complex_slot', complexGameState);
      
      expect(result).toBe(true);
      
      const savedData = JSON.parse(mockAsyncStorage['game_save_complex_slot']);
      expect(savedData.careers).toHaveLength(1);
      expect(savedData.items).toHaveLength(1);
      expect(savedData.companies).toHaveLength(1);
      expect(savedData.realEstate).toHaveLength(1);
    });

    it('should handle save errors gracefully', async () => {
      // Mock a save that would fail
      const invalidGameState = createGameState({
        stats: { health: 50, happiness: 50, energy: 50, fitness: 50, money: 1000, reputation: 50, gems: 0 },
      });
      
      // Add circular reference to cause JSON.stringify to fail
      (invalidGameState as any).circularRef = invalidGameState;
      
      const result = await saveGame('error_slot', invalidGameState);
      
      expect(result).toBe(false);
    });
  });

  describe('Load Game', () => {
    it('should load game state successfully', async () => {
      const originalGameState = createGameState({
        stats: { health: 80, happiness: 90, energy: 70, fitness: 85, money: 10000, reputation: 75, gems: 25 },
        week: 15,
        date: { year: 2025, month: 'April', week: 15, age: 18 },
      });

      await saveGame('load_test', originalGameState);
      
      const loadedGameState = await loadGame('load_test');
      
      expect(loadedGameState).not.toBeNull();
      expect(loadedGameState?.week).toBe(15);
      expect(loadedGameState?.stats.money).toBe(10000);
      expect(loadedGameState?.stats.gems).toBe(25);
    });

    it('should return null for non-existent save', async () => {
      const loadedGameState = await loadGame('non_existent');
      
      expect(loadedGameState).toBeNull();
    });

    it('should handle corrupted save data', async () => {
      // Save corrupted data
      mockAsyncStorage['game_save_corrupted'] = 'invalid json data';
      
      const loadedGameState = await loadGame('corrupted');
      
      expect(loadedGameState).toBeNull();
    });

    it('should preserve all game state properties', async () => {
      const originalGameState = createGameState({
        stats: { health: 100, happiness: 100, energy: 100, fitness: 100, money: 50000, reputation: 100, gems: 50 },
        week: 20,
        date: { year: 2025, month: 'May', week: 20, age: 18 },
        settings: { darkMode: true, soundEnabled: false, notificationsEnabled: true, autoSave: false, language: 'Swedish', maxStats: true, hapticFeedback: true, weeklySummaryEnabled: true, showDecimalsInStats: false, lifetimePremium: false },
        perks: { workBoost: true, mindset: true, fastLearner: true },
        achievements: [
          { id: 'first_job', name: 'First Job', description: 'Get your first job', category: 'career', completed: true, reward: 100 }
        ],
      });

      await saveGame('preserve_test', originalGameState);
      
      const loadedGameState = await loadGame('preserve_test');
      
      expect(loadedGameState).not.toBeNull();
      expect(loadedGameState?.settings.darkMode).toBe(true);
      expect(loadedGameState?.settings.language).toBe('Swedish');
      expect(loadedGameState?.perks?.workBoost).toBe(true);
      expect(loadedGameState?.achievements).toHaveLength(1);
      expect(loadedGameState?.achievements[0].completed).toBe(true);
    });
  });

  describe('Delete Save', () => {
    it('should delete save successfully', async () => {
      const gameState = createGameState();
      await saveGame('delete_test', gameState);
      
      expect(mockAsyncStorage['game_save_delete_test']).toBeDefined();
      
      const deleteResult = await deleteSave('delete_test');
      
      expect(deleteResult).toBe(true);
      expect(mockAsyncStorage['game_save_delete_test']).toBeUndefined();
    });

    it('should handle deleting non-existent save', async () => {
      const deleteResult = await deleteSave('non_existent');
      
      expect(deleteResult).toBe(true); // Should not fail
    });
  });

  describe('List Saves', () => {
    it('should list all saves correctly', async () => {
      const gameState1 = createGameState({ week: 1 });
      const gameState2 = createGameState({ week: 2 });
      const gameState3 = createGameState({ week: 3 });

      await saveGame('slot1', gameState1);
      await saveGame('slot2', gameState2);
      await saveGame('slot3', gameState3);

      const saves = await listSaves();
      
      expect(saves).toContain('slot1');
      expect(saves).toContain('slot2');
      expect(saves).toContain('slot3');
      expect(saves).toHaveLength(3);
    });

    it('should return empty array when no saves exist', async () => {
      const saves = await listSaves();
      
      expect(saves).toEqual([]);
    });
  });

  describe('Save Slot Management', () => {
    it('should handle multiple save slots independently', async () => {
      const gameState1 = createGameState({ week: 1, stats: { health: 50, happiness: 50, energy: 50, fitness: 50, money: 1000, reputation: 50, gems: 0 } });
      const gameState2 = createGameState({ week: 10, stats: { health: 80, happiness: 80, energy: 80, fitness: 80, money: 10000, reputation: 80, gems: 10 } });

      await saveGame('slot1', gameState1);
      await saveGame('slot2', gameState2);

      const loaded1 = await loadGame('slot1');
      const loaded2 = await loadGame('slot2');

      expect(loaded1?.week).toBe(1);
      expect(loaded2?.week).toBe(10);
      expect(loaded1?.stats.money).toBe(1000);
      expect(loaded2?.stats.money).toBe(10000);
    });

    it('should overwrite existing saves', async () => {
      const gameState1 = createGameState({ week: 1 });
      const gameState2 = createGameState({ week: 2 });

      await saveGame('overwrite_test', gameState1);
      await saveGame('overwrite_test', gameState2);

      const loaded = await loadGame('overwrite_test');
      
      expect(loaded?.week).toBe(2);
    });
  });

  describe('Data Integrity', () => {
    it('should maintain data integrity through save/load cycle', async () => {
      const originalGameState = createGameState({
        stats: { health: 75, happiness: 85, energy: 65, fitness: 80, money: 15000, reputation: 70, gems: 15 },
        week: 25,
        date: { year: 2025, month: 'June', week: 25, age: 18 },
        currentJob: 'software_engineer',
        bankSavings: 5000,
        companies: [
          {
            id: 'startup',
            name: 'My Startup',
            type: 'ai',
            weeklyIncome: 3000,
            baseWeeklyIncome: 3000,
            upgrades: [],
            employees: 3,
            workerSalary: 800,
            workerMultiplier: 1.1,
            marketingLevel: 1,
            warehouseLevel: 0,
            miners: {},
          }
        ],
        realEstate: [
          {
            id: 'apartment',
            name: 'Apartment',
            price: 150000,
            weeklyHappiness: 5,
            weeklyEnergy: 3,
            owned: true,
            interior: ['basic_furniture'],
            upgradeLevel: 1,
            rent: 800,
            upkeep: 150,
          }
        ],
      });

      await saveGame('integrity_test', originalGameState);
      const loadedGameState = await loadGame('integrity_test');

      // Deep comparison of critical properties
      expect(loadedGameState?.stats).toEqual(originalGameState.stats);
      expect(loadedGameState?.week).toBe(originalGameState.week);
      expect(loadedGameState?.date).toEqual(originalGameState.date);
      expect(loadedGameState?.currentJob).toBe(originalGameState.currentJob);
      expect(loadedGameState?.bankSavings).toBe(originalGameState.bankSavings);
      expect(loadedGameState?.companies).toHaveLength(originalGameState.companies.length);
      expect(loadedGameState?.realEstate).toHaveLength(originalGameState.realEstate.length);
    });
  });
});
