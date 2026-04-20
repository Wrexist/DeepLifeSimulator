/**
 * Tests for Error Recovery utility
 */

import {
  retryWithBackoff,
  withFallback,
  withCircuitBreaker,
  resetCircuitBreaker,
  withErrorRecovery,
} from '@/utils/errorRecovery';

describe('Error Recovery', () => {
  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const fn = jest.fn().mockResolvedValue('success');
      const result = await retryWithBackoff(fn);

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure', async () => {
      const fn = jest.fn()
        .mockRejectedValueOnce(new Error('network error'))
        .mockResolvedValue('success');

      const result = await retryWithBackoff(fn, { maxRetries: 2, initialDelayMs: 10 });

      expect(result.success).toBe(true);
      expect(result.result).toBe('success');
      expect(result.attempts).toBe(2);
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const error = new Error('persistent error');
      const fn = jest.fn().mockRejectedValue(error);

      const result = await retryWithBackoff(fn, { maxRetries: 2, initialDelayMs: 10 });

      expect(result.success).toBe(false);
      expect(result.error).toBe(error);
      expect(result.attempts).toBe(3); // initial + 2 retries
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const error = new Error('400 Bad Request');
      const fn = jest.fn().mockRejectedValue(error);

      const result = await retryWithBackoff(fn, {
        maxRetries: 3,
        nonRetryableErrors: ['400'],
        initialDelayMs: 10,
      });

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1); // Should not retry
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('withFallback', () => {
    it('should use first function if it succeeds', async () => {
      const fn1 = jest.fn().mockResolvedValue('success1');
      const fn2 = jest.fn().mockResolvedValue('success2');

      const result = await withFallback([fn1, fn2]);

      expect(result).toBe('success1');
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).not.toHaveBeenCalled();
    });

    it('should fallback to second function if first fails', async () => {
      const fn1 = jest.fn().mockRejectedValue(new Error('failed'));
      const fn2 = jest.fn().mockResolvedValue('success2');

      const result = await withFallback([fn1, fn2]);

      expect(result).toBe('success2');
      expect(fn1).toHaveBeenCalledTimes(1);
      expect(fn2).toHaveBeenCalledTimes(1);
    });

    it('should throw if all functions fail', async () => {
      const fn1 = jest.fn().mockRejectedValue(new Error('failed1'));
      const fn2 = jest.fn().mockRejectedValue(new Error('failed2'));

      await expect(withFallback([fn1, fn2])).rejects.toThrow();
    });
  });

  describe('withCircuitBreaker', () => {
    beforeEach(() => {
      resetCircuitBreaker('test-service');
    });

    it('should execute function when circuit is closed', async () => {
      const fn = jest.fn().mockResolvedValue('success');

      const result = await withCircuitBreaker('test-service', fn);

      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should open circuit after threshold failures', async () => {
      const error = new Error('service error');
      const fn = jest.fn().mockRejectedValue(error);

      // Trigger failures to open circuit
      for (let i = 0; i < 5; i++) {
        try {
          await withCircuitBreaker('test-service', fn);
        } catch (e) {
          // Expected
        }
      }

      // Circuit should be open now
      await expect(withCircuitBreaker('test-service', fn)).rejects.toThrow('Circuit breaker is open');
    });
  });

  describe('withErrorRecovery', () => {
    beforeEach(() => {
      resetCircuitBreaker('test-service');
    });

    it('should return result from primary function', async () => {
      const primaryFn = jest.fn().mockResolvedValue('success');
      const fallbackFn = jest.fn().mockResolvedValue('fallback');

      const result = await withErrorRecovery('test-service', primaryFn, fallbackFn);

      expect(result).toBe('success');
      expect(primaryFn).toHaveBeenCalledTimes(1);
      expect(fallbackFn).not.toHaveBeenCalled();
    });

    it('should use fallback if primary fails', async () => {
      const primaryFn = jest.fn().mockRejectedValue(new Error('failed'));
      const fallbackFn = jest.fn().mockResolvedValue('fallback');

      const result = await withErrorRecovery('test-service', primaryFn, fallbackFn, {
        maxRetries: 1,
        initialDelayMs: 10,
      });

      expect(result).toBe('fallback');
      expect(fallbackFn).toHaveBeenCalledTimes(1);
    });
  });
});

