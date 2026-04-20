import {
  calculateChecksum,
  validateGameState,
  createSaveData,
  verifySaveData,
  parseSaveData,
} from '@/utils/saveValidation';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

describe('saveValidation', () => {
  describe('calculateChecksum', () => {
    it('calculates stable checksums for equal payloads', () => {
      const data = 'test data';
      expect(calculateChecksum(data)).toBe(calculateChecksum(data));
    });

    it('produces different checksums for different payloads', () => {
      expect(calculateChecksum('data1')).not.toBe(calculateChecksum('data2'));
    });
  });

  describe('validateGameState', () => {
    it('accepts a valid game state from factory', () => {
      const state = createTestGameState();
      const result = validateGameState(state);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects states without stats', () => {
      const stateWithoutStats = { ...createTestGameState(), stats: undefined } as any;
      const result = validateGameState(stateWithoutStats);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('reports out-of-range stat values as warnings (non-critical)', () => {
      const invalidState = createTestGameState({
        stats: {
          ...createTestGameState().stats,
          health: 150,
        },
      });
      const result = validateGameState(invalidState);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.toLowerCase().includes('health'))).toBe(true);
    });
  });

  describe('createSaveData', () => {
    it('creates save data with checksum and signature material', () => {
      const state = createTestGameState();
      const save = createSaveData(state, 1);
      expect(save.data).toBeTruthy();
      expect(save.checksum).toBeTruthy();
      expect(typeof save.checksum).toBe('string');
      expect(save.hmac).toBeTruthy();
    });
  });

  describe('verifySaveData', () => {
    it('verifies created save data', () => {
      const save = createSaveData(createTestGameState(), 1);
      expect(verifySaveData(save.data, save.checksum, save.signature, save.hmac)).toBe(true);
    });

    it('rejects incorrect checksums', () => {
      const save = createSaveData(createTestGameState(), 1);
      expect(verifySaveData(save.data, 'wrong', save.signature, save.hmac)).toBe(false);
    });
  });

  describe('parseSaveData', () => {
    it('parses valid save payloads', () => {
      const save = createSaveData(createTestGameState(), 1);
      const result = parseSaveData(save.data, save.checksum, save.signature, save.hmac);
      expect(result.valid).toBe(true);
      expect(result.state).toBeTruthy();
    });

    it('rejects corrupted payloads', () => {
      const result = parseSaveData('invalid json');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
