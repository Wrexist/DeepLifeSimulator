/**
 * Startup Circuit Breaker
 *
 * Prevents infinite restart loops by implementing circuit breaker pattern.
 * Tracks startup failures and escalates recovery strategies based on failure patterns.
 */

// CRITICAL: DO NOT import AsyncStorage at module level
// This would trigger TurboModule initialization before bridge is ready on iOS 26 Beta
// Instead, lazy-load it on first use
let _asyncStorage: typeof import('@react-native-async-storage/async-storage').default | null = null;
let _asyncStorageLoadAttempted = false;

function getAsyncStorage(): typeof import('@react-native-async-storage/async-storage').default | null {
  if (_asyncStorage) {
    return _asyncStorage;
  }
  if (_asyncStorageLoadAttempted) {
    return null; // Already tried and failed
  }
  _asyncStorageLoadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _asyncStorage = require('@react-native-async-storage/async-storage').default;
    return _asyncStorage;
  } catch (error) {
    // AsyncStorage not available - running before bridge is ready
    if (__DEV__) {
      console.warn('[CircuitBreaker] AsyncStorage not available yet:', error);
    }
    return null;
  }
}

import { logger } from '@/utils/logger';

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export interface StartupFailureRecord {
  timestamp: number;
  failureType: 'crash' | 'timeout' | 'error' | 'health_check_failed';
  errorMessage?: string;
  bootStage?: string;
  attemptNumber: number;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;      // Number of failures before opening circuit
  recoveryTimeoutMs: number;     // Time before attempting recovery
  maxRecoveryAttempts: number;   // Max attempts in half-open state
  monitoringWindowMs: number;    // Time window for failure counting
  escalationThreshold: number;   // Failures before escalating to nuclear option
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 3,
  recoveryTimeoutMs: 30000,      // 30 seconds
  maxRecoveryAttempts: 2,
  monitoringWindowMs: 300000,    // 5 minutes
  escalationThreshold: 5,
};

const STORAGE_KEY = '@startup_circuit_breaker';
const FAILURE_STORAGE_KEY = '@startup_failures';

export class StartupCircuitBreaker {
  private state: CircuitBreakerState = 'closed';
  private lastFailureTime: number = 0;
  private recoveryAttempts: number = 0;
  private config: CircuitBreakerConfig;
  private failures: StartupFailureRecord[] = [];

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize circuit breaker from persisted state
   */
  async initialize(): Promise<void> {
    try {
      const storage = getAsyncStorage();
      if (!storage) {
        // AsyncStorage not available yet - use default state
        return;
      }
      const stored = await storage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        this.state = parsed.state || 'closed';
        this.lastFailureTime = parsed.lastFailureTime || 0;
        this.recoveryAttempts = parsed.recoveryAttempts || 0;
      }

      // Load failure history
      const failuresStored = await storage.getItem(FAILURE_STORAGE_KEY);
      if (failuresStored) {
        this.failures = JSON.parse(failuresStored);
        this.cleanupOldFailures();
      }
    } catch (error) {
      if (__DEV__) {
        console.warn('[CircuitBreaker] Failed to load persisted state:', error);
      }
      // Continue with default state
    }
  }

  /**
   * Record a startup failure
   */
  async recordFailure(
    failureType: StartupFailureRecord['failureType'],
    errorMessage?: string,
    bootStage?: string
  ): Promise<void> {
    const now = Date.now();
    const attemptNumber = this.failures.length + 1;

    const failure: StartupFailureRecord = {
      timestamp: now,
      failureType,
      errorMessage,
      bootStage,
      attemptNumber,
    };

    this.failures.push(failure);
    this.lastFailureTime = now;

    // Clean up old failures outside monitoring window
    this.cleanupOldFailures();

    // Determine if circuit should open
    const recentFailures = this.getRecentFailures();
    if (recentFailures.length >= this.config.failureThreshold) {
      this.state = 'open';
      if (__DEV__) {
        console.warn(`[CircuitBreaker] Circuit opened after ${recentFailures.length} failures`);
      }
    }

    // Persist state
    await this.persistState();

    if (__DEV__) {
      logger.warn('[CircuitBreaker] Startup failure recorded', {
        type: failureType,
        stage: bootStage,
        totalFailures: this.failures.length,
        circuitState: this.state,
      });
    }
  }

  /**
   * Record successful startup
   */
  async recordSuccess(): Promise<void> {
    // Reset circuit on success
    if (this.state === 'half-open') {
      this.state = 'closed';
      this.recoveryAttempts = 0;
    }

    // Clear old failures on successful startup
    this.failures = [];
    await this.persistState();

    if (__DEV__) {
      logger.info('[CircuitBreaker] Startup success recorded, circuit reset');
    }
  }

  /**
   * Check if startup should be allowed
   */
  shouldAllowStartup(): {
    allowed: boolean;
    reason?: string;
    recommendedAction: 'proceed' | 'wait' | 'escalate' | 'nuclear';
    waitTimeMs?: number;
  } {
    const now = Date.now();
    const recentFailures = this.getRecentFailures();

    switch (this.state) {
      case 'closed':
        return { allowed: true, recommendedAction: 'proceed' };

      case 'open':
        const timeSinceLastFailure = now - this.lastFailureTime;
        if (timeSinceLastFailure >= this.config.recoveryTimeoutMs) {
          // Time to try recovery
          this.state = 'half-open';
          this.recoveryAttempts = 0;
          this.persistState();
          return { allowed: true, recommendedAction: 'proceed' };
        } else {
          const waitTime = this.config.recoveryTimeoutMs - timeSinceLastFailure;
          return {
            allowed: false,
            reason: `Circuit breaker open due to ${recentFailures.length} recent failures`,
            recommendedAction: 'wait',
            waitTimeMs: waitTime,
          };
        }

      case 'half-open':
        if (this.recoveryAttempts >= this.config.maxRecoveryAttempts) {
          // Too many failed recovery attempts
          this.state = 'open';
          this.persistState();
          return {
            allowed: false,
            reason: `Maximum recovery attempts (${this.config.maxRecoveryAttempts}) exceeded`,
            recommendedAction: recentFailures.length >= this.config.escalationThreshold ? 'nuclear' : 'escalate',
          };
        }
        return { allowed: true, recommendedAction: 'proceed' };

      default:
        return { allowed: true, recommendedAction: 'proceed' };
    }
  }

  /**
   * Handle failed recovery attempt
   */
  async handleRecoveryFailure(): Promise<void> {
    this.recoveryAttempts++;
    if (this.recoveryAttempts >= this.config.maxRecoveryAttempts) {
      this.state = 'open';
    }
    await this.persistState();
  }

  /**
   * Get circuit breaker status for debugging
   */
  getStatus() {
    return {
      state: this.state,
      lastFailureTime: this.lastFailureTime,
      recoveryAttempts: this.recoveryAttempts,
      totalFailures: this.failures.length,
      recentFailures: this.getRecentFailures().length,
      nextRetryTime: this.state === 'open'
        ? this.lastFailureTime + this.config.recoveryTimeoutMs
        : null,
    };
  }

  /**
   * Force reset circuit breaker (for manual recovery)
   */
  async forceReset(): Promise<void> {
    this.state = 'closed';
    this.recoveryAttempts = 0;
    this.failures = [];
    await this.persistState();

    if (__DEV__) {
      logger.info('[CircuitBreaker] Circuit breaker manually reset');
    }
  }

  /**
   * Get recent failures within monitoring window
   */
  private getRecentFailures(): StartupFailureRecord[] {
    const cutoff = Date.now() - this.config.monitoringWindowMs;
    return this.failures.filter(f => f.timestamp > cutoff);
  }

  /**
   * Clean up failures outside monitoring window
   */
  private cleanupOldFailures(): void {
    const cutoff = Date.now() - this.config.monitoringWindowMs;
    this.failures = this.failures.filter(f => f.timestamp > cutoff);
  }

  /**
   * Persist circuit breaker state
   */
  private async persistState(): Promise<void> {
    try {
      const storage = getAsyncStorage();
      if (!storage) {
        // AsyncStorage not available yet - skip persistence
        return;
      }
      const state = {
        state: this.state,
        lastFailureTime: this.lastFailureTime,
        recoveryAttempts: this.recoveryAttempts,
      };
      await storage.setItem(STORAGE_KEY, JSON.stringify(state));
      await storage.setItem(FAILURE_STORAGE_KEY, JSON.stringify(this.failures));
    } catch (error) {
      if (__DEV__) {
        console.warn('[CircuitBreaker] Failed to persist state:', error);
      }
    }
  }
}

// Singleton instance
export const startupCircuitBreaker = new StartupCircuitBreaker();
