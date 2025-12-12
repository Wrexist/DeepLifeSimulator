/**
 * Rate Limiter utility for API calls and operations
 * Prevents excessive API calls and protects against abuse
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // Time window in milliseconds
  key?: string; // Optional key for different rate limits
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  /**
   * Register a rate limit configuration
   */
  registerConfig(key: string, config: RateLimitConfig): void {
    this.configs.set(key, config);
  }

  /**
   * Check if a request is allowed
   * @returns { allowed: boolean, remaining: number, resetTime: number }
   */
  checkLimit(key: string): { allowed: boolean; remaining: number; resetTime: number } {
    const config = this.configs.get(key);
    if (!config) {
      // No limit configured, allow all requests
      return { allowed: true, remaining: Infinity, resetTime: Date.now() };
    }

    const now = Date.now();
    const entry = this.limits.get(key);

    // Check if window has expired
    if (!entry || now >= entry.resetTime) {
      // Create new window
      const newEntry: RateLimitEntry = {
        count: 1,
        resetTime: now + config.windowMs,
      };
      this.limits.set(key, newEntry);
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: newEntry.resetTime,
      };
    }

    // Check if limit exceeded
    if (entry.count >= config.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: entry.resetTime,
      };
    }

    // Increment count
    entry.count++;
    this.limits.set(key, entry);

    return {
      allowed: true,
      remaining: config.maxRequests - entry.count,
      resetTime: entry.resetTime,
    };
  }

  /**
   * Reset rate limit for a key
   */
  reset(key: string): void {
    this.limits.delete(key);
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.limits.clear();
  }

  /**
   * Get current rate limit status
   */
  getStatus(key: string): { count: number; maxRequests: number; resetTime: number } | null {
    const config = this.configs.get(key);
    const entry = this.limits.get(key);

    if (!config) return null;

    if (!entry || Date.now() >= entry.resetTime) {
      return {
        count: 0,
        maxRequests: config.maxRequests,
        resetTime: Date.now() + config.windowMs,
      };
    }

    return {
      count: entry.count,
      maxRequests: config.maxRequests,
      resetTime: entry.resetTime,
    };
  }
}

// Singleton instance
const rateLimiter = new RateLimiter();

// Predefined rate limit configurations
export const RATE_LIMITS = {
  CLOUD_SYNC: {
    maxRequests: 10, // 10 syncs
    windowMs: 60 * 1000, // per minute
  },
  LEADERBOARD: {
    maxRequests: 5, // 5 submissions
    windowMs: 60 * 1000, // per minute
  },
  IAP_VALIDATION: {
    maxRequests: 20, // 20 validations
    windowMs: 60 * 1000, // per minute
  },
  API_GENERAL: {
    maxRequests: 30, // 30 requests
    windowMs: 60 * 1000, // per minute
  },
} as const;

// Initialize default configurations
Object.entries(RATE_LIMITS).forEach(([key, config]) => {
  rateLimiter.registerConfig(key, config);
});

/**
 * Rate limit decorator for async functions
 */
export function withRateLimit(
  limitKey: string,
  onLimitExceeded?: (remaining: number, resetTime: number) => void
) {
  return function <T extends (...args: any[]) => Promise<any>>(
    target: any,
    _propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>
  ) {
    const originalMethod = descriptor.value!;

    descriptor.value = async function (this: any, ...args: any[]) {
      const result = rateLimiter.checkLimit(limitKey);

      if (!result.allowed) {
        if (onLimitExceeded) {
          onLimitExceeded(result.remaining, result.resetTime);
        }
        throw new Error(
          `Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`
        );
      }

      return originalMethod.apply(this, args);
    } as T;

    return descriptor;
  };
}

/**
 * Rate limit wrapper for async functions
 */
export async function rateLimited<T>(
  limitKey: string,
  fn: () => Promise<T>,
  onLimitExceeded?: (remaining: number, resetTime: number) => void
): Promise<T> {
  const result = rateLimiter.checkLimit(limitKey);

  if (!result.allowed) {
    if (onLimitExceeded) {
      onLimitExceeded(result.remaining, result.resetTime);
    }
    throw new Error(
      `Rate limit exceeded. Try again in ${Math.ceil((result.resetTime - Date.now()) / 1000)} seconds.`
    );
  }

  return fn();
}

/**
 * Check rate limit without consuming it
 */
export function checkRateLimit(key: string): { allowed: boolean; remaining: number; resetTime: number } {
  return rateLimiter.checkLimit(key);
}

/**
 * Get rate limit status
 */
export function getRateLimitStatus(key: string): { count: number; maxRequests: number; resetTime: number } | null {
  return rateLimiter.getStatus(key);
}

/**
 * Reset rate limit
 */
export function resetRateLimit(key: string): void {
  rateLimiter.reset(key);
}

/**
 * Reset all rate limits
 */
export function resetAllRateLimits(): void {
  rateLimiter.resetAll();
}

export default rateLimiter;

