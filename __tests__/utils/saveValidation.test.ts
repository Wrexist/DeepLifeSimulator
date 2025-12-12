import { 
  calculateChecksum, 
  validateGameState, 
  createSaveData, 
  verifySaveData,
  parseSaveData 
} from '@/utils/saveValidation';
import { GameState } from '@/contexts/GameContext';

describe('saveValidation', () => {
  describe('calculateChecksum', () => {
    it('should calculate consistent checksums', () => {
      const data = 'test data';
      const checksum1 = calculateChecksum(data);
      const checksum2 = calculateChecksum(data);
      expect(checksum1).toBe(checksum2);
    });

    it('should produce different checksums for different data', () => {
      const checksum1 = calculateChecksum('data1');
      const checksum2 = calculateChecksum('data2');
      expect(checksum1).not.toBe(checksum2);
    });
  });

  describe('validateGameState', () => {
    const validState: Partial<GameState> = {
      stats: {
        health: 50,
        happiness: 50,
        energy: 50,
        fitness: 50,
        money: 1000,
        reputation: 50,
        gems: 0,
      },
      date: {
        year: 2024,
        month: 'January',
        week: 1,
        age: 25,
      },
      settings: {
        darkMode: false,
        soundEnabled: true,
        hapticFeedback: true,
        notificationsEnabled: false,
        autoSave: true,
        maxStats: false,
      },
      careers: [],
      hobbies: [],
      items: [],
      relationships: [],
    };

    it('should validate correct game state', () => {
      const result = validateGameState(validState);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject state without stats', () => {
      const invalidState = { ...validState };
      delete invalidState.stats;
      const result = validateGameState(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should reject invalid stat ranges', () => {
      const invalidState = {
        ...validState,
        stats: {
          ...validState.stats!,
          health: 150, // Out of range
        },
      };
      const result = validateGameState(invalidState);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('Health out of range'))).toBe(true);
    });
  });

  describe('createSaveData', () => {
    it('should create save data with checksum', () => {
      const state = {
        stats: {
          health: 50,
          happiness: 50,
          energy: 50,
          fitness: 50,
          money: 1000,
          reputation: 50,
          gems: 0,
        },
      } as GameState;

      const { data, checksum } = createSaveData(state, 1);
      expect(data).toBeTruthy();
      expect(checksum).toBeTruthy();
      expect(typeof checksum).toBe('string');
    });
  });

  describe('verifySaveData', () => {
    it('should verify correct checksum', () => {
      const data = 'test data';
      const checksum = calculateChecksum(data);
      expect(verifySaveData(data, checksum)).toBe(true);
    });

    it('should reject incorrect checksum', () => {
      const data = 'test data';
      const wrongChecksum = 'wrong';
      expect(verifySaveData(data, wrongChecksum)).toBe(false);
    });
  });

  describe('parseSaveData', () => {
    it('should parse valid save data', () => {
      const state = {
        stats: {
          health: 50,
          happiness: 50,
          energy: 50,
          fitness: 50,
          money: 1000,
          reputation: 50,
          gems: 0,
        },
        date: {
          year: 2024,
          month: 'January',
          week: 1,
          age: 25,
        },
        settings: {
          darkMode: false,
          soundEnabled: true,
          hapticFeedback: true,
          notificationsEnabled: false,
          autoSave: true,
          maxStats: false,
        },
        careers: [],
        hobbies: [],
        items: [],
        relationships: [],
      } as GameState;

      const { data, checksum } = createSaveData(state, 1);
      const result = parseSaveData(data, checksum);
      
      expect(result.valid).toBe(true);
      expect(result.state).toBeTruthy();
    });

    it('should reject corrupted data', () => {
      const corruptedData = 'invalid json';
      const result = parseSaveData(corruptedData);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});

