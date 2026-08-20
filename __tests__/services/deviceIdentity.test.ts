/**
 * `utils/deviceIdentity.ts` — the anonymous identity cloud backups are keyed on.
 *
 * The case that matters most here is PROMOTION. Devices in the field already
 * hold an id in AsyncStorage from before secure-store was wired. If resolution
 * ever mints a new one instead of promoting that, every backup those installs
 * have made becomes unreachable — the failure is silent, permanent, and looks
 * exactly like a working backup right up until someone tries to restore.
 *
 * expo-secure-store is mocked rather than imported: it is a native module, so
 * the real one cannot run under Jest, and the module is required lazily inside
 * a try/catch precisely so an unavailable native module degrades instead of
 * crashing at import.
 */

const mockGetItemAsync = jest.fn<Promise<string | null>, [string]>();
const mockSetItemAsync = jest.fn<Promise<void>, [string, string]>();
jest.mock('expo-secure-store', () => ({
  getItemAsync: (k: string) => mockGetItemAsync(k),
  setItemAsync: (k: string, v: string) => mockSetItemAsync(k, v),
}));

const mockStorage = new Map<string, string>();
const mockUnwritableKeys = new Set<string>();
jest.mock('@/utils/safeStorage', () => ({
  safeGetItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  safeSetItem: jest.fn(async (key: string, value: string) => {
    if (mockUnwritableKeys.has(key)) return false;
    mockStorage.set(key, value);
    return true;
  }),
}));

const KEY = 'cloud_user_id';

/** A fresh module graph per case, so the cached secure-store handle resets. */
function loadModule() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@/utils/deviceIdentity') as typeof import('@/utils/deviceIdentity');
}

beforeEach(() => {
  jest.resetModules();
  mockStorage.clear();
  mockUnwritableKeys.clear();
  mockGetItemAsync.mockReset().mockResolvedValue(null);
  mockSetItemAsync.mockReset().mockResolvedValue(undefined);
});

describe('resolveDeviceId — secure store present', () => {
  it('returns the secure-store id and mirrors it back into AsyncStorage', async () => {
    // The post-reinstall shape on iOS: the keychain kept the id, app storage did
    // not. The fallback tier should be repopulated so it can answer next time.
    mockGetItemAsync.mockResolvedValue('player_keychain_1');

    const id = await loadModule().resolveDeviceId();

    expect(id).toBe('player_keychain_1');
    expect(mockStorage.get(KEY)).toBe('player_keychain_1');
  });

  it('prefers the secure-store id over a different legacy one', async () => {
    mockGetItemAsync.mockResolvedValue('player_secure_wins');
    mockStorage.set(KEY, 'player_legacy_loses');

    expect(await loadModule().resolveDeviceId()).toBe('player_secure_wins');
  });
});

describe('resolveDeviceId — migrating an existing install', () => {
  it('PROMOTES a legacy AsyncStorage id instead of minting a new one', async () => {
    mockGetItemAsync.mockResolvedValue(null); // nothing in secure store yet
    mockStorage.set(KEY, 'player_existing_install');

    const id = await loadModule().resolveDeviceId();

    // Same identity — anything else orphans this install's backups.
    expect(id).toBe('player_existing_install');
    expect(mockSetItemAsync).toHaveBeenCalledWith(KEY, 'player_existing_install');
  });

  it('still returns the legacy id when promoting it into secure store fails', async () => {
    // The id is already durably in AsyncStorage, so a failed promotion costs
    // future reinstall-survival, not this session's identity.
    mockGetItemAsync.mockResolvedValue(null);
    mockSetItemAsync.mockRejectedValue(new Error('keystore unavailable'));
    mockStorage.set(KEY, 'player_existing_install');

    expect(await loadModule().resolveDeviceId()).toBe('player_existing_install');
  });

  it('does not treat a placeholder id as an identity', async () => {
    // initialGameState ships userProfile.username = 'player'; an earlier
    // version of this logic preferred that field, which would have pointed
    // every install at one shared cloud key.
    mockGetItemAsync.mockResolvedValue(null);
    mockStorage.set(KEY, 'player');

    const id = await loadModule().resolveDeviceId();

    expect(id).not.toBe('player');
    expect(id).toMatch(/^player_/);
  });
});

describe('resolveDeviceId — first run', () => {
  it('mints an id the server will accept and persists it to both stores', async () => {
    const id = await loadModule().resolveDeviceId();

    // The server enforces this exact shape; a mint it would reject makes every
    // upload a 400.
    expect(id).toMatch(/^player_[a-z0-9_]{3,60}$/);
    expect(mockStorage.get(KEY)).toBe(id);
    expect(mockSetItemAsync).toHaveBeenCalledWith(KEY, id);
  });

  it('returns null when the new id cannot be persisted ANYWHERE', async () => {
    // An id that does not survive the next launch is not an identity: backups
    // made under it could never be found again.
    mockUnwritableKeys.add(KEY);
    mockSetItemAsync.mockRejectedValue(new Error('keystore unavailable'));

    expect(await loadModule().resolveDeviceId()).toBeNull();
  });

  it('still returns an id when only ONE of the two stores accepts it', async () => {
    mockUnwritableKeys.add(KEY); // AsyncStorage refuses; secure store accepts
    const id = await loadModule().resolveDeviceId();
    expect(id).toMatch(/^player_/);
  });
});

describe('resolveDeviceId — secure store unavailable', () => {
  it('falls back to AsyncStorage when every secure-store call throws', async () => {
    mockGetItemAsync.mockRejectedValue(new Error('no hardware keystore'));
    mockSetItemAsync.mockRejectedValue(new Error('no hardware keystore'));
    mockStorage.set(KEY, 'player_async_only');

    // A device without a usable keystore must keep backing up under the
    // identity it already has, not lose the feature entirely.
    expect(await loadModule().resolveDeviceId()).toBe('player_async_only');
  });

  it('mints and persists to AsyncStorage when secure store is unusable', async () => {
    mockGetItemAsync.mockRejectedValue(new Error('no hardware keystore'));
    mockSetItemAsync.mockRejectedValue(new Error('no hardware keystore'));

    const id = await loadModule().resolveDeviceId();

    expect(id).toMatch(/^player_/);
    expect(mockStorage.get(KEY)).toBe(id);
  });
});

describe('isValidDeviceId', () => {
  it.each([
    ['player_abc123', true],
    ['player', false],
    ['guest', false],
    ['anonymous', false],
    ['GUEST', false],
    ['ab', false],
    ['', false],
    [null, false],
  ])('%s -> %s', (input, expected) => {
    expect(loadModule().isValidDeviceId(input as string | null)).toBe(expected);
  });
});
