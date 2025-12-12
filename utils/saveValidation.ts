import { GameState } from '@/contexts/game/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Calculate CRC32 checksum for data integrity
 */
export function calculateChecksum(data: string): string {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i);
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff).toString(16).padStart(8, '0');
}

/**
 * Type guard to check if object has stats property
 */
function hasStats(obj: any): obj is { stats: Record<string, any> } {
  return obj !== null && obj !== undefined && typeof obj === 'object' && 'stats' in obj;
}

/**
 * Type guard to check if value is a valid number
 */
function isValidNumber(value: any): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Auto-fix stats by clamping them to valid ranges
 */
export function autoFixStats(state: any): { fixed: boolean; fixes: string[] } {
  const fixes: string[] = [];
  let fixed = false;

  if (!hasStats(state)) {
    return { fixed: false, fixes: [] };
  }

  // Clamp stats to valid ranges
  const statRanges: { [key: string]: [number, number] } = {
    health: [0, 100],
    happiness: [0, 100],
    energy: [0, 100],
    fitness: [0, 100],
    reputation: [0, 100],
  };

  for (const [stat, [min, max]] of Object.entries(statRanges)) {
    if (isValidNumber(state.stats[stat])) {
      const oldValue = state.stats[stat];
      state.stats[stat] = Math.max(min, Math.min(max, state.stats[stat]));
      if (oldValue !== state.stats[stat]) {
        fixes.push(`${stat} clamped from ${oldValue} to ${state.stats[stat]}`);
        fixed = true;
      }
    }
  }

  // Fix money and gems
  if (isValidNumber(state.stats.money)) {
    if (state.stats.money < 0) {
      const oldValue = state.stats.money;
      state.stats.money = Math.max(0, state.stats.money);
      fixes.push(`money fixed from ${oldValue} to ${state.stats.money}`);
      fixed = true;
    }
  } else if (state.stats.money !== undefined) {
    const oldValue = state.stats.money;
    state.stats.money = 0;
    fixes.push(`money fixed from ${oldValue} to 0`);
    fixed = true;
  }

  if (isValidNumber(state.stats.gems)) {
    if (state.stats.gems < 0) {
      const oldValue = state.stats.gems;
      state.stats.gems = Math.max(0, state.stats.gems);
      fixes.push(`gems fixed from ${oldValue} to ${state.stats.gems}`);
      fixed = true;
    }
  } else if (state.stats.gems !== undefined) {
    const oldValue = state.stats.gems;
    state.stats.gems = 0;
    fixes.push(`gems fixed from ${oldValue} to 0`);
    fixed = true;
  }

  return { fixed, fixes };
}

/**
 * Type guard to check if object is a valid GameState-like object
 */
function isGameStateLike(obj: any): obj is Partial<GameState> {
  return obj !== null && obj !== undefined && typeof obj === 'object';
}

/**
 * Repair common corruption patterns in game state
 */
export function repairGameState(state: any): { repaired: boolean; repairs: string[] } {
  const repairs: string[] = [];
  let repaired = false;

  if (!state || typeof state !== 'object') {
    return { repaired: false, repairs: [] };
  }

  // Ensure stats object exists
  if (!state.stats || typeof state.stats !== 'object') {
    state.stats = {
      health: 50,
      happiness: 50,
      energy: 50,
      fitness: 50,
      money: 0,
      reputation: 50,
      gems: 0,
    };
    repairs.push('Created missing stats object');
    repaired = true;
  }

  // Ensure date object exists
  if (!state.date || typeof state.date !== 'object') {
    state.date = {
      year: 2025,
      month: 'January',
      week: 1,
      age: 18,
    };
    repairs.push('Created missing date object');
    repaired = true;
  }

  // Ensure settings object exists
  if (!state.settings || typeof state.settings !== 'object') {
    state.settings = {
      darkMode: false,
      soundEnabled: true,
      notificationsEnabled: true,
      autoSave: true,
      language: 'English',
      maxStats: false,
    };
    repairs.push('Created missing settings object');
    repaired = true;
  }

  // Ensure required arrays exist
  const requiredArrays = ['careers', 'hobbies', 'items', 'relationships', 'achievements', 'educations', 'pets', 'companies', 'realEstate', 'cryptos', 'diseases', 'loans'];
  for (const field of requiredArrays) {
    if (!Array.isArray(state[field])) {
      state[field] = [];
      repairs.push(`Created missing ${field} array`);
      repaired = true;
    }
  }

  // Fix invalid array items
  if (Array.isArray(state.items)) {
    const originalLength = state.items.length;
    state.items = state.items.filter((item: any) => item && typeof item === 'object' && item.id);
    if (state.items.length !== originalLength) {
      repairs.push(`Removed ${originalLength - state.items.length} invalid items`);
      repaired = true;
    }
  }

  // Fix invalid relationships
  if (Array.isArray(state.relationships)) {
    const originalLength = state.relationships.length;
    state.relationships = state.relationships.filter((rel: any) => rel && typeof rel === 'object' && rel.id);
    if (state.relationships.length !== originalLength) {
      repairs.push(`Removed ${originalLength - state.relationships.length} invalid relationships`);
      repaired = true;
    }
  }

  // Ensure version exists
  if (typeof state.version !== 'number' || state.version < 1) {
    state.version = 5; // Default to current version
    repairs.push('Set missing/invalid version');
    repaired = true;
  }

  return { repaired, repairs };
}

/**
 * Validate game state structure and data integrity
 * Enhanced to be more permissive and allow saving with warnings
 */
export function validateGameState(state: any, autoFix: boolean = false): { valid: boolean; errors: string[]; warnings: string[]; fixed?: boolean; fixes?: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check if state exists
  if (!isGameStateLike(state)) {
    errors.push('Game state is null or undefined');
    return { valid: false, errors };
  }

  // Repair common corruption patterns first
  if (autoFix) {
    const repairResult = repairGameState(state);
    if (repairResult.repaired) {
      warnings.push(...repairResult.repairs);
    }
    // Then auto-fix stats
    const fixResult = autoFixStats(state);
    if (fixResult.fixed) {
      warnings.push(...fixResult.fixes);
    }
  }

  // Validate version
  if (typeof state.version !== 'number') {
    errors.push('Missing or invalid state version');
  }

  // Validate required fields
  if (!state.stats) {
    errors.push('Missing stats object');
  } else {
    // Validate stats structure
    const requiredStats = ['health', 'happiness', 'energy', 'fitness', 'money', 'reputation', 'gems'];
    for (const stat of requiredStats) {
      if (!isValidNumber(state.stats[stat])) {
        errors.push(`Invalid ${stat} value: expected number, got ${typeof state.stats[stat]}`);
      }
    }

  // Validate stat ranges - only report as errors if auto-fix didn't work
  // Otherwise, these are warnings that were fixed
  if (autoFix) {
    // If auto-fix was used, check if fixes were applied
    // If stats are still out of range after auto-fix, it's an error
    if (state.stats.health < 0 || state.stats.health > 100) {
      errors.push(`Health out of range after auto-fix: ${state.stats.health} (expected 0-100)`);
    }
    if (state.stats.happiness < 0 || state.stats.happiness > 100) {
      errors.push(`Happiness out of range after auto-fix: ${state.stats.happiness} (expected 0-100)`);
    }
    if (state.stats.energy < 0 || state.stats.energy > 100) {
      errors.push(`Energy out of range after auto-fix: ${state.stats.energy} (expected 0-100)`);
    }
    if (state.stats.fitness < 0 || state.stats.fitness > 100) {
      errors.push(`Fitness out of range after auto-fix: ${state.stats.fitness} (expected 0-100)`);
    }
    if (!isValidNumber(state.stats.money) || state.stats.money < 0) {
      errors.push(`Invalid money value after auto-fix: ${state.stats.money}`);
    }
    if (!isValidNumber(state.stats.reputation) || state.stats.reputation < 0 || state.stats.reputation > 100) {
      errors.push(`Reputation out of range after auto-fix: ${state.stats.reputation} (expected 0-100)`);
    }
    if (!isValidNumber(state.stats.gems) || state.stats.gems < 0) {
      errors.push(`Invalid gems value after auto-fix: ${state.stats.gems}`);
    }
  } else {
    // Without auto-fix, report as warnings (not errors) to allow saving
    if (state.stats.health < 0 || state.stats.health > 100) {
      warnings.push(`Health out of range: ${state.stats.health} (expected 0-100)`);
    }
    if (state.stats.happiness < 0 || state.stats.happiness > 100) {
      warnings.push(`Happiness out of range: ${state.stats.happiness} (expected 0-100)`);
    }
    if (state.stats.energy < 0 || state.stats.energy > 100) {
      warnings.push(`Energy out of range: ${state.stats.energy} (expected 0-100)`);
    }
    if (state.stats.fitness < 0 || state.stats.fitness > 100) {
      warnings.push(`Fitness out of range: ${state.stats.fitness} (expected 0-100)`);
    }
    if (!isValidNumber(state.stats.money) || state.stats.money < 0) {
      warnings.push(`Invalid money value: ${state.stats.money}`);
    }
    if (!isValidNumber(state.stats.reputation) || state.stats.reputation < 0 || state.stats.reputation > 100) {
      warnings.push(`Reputation out of range: ${state.stats.reputation} (expected 0-100)`);
    }
    if (!isValidNumber(state.stats.gems) || state.stats.gems < 0) {
      warnings.push(`Invalid gems value: ${state.stats.gems}`);
    }
  }
  }

  if (!state.date || typeof state.date !== 'object') {
    errors.push('Missing date object');
  } else {
    if (!isValidNumber(state.date.year) || state.date.year < 0) {
      errors.push(`Invalid year: ${state.date.year}`);
    }
    if (!isValidNumber(state.date.week) || state.date.week < 0) {
      errors.push(`Invalid week: ${state.date.week}`);
    }
    if (!isValidNumber(state.date.age) || state.date.age < 0) {
      errors.push(`Invalid age: ${state.date.age}`);
    }
  }

  if (!state.settings) {
    errors.push('Missing settings object');
  } else {
    // Only validate if the field exists (allow undefined for optional fields)
    if (state.settings.soundEnabled !== undefined && typeof state.settings.soundEnabled !== 'boolean') {
      errors.push('Invalid settings.soundEnabled');
    }
    if (state.settings.musicEnabled !== undefined && typeof state.settings.musicEnabled !== 'boolean') {
      errors.push('Invalid settings.musicEnabled');
    }
    if (state.settings.darkMode !== undefined && typeof state.settings.darkMode !== 'boolean') {
      errors.push('Invalid settings.darkMode');
    }
  }

  // Validate arrays exist (even if empty) - only check fields that should always exist
  // If auto-fix is enabled, repair function already fixed these, so just warn
  const requiredArrayFields = ['careers', 'hobbies', 'items', 'relationships', 'achievements', 'educations'];
  for (const field of requiredArrayFields) {
    if (!Array.isArray(state[field])) {
      if (autoFix) {
        // Should have been fixed by repair, but if not, it's an error
        errors.push(`${field} must be an array (repair failed)`);
      } else {
        warnings.push(`${field} should be an array`);
      }
    }
  }

  // Optional array fields - only validate if they exist
  const optionalArrayFields = ['log', 'history', 'properties', 'pets', 'companies', 'realEstate', 'cryptos'];
  for (const field of optionalArrayFields) {
    if (state[field] !== undefined && !Array.isArray(state[field])) {
      errors.push(`${field} must be an array if present`);
    }
  }

  // Deep validation of critical arrays
  if (Array.isArray(state.items)) {
    state.items.forEach((item: any, index: number) => {
      if (!item || typeof item !== 'object' || !item.id || typeof item.id !== 'string') {
        errors.push(`Item at index ${index} missing valid id`);
      }
    });
  }

  // Allow saving with warnings (only block on critical errors)
  // Critical errors are: missing required objects, invalid types that can't be fixed
  const criticalErrors = errors.filter(e => 
    e.includes('null or undefined') || 
    e.includes('Missing') ||
    e.includes('must be an array') ||
    e.includes('repair failed')
  );
  
  return {
    valid: criticalErrors.length === 0, // Only block on critical errors
    errors: criticalErrors.length > 0 ? criticalErrors : errors, // Return all errors for logging
    warnings,
  };
}

/**
 * Create save data with checksum
 */
export function createSaveData(state: GameState, version: number): { data: string; checksum: string } {
  const saveData = {
    ...state,
    version,
    updatedAt: Date.now(),
  };
  
  const dataString = JSON.stringify(saveData);
  const checksum = calculateChecksum(dataString);
  
  return {
    data: dataString,
    checksum,
  };
}

/**
 * Verify save data integrity using checksum
 */
export function verifySaveData(data: string, expectedChecksum: string): boolean {
  const actualChecksum = calculateChecksum(data);
  return actualChecksum === expectedChecksum;
}

/**
 * Parse and validate save data
 */
export function parseSaveData(dataString: string, checksum?: string): { state: GameState | null; valid: boolean; errors: string[] } {
  try {
    // Verify checksum if provided
    if (checksum && !verifySaveData(dataString, checksum)) {
      return {
        state: null,
        valid: false,
        errors: ['Checksum verification failed - data may be corrupted'],
      };
    }

    const parsed = JSON.parse(dataString);
    const validation = validateGameState(parsed);

    return {
      state: validation.valid ? (parsed as GameState) : null,
      valid: validation.valid,
      errors: validation.errors,
    };
  } catch (error) {
    return {
      state: null,
      valid: false,
      errors: [`Failed to parse save data: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Atomic save operation with write-verify pattern to prevent corruption
 * Writes to temp key first, verifies, then moves to final key
 */
export async function atomicSave(
  key: string,
  data: string,
  storage: typeof AsyncStorage = AsyncStorage
): Promise<{ success: boolean; error?: string }> {
  const tempKey = `${key}_temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  try {
    // Step 1: Write to temp key first
    await storage.setItem(tempKey, data);
    
    // Step 2: Verify write succeeded
    const verify = await storage.getItem(tempKey);
    if (verify !== data) {
      // Cleanup temp on verification failure
      try {
        await storage.removeItem(tempKey);
      } catch {}
      return { success: false, error: 'Write verification failed' };
    }
    
    // Step 3: Move to final key (atomic on most platforms)
    await storage.setItem(key, data);
    
    // Step 4: Verify final write
    const finalVerify = await storage.getItem(key);
    if (finalVerify !== data) {
      // Cleanup both on final verification failure
      try {
        await storage.removeItem(key);
        await storage.removeItem(tempKey);
      } catch {}
      return { success: false, error: 'Final write verification failed' };
    }
    
    // Step 5: Cleanup temp key (success)
    try {
      await storage.removeItem(tempKey);
    } catch {
      // Non-critical if temp cleanup fails
    }
    
    return { success: true };
  } catch (error) {
    // Cleanup temp on any error
    try {
      await storage.removeItem(tempKey);
    } catch {}
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during atomic save',
    };
  }
}
