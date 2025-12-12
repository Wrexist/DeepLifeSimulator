/**
 * AI Debug Configuration
 * Pluggable hooks to wire game state, navigation, and metrics into the debug system
 * 
 * This module provides a central configuration point for the AI debugging suite.
 * It allows different parts of the app to register their state getters and metadata.
 */

import { GameState } from '@/contexts/game/types';

export type AnyState = GameState | unknown;

export interface PerformanceMetrics {
  fps?: number;
  memoryMb?: number;
  jsHeapSizeMb?: number;
}

export interface AiDebugContext {
  // Navigation
  getCurrentScreen?: () => string | null;
  
  // State - returns GameState or null
  getStoreState?: () => AnyState | null;
  
  // Performance metrics (placeholder for future integration)
  getPerformanceMetrics?: () => Promise<PerformanceMetrics>;
  
  // Network events (placeholder for future API integration)
  getLastNetworkEvents?: () => unknown[];
  
  // Error tracking
  getLastError?: () => unknown | null;
  setLastError?: (error: unknown) => void;
  
  // App metadata
  appVersion?: string;
  buildNumber?: string;
  environment?: 'dev' | 'staging' | 'prod';
  stateVersion?: number;
}

// Default context with empty hooks - will be populated at app init
export const aiDebugContext: AiDebugContext = {
  environment: __DEV__ ? 'dev' : 'prod',
};

// Error capture storage
let lastCaughtError: unknown = null;
const errorHistory: Array<{ error: unknown; timestamp: number; isFatal?: boolean }> = [];
const MAX_ERROR_HISTORY = 10;

/**
 * Capture an error for debug analysis
 * Integrates with the existing error handling in _layout.tsx
 */
export function captureError(error: unknown, isFatal?: boolean): void {
  lastCaughtError = error;
  
  // Add to history with timestamp
  errorHistory.push({
    error,
    timestamp: Date.now(),
    isFatal,
  });
  
  // Keep history bounded
  if (errorHistory.length > MAX_ERROR_HISTORY) {
    errorHistory.shift();
  }
  
  // Call custom handler if set
  if (aiDebugContext.setLastError) {
    aiDebugContext.setLastError(error);
  }
}

/**
 * Get the last caught error
 */
export function getLastCaughtError(): unknown {
  return lastCaughtError;
}

/**
 * Get error history for debugging
 */
export function getErrorHistory(): Array<{ error: unknown; timestamp: number; isFatal?: boolean }> {
  return [...errorHistory];
}

/**
 * Clear error history
 */
export function clearErrorHistory(): void {
  errorHistory.length = 0;
  lastCaughtError = null;
}

/**
 * Initialize the debug context with app-specific hooks
 * Call this at app startup (in _layout.tsx or App.tsx)
 */
export function initializeDebugContext(config: Partial<AiDebugContext>): void {
  Object.assign(aiDebugContext, config);
  
  if (__DEV__) {
    console.log('[AI Debug] Context initialized:', {
      environment: aiDebugContext.environment,
      appVersion: aiDebugContext.appVersion,
      buildNumber: aiDebugContext.buildNumber,
      stateVersion: aiDebugContext.stateVersion,
      hasStateGetter: !!aiDebugContext.getStoreState,
      hasScreenGetter: !!aiDebugContext.getCurrentScreen,
    });
  }
}

/**
 * Update the state getter (useful when context becomes available)
 */
export function setStateGetter(getter: () => AnyState | null): void {
  aiDebugContext.getStoreState = getter;
}

/**
 * Update the screen getter (useful when navigation becomes available)
 */
export function setScreenGetter(getter: () => string | null): void {
  aiDebugContext.getCurrentScreen = getter;
}

/**
 * Check if debug context is properly initialized
 */
export function isDebugContextReady(): boolean {
  return !!(
    aiDebugContext.appVersion &&
    aiDebugContext.getStoreState
  );
}

/**
 * Get a summary of the current debug context state
 */
export function getDebugContextSummary(): {
  initialized: boolean;
  environment: string;
  appVersion?: string;
  buildNumber?: string;
  stateVersion?: number;
  errorCount: number;
} {
  return {
    initialized: isDebugContextReady(),
    environment: aiDebugContext.environment ?? 'unknown',
    appVersion: aiDebugContext.appVersion,
    buildNumber: aiDebugContext.buildNumber,
    stateVersion: aiDebugContext.stateVersion,
    errorCount: errorHistory.length,
  };
}

