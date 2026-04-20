/**
 * Error Recovery System
 * Provides automatic retry, fallback strategies, and error reporting
 */

import { logger } from './logger';

const log = logger.scope('ErrorRecovery');

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[]; // Error messages that should trigger retry
  nonRetryableErrors?: string[]; // Error messages that should NOT trigger retry
}

export interface RetryResult<T> {
  success: boolean;
  result?: T;
  error?: Error;
  attempts: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableErrors: ['network', 'timeout', 'ECONNRESET', 'ETIMEDOUT'],
  nonRetryableErrors: ['400', '401', '403', '404', 'validation'],
};

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable
 */
function isRetryableError(error: Error, config: RetryConfig): boolean {
  const errorMessage = error.message.toLowerCase();
  const errorName = error.name.toLowerCase();

  // Check non-retryable errors first
  if (config.nonRetryableErrors) {
    for (const nonRetryable of config.nonRetryableErrors) {
      if (errorMessage.includes(nonRetryable.toLowerCase()) || errorName.includes(nonRetryable.toLowerCase())) {
        return false;
      }
    }
  }

  // Check retryable errors
  if (config.retryableErrors) {
    for (const retryable of config.retryableErrors) {
      if (errorMessage.includes(retryable.toLowerCase()) || errorName.includes(retryable.toLowerCase())) {
        return true;
      }
    }
  }

  // Default: retry network errors, don't retry client errors
  return !errorMessage.includes('400') && !errorMessage.includes('401') && !errorMessage.includes('403');
}

/**
 * Retry an async function with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  const finalConfig: RetryConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  let lastError: Error | undefined;
  let delay = finalConfig.initialDelayMs;

  for (let attempt = 0; attempt <= finalConfig.maxRetries; attempt++) {
    try {
      const result = await fn();
      if (attempt > 0) {
        log.info(`Operation succeeded after ${attempt} retries`);
      }
      return {
        success: true,
        result,
        attempts: attempt + 1,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Check if error is retryable
      if (!isRetryableError(lastError, finalConfig)) {
        log.warn(`Non-retryable error encountered: ${lastError.message}`);
        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
        };
      }

      // Check if we have retries left
      if (attempt >= finalConfig.maxRetries) {
        log.error(`Operation failed after ${attempt + 1} attempts: ${lastError.message}`);
        return {
          success: false,
          error: lastError,
          attempts: attempt + 1,
        };
      }

      // Wait before retrying
      log.info(`Retry attempt ${attempt + 1}/${finalConfig.maxRetries} after ${delay}ms. Error: ${lastError.message}`);
      await sleep(delay);

      // Calculate next delay with exponential backoff
      delay = Math.min(delay * finalConfig.backoffMultiplier, finalConfig.maxDelayMs);
    }
  }

  return {
    success: false,
    error: lastError,
    attempts: finalConfig.maxRetries + 1,
  };
}

/**
 * Fallback strategy: try multiple functions in order until one succeeds
 */
export async function withFallback<T>(
  functions: (() => Promise<T>)[],
  onAllFailed?: (errors: Error[]) => void
): Promise<T> {
  const errors: Error[] = [];

  for (let i = 0; i < functions.length; i++) {
    try {
      const result = await functions[i]();
      if (i > 0) {
        log.info(`Fallback function ${i + 1} succeeded`);
      }
      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
      log.warn(`Fallback function ${i + 1} failed: ${err.message}`);
    }
  }

  // All functions failed
  if (onAllFailed) {
    onAllFailed(errors);
  }
  throw new Error(`All ${functions.length} fallback functions failed: ${errors.map(e => e.message).join(', ')}`);
}

/**
 * Circuit breaker pattern for preventing cascading failures
 */
class CircuitBreaker {
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private threshold: number = 5,
    private resetTimeout: number = 30000 // 30 seconds
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = 'half-open';
        log.info('Circuit breaker: transitioning to half-open state');
      } else {
        throw new Error('Circuit breaker is open. Service unavailable.');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failures = 0;
    if (this.state === 'half-open') {
      this.state = 'closed';
      log.info('Circuit breaker: closed (service recovered)');
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.threshold) {
      this.state = 'open';
      log.error(`Circuit breaker: opened after ${this.failures} failures`);
    }
  }

  reset(): void {
    this.failures = 0;
    this.state = 'closed';
    this.lastFailureTime = 0;
    log.info('Circuit breaker: manually reset');
  }

  getState(): 'closed' | 'open' | 'half-open' {
    return this.state;
  }
}

// Circuit breaker instances for different services
const circuitBreakers = new Map<string, CircuitBreaker>();

/**
 * Get or create a circuit breaker for a service
 */
function getCircuitBreaker(serviceName: string): CircuitBreaker {
  if (!circuitBreakers.has(serviceName)) {
    circuitBreakers.set(serviceName, new CircuitBreaker());
  }
  return circuitBreakers.get(serviceName)!;
}

/**
 * Execute a function with circuit breaker protection
 */
export async function withCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>
): Promise<T> {
  const breaker = getCircuitBreaker(serviceName);
  return breaker.execute(fn);
}

/**
 * Reset circuit breaker for a service
 */
export function resetCircuitBreaker(serviceName: string): void {
  const breaker = circuitBreakers.get(serviceName);
  if (breaker) {
    breaker.reset();
  }
}

/**
 * Combined retry with circuit breaker
 */
export async function retryWithCircuitBreaker<T>(
  serviceName: string,
  fn: () => Promise<T>,
  retryConfig: Partial<RetryConfig> = {}
): Promise<RetryResult<T>> {
  return retryWithBackoff(
    () => withCircuitBreaker(serviceName, fn),
    retryConfig
  );
}

/**
 * Error recovery wrapper that combines retry, circuit breaker, and fallback
 */
export async function withErrorRecovery<T>(
  serviceName: string,
  primaryFn: () => Promise<T>,
  fallbackFn?: () => Promise<T>,
  retryConfig: Partial<RetryConfig> = {}
): Promise<T> {
  try {
    const result = await retryWithCircuitBreaker(serviceName, primaryFn, retryConfig);
    if (result.success && result.result !== undefined) {
      return result.result;
    }
    throw result.error || new Error('Operation failed');
  } catch (error) {
    if (fallbackFn) {
      log.info(`Primary function failed, trying fallback for ${serviceName}`);
      try {
        return await fallbackFn();
      } catch (fallbackError) {
        log.error(`Both primary and fallback failed for ${serviceName}`);
        throw fallbackError;
      }
    }
    throw error;
  }
}

export default {
  retryWithBackoff,
  withFallback,
  withCircuitBreaker,
  retryWithCircuitBreaker,
  withErrorRecovery,
  resetCircuitBreaker,
};

