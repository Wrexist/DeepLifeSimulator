/**
 * The anonymous per-device identity that cloud backups are keyed on.
 *
 * WHY THIS EXISTS. The id used to live only in AsyncStorage, which every
 * platform wipes on uninstall — so deleting and reinstalling the app orphaned
 * every backup that device had ever made. The backup reported success and
 * could never be restored, which is the worst shape a backup can have.
 *
 * WHAT SECURE-STORE ACTUALLY BUYS, PER PLATFORM. This is not symmetric and it
 * would be dishonest to describe it as "reinstall-safe" flatly:
 *
 *   iOS      Keychain items OUTLIVE app deletion. Reinstall genuinely recovers
 *            the id, and with it the backup. This is the fix.
 *   Android  Keystore-encrypted values live in app storage, which uninstall
 *            deletes. The id does NOT survive, and cannot be made to: Android
 *            auto-backup would carry the ciphertext to a device whose Keystore
 *            lacks the key, restoring undecryptable garbage instead of an
 *            absent key. The expo-secure-store config plugin excludes it from
 *            auto-backup for exactly that reason (see app.config.js).
 *
 * So on Android the answer to "new phone" and to "reinstall" is the same one:
 * a transfer code (server/cloud-save, POST /save/transfer). Secure-store still
 * earns its place there — it survives app-data clears and is the right home for
 * a credential-shaped value — it just is not an uninstall fix on that platform.
 *
 * AsyncStorage is kept in step deliberately, as a fallback rather than a
 * duplicate: if secure-store is unavailable or throws on a given device, an id
 * already mirrored there still resolves, and the device keeps backing up under
 * the identity it has always used.
 */
import { safeGetItem, safeSetItem } from './safeStorage';
import { logger } from './logger';

/** Same key in both stores: one identity, two places it may be found. */
const CLOUD_USER_ID_KEY = 'cloud_user_id';

/**
 * Ids that are placeholders rather than identities. `player` is the one that
 * matters: initialGameState ships `userProfile.username = 'player'`, and an
 * earlier version of this logic preferred that field — so every install would
 * have uploaded to the single cloud key `player` and restored whichever device
 * wrote last. Kept here so a stored value of that shape is never trusted.
 */
const RESERVED_USER_IDS = new Set([
  'local_player', 'guest', 'anonymous', 'unknown', 'null', 'undefined', 'player',
]);

type SecureStoreModule = typeof import('expo-secure-store');

/**
 * `undefined` = not yet attempted, `null` = attempted and unavailable.
 *
 * Required lazily inside a try/catch rather than imported at module top level:
 * this is a native module, and a top-level import makes an unavailable module a
 * module-init crash instead of a degraded feature (CLAUDE.md section 4.6).
 */
let secureStoreModule: SecureStoreModule | null | undefined;

function getSecureStore(): SecureStoreModule | null {
  if (secureStoreModule !== undefined) return secureStoreModule;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    secureStoreModule = require('expo-secure-store') as SecureStoreModule;
  } catch {
    logger.warn('[DeviceIdentity] expo-secure-store unavailable - falling back to AsyncStorage');
    secureStoreModule = null;
  }
  return secureStoreModule;
}

/**
 * Every secure-store call is individually guarded. Requiring the module can
 * succeed on a device where the calls still throw (no hardware keystore, a
 * locked keychain, a corrupt entry), and a throw here must degrade to the
 * fallback rather than take the backup down with it.
 */
async function secureGet(key: string): Promise<string | null> {
  const store = getSecureStore();
  if (!store) return null;
  try {
    return await store.getItemAsync(key);
  } catch (error) {
    logger.warn('[DeviceIdentity] secure-store read failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<boolean> {
  const store = getSecureStore();
  if (!store) return false;
  try {
    await store.setItemAsync(key, value);
    return true;
  } catch (error) {
    logger.warn('[DeviceIdentity] secure-store write failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/** Shape-only check. The server additionally enforces `^player_[a-z0-9_]{3,60}$`. */
export function isValidDeviceId(userId: string | null | undefined): boolean {
  if (!userId || typeof userId !== 'string') return false;
  const normalized = userId.trim().toLowerCase();
  return normalized.length >= 3 && !RESERVED_USER_IDS.has(normalized);
}

/** Matches the server's USER_ID_RE, so a minted id is never rejected on upload. */
function mintDeviceId(): string {
  return `player_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The device's backup identity, or null when there is none it could use AGAIN.
 *
 * Null is not "try later" - it means any id returned now would be unrecoverable
 * on the next launch, so every caller treats it as "skip this operation". A
 * backup uploaded under an identity the device cannot reproduce is unreachable
 * forever, which is strictly worse than not backing up at all.
 */
export async function resolveDeviceId(): Promise<string | null> {
  // 1. Secure store - the durable home, and on iOS the one that survives a
  //    reinstall.
  const secure = await secureGet(CLOUD_USER_ID_KEY);
  if (isValidDeviceId(secure)) {
    const id = secure!.trim();
    // Mirror back: after an iOS reinstall the keychain has the id and
    // AsyncStorage does not, and the fallback path should still find it.
    const legacy = await safeGetItem(CLOUD_USER_ID_KEY);
    if (legacy !== id) void safeSetItem(CLOUD_USER_ID_KEY, id);
    return id;
  }

  // 2. A pre-existing AsyncStorage id, from before secure-store was wired.
  //    PROMOTE it, never replace it: minting a new id here would orphan every
  //    backup this install has already made - the exact failure the migration
  //    exists to prevent.
  const legacy = await safeGetItem(CLOUD_USER_ID_KEY);
  if (isValidDeviceId(legacy)) {
    const id = legacy!.trim();
    await secureSet(CLOUD_USER_ID_KEY, id); // best effort; it is already persisted
    return id;
  }

  // 3. First run on this device.
  const generated = mintDeviceId();
  const secureOk = await secureSet(CLOUD_USER_ID_KEY, generated);
  const asyncOk = await safeSetItem(CLOUD_USER_ID_KEY, generated);

  // Persisted ANYWHERE is enough to be recoverable next launch. Persisted
  // nowhere is not an identity, and saying so is the honest answer - no retry
  // here, because safeSetItem already does its own quota cleanup-and-retry, so
  // a false means the value is genuinely not stored.
  if (!secureOk && !asyncOk) {
    logger.error(
      '[DeviceIdentity] Could not persist a new device id - refusing to sync under an unrecoverable identity'
    );
    return null;
  }
  return generated;
}

/** Test seam. Resets the cached module handle so a fresh mock is picked up. */
export function __resetSecureStoreCacheForTests(): void {
  secureStoreModule = undefined;
}
