/**
 * AI Debug Suite - Main Export
 *
 * This module provides essential debugging tools for game testing
 * and development in DeepLifeSim.
 *
 * Usage:
 * ```typescript
 * import {
 *   createDebugSnapshot,
 *   runIntegrityChecks,
 *   generateActionSimulations,
 *   generateLifeScenarios
 * } from '@/src/debug';
 * ```
 */

// Configuration & Context
export {
  aiDebugContext,
  initializeDebugContext,
  setStateGetter,
  setScreenGetter,
  captureError,
  getLastCaughtError,
  getErrorHistory,
  clearErrorHistory,
  isDebugContextReady,
  getDebugContextSummary,
  type AiDebugContext,
  type AnyState,
  type PerformanceMetrics,
} from './aiDebugConfig';

// Debug Snapshots
export {
  createDebugSnapshot,
  createQuickSnapshot,
  createFocusedSnapshot,
  type DebugSnapshot,
  type CriticalStateSlice,
  type QuickIntegrityChecks,
} from './aiDebugSnapshot';

// Integrity Checks
export {
  runIntegrityChecks,
  type IntegrityIssue,
  type IntegrityReport,
} from './aiIntegrityChecks';

// Action Simulator
export {
  generateActionSimulations,
  generateLifeScenarios,
  runActionSimulation,
  runLifeScenario,
  type SimulatedAction,
  type LifeScenario,
} from './actionSimulator';

