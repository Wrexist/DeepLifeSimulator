/**
 * AI Debug Snapshot
 * Collects comprehensive game state, logs, and metrics for AI-assisted debugging
 * 
 * The snapshot provides everything an AI assistant needs to analyze bugs:
 * - Game state and critical values
 * - Recent log entries
 * - Error history
 * - Quick integrity check results
 * - AsyncStorage inventory
 */

import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { aiDebugContext, getLastCaughtError, getErrorHistory } from './aiDebugConfig';
import { remoteLogger, LogEntry } from '@/services/RemoteLoggingService';
import { STATE_VERSION } from '@/contexts/game/initialState';

// Snapshot version for compatibility tracking
const SNAPSHOT_VERSION = '1.0.0';

export interface DebugSnapshot {
  meta: {
    createdAt: string;
    snapshotVersion: string;
    environment: string;
    platform: string;
    platformVersion?: string;
    appVersion?: string;
    buildNumber?: string;
    stateVersion: number;
  };
  screen: {
    currentScreen: string | null;
  };
  state: {
    gameState: unknown;
    criticalStateSlice: CriticalStateSlice;
    asyncStorageKeys: string[];
    asyncStorageSummary: Record<string, { size: number; preview?: string }>;
  };
  logs: LogEntry[];
  performance: {
    fps?: number;
    memoryMb?: number;
    jsHeapSizeMb?: number;
  };
  errors: {
    lastError: unknown | null;
    errorStack?: string;
    errorHistory: Array<{ error: unknown; timestamp: number; isFatal?: boolean }>;
  };
  integrity: {
    quickChecks: QuickIntegrityChecks;
  };
}

export interface CriticalStateSlice {
  // Core stats
  weeksLived?: number;
  age?: number;
  money?: number;
  bankSavings?: number;
  health?: number;
  happiness?: number;
  energy?: number;
  fitness?: number;
  reputation?: number;
  gems?: number;
  
  // Game progression
  currentJob?: string;
  generationNumber?: number;
  lifeStage?: string;
  
  // Issues
  diseases?: Array<{ id: string; name: string; severity: string }>;
  jailWeeks?: number;
  wantedLevel?: number;
  
  // Death state
  showDeathPopup?: boolean;
  deathReason?: string;
  showZeroStatPopup?: boolean;
  zeroStatType?: string;
  
  // Version
  version?: number;
}

export interface QuickIntegrityChecks {
  hasValidStats: boolean;
  hasValidDate: boolean;
  hasValidRelationships: boolean;
  hasValidCareers: boolean;
  hasValidItems: boolean;
  hasValidSettings: boolean;
  statsInRange: boolean;
  noNaNValues: boolean;
}

/**
 * Get a summary of AsyncStorage contents
 * Returns keys and size/preview for each entry
 */
async function getAsyncStorageSummary(): Promise<{
  keys: string[];
  summary: Record<string, { size: number; preview?: string }>;
}> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    if (!keys || keys.length === 0) {
      return { keys: [], summary: {} };
    }

    const summary: Record<string, { size: number; preview?: string }> = {};
    
    // Get summaries for each key (limit to prevent slowdown)
    const keysToProcess = keys.slice(0, 50); // Limit to 50 keys
    
    for (const key of keysToProcess) {
      try {
        const value = await AsyncStorage.getItem(key);
        if (value !== null) {
          summary[key] = {
            size: value.length,
            // Truncate preview for large values
            preview: value.length > 200 ? value.substring(0, 200) + '...' : value,
          };
        } else {
          summary[key] = { size: 0 };
        }
      } catch (err) {
        summary[key] = { size: -1, preview: `Error reading: ${String(err)}` };
      }
    }
    
    if (keys.length > 50) {
      summary['__truncated'] = { 
        size: 0, 
        preview: `${keys.length - 50} more keys not shown` 
      };
    }
    
    return { keys: [...keys], summary };
  } catch (err) {
    return { 
      keys: [], 
      summary: { __error: { size: -1, preview: `AsyncStorage error: ${String(err)}` } } 
    };
  }
}

/**
 * Extract critical state values for quick analysis
 */
function extractCriticalStateSlice(state: any): CriticalStateSlice {
  if (!state) return {};
  
  return {
    // Core stats
    weeksLived: state.weeksLived,
    age: state.date?.age,
    money: state.stats?.money,
    bankSavings: state.bankSavings,
    health: state.stats?.health,
    happiness: state.stats?.happiness,
    energy: state.stats?.energy,
    fitness: state.stats?.fitness,
    reputation: state.stats?.reputation,
    gems: state.stats?.gems,
    
    // Game progression
    currentJob: state.currentJob,
    generationNumber: state.generationNumber,
    lifeStage: state.lifeStage,
    
    // Issues - map to simpler format
    diseases: state.diseases?.map((d: any) => ({
      id: d.id,
      name: d.name,
      severity: d.severity,
    })),
    jailWeeks: state.jailWeeks,
    wantedLevel: state.wantedLevel,
    
    // Death state
    showDeathPopup: state.showDeathPopup,
    deathReason: state.deathReason,
    showZeroStatPopup: state.showZeroStatPopup,
    zeroStatType: state.zeroStatType,
    
    // Version
    version: state.version,
  };
}

/**
 * Run quick integrity checks without full validation
 */
function runQuickIntegrityChecks(state: any): QuickIntegrityChecks {
  if (!state) {
    return {
      hasValidStats: false,
      hasValidDate: false,
      hasValidRelationships: false,
      hasValidCareers: false,
      hasValidItems: false,
      hasValidSettings: false,
      statsInRange: false,
      noNaNValues: false,
    };
  }

  // Check stats object
  const hasValidStats = !!(
    state.stats &&
    typeof state.stats.health === 'number' &&
    typeof state.stats.happiness === 'number' &&
    typeof state.stats.energy === 'number' &&
    typeof state.stats.money === 'number'
  );

  // Check date object
  const hasValidDate = !!(
    state.date &&
    typeof state.date.age === 'number' &&
    typeof state.date.year === 'number' &&
    typeof state.date.week === 'number'
  );

  // Check arrays exist
  const hasValidRelationships = Array.isArray(state.relationships);
  const hasValidCareers = Array.isArray(state.careers);
  const hasValidItems = Array.isArray(state.items);
  const hasValidSettings = !!(state.settings && typeof state.settings.darkMode === 'boolean');

  // Check stats are in range
  const statsInRange = hasValidStats && (
    state.stats.health >= 0 && state.stats.health <= 100 &&
    state.stats.happiness >= 0 && state.stats.happiness <= 100 &&
    state.stats.energy >= 0 && state.stats.energy <= 100 &&
    state.stats.fitness >= 0 && state.stats.fitness <= 100
  );

  // Check for NaN values in critical fields
  const noNaNValues = hasValidStats && (
    !isNaN(state.stats.health) &&
    !isNaN(state.stats.happiness) &&
    !isNaN(state.stats.energy) &&
    !isNaN(state.stats.money) &&
    !isNaN(state.date?.age ?? 0) &&
    !isNaN(state.weeksLived ?? 0)
  );

  return {
    hasValidStats,
    hasValidDate,
    hasValidRelationships,
    hasValidCareers,
    hasValidItems,
    hasValidSettings,
    statsInRange,
    noNaNValues,
  };
}

/**
 * Create a full debug snapshot
 * This may take a moment as it reads AsyncStorage
 */
export async function createDebugSnapshot(): Promise<DebugSnapshot> {
  const now = new Date();
  
  // Get async storage summary
  const { keys: asyncStorageKeys, summary: asyncStorageSummary } = await getAsyncStorageSummary();
  
  // Get performance metrics if available
  const perf = aiDebugContext.getPerformanceMetrics
    ? await aiDebugContext.getPerformanceMetrics()
    : {};
  
  // Get game state
  const gameState = aiDebugContext.getStoreState
    ? aiDebugContext.getStoreState()
    : null;
  
  // Get last error
  const lastError = aiDebugContext.getLastError
    ? aiDebugContext.getLastError()
    : getLastCaughtError();

  // Get error history
  const errorHistory = getErrorHistory();

  const snapshot: DebugSnapshot = {
    meta: {
      createdAt: now.toISOString(),
      snapshotVersion: SNAPSHOT_VERSION,
      environment: aiDebugContext.environment ?? 'unknown',
      platform: Platform.OS,
      platformVersion: Platform.Version?.toString(),
      appVersion: aiDebugContext.appVersion,
      buildNumber: aiDebugContext.buildNumber,
      stateVersion: aiDebugContext.stateVersion ?? STATE_VERSION,
    },
    screen: {
      currentScreen: aiDebugContext.getCurrentScreen
        ? aiDebugContext.getCurrentScreen()
        : null,
    },
    state: {
      gameState,
      criticalStateSlice: extractCriticalStateSlice(gameState),
      asyncStorageKeys,
      asyncStorageSummary,
    },
    logs: remoteLogger.getLogs().slice(0, 100), // Last 100 logs
    performance: {
      fps: perf.fps,
      memoryMb: perf.memoryMb,
      jsHeapSizeMb: perf.jsHeapSizeMb,
    },
    errors: {
      lastError,
      errorStack: lastError instanceof Error ? lastError.stack : undefined,
      errorHistory,
    },
    integrity: {
      quickChecks: runQuickIntegrityChecks(gameState),
    },
  };

  return snapshot;
}

/**
 * Create a minimal snapshot for quick debugging
 * Faster than full snapshot - no AsyncStorage read
 */
export async function createQuickSnapshot(): Promise<Pick<DebugSnapshot, 'meta' | 'state' | 'errors' | 'integrity'>> {
  const gameState = aiDebugContext.getStoreState?.() ?? null;
  
  return {
    meta: {
      createdAt: new Date().toISOString(),
      snapshotVersion: SNAPSHOT_VERSION,
      environment: aiDebugContext.environment ?? 'unknown',
      platform: Platform.OS,
      platformVersion: Platform.Version?.toString(),
      appVersion: aiDebugContext.appVersion,
      buildNumber: aiDebugContext.buildNumber,
      stateVersion: aiDebugContext.stateVersion ?? STATE_VERSION,
    },
    state: {
      gameState: null, // Exclude full state for quick snapshot
      criticalStateSlice: extractCriticalStateSlice(gameState),
      asyncStorageKeys: [],
      asyncStorageSummary: {},
    },
    errors: {
      lastError: getLastCaughtError(),
      errorHistory: getErrorHistory(),
    },
    integrity: {
      quickChecks: runQuickIntegrityChecks(gameState),
    },
  };
}

/**
 * Create a snapshot focused on a specific area
 */
export async function createFocusedSnapshot(
  focus: 'state' | 'logs' | 'errors' | 'storage'
): Promise<Partial<DebugSnapshot>> {
  const gameState = aiDebugContext.getStoreState?.() ?? null;
  
  switch (focus) {
    case 'state':
      return {
        meta: {
          createdAt: new Date().toISOString(),
          snapshotVersion: SNAPSHOT_VERSION,
          environment: aiDebugContext.environment ?? 'unknown',
          platform: Platform.OS,
          stateVersion: aiDebugContext.stateVersion ?? STATE_VERSION,
        },
        state: {
          gameState,
          criticalStateSlice: extractCriticalStateSlice(gameState),
          asyncStorageKeys: [],
          asyncStorageSummary: {},
        },
      };
      
    case 'logs':
      return {
        meta: {
          createdAt: new Date().toISOString(),
          snapshotVersion: SNAPSHOT_VERSION,
          environment: aiDebugContext.environment ?? 'unknown',
          platform: Platform.OS,
          stateVersion: aiDebugContext.stateVersion ?? STATE_VERSION,
        },
        logs: remoteLogger.getLogs(),
      };
      
    case 'errors':
      const lastError = getLastCaughtError();
      return {
        meta: {
          createdAt: new Date().toISOString(),
          snapshotVersion: SNAPSHOT_VERSION,
          environment: aiDebugContext.environment ?? 'unknown',
          platform: Platform.OS,
          stateVersion: aiDebugContext.stateVersion ?? STATE_VERSION,
        },
        errors: {
          lastError,
          errorStack: lastError instanceof Error ? lastError.stack : undefined,
          errorHistory: getErrorHistory(),
        },
      };
      
    case 'storage':
      const { keys, summary } = await getAsyncStorageSummary();
      return {
        meta: {
          createdAt: new Date().toISOString(),
          snapshotVersion: SNAPSHOT_VERSION,
          environment: aiDebugContext.environment ?? 'unknown',
          platform: Platform.OS,
          stateVersion: aiDebugContext.stateVersion ?? STATE_VERSION,
        },
        state: {
          gameState: null,
          criticalStateSlice: {},
          asyncStorageKeys: keys,
          asyncStorageSummary: summary,
        },
      };
      
    default:
      return await createQuickSnapshot();
  }
}

