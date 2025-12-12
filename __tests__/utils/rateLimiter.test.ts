/**
 * Tests for Rate Limiter utility
 */

import rateLimiter, { checkRateLimit, resetRateLimit, RATE_LIMITS } from '@/utils/rateLimiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    // Reset all rate limits before each test
    resetRateLimit('CLOUD_SYNC');
    resetRateLimit('LEADERBOARD');
    resetRateLimit('API_GENERAL');
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limit', () => {
      const result = checkRateLimit('CLOUD_SYNC');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(RATE_LIMITS.CLOUD_SYNC.maxRequests - 1);
    });

    it('should block requests exceeding limit', () => {
      const maxRequests = RATE_LIMITS.CLOUD_SYNC.maxRequests;
      
      // Make maxRequests requests
      for (let i = 0; i < maxRequests; i++) {
        checkRateLimit('CLOUD_SYNC');
      }

      // Next request should be blocked
      const result = checkRateLimit('CLOUD_SYNC');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('should reset after window expires', async () => {
      const maxRequests = RATE_LIMITS.CLOUD_SYNC.maxRequests;
      
      // Exhaust the limit
      for (let i = 0; i < maxRequests; i++) {
        checkRateLimit('CLOUD_SYNC');
      }

      // Fast-forward time (in a real scenario, you'd wait)
      // For testing, we'll reset manually
      resetRateLimit('CLOUD_SYNC');

      // Should allow again
      const result = checkRateLimit('CLOUD_SYNC');
      expect(result.allowed).toBe(true);
    });

    it('should return correct remaining count', () => {
      const maxRequests = RATE_LIMITS.CLOUD_SYNC.maxRequests;
      
      for (let i = 0; i < 3; i++) {
        checkRateLimit('CLOUD_SYNC');
      }

      const result = checkRateLimit('CLOUD_SYNC');
      expect(result.remaining).toBe(maxRequests - 4);
    });
  });

  describe('resetRateLimit', () => {
    it('should reset rate limit counter', () => {
      // Make some requests
      checkRateLimit('CLOUD_SYNC');
      checkRateLimit('CLOUD_SYNC');

      // Reset
      resetRateLimit('CLOUD_SYNC');

      // Should start fresh
      const result = checkRateLimit('CLOUD_SYNC');
      expect(result.remaining).toBe(RATE_LIMITS.CLOUD_SYNC.maxRequests - 1);
    });
  });

  describe('different rate limit keys', () => {
    it('should track limits independently', () => {
      // Exhaust CLOUD_SYNC limit
      for (let i = 0; i < RATE_LIMITS.CLOUD_SYNC.maxRequests; i++) {
        checkRateLimit('CLOUD_SYNC');
      }

      // LEADERBOARD should still work
      const leaderboardResult = checkRateLimit('LEADERBOARD');
      expect(leaderboardResult.allowed).toBe(true);
    });
  });
});

