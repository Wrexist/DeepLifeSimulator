import AsyncStorage from '@react-native-async-storage/async-storage';
import { safeAsyncStorage } from '@/utils/storageWrapper';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => {
  const mock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
    getAllKeys: jest.fn(),
    clear: jest.fn(),
  };
  return {
    __esModule: true,
    default: mock,
    ...mock,
  };
});

describe('safeAsyncStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('readiness deadline ownership', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      (AsyncStorage.getAllKeys as jest.Mock).mockReset().mockResolvedValue([]);
      (AsyncStorage.getItem as jest.Mock).mockResolvedValue('"ready"');
    });

    afterEach(() => {
      jest.useRealTimers();
      (AsyncStorage.getAllKeys as jest.Mock).mockReset().mockResolvedValue([]);
    });

    it('releases the deadline after a successful readiness check', async () => {
      expect(await safeAsyncStorage.getItem('key')).toBe('ready');
      expect(jest.getTimerCount()).toBe(0);
    });

    it('releases a rejected attempt deadline before retrying', async () => {
      (AsyncStorage.getAllKeys as jest.Mock)
        .mockRejectedValueOnce(new Error('Bridge not ready'));
      const read = safeAsyncStorage.getItem('key');
      await jest.advanceTimersByTimeAsync(100);
      expect(await read).toBe('ready');
      expect(AsyncStorage.getAllKeys).toHaveBeenCalledTimes(2);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('still times out stalled checks and returns the fallback at the retry limit', async () => {
      (AsyncStorage.getAllKeys as jest.Mock).mockImplementation(() => new Promise(() => {}));
      const read = safeAsyncStorage.getItem('key', 'unavailable');
      await jest.advanceTimersByTimeAsync(3000);
      expect(await read).toBe('unavailable');
      expect(AsyncStorage.getAllKeys).toHaveBeenCalledTimes(5);
      expect(AsyncStorage.getItem).not.toHaveBeenCalled();
      expect(jest.getTimerCount()).toBe(0);
    });
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
