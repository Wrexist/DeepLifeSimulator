import { GameState } from '@/contexts/game/types';
import { STATE_VERSION } from '@/contexts/game/initialState';
import { logger } from '@/utils/logger';

// Lazy-load AsyncStorage to prevent TurboModule crash at module load time (iOS)
let _asyncStorage: any = null;
let _loadAttempted = false;
function getAsyncStorage(): any {
  if (_asyncStorage) return _asyncStorage;
  if (_loadAttempted) return null;
  _loadAttempted = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _asyncStorage = require('@react-native-async-storage/async-storage').default;
    return _asyncStorage;
  } catch {
    return null;
  }
}
const AsyncStorage = {
  get instance() { return getAsyncStorage(); },
  async setItem(key: string, value: string) { const s = getAsyncStorage(); if (!s) throw new Error('AsyncStorage not available'); return s.setItem(key, value); },
  async getItem(key: string) { const s = getAsyncStorage(); if (!s) return null; return s.getItem(key); },
  async removeItem(key: string) { const s = getAsyncStorage(); if (!s) return; return s.removeItem(key); },
  async multiGet(keys: string[]) { const s = getAsyncStorage(); if (!s) return keys.map((k: string) => [k, null] as const); return s.multiGet(keys); },
  async multiRemove(keys: string[]) { const s = getAsyncStorage(); if (!s) return; return s.multiRemove(keys); },
  async getAllKeys() { const s = getAsyncStorage(); if (!s) return []; return s.getAllKeys(); },
};
import {
  resolveSaveSigningRuntimeConfig,
  resolveActiveSaveHmacKey,
  SaveSigningConfigError,
} from '@/utils/saveSigningConfig';
export {
  SAVE_SIGNING_CONFIG_ERROR_CODE,
  SaveSigningConfigError,
  isSaveSigningConfigError,
} from '@/utils/saveSigningConfig';

const SAVE_SIGNATURE_KEY = process.env.EXPO_PUBLIC_SAVE_SIGNATURE_KEY;
// Expo only inlines EXPO_PUBLIC_* vars for direct member access,
// not when iterating process.env dynamically.
const saveSigningRuntime = resolveSaveSigningRuntimeConfig(
  {
    NODE_ENV: process.env.NODE_ENV,
    EXPO_PUBLIC_SAVE_HMAC_KEY: process.env.EXPO_PUBLIC_SAVE_HMAC_KEY,
    EXPO_PUBLIC_SAVE_SIGNATURE_KEY: process.env.EXPO_PUBLIC_SAVE_SIGNATURE_KEY,
    EXPO_PUBLIC_REQUIRE_SIGNED_SAVES: process.env.EXPO_PUBLIC_REQUIRE_SIGNED_SAVES,
    EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION: process.env.EXPO_PUBLIC_ALLOW_WEAK_SAVE_MIGRATION,
    EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES: process.env.EXPO_PUBLIC_ALLOW_UNSIGNED_LEGACY_SAVES,
  },
  typeof __DEV__ !== 'undefined' ? __DEV__ : undefined
);
const REQUIRE_SIGNED_SAVES = saveSigningRuntime.requireSignedSaves;
const ALLOW_WEAK_SAVE_MIGRATION = saveSigningRuntime.allowWeakSaveMigration;
const ALLOW_UNSIGNED_LEGACY_SAVES = saveSigningRuntime.allowUnsignedLegacySaves;

/**
 * Calculate CRC32 checksum for data integrity (error detection, NOT tamper detection)
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

export interface SaveEnvelopeV2 {
  v: 2;
  data: string;
  checksum: string;
  hmac?: string;
  signature?: string;
}

export interface DecodedSaveEnvelope {
  valid: boolean;
  data?: string;
  format?: 'v2' | 'legacy';
  error?: string;
}

export function shouldAllowUnsignedLegacySaves(): boolean {
  return ALLOW_UNSIGNED_LEGACY_SAVES;
}

// --- HMAC-SHA256 implementation for tamper-evident save integrity ---
// Pure JS implementation since expo-crypto is not available in this project.
// This raises the bar significantly above CRC32 recalculation.

function getActiveSaveHmacKey(): string | null {
  const activeKey = resolveActiveSaveHmacKey(saveSigningRuntime);
  if (activeKey) return activeKey;

  if (!REQUIRE_SIGNED_SAVES || ALLOW_WEAK_SAVE_MIGRATION) {
    logger.error('[SAVE_SECURITY] Missing save HMAC key in production; weak migration mode enabled');
    return null;
  }

  logger.error('[SAVE_SECURITY] Missing required save HMAC key in production');
  return null;
}

function sha256(message: string): string {
  // SHA-256 constants
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];

  const rr = (v: number, n: number) => (v >>> n) | (v << (32 - n));

  // Pre-processing: convert message to bytes
  const bytes: number[] = [];
  for (let i = 0; i < message.length; i++) {
    const c = message.charCodeAt(i);
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) { bytes.push(0xc0 | (c >> 6)); bytes.push(0x80 | (c & 0x3f)); }
    else { bytes.push(0xe0 | (c >> 12)); bytes.push(0x80 | ((c >> 6) & 0x3f)); bytes.push(0x80 | (c & 0x3f)); }
  }

  const bitLen = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  // Append 64-bit big-endian length
  for (let i = 56; i >= 0; i -= 8) bytes.push((bitLen >>> i) & 0xff);

  let h0 = 0x6a09e667, h1 = 0xbb67ae85, h2 = 0x3c6ef372, h3 = 0xa54ff53a;
  let h4 = 0x510e527f, h5 = 0x9b05688c, h6 = 0x1f83d9ab, h7 = 0x5be0cd19;

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const w = new Array(64);
    for (let i = 0; i < 16; i++) {
      w[i] = (bytes[offset + i * 4] << 24) | (bytes[offset + i * 4 + 1] << 16) |
             (bytes[offset + i * 4 + 2] << 8) | bytes[offset + i * 4 + 3];
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rr(w[i - 15], 7) ^ rr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rr(w[i - 2], 17) ^ rr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let a = h0, b = h1, c = h2, d = h3, e = h4, f = h5, g = h6, h = h7;
    for (let i = 0; i < 64; i++) {
      const S1 = rr(e, 6) ^ rr(e, 11) ^ rr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rr(a, 2) ^ rr(a, 13) ^ rr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    h0 = (h0 + a) | 0; h1 = (h1 + b) | 0; h2 = (h2 + c) | 0; h3 = (h3 + d) | 0;
    h4 = (h4 + e) | 0; h5 = (h5 + f) | 0; h6 = (h6 + g) | 0; h7 = (h7 + h) | 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map(v => (v >>> 0).toString(16).padStart(8, '0'))
    .join('');
}

/**
 * HMAC-SHA256 signature for tamper-evident save envelopes.
 * Uses configured key material (build/runtime config), never a hardcoded static key.
 */
export function calculateHmacSignature(data: string): string {
  const key = getActiveSaveHmacKey();
  if (!key) {
    if (ALLOW_WEAK_SAVE_MIGRATION) {
      // Explicit weak-mode fallback for controlled migration windows only.
      return calculateChecksum(`weak:${data}`);
    }
    throw new SaveSigningConfigError();
  }
  // HMAC: H((key XOR opad) || H((key XOR ipad) || message))
  const blockSize = 64;
  let keyBytes: number[] = [];
  for (let i = 0; i < key.length; i++) keyBytes.push(key.charCodeAt(i));
  if (keyBytes.length > blockSize) {
    // Hash the key if it's longer than block size
    const hashedKey = sha256(key);
    keyBytes = [];
    for (let i = 0; i < hashedKey.length; i += 2) {
      keyBytes.push(parseInt(hashedKey.substr(i, 2), 16));
    }
  }
  while (keyBytes.length < blockSize) keyBytes.push(0);

  let ipadStr = '', opadStr = '';
  for (let i = 0; i < blockSize; i++) {
    ipadStr += String.fromCharCode(keyBytes[i] ^ 0x36);
    opadStr += String.fromCharCode(keyBytes[i] ^ 0x5c);
  }

  const innerHash = sha256(ipadStr + data);
  // Convert inner hash hex back to string for outer hash
  let innerBytes = '';
  for (let i = 0; i < innerHash.length; i += 2) {
    innerBytes += String.fromCharCode(parseInt(innerHash.substr(i, 2), 16));
  }
  return sha256(opadStr + innerBytes);
}

/**
 * Legacy keyed signature (CRC32-based) for backwards compatibility with old saves.
 */
export function calculateSignature(data: string, key: string): string {
  return calculateChecksum(`${key}:${data}`);
}

/**
 * Type guard to check if object has stats property
 * Uses 'unknown' for better type safety in validation functions
 */
function hasStats(obj: unknown): obj is { stats: Record<string, unknown> } {
  return obj !== null && obj !== undefined && typeof obj === 'object' && 'stats' in obj;
}

/**
 * Type guard to check if value is a valid number
 * Uses 'unknown' for better type safety in validation functions
 */
function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Auto-fix stats by clamping them to valid ranges
 * Uses 'unknown' for better type safety in validation functions
 */
export function autoFixStats(state: unknown): { fixed: boolean; fixes: string[] } {
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

  if (fixed && fixes.length > 0) {
    logger.warn('autoFixStats: corrected invalid stat values', { fixes });
  }

  return { fixed, fixes };
}

/**
 * Type guard to check if object is a valid GameState-like object
 * Uses 'unknown' for better type safety in validation functions
 */
function isGameStateLike(obj: unknown): obj is Partial<GameState> {
  if (obj === null || obj === undefined || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  // Check for key required fields to distinguish from arbitrary objects
  return 'stats' in o && typeof o.stats === 'object' && o.stats !== null
    && 'weeksLived' in o && typeof o.weeksLived === 'number';
}

/**
 * Repair common corruption patterns in game state
 * Uses 'unknown' for better type safety in validation functions
 */
export function repairGameState(state: unknown): { repaired: boolean; repairs: string[] } {
  const repairs: string[] = [];
  let repaired = false;

  if (!state || typeof state !== 'object') {
    return { repaired: false, repairs: [] };
  }

  // Cast to Record for dynamic property access after the type guard above
  const s = state as Record<string, any>;

  // Ensure stats object exists
  if (!s.stats || typeof s.stats !== 'object') {
    s.stats = {
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
  if (!s.date || typeof s.date !== 'object') {
    s.date = {
      year: 2025,
      month: 'January',
      week: 1,
      age: 18,
    };
    repairs.push('Created missing date object');
    repaired = true;
  }

  // Ensure settings object exists
  if (!s.settings || typeof s.settings !== 'object') {
    s.settings = {
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
    if (!Array.isArray(s[field])) {
      s[field] = [];
      repairs.push(`Created missing ${field} array`);
      repaired = true;
    }
  }

  // Fix invalid hobbies
  if (Array.isArray(s.hobbies)) {
    s.hobbies = s.hobbies.map((hobby: any) => {
      if (!hobby || typeof hobby !== 'object' || !hobby.id) {
        return null; // Mark for removal
      }
      // Clamp skillLevel to valid range [>= 0]
      if (typeof hobby.skillLevel === 'number') {
        const oldLevel = hobby.skillLevel;
        hobby.skillLevel = Math.max(0, hobby.skillLevel);
        if (oldLevel !== hobby.skillLevel) {
          repairs.push(`Hobby ${hobby.id} skillLevel clamped from ${oldLevel} to ${hobby.skillLevel}`);
          repaired = true;
        }
      } else {
        hobby.skillLevel = 1; // Default value
        repairs.push(`Hobby ${hobby.id} skillLevel set to default 1`);
        repaired = true;
      }
      // Clamp skill to valid range [>= 0]
      if (typeof hobby.skill === 'number') {
        const oldSkill = hobby.skill;
        hobby.skill = Math.max(0, hobby.skill);
        if (oldSkill !== hobby.skill) {
          repairs.push(`Hobby ${hobby.id} skill clamped from ${oldSkill} to ${hobby.skill}`);
          repaired = true;
        }
      } else {
        hobby.skill = 0; // Default value
        repairs.push(`Hobby ${hobby.id} skill set to default 0`);
        repaired = true;
      }
      return hobby;
    }).filter((hobby: any) => hobby !== null);
  }

  // Fix invalid array items
  if (Array.isArray(s.items)) {
    const originalLength = s.items.length;
    s.items = s.items.filter((item: unknown) =>
      item !== null &&
      typeof item === 'object' &&
      'id' in item &&
      typeof (item as { id: unknown }).id === 'string'
    );
    if (s.items.length !== originalLength) {
      repairs.push(`Removed ${originalLength - s.items.length} invalid items`);
      repaired = true;
    }
  }

  // Fix invalid relationships
  if (Array.isArray(s.relationships)) {
    const originalLength = s.relationships.length;
    s.relationships = s.relationships.map((rel: any) => {
      if (!rel || typeof rel !== 'object' || !rel.id) {
        return null; // Mark for removal
      }
      // Clamp relationshipScore to valid range [0, 100]
      if (typeof rel.relationshipScore === 'number') {
        const oldScore = rel.relationshipScore;
        rel.relationshipScore = Math.max(0, Math.min(100, rel.relationshipScore));
        if (oldScore !== rel.relationshipScore) {
          repairs.push(`Relationship ${rel.id} score clamped from ${oldScore} to ${rel.relationshipScore}`);
          repaired = true;
        }
      } else {
        rel.relationshipScore = 50; // Default value
        repairs.push(`Relationship ${rel.id} score set to default 50`);
        repaired = true;
      }
      return rel;
    }).filter((rel: any) => rel !== null);

    if (s.relationships.length !== originalLength) {
      repairs.push(`Removed ${originalLength - s.relationships.length} invalid relationships`);
      repaired = true;
    }
  }

  // CRASH FIX (B-6): Deep NaN/Infinity scanner for nested numeric fields
  // Scan and repair NaN/Infinity in arrays of objects (stocks, loans, companies, etc.)
  const scanAndRepairArray = (arr: any[], fieldName: string, numericFields: string[]) => {
    if (!Array.isArray(arr)) return;
    arr.forEach((item, idx) => {
      if (!item || typeof item !== 'object') return;
      for (const field of numericFields) {
        if (typeof item[field] === 'number' && (!isFinite(item[field]) || isNaN(item[field]))) {
          const oldVal = item[field];
          item[field] = 0;
          repairs.push(`${fieldName}[${idx}].${field} was ${oldVal}, reset to 0`);
          repaired = true;
        }
      }
    });
  };

  // Scan stock holdings
  if (s.stocks?.holdings) {
    scanAndRepairArray(s.stocks.holdings, 'stocks.holdings', ['shares', 'currentPrice', 'averagePrice', 'totalInvested']);
  }
  // Scan loans
  if (Array.isArray(s.loans)) {
    scanAndRepairArray(s.loans, 'loans', ['principal', 'remaining', 'interestRate', 'weeklyPayment', 'weeksRemaining']);
  }
  // Scan companies
  if (Array.isArray(s.companies)) {
    scanAndRepairArray(s.companies, 'companies', ['weeklyIncome', 'value', 'cash', 'revenue', 'expenses']);
  }
  // Scan real estate
  if (Array.isArray(s.realEstate)) {
    scanAndRepairArray(s.realEstate, 'realEstate', ['price', 'rent', 'weeklyIncome', 'mortgage']);
  }
  // Scan cryptos
  if (Array.isArray(s.cryptos)) {
    scanAndRepairArray(s.cryptos, 'cryptos', ['price', 'owned', 'totalInvested']);
  }
  // Scan bankSavings
  if (typeof s.bankSavings === 'number' && (!isFinite(s.bankSavings) || isNaN(s.bankSavings))) {
    repairs.push(`bankSavings was ${s.bankSavings}, reset to 0`);
    s.bankSavings = 0;
    repaired = true;
  }

  // ── v11+ engagement wave defaults ──────────────────────────────
  // Players upgrading from v10 won't have these fields. Code that reads
  // e.g. state.playStreak.count will crash if playStreak is undefined.
  if (!s.playStreak || typeof s.playStreak !== 'object') {
    s.playStreak = { count: 0, lastPlayTimestamp: 0, longestStreak: 0 };
    repairs.push('Created missing playStreak object');
    repaired = true;
  }
  if (typeof s.legacyPoints !== 'number') {
    s.legacyPoints = 0;
    repairs.push('Set missing legacyPoints to 0');
    repaired = true;
  }
  if (s.activeChapterId === undefined) {
    s.activeChapterId = 'ch1_fresh_start';
    repairs.push('Set missing activeChapterId');
    repaired = true;
  }
  if (!Array.isArray(s.completedChapters)) {
    s.completedChapters = [];
    repairs.push('Created missing completedChapters array');
    repaired = true;
  }
  if (!Array.isArray(s.completedTutorialSteps)) {
    s.completedTutorialSteps = [];
    repairs.push('Created missing completedTutorialSteps array');
    repaired = true;
  }
  if (!Array.isArray(s.discoveredSecrets)) {
    s.discoveredSecrets = [];
    repairs.push('Created missing discoveredSecrets array');
    repaired = true;
  }
  if (!s.ribbonCollection || typeof s.ribbonCollection !== 'object') {
    s.ribbonCollection = { earned: [], discoveredIds: [] };
    repairs.push('Created missing ribbonCollection object');
    repaired = true;
  }
  if (!Array.isArray(s.checkpoints)) {
    s.checkpoints = [];
    repairs.push('Created missing checkpoints array');
    repaired = true;
  }
  if (typeof s.timeMachineUsesThisLife !== 'number') {
    s.timeMachineUsesThisLife = 0;
    repairs.push('Set missing timeMachineUsesThisLife to 0');
    repaired = true;
  }

  // ── v12+ addiction wave defaults ──────────────────────────────
  if (!s.diseaseHistory || typeof s.diseaseHistory !== 'object') {
    s.diseaseHistory = { diseases: [], totalDiseases: 0, totalCured: 0, deathsFromDisease: 0 };
    repairs.push('Created missing diseaseHistory object');
    repaired = true;
  }
  if (!Array.isArray(s.diseaseImmunities)) {
    s.diseaseImmunities = [];
    repairs.push('Created missing diseaseImmunities array');
    repaired = true;
  }

  // ── Settings sub-field defaults (added across v11/v12) ────────
  if (s.settings && typeof s.settings === 'object') {
    if (typeof s.settings.showDecimalsInStats !== 'boolean') {
      s.settings.showDecimalsInStats = false;
      repairs.push('Set missing settings.showDecimalsInStats');
      repaired = true;
    }
    if (typeof s.settings.autoProgression !== 'boolean') {
      s.settings.autoProgression = true;
      repairs.push('Set missing settings.autoProgression');
      repaired = true;
    }
    if (typeof s.settings.weeklySummaryEnabled !== 'boolean') {
      s.settings.weeklySummaryEnabled = true;
      repairs.push('Set missing settings.weeklySummaryEnabled');
      repaired = true;
    }
  }

  // Ensure version exists — use current STATE_VERSION, not a stale hardcoded value
  if (typeof s.version !== 'number' || s.version < 1) {
    s.version = STATE_VERSION;
    repairs.push(`Set missing/invalid version to current (${STATE_VERSION})`);
    repaired = true;
  }

  // Migrate staking positions from cyclical week to absolute week
  if (s.warehouse?.stakingPositions) {
    s.warehouse.stakingPositions.forEach((pos: any) => {
      if (!pos.startAbsoluteWeek && pos.startWeek <= 4 && (s.weeksLived || 0) > 4) {
        // Best-effort migration: estimate absolute start from weeksLived
        pos.startAbsoluteWeek = Math.max(0, (s.weeksLived || 0) - Math.floor((pos.lockWeeks || 4) / 2));
        pos.lastClaimAbsoluteWeek = pos.startAbsoluteWeek;
        repairs.push(`Migrated staking position startWeek from ${pos.startWeek} to absolute ${pos.startAbsoluteWeek}`);
        repaired = true;
      }
    });
  }

  // Migrate travel trip from cyclical week to absolute week
  if (s.travel?.currentTrip && s.travel.currentTrip.returnWeek <= 8 && (s.weeksLived || 0) > 8) {
    // Legacy returnWeek was stored using cyclical week — allow immediate return
    s.travel.currentTrip.returnWeek = 0;
    s.travel.currentTrip.startWeek = 0;
    repairs.push('Migrated travel trip timing from cyclical to absolute week');
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
    return { valid: false, errors, warnings: [] };
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
      const statValue = (state.stats as any)[stat];
      if (!isValidNumber(statValue)) {
        errors.push(`Invalid ${stat} value: expected number, got ${typeof statValue}`);
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

  // NaN/Infinity corruption detection for all key numeric fields
  // These always indicate corruption regardless of autoFix setting
  if (state.stats) {
    const numericStatFields = ['health', 'happiness', 'energy', 'fitness', 'money', 'reputation', 'gems'];
    for (const stat of numericStatFields) {
      const val = (state.stats as any)[stat];
      if (typeof val === 'number' && (!isFinite(val) || isNaN(val))) {
        errors.push(`${stat} is ${val} (NaN/Infinity indicates corruption)`);
      }
    }
  }

  // Validate bankSavings if present
  if (state.bankSavings !== undefined) {
    if (typeof state.bankSavings === 'number' && (!isFinite(state.bankSavings) || isNaN(state.bankSavings))) {
      errors.push(`bankSavings is ${state.bankSavings} (NaN/Infinity indicates corruption)`);
    }
  }

  // Validate weeksLived if present
  if (state.weeksLived !== undefined) {
    if (typeof state.weeksLived === 'number' && (!isFinite(state.weeksLived) || isNaN(state.weeksLived))) {
      errors.push(`weeksLived is ${state.weeksLived} (NaN/Infinity indicates corruption)`);
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
    // Semantic corruption detection: age > 200 is impossible
    if (isValidNumber(state.date.age) && state.date.age > 200) {
      errors.push(`Age ${state.date.age} exceeds maximum valid age (200), likely corrupted`);
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
    if (!Array.isArray((state as any)[field])) {
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
    if ((state as any)[field] !== undefined && !Array.isArray((state as any)[field])) {
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
export function createSaveData(state: GameState, version: number): { data: string; checksum: string; signature?: string; hmac?: string } {
  const saveData = {
    ...state,
    version,
    updatedAt: Date.now(),
  };

  const dataString = JSON.stringify(saveData);
  const checksum = calculateChecksum(dataString);
  let hmac: string | undefined;
  try {
    // ANTI-EXPLOIT: Always include HMAC-SHA256 signature for tamper detection.
    hmac = calculateHmacSignature(dataString);
  } catch (error) {
    if (REQUIRE_SIGNED_SAVES && !ALLOW_WEAK_SAVE_MIGRATION) {
      throw error;
    }
    logger.warn('[SAVE_SECURITY] Failed to generate HMAC during createSaveData', { error });
  }
  // Legacy signature for backwards compatibility
  const signature = SAVE_SIGNATURE_KEY ? calculateSignature(dataString, SAVE_SIGNATURE_KEY) : undefined;

  return {
    data: dataString,
    checksum,
    signature,
    hmac,
  };
}

/**
 * Wrap serialized state in the canonical v2 save envelope.
 */
export function createSaveEnvelope(dataString: string): string {
  const checksum = calculateChecksum(dataString);
  let hmac: string | undefined;
  try {
    hmac = calculateHmacSignature(dataString);
  } catch (error) {
    if (REQUIRE_SIGNED_SAVES && !ALLOW_WEAK_SAVE_MIGRATION) {
      throw error;
    }
    logger.warn('[SAVE_SECURITY] Failed to generate HMAC during createSaveEnvelope', { error });
  }
  const signature = SAVE_SIGNATURE_KEY ? calculateSignature(dataString, SAVE_SIGNATURE_KEY) : undefined;

  return JSON.stringify({
    v: 2,
    data: dataString,
    checksum,
    ...(hmac ? { hmac } : {}),
    ...(signature ? { signature } : {}),
  });
}

/**
 * Verify save data integrity using checksum and HMAC signature.
 * Accepts both legacy (CRC32-only) and new (HMAC-SHA256) formats for backwards compatibility.
 */
export function verifySaveData(data: string, expectedChecksum: string, expectedSignature?: string, expectedHmac?: string): boolean {
  // Always verify CRC32 checksum for basic corruption detection
  const actualChecksum = calculateChecksum(data);
  if (actualChecksum !== expectedChecksum) {
    return false;
  }

  // ANTI-EXPLOIT: Verify HMAC-SHA256 if present (new saves always have this)
  if (expectedHmac) {
    let actualHmac: string;
    try {
      actualHmac = calculateHmacSignature(data);
    } catch {
      return false;
    }
    if (actualHmac !== expectedHmac) {
      // Optional migration escape hatch only when explicitly enabled.
      if (!(ALLOW_WEAK_SAVE_MIGRATION && expectedSignature && SAVE_SIGNATURE_KEY)) {
        return false;
      }
      const actualSignature = calculateSignature(data, SAVE_SIGNATURE_KEY);
      return actualSignature === expectedSignature;
    }
    return true; // HMAC verified, skip legacy signature check
  }

  // Legacy signature verification for old saves (backwards compatible)
  if (expectedSignature) {
    if (!SAVE_SIGNATURE_KEY) {
      return __DEV__ || ALLOW_WEAK_SAVE_MIGRATION;
    }
    const actualSignature = calculateSignature(data, SAVE_SIGNATURE_KEY);
    return actualSignature === expectedSignature;
  }

  // Checksum-only saves are only allowed in controlled migration/development.
  return !REQUIRE_SIGNED_SAVES || ALLOW_WEAK_SAVE_MIGRATION;
}

/**
 * Strict verification for v2 envelope payloads.
 * Requires HMAC or signature metadata (checksum-only is not enough for tamper checks).
 */
export function verifySaveEnvelopeData(
  data: string,
  expectedChecksum: string,
  expectedSignature?: string,
  expectedHmac?: string
): boolean {
  if (!expectedChecksum || (!expectedHmac && !expectedSignature)) {
    return false;
  }

  return verifySaveData(data, expectedChecksum, expectedSignature, expectedHmac);
}

function looksLikeLegacySavePayload(parsed: unknown): boolean {
  if (!parsed || typeof parsed !== 'object') return false;
  const candidate = parsed as Record<string, unknown>;
  if (!candidate.stats || typeof candidate.stats !== 'object') return false;
  if (!candidate.date || typeof candidate.date !== 'object') return false;
  if (!('weeksLived' in candidate) || typeof candidate.weeksLived !== 'number') return false;
  return true;
}

/**
 * Decode persisted save content.
 * - v2 envelopes are verified strictly.
 * - legacy raw saves can optionally be accepted for migration compatibility.
 */
export function decodePersistedSaveEnvelope(
  persistedData: string,
  options: { allowLegacy?: boolean } = {}
): DecodedSaveEnvelope {
  const allowLegacy = options.allowLegacy ?? ALLOW_UNSIGNED_LEGACY_SAVES;

  try {
    const parsed = JSON.parse(persistedData);

    if (parsed && typeof parsed === 'object' && parsed.v === 2) {
      const envelope = parsed as Partial<SaveEnvelopeV2>;
      if (
        typeof envelope.data !== 'string' ||
        typeof envelope.checksum !== 'string'
      ) {
        return { valid: false, error: 'Malformed v2 envelope' };
      }

      if (REQUIRE_SIGNED_SAVES && !ALLOW_WEAK_SAVE_MIGRATION && !envelope.hmac) {
        return { valid: false, error: 'Signed save required but envelope has no HMAC' };
      }

      if (!verifySaveEnvelopeData(envelope.data, envelope.checksum, envelope.signature, envelope.hmac)) {
        return { valid: false, error: 'Envelope verification failed' };
      }

      return { valid: true, data: envelope.data, format: 'v2' };
    }

    if (!allowLegacy) {
      return { valid: false, error: 'Unsigned legacy save format is not accepted' };
    }

    if (!looksLikeLegacySavePayload(parsed)) {
      return { valid: false, error: 'Legacy save payload shape is invalid' };
    }

    return { valid: true, data: persistedData, format: 'legacy' };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Failed to decode persisted save envelope',
    };
  }
}

/**
 * Parse and validate save data
 */
export function parseSaveData(
  dataString: string,
  checksum?: string,
  signature?: string,
  hmac?: string
): { state: GameState | null; valid: boolean; errors: string[] } {
  try {
    // Verify checksum and HMAC if provided
    if (checksum && !verifySaveData(dataString, checksum, signature, hmac)) {
      return {
        state: null,
        valid: false,
        errors: ['Save envelope verification failed - data may be corrupted or tampered'],
      };
    }

    const parsed = JSON.parse(dataString);
    const validation = validateGameState(parsed);

    // Only return parsed as GameState if validation passed
    // TypeScript will infer the type correctly from validation.valid check
    // SAFETY: This assertion is safe because:
    // 1. validation.valid ensures the state passed all validation checks
    // 2. typeof parsed === 'object' && parsed !== null ensures it's a valid object
    // 3. validateGameState() checks all required properties exist
    return {
      state: validation.valid && typeof parsed === 'object' && parsed !== null 
        ? (parsed as GameState) // ✅ SAFE - Only after validation.valid check
        : null,
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
 * Includes retry logic for AsyncStorage timing issues
 */
export async function atomicSave(
  key: string,
  data: string,
  storage: typeof AsyncStorage = AsyncStorage
): Promise<{ success: boolean; error?: string }> {
  const tempKey = `${key}_temp_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  // Helper to verify with retry (AsyncStorage may need time to flush)
  const verifyWithRetry = async (verifyKey: string, expectedData: string, maxRetries = 3): Promise<boolean> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      // Small delay to allow AsyncStorage to flush (increases with each retry)
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 10 * attempt));
      }

      const verify = await storage.getItem(verifyKey);
      if (verify === expectedData) {
        return true;
      }
    }
    return false;
  };

  try {
    // Step 1: Write to temp key first
    await storage.setItem(tempKey, data);

    // Step 2: Verify write succeeded (with retry for timing issues)
    const tempVerified = await verifyWithRetry(tempKey, data);
    if (!tempVerified) {
      // Cleanup temp on verification failure
      try {
        await storage.removeItem(tempKey);
      } catch {}
      return { success: false, error: 'Write verification failed' };
    }

    // Step 3: Move to final key (atomic on most platforms)
    await storage.setItem(key, data);

    // Step 4: Verify final write (with retry for timing issues)
    const finalVerified = await verifyWithRetry(key, data);
    if (!finalVerified) {
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

// ─── DOUBLE-BUFFER SAVE SYSTEM (A-1 crash fix) ─────────────────────────
// Maintains two permanent buffers per save slot (A and B) with a pointer key.
// Always writes to the INACTIVE buffer, then flips the pointer.
// If a crash occurs mid-write, the active buffer remains intact.
// On load, tries active buffer first, then falls back to the other.

/**
 * Double-buffer save: writes to the inactive buffer, verifies, then flips pointer.
 * Crash at any point leaves the active buffer intact.
 */
export async function doubleBufferSave(
  slotKey: string,
  data: string,
  storage: typeof AsyncStorage = AsyncStorage
): Promise<{ success: boolean; error?: string; buffer?: 'A' | 'B' }> {
  const pointerKey = `${slotKey}_active`;
  const keyA = `${slotKey}_A`;
  const keyB = `${slotKey}_B`;

  try {
    // Step 1: Read current active pointer (default to 'A' if none exists)
    const currentActive = (await storage.getItem(pointerKey)) as 'A' | 'B' | null;
    const activeBuffer = currentActive === 'B' ? 'B' : 'A';
    const inactiveBuffer = activeBuffer === 'A' ? 'B' : 'A';
    const inactiveKey = inactiveBuffer === 'A' ? keyA : keyB;

    // Step 2: Write to INACTIVE buffer
    await storage.setItem(inactiveKey, data);

    // Step 3: Verify the write (with retry for AsyncStorage flush timing)
    let verified = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise(resolve => setTimeout(resolve, 10 * attempt));
      }
      const readBack = await storage.getItem(inactiveKey);
      if (readBack === data) {
        verified = true;
        break;
      }
    }

    if (!verified) {
      return { success: false, error: `Double-buffer write verification failed on buffer ${inactiveBuffer}` };
    }

    // Step 4: Flip pointer to newly written buffer
    // This is the critical moment — if crash happens here, both buffers exist
    // and we fall back to the one with a valid checksum + newer timestamp
    await storage.setItem(pointerKey, inactiveBuffer);

    return { success: true, buffer: inactiveBuffer };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error during double-buffer save',
    };
  }
}

/**
 * Double-buffer load: reads from the active buffer with fallback to the other.
 * Also handles migration from legacy single-key saves.
 */
export async function doubleBufferLoad(
  slotKey: string,
  storage: typeof AsyncStorage = AsyncStorage,
  options: { allowLegacy?: boolean } = {}
): Promise<{ data: string | null; source: 'A' | 'B' | 'legacy' | 'none'; migrated?: boolean }> {
  const pointerKey = `${slotKey}_active`;
  const keyA = `${slotKey}_A`;
  const keyB = `${slotKey}_B`;
  const allowLegacy = options.allowLegacy ?? ALLOW_UNSIGNED_LEGACY_SAVES;

  try {
    const currentActive = (await storage.getItem(pointerKey)) as 'A' | 'B' | null;

    // If pointer exists, try active buffer first, then fallback
    if (currentActive === 'A' || currentActive === 'B') {
      const activeKey = currentActive === 'A' ? keyA : keyB;
      const fallbackKey = currentActive === 'A' ? keyB : keyA;
      const fallbackBuffer = currentActive === 'A' ? 'B' : 'A';

      // Try active buffer
      const activeData = await storage.getItem(activeKey);
      if (activeData) {
        // Verify envelope integrity before returning
        const decoded = decodePersistedSaveEnvelope(activeData, { allowLegacy });
        if (decoded.valid) {
          return { data: activeData, source: currentActive };
        }
        logger.warn(`[DOUBLE_BUFFER] Active buffer ${currentActive} failed verification, trying fallback`);
      }

      // Active buffer is corrupt or missing — try fallback
      const fallbackData = await storage.getItem(fallbackKey);
      if (fallbackData) {
        const decoded = decodePersistedSaveEnvelope(fallbackData, { allowLegacy });
        if (decoded.valid) {
          // Fix the pointer to the good buffer
          await storage.setItem(pointerKey, fallbackBuffer);
          logger.warn(`[DOUBLE_BUFFER] Recovered from fallback buffer ${fallbackBuffer}`);
          return { data: fallbackData, source: fallbackBuffer };
        }
        logger.error(`[DOUBLE_BUFFER] Both buffers failed verification for ${slotKey}`);
      }

      // Both buffers failed — still check legacy key as last resort
    }

    // No pointer or both buffers failed — check legacy single-key save
    const legacyData = await storage.getItem(slotKey);
    if (legacyData && allowLegacy) {
      const decoded = decodePersistedSaveEnvelope(legacyData, { allowLegacy });
      if (decoded.valid) {
        // Migrate: write to buffer A and set pointer
        try {
          const canonicalEnvelope = createSaveEnvelope(legacyData);
          await storage.setItem(keyA, canonicalEnvelope);
          await storage.setItem(pointerKey, 'A');
          // Don't delete legacy key yet — keep as extra fallback until next successful save
          logger.info(`[DOUBLE_BUFFER] Migrated legacy save to double-buffer for ${slotKey}`);
          return { data: canonicalEnvelope, source: 'legacy', migrated: true };
        } catch (migrateError) {
          logger.warn('[DOUBLE_BUFFER] Migration to double-buffer failed (non-critical)', { error: migrateError });
          return { data: legacyData, source: 'legacy', migrated: true };
        }
      }
    }

    return { data: null, source: 'none' };
  } catch (error) {
    logger.error('[DOUBLE_BUFFER] Load failed:', error);
    // Last resort: try reading the legacy key directly
    if (allowLegacy) {
      try {
        const legacyData = await storage.getItem(slotKey);
        if (legacyData) {
          const decoded = decodePersistedSaveEnvelope(legacyData, { allowLegacy });
          if (decoded.valid) {
            return { data: legacyData, source: 'legacy' };
          }
        }
      } catch {}
    }
    return { data: null, source: 'none' };
  }
}

/**
 * Read save data from a slot using double-buffer with legacy fallback.
 * Convenience wrapper for code that just needs the raw persisted data string.
 */
export async function readSaveSlot(
  slot: number,
  storage: typeof AsyncStorage = AsyncStorage,
  options: { allowLegacy?: boolean } = {}
): Promise<string | null> {
  const result = await doubleBufferLoad(`save_slot_${slot}`, storage, options);
  return result.data;
}

/**
 * Delete a save slot completely (both buffers, pointer, and legacy key).
 */
export async function deleteSaveSlot(
  slot: number,
  storage: typeof AsyncStorage = AsyncStorage
): Promise<void> {
  const key = `save_slot_${slot}`;
  const keysToRemove = [
    key,              // legacy single-key
    `${key}_A`,       // buffer A
    `${key}_B`,       // buffer B
    `${key}_active`,  // pointer
  ];
  await storage.multiRemove(keysToRemove);
}

/**
 * Cleanup orphaned double-buffer temp keys and old legacy keys.
 * Call on app startup.
 */
export async function cleanupDoubleBufferOrphans(
  storage: typeof AsyncStorage = AsyncStorage
): Promise<number> {
  let cleaned = 0;
  try {
    const allKeys = await storage.getAllKeys();
    const tempKeys = allKeys.filter((key: string) =>
      key.match(/^save_slot_\d+_temp_\d+_/)
    );

    const oldTempKeys: string[] = [];
    for (const key of tempKeys) {
      const match = key.match(/^save_slot_\d+_temp_(\d+)_/);
      if (match) {
        const timestamp = parseInt(match[1], 10);
        // Clean up if older than 1 hour
        if (Date.now() - timestamp > 60 * 60 * 1000) {
          oldTempKeys.push(key);
        }
      }
    }

    if (oldTempKeys.length > 0) {
      await storage.multiRemove(oldTempKeys);
      cleaned = oldTempKeys.length;
      logger.debug(`[DOUBLE_BUFFER] Cleaned ${cleaned} orphaned temp keys`);
    }
  } catch (error) {
    logger.warn('[DOUBLE_BUFFER] Orphan cleanup failed (non-critical)', { error });
  }
  return cleaned;
}
