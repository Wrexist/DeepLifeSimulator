/**
 * AI Debug Suite - Main Export
 * 
 * This module provides comprehensive debugging tools for AI-assisted
 * bug finding and analysis in DeepLifeSim.
 * 
 * Usage:
 * ```typescript
 * import { 
 *   createDebugSnapshot, 
 *   runIntegrityChecks,
 *   runFuzz 
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
  quickStateCheck,
  filterIssuesBySeverity,
  filterIssuesByCategory,
  formatReportAsText,
  type IntegrityIssue,
  type IntegrityReport,
} from './aiIntegrityChecks';

// Fuzz Testing Engine
export {
  runFuzz,
  createGameFuzzConfig,
  SeededRandom,
  CommonInvariants,
  type FuzzConfig,
  type FuzzResult,
} from './fuzzEngine';

