import { GameState, type GameStats } from '@/contexts/game/types';
import { STATE_VERSION } from '@/contexts/game/initialState';
import { validateGameState } from '@/utils/saveValidation';
import { logger } from '@/utils/logger';

const log = logger.scope('GameEntryValidation');

/**
 * Result of game entry validation
 */
export interface GameEntryValidationResult {
  canEnter: boolean;
  reason?: string;
  errors: string[];
  warnings: string[];
  versionCompatible: boolean;
  stateComplete: boolean;
}

/**
 * Minimum required version for compatibility
 * Saves below this version are considered incompatible
 */
const MIN_SUPPORTED_VERSION = 5;

/**
 * Maximum supported version (current version)
 * Saves above this version are from future versions
 */
const MAX_SUPPORTED_VERSION = STATE_VERSION;

const ENTRY_REQUIRED_STATS: (keyof GameStats)[] = [
  'health',
  'happiness',
  'energy',
  'fitness',
  'money',
  'reputation',
  'gems',
];

/**
 * Validates that a game state is safe to enter gameplay with
 * This is called BEFORE navigation to /(tabs) to ensure:
 * - State is complete and valid
 * - Version is compatible
 * - Required systems are initialized
 * 
 * This function does NOT mutate state - it's a pure validator
 */
export function validateGameEntry(state: GameState | null | undefined): GameEntryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if state exists
  if (!state || typeof state !== 'object') {
    return {
      canEnter: false,
      reason: 'No game state loaded',
      errors: ['Game state is null or undefined'],
      warnings: [],
      versionCompatible: false,
      stateComplete: false,
    };
  }

  // Validate version compatibility
  let versionCompatible = true;
  if (typeof state.version !== 'number') {
    errors.push('Missing or invalid state version');
    versionCompatible = false;
  } else {
    if (state.version < MIN_SUPPORTED_VERSION) {
      errors.push(
        `Save version ${state.version} is too old (minimum supported: ${MIN_SUPPORTED_VERSION}). ` +
        'This save may be incompatible with the current game version.'
      );
      versionCompatible = false;
    } else if (state.version > MAX_SUPPORTED_VERSION) {
      errors.push(
        `Save version ${state.version} is from a newer game version (current: ${MAX_SUPPORTED_VERSION}). ` +
        'Please update the game to load this save.'
      );
      versionCompatible = false;
    } else if (state.version < MAX_SUPPORTED_VERSION) {
      warnings.push(
        `Save version ${state.version} is older than current (${MAX_SUPPORTED_VERSION}). ` +
        'Migration should have updated it, but some features may be unavailable.'
      );
    }
  }

  // TESTFLIGHT FIX: Check app version compatibility (if available)
  if (state._appVersion) {
    try {
      const appConfig = require('../app.config.js');
      const currentAppVersion = appConfig.expo?.version || 'unknown';
      const saveAppVersion = state._appVersion;
      
      // Compare versions (simple string comparison for now)
      // In production, use proper semver comparison
      if (saveAppVersion !== currentAppVersion) {
        warnings.push(
          `Save was created with app version ${saveAppVersion} (current: ${currentAppVersion}). ` +
          'This may cause compatibility issues.'
        );
      }
    } catch (error) {
      // App config not available, skip check
    }
  }

  // Validate state structure using existing validation
  const validation = validateGameState(state, false); // Don't auto-fix - we're just checking
  
  if (!validation.valid) {
    errors.push(...validation.errors);
  }
  
  if (validation.warnings.length > 0) {
    warnings.push(...validation.warnings);
  }

  // Check critical systems are initialized
  let stateComplete = true;

  // Check stats
  if (!state.stats || typeof state.stats !== 'object') {
    errors.push('Stats object is missing or invalid');
    stateComplete = false;
  } else {
    for (const stat of ENTRY_REQUIRED_STATS) {
      if (!(stat in state.stats)) {
        errors.push(`Missing stat: ${stat}`);
        stateComplete = false;
      } else {
        const statValue = state.stats[stat];
        // CRITICAL FIX: Handle null/undefined values - treat as missing and use default
        if (statValue === null || statValue === undefined) {
          errors.push(`Missing stat: ${stat} (value is null or undefined)`);
          stateComplete = false;
        } else if (typeof statValue !== 'number' || isNaN(statValue) || !isFinite(statValue)) {
          errors.push(`Invalid ${stat} value: ${statValue}`);
          stateComplete = false;
        }
      }
    }
  }

  // Check date
  if (!state.date || typeof state.date !== 'object') {
    errors.push('Date object is missing or invalid');
    stateComplete = false;
  } else {
    if (typeof state.date.year !== 'number' || typeof state.date.age !== 'number' || typeof state.date.week !== 'number') {
      errors.push('Date object has invalid structure');
      stateComplete = false;
    }
  }

  // Check userProfile (required for gameplay)
  if (!state.userProfile || typeof state.userProfile !== 'object') {
    errors.push('User profile is missing or invalid');
    stateComplete = false;
  } else {
    // CRITICAL FIX: Handle null/undefined name values
    const firstName = state.userProfile.firstName;
    const lastName = state.userProfile.lastName;
    if (!firstName || firstName === null || firstName === undefined || 
        !lastName || lastName === null || lastName === undefined) {
      errors.push('User profile missing name information');
      stateComplete = false;
    }
  }

  // Check required arrays exist (can be empty, but must exist)
  const requiredArrays = [
    'careers', 'hobbies', 'items', 'relationships', 'achievements',
    'educations', 'pets', 'companies', 'realEstate', 'cryptos',
    'diseases', 'streetJobs', 'jailActivities', 'foods',
    'healthActivities', 'dietPlans', 'darkWebItems', 'hacks'
  ];

  const stateFields = state as unknown as Record<string, unknown>;
  for (const field of requiredArrays) {
    if (!Array.isArray(stateFields[field])) {
      errors.push(`${field} must be an array`);
      stateComplete = false;
    }
  }

  // Check settings
  if (!state.settings || typeof state.settings !== 'object') {
    errors.push('Settings object is missing or invalid');
    stateComplete = false;
  }

  // Determine if entry is allowed
  const canEnter = errors.length === 0 && versionCompatible && stateComplete;

  const reason = !canEnter
    ? errors.length > 0
      ? errors[0]
      : !versionCompatible
      ? 'Version incompatibility'
      : !stateComplete
      ? 'Incomplete game state'
      : 'Unknown validation failure'
    : undefined;

  log.info('Game entry validation completed', {
    canEnter,
    reason,
    errorCount: errors.length,
    warningCount: warnings.length,
    versionCompatible,
    stateComplete,
    version: state.version,
  });

  return {
    canEnter,
    reason,
    errors,
    warnings,
    versionCompatible,
    stateComplete,
  };
}

/**
 * Checks if a save slot contains valid, loadable game data
 * This is used to determine if a slot can be loaded
 * Does NOT load the state, just validates it exists and is valid
 */
export async function validateSaveSlot(slot: number): Promise<{
  valid: boolean;
  exists: boolean;
  errors: string[];
  version?: number;
}> {
  const errors: string[] = [];
  
  try {
    // CRASH FIX (A-1): Read from double-buffer system
    const { readSaveSlot, shouldAllowUnsignedLegacySaves } = await import('@/utils/saveValidation');
    const allowLegacy = shouldAllowUnsignedLegacySaves();
    const savedData = await readSaveSlot(slot, undefined, { allowLegacy });
    
    if (!savedData) {
      return {
        valid: false,
        exists: false,
        errors: ['Save slot is empty'],
      };
    }

    try {
      const { decodePersistedSaveEnvelope } = await import('@/utils/saveValidation');
      const decoded = decodePersistedSaveEnvelope(savedData, { allowLegacy });
      if (!decoded.valid || typeof decoded.data !== 'string') {
        return {
          valid: false,
          exists: true,
          errors: [decoded.error || 'Save envelope verification failed'],
        };
      }

      const parsed = JSON.parse(decoded.data);
      
      if (!parsed || typeof parsed !== 'object') {
        return {
          valid: false,
          exists: true,
          errors: ['Save data is not a valid object'],
        };
      }

      // Check version
      if (typeof parsed.version !== 'number') {
        errors.push('Save has invalid or missing version');
      } else {
        if (parsed.version < MIN_SUPPORTED_VERSION) {
          errors.push(`Save version ${parsed.version} is too old (minimum: ${MIN_SUPPORTED_VERSION})`);
        } else if (parsed.version > MAX_SUPPORTED_VERSION) {
          errors.push(`Save version ${parsed.version} is from a newer game version`);
        }
      }

      // Quick structure check
      if (!parsed.stats || typeof parsed.stats !== 'object') {
        errors.push('Save is missing stats object');
      }
      if (!parsed.date || typeof parsed.date !== 'object') {
        errors.push('Save is missing date object');
      }
      if (!parsed.userProfile || typeof parsed.userProfile !== 'object') {
        errors.push('Save is missing user profile');
      }

      return {
        valid: errors.length === 0,
        exists: true,
        errors,
        version: parsed.version,
      };
    } catch (parseError) {
      return {
        valid: false,
        exists: true,
        errors: ['Save data is corrupted or invalid JSON'],
      };
    }
  } catch (error) {
    log.error(`Error validating save slot ${slot}:`, error);
    return {
      valid: false,
      exists: false,
      errors: ['Failed to read save slot'],
    };
  }
}

