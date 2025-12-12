import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeAsyncStorage } from '@/utils/storageWrapper';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  multiGet: jest.fn(),
  multiSet: jest.fn(),
  multiRemove: jest.fn(),
  getAllKeys: jest.fn(),
  clear: jest.fn(),
}));

describe('safeAsyncStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getItem', () => {
    it('should return parsed JSON value', async () => {
      const testData = { key: 'value' };
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(testData));

      const result = await safeAsyncStorage.getItem('testKey');
      expect(result).toEqual(testData);
    });

    it('should return fallback for null values', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

      const result = await safeAsyncStorage.getItem('testKey', 'fallback');
      expect(result).toBe('fallback');
    });

    it('should handle parse errors gracefully', async () => {
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json');

      const result = await safeAsyncStorage.getItem('testKey', 'fallback');
      expect(result).toBe('fallback');
    });
  });

  describe('setItem', () => {
    it('should stringify and save data', async () => {
      const testData = { key: 'value' };
      (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

      const result = await safeAsyncStorage.setItem('testKey', testData);
      expect(result).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith('testKey', JSON.stringify(testData));
    });

    it('should return false on error', async () => {
      (AsyncStorage.setItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await safeAsyncStorage.setItem('testKey', 'value');
      expect(result).toBe(false);
    });
  });

  describe('removeItem', () => {
    it('should remove item successfully', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

      const result = await safeAsyncStorage.removeItem('testKey');
      expect(result).toBe(true);
    });

    it('should return false on error', async () => {
      (AsyncStorage.removeItem as jest.Mock).mockRejectedValue(new Error('Storage error'));

      const result = await safeAsyncStorage.removeItem('testKey');
      expect(result).toBe(false);
    });
  });
});

