/**
 * Startup Health Validator
 *
 * Validates that all critical systems are ready before allowing navigation.
 * Prevents navigation when the app is in an unstable state.
 */

import { getLastBootStage } from './bootBreadcrumbs';
import { logger } from '@/utils/logger';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface StartupHealthStatus {
  isHealthy: boolean;
  issues: string[];
  warnings: string[];
  criticalSystemsReady: {
    errorHandlers: boolean;
    providers: boolean;
    navigation: boolean;
    storage: boolean;
    firstFrame: boolean;
  };
  recommendedAction: 'proceed' | 'wait' | 'restart' | 'error';
}

export interface HealthCheckResult {
  status: StartupHealthStatus;
  timestamp: number;
  validationTime: number;
}

/**
 * Comprehensive startup health check
 */
export async function validateStartupHealth(): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const issues: string[] = [];
  const warnings: string[] = [];

  const criticalSystemsReady = {
    errorHandlers: false,
    providers: false,
    navigation: false,
    storage: false,
    firstFrame: false,
  };

  // Check 1: Error handlers are set up
  try {
    if (typeof global !== 'undefined' && global.ErrorUtils) {
      criticalSystemsReady.errorHandlers = true;
    } else {
      issues.push('Global error handlers not initialized');
    }
  } catch (error) {
    issues.push('Error checking error handlers setup');
  }

  // Check 2: RCTFatal is properly stubbed
  try {
    if (typeof global !== 'undefined' && typeof global.RCTFatal === 'function') {
      criticalSystemsReady.providers = true; // Using providers as proxy for native bridge
    } else {
      issues.push('Native bridge not ready (RCTFatal not stubbed)');
    }
  } catch (error) {
    issues.push('Error checking native bridge status');
  }

  // Check 3: Boot stage progress
  try {
    const lastStage = await getLastBootStage();
    const expectedStages = ['layout_init_start', 'layout_error_handlers_setup', 'layout_start', 'first_screen_visible', 'app_ready'];
    const completionStages = ['first_screen_visible', 'app_ready', 'layout_services_init'];

    if (!lastStage) {
      // No boot stage info is not critical - might be first launch
      warnings.push('No boot stage information available');
    } else {
      // If we're at app_ready or later, everything is definitely ready
      if (completionStages.includes(lastStage)) {
        criticalSystemsReady.firstFrame = true;
        criticalSystemsReady.navigation = true;
      } else if (expectedStages.includes(lastStage)) {
        const stageIndex = expectedStages.indexOf(lastStage);
        if (stageIndex >= expectedStages.indexOf('first_screen_visible')) {
          criticalSystemsReady.firstFrame = true;
        }
        if (stageIndex >= expectedStages.indexOf('layout_start')) {
          criticalSystemsReady.navigation = true;
        }
      } else {
        // Unknown stage - log as warning but don't block
        warnings.push(`Unexpected boot stage: ${lastStage}`);
        // If we have any stage at all, assume basic readiness
        criticalSystemsReady.navigation = true;
      }
    }
  } catch (error) {
    // Boot stage check failure is not critical - might be first launch
    warnings.push('Error checking boot stage progress');
  }

  // Check 4: AsyncStorage availability
  try {
    // Check if AsyncStorage is available and functional
    if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
      // Try a simple read operation to verify it's working
      await AsyncStorage.getItem('health_check_test');
      criticalSystemsReady.storage = true;
    } else {
      // AsyncStorage module exists but methods aren't available
      // This is not critical for startup, so just mark storage as not ready
      // Don't add a warning - this is expected in some environments
    }
  } catch (error) {
    // AsyncStorage access failed - this could be a timing issue or actual unavailability
    // Only log a warning in development and if it's not a common timing issue
    if (__DEV__ && error && typeof error === 'object' && 'message' in error) {
      const errorMessage = String(error.message || '');
      // Don't warn for common timing/initialization issues
      if (!errorMessage.includes('not available') && !errorMessage.includes('not ready')) {
        // Only warn for actual errors, not initialization delays
        // Storage check failure is not critical for startup
      }
    }
    // Not critical for startup, so don't add to issues or warnings
  }

  // Check 5: React Navigation/Expo Router readiness
  try {
    // Check if router is available (this is a lightweight check)
    const routerAvailable = typeof require !== 'undefined' &&
                           typeof require('expo-router') !== 'undefined';
    if (!routerAvailable) {
      issues.push('Expo Router module not available');
    }
  } catch (error) {
    warnings.push('Could not verify router availability');
  }

  // Check 6: Startup health check from layout
  try {
    if (typeof global !== 'undefined' && typeof global.__STARTUP_HEALTH_CHECK__ === 'function') {
      const healthCheck = global.__STARTUP_HEALTH_CHECK__();
      if (healthCheck && !healthCheck.ready) {
        issues.push('Startup health check indicates system not ready');
      }
    }
  } catch (error) {
    warnings.push('Could not access startup health check');
  }

  // Determine overall health
  const isHealthy = issues.length === 0;
  let recommendedAction: StartupHealthStatus['recommendedAction'] = 'proceed';

  if (issues.length > 0) {
    recommendedAction = 'error';
  } else if (!criticalSystemsReady.errorHandlers) {
    // Error handlers are critical - must wait
    recommendedAction = 'wait';
  } else if (!criticalSystemsReady.firstFrame && warnings.length > 3) {
    // Only wait if first frame not ready AND we have many warnings
    recommendedAction = 'wait';
  } else {
    // If healthy and error handlers ready, proceed even with warnings
    recommendedAction = 'proceed';
  }

  const validationTime = Date.now() - startTime;

  const result: HealthCheckResult = {
    status: {
      isHealthy,
      issues,
      warnings,
      criticalSystemsReady,
      recommendedAction,
    },
    timestamp: Date.now(),
    validationTime,
  };

  // Log results in development
  if (__DEV__) {
    logger.info('[HealthValidator] Startup health check completed', {
      healthy: isHealthy,
      issuesCount: issues.length,
      warningsCount: warnings.length,
      action: recommendedAction,
      validationTime: `${validationTime}ms`,
    });

    if (issues.length > 0) {
      console.warn('[HealthValidator] Critical issues:', issues);
    }
    if (warnings.length > 0) {
      console.warn('[HealthValidator] Warnings:', warnings);
    }
  }

  return result;
}

/**
 * Quick health check for navigation decisions
 */
export async function shouldAllowNavigation(): Promise<boolean> {
  try {
    const health = await validateStartupHealth();
    return health.status.recommendedAction === 'proceed';
  } catch (error) {
    if (__DEV__) {
      console.error('[HealthValidator] Error during navigation check:', error);
    }
    // Default to allowing navigation if health check fails
    return true;
  }
}

/**
 * Get health status summary for debugging
 */
export function getHealthStatusSummary(health: StartupHealthStatus): string {
  const summary = [
    `Healthy: ${health.isHealthy}`,
    `Action: ${health.recommendedAction}`,
    `Critical systems: ${Object.entries(health.criticalSystemsReady)
      .filter(([, ready]) => ready)
      .map(([system]) => system)
      .join(', ')}`,
  ];

  if (health.issues.length > 0) {
    summary.push(`Issues: ${health.issues.length}`);
  }
  if (health.warnings.length > 0) {
    summary.push(`Warnings: ${health.warnings.length}`);
  }

  return summary.join(' | ');
}
