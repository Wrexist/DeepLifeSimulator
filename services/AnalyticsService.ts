/**
 * Analytics Service
 * Provides analytics tracking for the app
 * Supports Firebase Analytics and custom event tracking
 */

import { logger } from '@/utils/logger';

export interface AnalyticsEvent {
  name: string;
  parameters?: Record<string, any>;
  timestamp?: number;
}

export interface UserProperties {
  [key: string]: string | number | boolean;
}

class AnalyticsService {
  private static instance: AnalyticsService;
  private isInitialized = false;
  private eventQueue: AnalyticsEvent[] = [];
  private userProperties: UserProperties = {};

  private constructor() {
    // Initialize analytics when service is created
    this.initialize();
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Initialize analytics service
   */
  private async initialize(): Promise<void> {
    try {
      // Try to initialize Firebase Analytics
      // Dynamic import to avoid breaking if Firebase is not installed
      const firebase = await import('@react-native-firebase/analytics').catch(() => null);
      
      if (firebase?.default) {
        this.isInitialized = true;
        logger.info('Analytics initialized with Firebase');
      } else {
        // Fallback to console logging in development
        this.isInitialized = true;
        if (__DEV__) {
          logger.info('Analytics initialized (console mode)');
        }
      }
    } catch (error) {
      logger.error('Analytics initialization error:', error);
      this.isInitialized = true; // Still allow tracking, just log to console
    }
  }

  /**
   * Log an event
   */
  async logEvent(eventName: string, parameters?: Record<string, any>): Promise<void> {
    const event: AnalyticsEvent = {
      name: eventName,
      parameters,
      timestamp: Date.now(),
    };

    if (!this.isInitialized) {
      this.eventQueue.push(event);
      return;
    }

    try {
      // Try Firebase Analytics
      const firebase = await import('@react-native-firebase/analytics').catch(() => null);
      if (firebase?.default) {
        await firebase.default().logEvent(eventName, parameters || {});
        return;
      }
    } catch (error) {
      // Firebase not available, log to console
      if (__DEV__) {
        logger.debug('Analytics Event:', { eventName, parameters });
      }
    }
  }

  /**
   * Set user properties
   */
  async setUserProperties(properties: UserProperties): Promise<void> {
    this.userProperties = { ...this.userProperties, ...properties };

    try {
      const firebase = await import('@react-native-firebase/analytics').catch(() => null);
      if (firebase?.default) {
        for (const [key, value] of Object.entries(properties)) {
          await firebase.default().setUserProperty(key, String(value));
        }
        return;
      }
    } catch (error) {
      if (__DEV__) {
        logger.debug('Analytics User Properties:', properties);
      }
    }
  }

  /**
   * Set user ID
   */
  async setUserId(userId: string): Promise<void> {
    try {
      const firebase = await import('@react-native-firebase/analytics').catch(() => null);
      if (firebase?.default) {
        await firebase.default().setUserId(userId);
        return;
      }
    } catch (error) {
      if (__DEV__) {
        logger.debug('Analytics User ID:', { userId });
      }
    }
  }

  /**
   * Track screen view
   */
  async logScreenView(screenName: string, screenClass?: string): Promise<void> {
    await this.logEvent('screen_view', {
      screen_name: screenName,
      screen_class: screenClass || screenName,
    });
  }

  /**
   * Track purchase
   */
  async logPurchase(
    value: number,
    currency: string,
    items: { item_id: string; item_name: string; price: number; quantity: number }[]
  ): Promise<void> {
    await this.logEvent('purchase', {
      value,
      currency,
      items,
    });
  }

  /**
   * Track IAP purchase
   */
  async logIAPPurchase(productId: string, price: number, currency: string = 'USD'): Promise<void> {
    await this.logEvent('iap_purchase', {
      product_id: productId,
      value: price,
      currency,
    });
  }

  /**
   * Track game action
   */
  async logGameAction(action: string, parameters?: Record<string, any>): Promise<void> {
    await this.logEvent('game_action', {
      action,
      ...parameters,
    });
  }

  /**
   * Track crash event
   */
  async logCrash(
    category: 'save' | 'progression' | 'ui' | 'network' | 'unknown',
    error: Error,
    context?: Record<string, any>
  ): Promise<void> {
    await this.logEvent('crash_detected', {
      category,
      error_message: error.message,
      error_stack: error.stack?.substring(0, 500), // Limit stack trace length
      ...context,
    });
  }

  /**
   * Track save error
   */
  async logSaveError(
    errorType: 'quota' | 'serialization' | 'validation' | 'unknown',
    retryCount: number,
    emergencyBackupCreated: boolean,
    errorMessage?: string
  ): Promise<void> {
    await this.logEvent('save_error', {
      error_type: errorType,
      retry_count: retryCount,
      emergency_backup_created: emergencyBackupCreated,
      error_message: errorMessage || 'Unknown error',
    });
  }

  /**
   * Track state corruption
   */
  async logStateCorruption(
    validationErrors: string[],
    recoveryAttempted: boolean,
    recoverySuccess: boolean
  ): Promise<void> {
    await this.logEvent('state_corruption', {
      validation_errors: validationErrors.join(', '),
      recovery_attempted: recoveryAttempted,
      recovery_success: recoverySuccess,
    });
  }

  /**
   * Track recovery success
   */
  async logRecoverySuccess(
    recoveryType: 'backup' | 'repair' | 'validation',
    source: string
  ): Promise<void> {
    await this.logEvent('recovery_success', {
      recovery_type: recoveryType,
      source,
    });
  }

  /**
   * Track recovery failure
   */
  async logRecoveryFailure(
    recoveryType: 'backup' | 'repair' | 'validation',
    reason: string
  ): Promise<void> {
    await this.logEvent('recovery_failed', {
      recovery_type: recoveryType,
      reason,
    });
  }

  /**
   * Process queued events
   */
  async processQueue(): Promise<void> {
    while (this.eventQueue.length > 0) {
      const event = this.eventQueue.shift();
      if (event) {
        await this.logEvent(event.name, event.parameters);
      }
    }
  }
}

export const analyticsService = AnalyticsService.getInstance();
export default analyticsService;

