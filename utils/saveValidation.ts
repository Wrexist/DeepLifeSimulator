import { GameState } from '@/contexts/game/types';
import { STATE_VERSION, initialGameState } from '@/contexts/game/initialState';
import { logger } from '@/utils/logger';
import {
  resolveSaveSigningRuntimeConfig,
  resolveActiveSaveHmacKey,
  SaveSigningConfigError,
} from '@/utils/saveSigningConfig';

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
export {
  SAVE_SIGNING_CONFIG_ERROR_CODE,
  SaveSigningConfigError,
  isSaveSigningConfigError,
} from '@/utils/saveSigningConfig';

/** Core numeric stats validated on every save payload */
const VALIDATION_STAT_KEYS = [
  'health',
  'happiness',
  'energy',
  'fitness',
  'money',
  'reputation',
  'gems',
] as const;

function statsAsUnknownRecord(stats: unknown): Record<string, unknown> | null {
  if (stats === null || typeof stats !== 'object') return null;
  return stats as Record<string, unknown>;
}

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
    } else if (state.stats[stat] !== undefined) {
      // P0-6: a NaN/Infinity/non-number core stat would pass save validation but
      // then be rejected by gameEntryValidation's isFinite check — an unplayable
      // save. Reset it to a safe neutral midpoint so the save loads and plays.
      const oldValue = state.stats[stat];
      state.stats[stat] = Math.round((min + max) / 2);
      fixes.push(`${stat} reset from ${String(oldValue)} to ${state.stats[stat]} (was non-finite)`);
      fixed = true;
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
 * Repair common corruption patterns in game state.
 *
 * IMPORTANT (P0-10 fix): this function operates on a deep clone internally and
 * then copies the clone's properties back onto the original `state` object. The
 * top-level reference is preserved (so callers using `{...prev}` to get a new
 * React state object still work), but every nested reference (`state.stats`,
 * `state.banking`, …) is replaced with a fresh object. That way React's memo
 * deps actually fire after a repair — previously the in-place mutation kept
 * the same nested refs and selectors silently saw stale data, freezing the UI.
 */
export function repairGameState(state: unknown): { repaired: boolean; repairs: string[] } {
  const repairs: string[] = [];
  let repaired = false;

  if (!state || typeof state !== 'object') {
    return { repaired: false, repairs: [] };
  }

  // Deep-clone so all nested objects/arrays get fresh references. structuredClone
  // is available in Hermes / RN 0.81+. Fallback to JSON round-trip just in case.
  let s: Record<string, any>;
  try {
    s = (typeof structuredClone === 'function'
      ? structuredClone(state)
      : JSON.parse(JSON.stringify(state))) as Record<string, any>;
  } catch {
    // If cloning fails (e.g. circular refs), fall back to in-place mutation
    // — degraded mode but better than crashing the repair flow.
    s = state as Record<string, any>;
  }

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

  // Refresh template-derived disease flags on active diseases. Instances
  // snapshot `curable` at contraction time, so saves from before the disease
  // rebalance (critical terminals became curable via experimental treatment)
  // carried an unwinnable `curable: false` heart disease/stroke/etc. forever.
  if (Array.isArray(s.diseases)) {
    // Lazy require avoids pulling the disease catalog into every import of this module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getDiseaseTemplate } = require('@/lib/diseases/diseaseDefinitions');
    for (const disease of s.diseases as { id?: unknown; curable?: unknown }[]) {
      if (!disease || typeof disease !== 'object' || typeof disease.id !== 'string') continue;
      const template = getDiseaseTemplate(disease.id);
      if (template && typeof disease.curable === 'boolean' && disease.curable !== template.curable) {
        disease.curable = template.curable;
        repairs.push(`Synced curable flag for disease ${disease.id}`);
        repaired = true;
      }
    }
  }

  // Catalog arrays hold the game's available jobs/foods/activities/hacks. An
  // empty default would break gameplay, and validateGameEntry REQUIRES these to
  // exist — so when repair didn't create them (its list had drifted behind the
  // entry validator), a save missing one passed repair but failed entry, locking
  // the player out of their own save. Restore them from initialGameState so
  // repair's required set is a superset of validateGameEntry's.
  const catalogArrays = ['streetJobs', 'jailActivities', 'foods', 'healthActivities', 'dietPlans', 'darkWebItems', 'hacks'];
  const initialFields = initialGameState as unknown as Record<string, unknown>;
  for (const field of catalogArrays) {
    if (!Array.isArray(s[field])) {
      const seed = initialFields[field];
      s[field] = Array.isArray(seed) ? JSON.parse(JSON.stringify(seed)) : [];
      repairs.push(`Restored missing ${field} catalog from defaults`);
      repaired = true;
    }
  }

  // `crimeSkills` is a concrete-default object that repair never backfilled, and
  // the Work tab reads it BARE in render — `gameState.crimeSkills[job.skill].level`
  // (app/(tabs)/work.tsx) — so a save missing it (CloudSync merge / hand-edit)
  // white-screens the tab. Restore the whole container when it is missing, and
  // fill individual skills when it is present-but-partial (the likelier shape as
  // the skill list grows). 2026-07-28 audit crash-1.
  {
    const seedSkills = initialFields.crimeSkills as Record<string, unknown> | undefined;
    if (seedSkills && typeof seedSkills === 'object') {
      if (!s.crimeSkills || typeof s.crimeSkills !== 'object' || Array.isArray(s.crimeSkills)) {
        s.crimeSkills = JSON.parse(JSON.stringify(seedSkills));
        repairs.push('Restored missing crimeSkills from defaults');
        repaired = true;
      } else {
        let addedSkills = 0;
        for (const [skillId, seed] of Object.entries(seedSkills)) {
          const current = s.crimeSkills[skillId];
          if (!current || typeof current !== 'object' || typeof current.level !== 'number') {
            s.crimeSkills[skillId] = JSON.parse(JSON.stringify(seed));
            addedSkills += 1;
          }
        }
        if (addedSkills > 0) {
          repairs.push(`Backfilled ${addedSkills} missing crimeSkills entries`);
          repaired = true;
        }
      }
    }
  }

  // Additive optional fields that post-date their subsystem's last migration
  // (Luxury catalog + Life Ambitions). Migration 23 fills them on a version
  // ladder, but repair also runs on partial saves (CloudSync merge / hand-edit)
  // that a wholesale migration can miss, so heal a present-but-incomplete state
  // here too. Only the concrete-default fields need it; `ambitionId` defaults to
  // undefined (absent = freeform), so an absent key already equals the default.
  if (!Array.isArray(s.luxuryItems)) {
    s.luxuryItems = [];
    repairs.push('Backfilled missing luxuryItems array from defaults');
    repaired = true;
  }
  if (!Array.isArray(s.ambitionCompletedMilestones)) {
    s.ambitionCompletedMilestones = [];
    repairs.push('Backfilled missing ambitionCompletedMilestones array from defaults');
    repaired = true;
  }
  if (typeof s.ambitionRewardClaimed !== 'boolean') {
    s.ambitionRewardClaimed = false;
    repairs.push('Backfilled missing ambitionRewardClaimed flag from defaults');
    repaired = true;
  }
  // Per-item luxury state (v24). The sidecar must exist AND carry an entry for
  // every owned id — an owned item with no holding reads as "acquired at week 0"
  // everywhere downstream. Mirrors migration 24 exactly, because repair also
  // runs on partial saves (CloudSync merge / hand-edit) the ladder never saw.
  if (typeof s.hasPilotLicense !== 'boolean') {
    s.hasPilotLicense = false;
    repairs.push('Backfilled missing hasPilotLicense flag from defaults');
    repaired = true;
  }
  if (!s.luxuryHoldings || typeof s.luxuryHoldings !== 'object' || Array.isArray(s.luxuryHoldings)) {
    s.luxuryHoldings = {};
    repairs.push('Backfilled missing luxuryHoldings record from defaults');
    repaired = true;
  }
  {
    const holdingWeek =
      typeof s.weeksLived === 'number' && isFinite(s.weeksLived) && s.weeksLived >= 0 ? s.weeksLived : 0;
    let addedHoldings = 0;
    for (const id of s.luxuryItems as string[]) {
      if (typeof id === 'string' && !s.luxuryHoldings[id]) {
        s.luxuryHoldings[id] = { acquiredWeek: holdingWeek };
        addedHoldings += 1;
      }
    }
    if (addedHoldings > 0) {
      repairs.push(`Backfilled ${addedHoldings} missing luxuryHoldings entries`);
      // MUST set `repaired`: the repaired clone is only written back onto the
      // caller's object when this flag is true (see the write-back at the end of
      // this function), so a backfill without it is computed and then discarded.
      repaired = true;
    }
  }
  // `realEstateActivity` (a concrete-default `[]`) is backfilled on the version
  // ladder by migration 22, but — like luxuryItems above — repair also runs on
  // partial saves (CloudSync merge / hand-edit) that a wholesale migration can
  // miss, so heal a present-but-malformed state here too. This closes the
  // migration/repair asymmetry (CLAUDE.md save-format rule (b)).
  //
  // Normalize the CONTENTS, not just the top-level shape: the weekly tick does
  // `(prevActivity ?? []).map((e) => e.id)` (`applyRentAndHousing.ts:139`) and
  // RealEstateApp spreads each entry (`RealEstateApp.tsx:338`), neither with a
  // per-entry guard — so a present array carrying a `null`/non-object entry
  // throws before the slice can be rebuilt, and the save keeps failing week
  // progression. Drop malformed entries here (same "normalize a present-but-
  // broken shape at the load boundary" contract as the favorLedger repair).
  if (!Array.isArray(s.realEstateActivity)) {
    s.realEstateActivity = [];
    repairs.push('Backfilled missing realEstateActivity array from defaults');
    repaired = true;
  } else if (
    s.realEstateActivity.some(
      (e: any) => e == null || typeof e !== 'object' || typeof e.id !== 'string',
    )
  ) {
    s.realEstateActivity = s.realEstateActivity.filter(
      (e: any) => e != null && typeof e === 'object' && typeof e.id === 'string',
    );
    repairs.push('Dropped malformed realEstateActivity entries');
    repaired = true;
  }

  // ── Older migration/repair parity gaps (same rule (b) asymmetry) ─────────
  // Surfaced by the new audit-save V8 static check, which cross-references every
  // migration-backfilled CONCRETE default against repairGameState.
  //
  // `wantedLevel` is the one with a live crash-class consumer: JobActions does
  // `prev.wantedLevel + (job.wantedIncrease || 1)` with no `?? 0`, so a partial
  // save missing the key turns it into NaN, and every downstream success-chance
  // that reads it (`Math.min(25, wantedLevel * 3)`) goes NaN with it.
  if (typeof s.wantedLevel !== 'number' || !isFinite(s.wantedLevel)) {
    s.wantedLevel = 0;
    repairs.push('Backfilled missing wantedLevel from defaults');
    repaired = true;
  }
  // IAP dedupe ledger (v2 migration): the list that stops a replayed store
  // transaction from granting twice. It must exist as an array.
  if (!Array.isArray(s.processedIAPTransactions)) {
    s.processedIAPTransactions = [];
    repairs.push('Backfilled missing processedIAPTransactions from defaults');
    repaired = true;
  }
  // Hobby Mastery maps (migration 21).
  if (!s.pursuits || typeof s.pursuits !== 'object' || Array.isArray(s.pursuits)) {
    s.pursuits = {};
    repairs.push('Backfilled missing pursuits map from defaults');
    repaired = true;
  }
  if (
    !s.weeklyPursuitPractice ||
    typeof s.weeklyPursuitPractice !== 'object' ||
    Array.isArray(s.weeklyPursuitPractice)
  ) {
    s.weeklyPursuitPractice = {};
    repairs.push('Backfilled missing weeklyPursuitPractice map from defaults');
    repaired = true;
  }
  // Legacy Pass cosmetics (migration 20) — parent-guarded, mirroring the
  // migration's own `else if` branch for a partially-shaped legacyPass.
  if (
    s.legacyPass &&
    typeof s.legacyPass === 'object' &&
    !Array.isArray(s.legacyPass.ownedCosmetics)
  ) {
    s.legacyPass.ownedCosmetics = [];
    repairs.push('Backfilled missing legacyPass.ownedCosmetics from defaults');
    repaired = true;
  }

  // ── v22 Wave-A NESTED concrete defaults (migration/repair parity) ─────────
  // Migration 22 backfills these on the version ladder, but repair also runs on
  // partial saves already stamped at a later version (CloudSync merge /
  // hand-edit) that the wholesale ladder skips — the same asymmetry
  // `realEstateActivity` had (CLAUDE.md save-format rule (b)). Every consumer
  // guards its read, so these are healing-not-crash repairs; they are mirrored
  // here so the rule holds for NESTED fields too, not just top-level ones.
  //
  // Parent-guarded exactly like the migration: a missing subsystem is rebuilt by
  // its own repair block (or its `ensure*` helper), never invented here.
  if (s.banking && typeof s.banking === 'object') {
    if (!s.banking.rateEnvironment || typeof s.banking.rateEnvironment !== 'object') {
      s.banking.rateEnvironment = { depositMult: 1, loanDelta: 0 };
      repairs.push('Backfilled missing banking.rateEnvironment from defaults');
      repaired = true;
    }
    if (!s.banking.budgetTargets || typeof s.banking.budgetTargets !== 'object') {
      s.banking.budgetTargets = {};
      repairs.push('Backfilled missing banking.budgetTargets from defaults');
      repaired = true;
    }
  }
  if (s.gamingStreaming && typeof s.gamingStreaming === 'object') {
    for (const field of ['perkTier', 'lastMemberWeek', 'hypeStreak'] as const) {
      if (typeof s.gamingStreaming[field] !== 'number' || !isFinite(s.gamingStreaming[field])) {
        s.gamingStreaming[field] = 0;
        repairs.push(`Backfilled missing gamingStreaming.${field} from defaults`);
        repaired = true;
      }
    }
  }
  if (s.travel && typeof s.travel === 'object' && !Array.isArray(s.travel.passportMilestones)) {
    s.travel.passportMilestones = [];
    repairs.push('Backfilled missing travel.passportMilestones from defaults');
    repaired = true;
  }

  // A present-but-malformed `favorLedger` (CloudSync merge / hand-edit /
  // interrupted migration) — e.g. `{}` or `{ favors: null }` — is truthy, so the
  // consumers that fall back only on nullish (`favorLedger ?? emptyLedger()`,
  // ContactsApp's `?? { favors: [] }`) skip the fallback and then crash on
  // `ledger.favors.filter/.some/.map`. Normalise the shape once here at the load
  // boundary so no consumer (weekly tick, ContactsApp render, ContactsActions,
  // cross-system stats) ever sees a bad `favors`. Missing entirely is fine — the
  // nullish fallbacks already cover that; only repair a present, broken shape.
  if (s.favorLedger != null && !Array.isArray(s.favorLedger.favors)) {
    s.favorLedger = { favors: [] };
    repairs.push('Normalized malformed favorLedger (missing/invalid favors array)');
    repaired = true;
  }

  // Reconcile each saved career's `levels` ladder with the current catalog.
  // Several ladders were extended to 6 levels (task #46), but saves persist the
  // FULL career object — including its `levels` snapshot — so a player who
  // started before the extension would otherwise stay capped at the old, shorter
  // ladder. When the catalog now offers MORE levels for a career, adopt the
  // catalog's `levels` (which also carries the new per-level `experienceRequired`
  // promotion gates) while preserving every dynamic field the player earned
  // (level, progress, accepted/applied, performance, raiseMultiplier,
  // startedWeeksLived, …). Idempotent and one-directional: only runs when the
  // save is behind, never shrinks a ladder, and never moves the player's level.
  // No save-version bump — repairGameState runs on every load.
  if (Array.isArray(s.careers)) {
    // Lazy require keeps the career catalogs out of every import of this module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { INITIAL_CAREERS } = require('@/lib/careers/careerData');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ADVANCED_CAREERS } = require('@/lib/careers/advancedCareers');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { POLITICAL_CAREER } = require('@/lib/careers/political');
    const catalogLevelsById = new Map<string, { name: string; salary: number }[]>();
    for (const c of [...(INITIAL_CAREERS || []), ...(ADVANCED_CAREERS || []), POLITICAL_CAREER]) {
      if (c && typeof c.id === 'string' && Array.isArray(c.levels)) {
        catalogLevelsById.set(c.id, c.levels);
      }
    }
    for (const career of s.careers as { id?: unknown; levels?: unknown; level?: unknown }[]) {
      if (!career || typeof career.id !== 'string' || !Array.isArray(career.levels)) continue;
      const catalogLevels = catalogLevelsById.get(career.id);
      if (catalogLevels && catalogLevels.length > career.levels.length) {
        career.levels = JSON.parse(JSON.stringify(catalogLevels));
        // Defensive: keep the player's level index inside the (now longer) bounds.
        if (typeof career.level === 'number') {
          career.level = Math.max(0, Math.min(career.level, catalogLevels.length - 1));
        }
        repairs.push(`Extended ${career.id} career ladder to ${catalogLevels.length} levels from catalog`);
        repaired = true;
      }
    }
  }

  // Backfill the v14/v16/v18 app subsystems. Their migrations only create the
  // slice when it is ENTIRELY missing (`if (!state.banking)`), so a save with a
  // present-but-PARTIAL object (CloudSync merge, hand-edit, future field rename)
  // slipped through every safety net with e.g. banking.creditScore / darkWeb.heat
  // / cryptoMarket.coinMarkets undefined → crash on first access. Restore a
  // missing object wholesale; shallow-merge defaults into a partial one to fill
  // any missing top-level keys.
  const subsystemObjects = ['banking', 'darkWeb', 'cryptoMarket', 'legacyPass'];
  for (const key of subsystemObjects) {
    const seed = initialFields[key];
    if (!seed || typeof seed !== 'object') continue;
    const current = s[key];
    if (!current || typeof current !== 'object') {
      s[key] = JSON.parse(JSON.stringify(seed));
      repairs.push(`Restored missing ${key} subsystem from defaults`);
      repaired = true;
    } else {
      const seedObj = JSON.parse(JSON.stringify(seed)) as Record<string, unknown>;
      const currentObj = current as Record<string, unknown>;
      const merged = { ...seedObj, ...currentObj };
      if (Object.keys(merged).length > Object.keys(currentObj).length) {
        s[key] = merged;
        repairs.push(`Filled missing ${key} fields from defaults`);
        repaired = true;
      }
    }
  }

  // P1-12: clamp a tampered/corrupt credit score into the real FICO range [300, 850].
  // The loan-APR adjustment already clamps at use (amortization.ts:84), but the loan/card
  // eligibility gates (operations.ts:194,498) and the UI read banking.creditScore.score
  // RAW — so keep the persisted value honest after the partial-subsystem merge above.
  // Use `in`-guards (no union cast, per the project rule) and repair NON-numeric / missing scores
  // too — a partial `creditScore` object (e.g. `{}` or `score: "700"`) survives the merge above.
  if (s.banking && typeof s.banking === 'object' && 'creditScore' in s.banking) {
    const creditScore = (s.banking as { creditScore?: unknown }).creditScore;
    if (creditScore && typeof creditScore === 'object') {
      const csObj = creditScore as { score?: unknown; band?: unknown };
      const rawScore = 'score' in csObj ? csObj.score : undefined;
      const nextScore =
        typeof rawScore === 'number' && Number.isFinite(rawScore)
          ? Math.max(300, Math.min(850, Math.round(rawScore)))
          : 650;
      if (rawScore !== nextScore) {
        csObj.score = nextScore;
        repairs.push(`Clamped credit score ${String(rawScore)} → ${nextScore} (valid range 300–850)`);
        repaired = true;
      }
      // Backfill the credit band on saves created before the band feature: the
      // creditScore object exists but has no (or an invalid) `band`, so the
      // credit gauge renders it as undefined. Derive it from the normalized
      // score. Source of truth for the score→band thresholds is scoreToBand in
      // lib/banking/creditScore.ts — imported here, never duplicated.
      const validBands = ['poor', 'fair', 'good', 'veryGood', 'excellent'];
      if (typeof csObj.band !== 'string' || !validBands.includes(csObj.band)) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { scoreToBand } = require('@/lib/banking/creditScore');
        const scoreForBand = typeof csObj.score === 'number' ? csObj.score : nextScore;
        csObj.band = scoreToBand(scoreForBand);
        repairs.push(`Backfilled missing credit band → ${String(csObj.band)}`);
        repaired = true;
      }
    }
  }

  // L5: clamp jailWeeks. nextWeek self-heals a bad value on the first tick, but
  // until then a tampered/corrupt save could display a multi-thousand-week
  // sentence (and inflate bail cost = jailWeeks * 500).
  if (s.jailWeeks !== undefined) {
    const jw = Number.isFinite(s.jailWeeks) ? Math.max(0, Math.min(52, Math.floor(s.jailWeeks))) : 0;
    if (jw !== s.jailWeeks) {
      s.jailWeeks = jw;
      repairs.push(`Clamped jailWeeks to ${jw}`);
      repaired = true;
    }
  }

  // Fix invalid hobbies
  if (Array.isArray(s.hobbies)) {
    // The removal below is counted and flagged. It used to filter silently:
    // repairGameState works on a CLONE that is only written back when
    // `repaired` is true, so a load whose ONLY defect was a malformed hobby had
    // the fix computed and thrown away, every time. Same class as the fourteen
    // Spark/Pulse backfills. 2026-07-29 audit MR-6.
    const originalHobbyLength = s.hobbies.length;
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
    if (s.hobbies.length !== originalHobbyLength) {
      repairs.push(`Removed ${originalHobbyLength - s.hobbies.length} invalid hobbies`);
      repaired = true;
    }
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
  // eventLog is a required top-level field and is one of the collections dropped
  // from checkpoint snapshots, so it must be re-defaulted here (this runs on
  // every load AND on the checkpoint-rewind repair pass). Missing → empty log.
  if (!Array.isArray(s.eventLog)) {
    s.eventLog = [];
    repairs.push('Created missing eventLog array');
    repaired = true;
  }

  // Re-slim any stored checkpoint snapshots that predate checkpoint slimming.
  // Old checkpoints are full deep clones of the game state and can dominate a
  // long-game save (the event log + Pulse feed history repeated across up to
  // MAX_CHECKPOINTS snapshots). Strip the same re-derivable collections here so
  // an existing bloated save shrinks on its next load. Fully crash-safe: it
  // never throws on a malformed checkpoint and drops snapshots that can't parse.
  if (Array.isArray(s.checkpoints) && s.checkpoints.length > 0) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { slimCheckpointSnapshot } = require('@/lib/timeMachine/checkpointSystem');
      if (typeof slimCheckpointSnapshot === 'function') {
        const before = JSON.stringify(s.checkpoints).length;
        const kept: any[] = [];
        for (const cp of s.checkpoints as any[]) {
          if (!cp || typeof cp !== 'object') continue; // drop malformed checkpoint entries
          try {
            let snap: unknown = cp.snapshot;
            if (typeof snap === 'string') {
              // Legacy JSON-string snapshot — parse, then persist the slimmed
              // object form (this also removes the double-encoding overhead).
              snap = JSON.parse(snap);
            }
            if (snap && typeof snap === 'object') {
              cp.snapshot = slimCheckpointSnapshot(snap as Record<string, any>);
            }
            kept.push(cp);
          } catch {
            // Unparseable snapshot — drop this one checkpoint, keep the rest.
          }
        }
        s.checkpoints = kept;
        const after = JSON.stringify(s.checkpoints).length;
        if (after < before) {
          repairs.push(`Slimmed stored checkpoint snapshots (−${before - after} bytes)`);
          repaired = true;
        }
      }
    } catch {
      // checkpointSystem unavailable / unexpected shape — skip re-slim, never crash repair.
    }
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

  // ── v13+ Pulse social platform defaults ───────────────────────
  // Mirror of the v13 migration so a deeply corrupted save can be rebuilt.
  if (!s.socialMedia || typeof s.socialMedia !== 'object') {
    s.socialMedia = {
      followers: 0,
      influenceLevel: 'novice',
      totalPosts: 0,
      viralPosts: 0,
      brandPartnerships: 0,
      engagementRate: 0,
    };
    repairs.push('Created missing socialMedia object');
    repaired = true;
  }
  const sm = s.socialMedia;
  if (sm.commentThreads === undefined || typeof sm.commentThreads !== 'object') {
    sm.commentThreads = {};
    repairs.push('Created missing socialMedia.commentThreads');
    repaired = true;
  }
  if (!Array.isArray(sm.trendingHashtags)) {
    sm.trendingHashtags = [];
    repairs.push('Created missing socialMedia.trendingHashtags');
    repaired = true;
  }
  if (!sm.followGraph || typeof sm.followGraph !== 'object') {
    sm.followGraph = {
      followingNpcIds: [],
      followedByNpcIds: [],
      lastUpdatedWeek: s.weeksLived ?? 0,
    };
    repairs.push('Created missing socialMedia.followGraph');
    repaired = true;
  }
  if (sm.activeScandal === undefined) {
    sm.activeScandal = null;
    repairs.push('Normalized missing socialMedia.activeScandal');
    repaired = true;
  }
  if (!Array.isArray(sm.scandalHistory)) {
    sm.scandalHistory = [];
    repairs.push('Created missing socialMedia.scandalHistory');
    repaired = true;
  }
  if (!sm.brandInbox || typeof sm.brandInbox !== 'object') {
    sm.brandInbox = { pending: [], declined: [], history: [] };
    repairs.push('Created missing socialMedia.brandInbox');
    repaired = true;
  }
  if (!sm.verifiedPro || typeof sm.verifiedPro !== 'object') {
    sm.verifiedPro = {
      active: false,
      perksUnlocked: {
        blueCheckmark: false,
        postBoostMultiplier: 1.0,
        analyticsUnlocked: false,
        noAdsInFeed: false,
        longerPosts: false,
      },
    };
    repairs.push('Created missing socialMedia.verifiedPro');
    repaired = true;
  }
  // Legacy real-money IAP grants (active, has expiresTimestamp, NO weeklyPrice)
  // must still honor their wall-clock term. The weekly tick no longer expires them
  // (removed for deterministic-tick safety), so reconcile at load time only here.
  // NEW in-game cash subs (weeklyPrice set) and still-unexpired legacy grants are
  // left untouched.
  if (
    sm.verifiedPro &&
    sm.verifiedPro.active === true &&
    typeof sm.verifiedPro.weeklyPrice !== 'number' &&
    typeof sm.verifiedPro.expiresTimestamp === 'number' &&
    sm.verifiedPro.expiresTimestamp < Date.now()
  ) {
    sm.verifiedPro.active = false;
    sm.verifiedPro.perksUnlocked = {
      blueCheckmark: false,
      postBoostMultiplier: 1.0,
      analyticsUnlocked: false,
      noAdsInFeed: false,
      longerPosts: false,
    };
    if (s.userProfile && typeof s.userProfile === 'object' && s.userProfile.verified) {
      s.userProfile.verified = false;
    }
    repairs.push('Expired legacy Verified Pro IAP grant past its term');
    repaired = true;
  }
  if (!Array.isArray(sm.notifications)) {
    sm.notifications = [];
    repairs.push('Created missing socialMedia.notifications');
    repaired = true;
  }
  // `activeBrandDeals` is a concrete-default `[]` in initialState with neither a
  // migration backfill nor a repair mirror — it predates both (2026-07-28 audit
  // save-5). The static parity check in audit-save.cjs only sees fields a
  // migration touches, so a field that never got one is invisible to it.
  if (!Array.isArray(sm.activeBrandDeals)) {
    sm.activeBrandDeals = [];
    repairs.push('Created missing socialMedia.activeBrandDeals');
    repaired = true;
  }
  // Checkpoint snapshots strip recentPosts (see slimCheckpointSnapshot); the
  // rewind path relies on this default to restore a valid empty feed cache.
  if (!Array.isArray(sm.recentPosts)) {
    sm.recentPosts = [];
    repairs.push('Created missing socialMedia.recentPosts');
    repaired = true;
  }
  if (sm.liveSession === undefined) {
    sm.liveSession = null;
    repairs.push('Normalized missing socialMedia.liveSession');
    repaired = true;
  }
  if (!Array.isArray(sm.pendingBoosts)) {
    sm.pendingBoosts = [];
    repairs.push('Created missing socialMedia.pendingBoosts');
    repaired = true;
  }
  if (!sm.lifetimeStats || typeof sm.lifetimeStats !== 'object') {
    sm.lifetimeStats = {
      peakFollowers: sm.followers ?? 0,
      peakInfluenceLevel: sm.influenceLevel ?? 'novice',
      totalScandalsSurvived: 0,
      totalBrandDealsCompleted: sm.brandPartnerships ?? 0,
      totalGemsBoostsUsed: 0,
      totalVerifiedProWeeks: 0,
    };
    repairs.push('Created missing socialMedia.lifetimeStats');
    repaired = true;
  }
  if (sm.lastViralBoostBySkill === undefined || typeof sm.lastViralBoostBySkill !== 'object') {
    sm.lastViralBoostBySkill = {};
    repairs.push('Created missing socialMedia.lastViralBoostBySkill');
    repaired = true;
  }
  // v22 Wave-A concrete defaults — mirrored from migration 22 so a partial save
  // already stamped past v22 is healed here too (save-format rule (b)). The
  // history is anchored with the current follower count, exactly like the
  // migration, so charts always have a datum; the 52-point cap is re-applied.
  if (!Array.isArray(sm.followerHistory)) {
    sm.followerHistory = [
      {
        week: typeof s.weeksLived === 'number' && isFinite(s.weeksLived) ? Math.max(0, Math.floor(s.weeksLived)) : 0,
        followers: typeof sm.followers === 'number' && isFinite(sm.followers) ? sm.followers : 0,
      },
    ];
    repairs.push('Backfilled missing socialMedia.followerHistory from defaults');
    repaired = true;
  } else if (sm.followerHistory.length > 52) {
    sm.followerHistory = sm.followerHistory.slice(-52);
    repairs.push('Trimmed socialMedia.followerHistory to the 52-point cap');
    repaired = true;
  }
  if (typeof sm.scandalRiskScore !== 'number' || !isFinite(sm.scandalRiskScore)) {
    sm.scandalRiskScore = 0;
    repairs.push('Backfilled missing socialMedia.scandalRiskScore from defaults');
    repaired = true;
  }

  // ── v15+ Spark dating app defaults ───────────────────────────
  // Mirror of the v15 migration so a corrupted save can rebuild Spark state.
  if (!s.sparkApp || typeof s.sparkApp !== 'object') {
    s.sparkApp = {};
    repairs.push('Created missing sparkApp object');
    repaired = true;
  }
  const sp = s.sparkApp;
  if (!sp.profile || typeof sp.profile !== 'object') {
    sp.profile = { bio: '', photos: [], interests: [], showAge: true, showJob: true, showWealth: false };
    repairs.push('Created missing sparkApp.profile');
    repaired = true;
  }
  if (!Array.isArray(sp.swipes)) { sp.swipes = []; repairs.push('Created missing sparkApp.swipes'); repaired = true; }
  if (!Array.isArray(sp.matches)) { sp.matches = []; repairs.push('Created missing sparkApp.matches'); repaired = true; }
  if (!sp.messages || typeof sp.messages !== 'object') {
    sp.messages = {};
    repairs.push('Created missing sparkApp.messages');
    repaired = true;
  }
  // Every branch below MUST set `repaired` — the repaired clone is only written
  // back onto the caller's object when that flag is true, so a backfill without
  // it is computed and silently discarded (CLAUDE.md; 2026-07-28 audit save-3).
  if (typeof sp.swipeQuota !== 'number') { sp.swipeQuota = 30; repairs.push('Created missing sparkApp.swipeQuota'); repaired = true; }
  if (typeof sp.swipesUsedThisWeek !== 'number') { sp.swipesUsedThisWeek = 0; repairs.push('Created missing sparkApp.swipesUsedThisWeek'); repaired = true; }
  if (typeof sp.lastQuotaResetWeek !== 'number') { sp.lastQuotaResetWeek = s.weeksLived ?? 0; repairs.push('Created missing sparkApp.lastQuotaResetWeek'); repaired = true; }
  if (typeof sp.superLikesUsedThisWeek !== 'number') { sp.superLikesUsedThisWeek = 0; repairs.push('Created missing sparkApp.superLikesUsedThisWeek'); repaired = true; }
  if (!sp.premium || typeof sp.premium !== 'object') {
    sp.premium = {
      active: false,
      tier: 'free',
      perks: {
        unlimitedSwipes: false,
        seeWhoLikedYou: false,
        rewindLastSwipe: false,
        boostMultiplier: 1.0,
        superLikesPerDay: 1,
        verifiedBadge: false,
        travelMode: false,
      },
    };
    repairs.push('Created missing sparkApp.premium');
    repaired = true;
  }
  // Legacy Spark Premium IAP grants: same load-time term reconciliation as Verified
  // Pro above (active + expiresTimestamp + NO weeklyPrice → expire if past term).
  if (
    sp.premium &&
    sp.premium.active === true &&
    typeof sp.premium.weeklyPrice !== 'number' &&
    typeof sp.premium.expiresTimestamp === 'number' &&
    sp.premium.expiresTimestamp < Date.now()
  ) {
    sp.premium.active = false;
    sp.premium.tier = 'free';
    sp.premium.perks = {
      unlimitedSwipes: false,
      seeWhoLikedYou: false,
      rewindLastSwipe: false,
      boostMultiplier: 1.0,
      superLikesPerDay: 1,
      verifiedBadge: false,
      travelMode: false,
    };
    repairs.push('Expired legacy Spark Premium IAP grant past its term');
    repaired = true;
  }
  // Same rule (b) flag discipline as above. `likedYou` is the one with a live
  // crash consumer: likeBackFromLikedYou reads the RAW sparkApp, so a save
  // missing it threw — and the repair that fixed it was being thrown away.
  if (!Array.isArray(sp.likedYou)) { sp.likedYou = []; repairs.push('Created missing sparkApp.likedYou'); repaired = true; }
  if (!Array.isArray(sp.catfishRecords)) { sp.catfishRecords = []; repairs.push('Created missing sparkApp.catfishRecords'); repaired = true; }
  if (sp.activeJealousy === undefined) { sp.activeJealousy = null; repairs.push('Normalized missing sparkApp.activeJealousy'); repaired = true; }
  if (!Array.isArray(sp.jealousyHistory)) { sp.jealousyHistory = []; repairs.push('Created missing sparkApp.jealousyHistory'); repaired = true; }
  if (sp.boost === undefined) { sp.boost = null; repairs.push('Normalized missing sparkApp.boost'); repaired = true; }
  if (!Array.isArray(sp.dismissedCatfishIds)) { sp.dismissedCatfishIds = []; repairs.push('Created missing sparkApp.dismissedCatfishIds'); repaired = true; }
  if (!Array.isArray(sp.reportedIds)) { sp.reportedIds = []; repairs.push('Created missing sparkApp.reportedIds'); repaired = true; }
  if (!sp.lifetimeStats || typeof sp.lifetimeStats !== 'object') {
    sp.lifetimeStats = {
      totalSwipes: 0, totalMatches: 0, totalSuperLikes: 0,
      totalDatesGoneOn: 0, totalGiftsGiven: 0, totalProposals: 0,
      totalMarriages: 0, totalDivorces: 0,
      totalCatfishExposed: 0, totalJealousyEvents: 0,
      peakPremiumTier: 'free', totalPremiumWeeks: 0,
    };
    repairs.push('Created missing sparkApp.lifetimeStats');
    repaired = true;
  }

  // ── v17+ Hustle business app defaults ───────────────────────
  if (!s.hustleApp || typeof s.hustleApp !== 'object') {
    s.hustleApp = {};
    repairs.push('Created missing hustleApp object');
    repaired = true;
  }
  const hu = s.hustleApp;
  if (!hu.companies || typeof hu.companies !== 'object') {
    hu.companies = {};
    repairs.push('Created missing hustleApp.companies');
    repaired = true;
  }
  if (!hu.lifetimeStats || typeof hu.lifetimeStats !== 'object') {
    hu.lifetimeStats = {
      totalCompaniesFounded: Array.isArray(s.companies) ? s.companies.length : 0,
      totalCompaniesSold: 0,
      totalIPOsLaunched: 0,
      totalAcquisitionsCompleted: 0,
      totalScandalsSurvived: 0,
      totalCampaignsRun: 0,
      totalNamedHires: 0,
      totalFires: 0,
      peakBrandScore: 0,
      peakMarketShare: 0,
      peakSharePrice: 0,
    };
    repairs.push('Created missing hustleApp.lifetimeStats');
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
    // Light mode was never fully implemented and produced a broken half-themed
    // look (light chrome around dark content), so the toggle was removed. Coerce
    // any save that had toggled it off back to dark, otherwise those players are
    // stranded in the broken light state with no toggle to escape it.
    if (s.settings.darkMode !== true) {
      s.settings.darkMode = true;
      repairs.push('Coerced settings.darkMode back to true (light mode removed)');
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
      // `=== undefined`, not `!`. Absolute week 0 is a legitimate value —
      // MiningActions writes `startAbsoluteWeek: prev.weeksLived || 0` — and
      // testing falsy rewrote a correct 0, moving the position's start (and
      // resetting lastClaimAbsoluteWeek) on every load. 2026-07-29 audit MR-5.
      if (pos.startAbsoluteWeek === undefined && pos.startWeek <= 4 && (s.weeksLived || 0) > 4) {
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

  // P0-10: copy repaired clone back onto the original `state` object so the
  // top-level reference is preserved (caller API) but every nested ref is fresh
  // (so React memos keyed on e.g. `gameState.stats` actually fire).
  if (s !== state && repaired) {
    const original = state as Record<string, any>;
    // Remove keys that the clone no longer has (defensive — repair never deletes,
    // but covers future code that does).
    for (const key of Object.keys(original)) {
      if (!(key in s)) delete original[key];
    }
    // Assign every clone key (new references) onto the original.
    for (const key of Object.keys(s)) {
      original[key] = s[key];
    }
  }

  return { repaired, repairs };
}

/**
 * True when the state is the pristine boot default — no life has been started.
 *
 * Every real game built by onboarding has a `scenarioId` AND a non-empty
 * `userProfile.firstName` (name entry is mandatory); the provider's initial
 * state has neither. Persisting such a state is what created the phantom
 * "Unnamed Character · $200 · 18" save on a clean install: the background /
 * periodic autosave fired while the user was still on the main menu and wrote
 * the untouched default into slot 1 (which also set `lastSlot`, lighting up
 * the Continue card). saveGame skips these states entirely.
 */
export function isPristineUnstartedState(state: any): boolean {
  if (!state || typeof state !== 'object') return true;
  const hasScenario = typeof state.scenarioId === 'string' && state.scenarioId.length > 0;
  const firstName = state.userProfile?.firstName;
  const lastName = state.userProfile?.lastName;
  const hasName =
    (typeof firstName === 'string' && firstName.trim().length > 0) ||
    (typeof lastName === 'string' && lastName.trim().length > 0);
  return !hasScenario && !hasName;
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
    const statsRecord = statsAsUnknownRecord(state.stats);
    if (statsRecord) {
      for (const stat of VALIDATION_STAT_KEYS) {
        const statValue = statsRecord[stat];
        if (!isValidNumber(statValue)) {
          errors.push(`Invalid ${stat} value: expected number, got ${typeof statValue}`);
        }
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
  const statsForNaN = statsAsUnknownRecord(state.stats);
  if (statsForNaN) {
    for (const stat of VALIDATION_STAT_KEYS) {
      const val = statsForNaN[stat];
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
  const stateRecord = state as Record<string, unknown>;
  const requiredArrayFields = ['careers', 'hobbies', 'items', 'relationships', 'achievements', 'educations'];
  for (const field of requiredArrayFields) {
    if (!Array.isArray(stateRecord[field])) {
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
    if (
      stateRecord[field] !== undefined &&
      !Array.isArray(stateRecord[field])
    ) {
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
    e.includes('repair failed') ||
    // P0-6: NaN/Infinity in a stat is corruption that makes a save load as
    // "valid" but then fail gameEntryValidation (isFinite check) — an
    // unplayable save. Treat it as critical so the load path repairs it.
    e.includes('NaN/Infinity')
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
 * What a slot read actually found.
 *
 * `none` and `unverified`/`unknown` used to be the SAME `{data: null}`, and
 * three separate occupancy guards read that null as "this slot is free to
 * overwrite". A save that merely failed CRC32/HMAC verification — after an HMAC
 * key rotation, say, which invalidates every save on the device at once —
 * looked exactly like an empty slot. So did a storage read that threw.
 * (2026-07-29 audit PIPE-1 / SEC-1.)
 */
export type SaveSlotSource =
  /** Read and verified from that buffer / the legacy key. */
  | 'A'
  | 'B'
  | 'legacy'
  /** Nothing is stored here. The ONLY value that means "safe to overwrite". */
  | 'none'
  /** A blob exists but did not verify. Often still recoverable from a backup. */
  | 'unverified'
  /** The read itself failed. Proves nothing about whether data exists. */
  | 'unknown';

export interface SaveSlotReadResult {
  data: string | null;
  source: SaveSlotSource;
  migrated?: boolean;
  /**
   * True when any raw slot key returned a non-null string, or when we could not
   * establish that they did not. Never optimistic: a thrown read reports `true`,
   * because "I could not tell" must not authorise a destructive write.
   */
  blobPresent: boolean;
}

/**
 * Double-buffer load: reads from the active buffer with fallback to the other.
 * Also handles migration from legacy single-key saves.
 */
export async function doubleBufferLoad(
  slotKey: string,
  storage: typeof AsyncStorage = AsyncStorage,
  options: { allowLegacy?: boolean } = {}
): Promise<SaveSlotReadResult> {
  const pointerKey = `${slotKey}_active`;
  const keyA = `${slotKey}_A`;
  const keyB = `${slotKey}_B`;
  const allowLegacy = options.allowLegacy ?? ALLOW_UNSIGNED_LEGACY_SAVES;

  let blobPresent = false;

  try {
    const currentActive = (await storage.getItem(pointerKey)) as 'A' | 'B' | null;

    // Try the pointed-at buffer first, then the other one. When the pointer is
    // MISSING we still try both: this whole block used to sit inside
    // `if (currentActive === 'A' || currentActive === 'B')`, so a lost pointer
    // skipped the buffers entirely and fell straight through to the legacy key
    // — reporting "no data" for a slot holding two intact megabyte saves
    // (2026-07-29 audit SAVE-OW-3).
    const order: Array<'A' | 'B'> = currentActive === 'B' ? ['B', 'A'] : ['A', 'B'];

    for (const buffer of order) {
      const bufferKey = buffer === 'A' ? keyA : keyB;
      const bufferData = await storage.getItem(bufferKey);
      if (!bufferData) continue;
      blobPresent = true;

      const decoded = decodePersistedSaveEnvelope(bufferData, { allowLegacy });
      if (!decoded.valid) {
        logger.warn(`[DOUBLE_BUFFER] Buffer ${buffer} failed verification for ${slotKey}`);
        continue;
      }

      // Heal a wrong or missing pointer so the next read goes straight there.
      if (currentActive !== buffer) {
        try {
          await storage.setItem(pointerKey, buffer);
          logger.warn(`[DOUBLE_BUFFER] Repointed ${slotKey} to buffer ${buffer}`);
        } catch (pointerError) {
          logger.warn('[DOUBLE_BUFFER] Could not repair active pointer (non-critical)', {
            error: pointerError,
          });
        }
      }
      return { data: bufferData, source: buffer, blobPresent: true };
    }

    // Both buffers absent or unverifiable — check the legacy single-key save.
    const legacyData = await storage.getItem(slotKey);
    if (legacyData) {
      blobPresent = true;
      if (allowLegacy) {
        const decoded = decodePersistedSaveEnvelope(legacyData, { allowLegacy });
        if (decoded.valid) {
          // Migrate: write to buffer A and set pointer
          try {
            const canonicalEnvelope = createSaveEnvelope(legacyData);
            await storage.setItem(keyA, canonicalEnvelope);
            await storage.setItem(pointerKey, 'A');
            // Don't delete legacy key yet — keep as extra fallback until next successful save
            logger.info(`[DOUBLE_BUFFER] Migrated legacy save to double-buffer for ${slotKey}`);
            return { data: canonicalEnvelope, source: 'legacy', migrated: true, blobPresent: true };
          } catch (migrateError) {
            logger.warn('[DOUBLE_BUFFER] Migration to double-buffer failed (non-critical)', { error: migrateError });
            return { data: legacyData, source: 'legacy', migrated: true, blobPresent: true };
          }
        }
      }
    }

    if (blobPresent) {
      logger.error(`[DOUBLE_BUFFER] Data present but unverifiable for ${slotKey}`);
      return { data: null, source: 'unverified', blobPresent: true };
    }
    return { data: null, source: 'none', blobPresent: false };
  } catch (error) {
    logger.error('[DOUBLE_BUFFER] Load failed:', error);
    // Last resort: try reading the legacy key directly
    if (allowLegacy) {
      try {
        const legacyData = await storage.getItem(slotKey);
        if (legacyData) {
          const decoded = decodePersistedSaveEnvelope(legacyData, { allowLegacy });
          if (decoded.valid) {
            return { data: legacyData, source: 'legacy', blobPresent: true };
          }
        }
      } catch {}
    }
    // A throw tells us nothing about whether the slot holds data, so it must
    // NOT read as empty.
    return { data: null, source: 'unknown', blobPresent: true };
  }
}

/**
 * Read a slot and report WHY it came back empty, for callers deciding whether a
 * slot may be overwritten. `readSaveSlot` cannot answer that — it returns the
 * same `null` for "nothing stored", "failed verification" and "the read threw".
 * Only `'none'` means safe to overwrite.
 */
export async function readSaveSlotDetailed(
  slot: number,
  storage: typeof AsyncStorage = AsyncStorage,
  options: { allowLegacy?: boolean } = {}
): Promise<SaveSlotReadResult> {
  return doubleBufferLoad(`save_slot_${slot}`, storage, options);
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
