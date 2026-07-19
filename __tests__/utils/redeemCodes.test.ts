import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  sha256Hex,
  normalizeRedeemCode,
  lookupRedeemCode,
  lookupRedeemCodeWithTable,
  REDEEM_HASHES,
  REDEEM_LEDGER_KEY,
  readRedeemLedger,
  beginRedeemClaim,
  finalizeRedeemClaim,
  isCodeRedeemedOnDevice,
  applyRedeemReward,
  rewardLabel,
  canAttemptRedeem,
  recordRedeemAttempt,
  reconcileRedeemClaim,
  persistRedeemedPerkEntitlements,
  type RedeemReward,
} from '@/utils/redeemCodes';
import { IAP_PRODUCTS, PRODUCT_CONFIGS, getProductConfig } from '@/utils/iapConfig';
import { iapService } from '@/services/IAPService';
import { createTestGameState } from '../helpers/createTestGameState';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeCrypto = require('crypto');
const nodeSha256 = (s: string): string =>
  nodeCrypto.createHash('sha256').update(s, 'utf8').digest('hex');

// Mock AsyncStorage with a REAL in-memory store so begin/finalize/read round-trip
// (safeStorage lazily require()s it — same shape as discordRewardClaim.test.ts).
jest.mock('@react-native-async-storage/async-storage', () => {
  const mock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    multiGet: jest.fn(),
    multiSet: jest.fn(),
    multiRemove: jest.fn(),
    getAllKeys: jest.fn(),
    clear: jest.fn(),
  };
  return { __esModule: true, default: mock, ...mock };
});

const mockGetItem = AsyncStorage.getItem as jest.Mock;
const mockSetItem = AsyncStorage.setItem as jest.Mock;

let store: Record<string, string>;

beforeEach(() => {
  jest.clearAllMocks();
  store = {};
  mockSetItem.mockImplementation((key: string, value: string) => {
    store[key] = value;
    return Promise.resolve();
  });
  mockGetItem.mockImplementation((key: string) =>
    Promise.resolve(Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
  );
});

// Failure-safe spy restoration: a manual spy.mockRestore() at the end of a test
// is skipped when an assertion throws first, leaking the mock into later tests.
// Safe globally here — the AsyncStorage jest.fn implementations are re-created
// in the beforeEach above on every test.
afterEach(() => {
  jest.restoreAllMocks();
});

describe('sha256Hex', () => {
  it('matches the standard NIST vectors', () => {
    expect(sha256Hex('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches Node crypto across lengths incl. the >55 and >64 byte padding edges', () => {
    // 55/56 straddle the "one more block for the length field" boundary; 64/65
    // straddle a full block; 119/120 straddle the two-block boundary.
    const lengths = [0, 1, 2, 3, 55, 56, 57, 63, 64, 65, 100, 119, 120, 128, 200];
    for (const n of lengths) {
      const s = 'a'.repeat(n);
      expect(sha256Hex(s)).toBe(nodeSha256(s));
    }
  });

  it('matches Node crypto for mixed-content and multi-byte UTF-8 strings', () => {
    const samples = [
      'The quick brown fox jumps over the lazy dog',
      'DEEP-TEST-TEST-TEST',
      'café ☕ 日本語 — 🎁 promo',
      JSON.stringify({ finalized: ['a', 'b'], pending: null }),
    ];
    for (const s of samples) {
      expect(sha256Hex(s)).toBe(nodeSha256(s));
    }
  });
});

describe('normalizeRedeemCode', () => {
  it('uppercases first, then strips everything that is not A-Z / 2-9', () => {
    expect(normalizeRedeemCode('deep-abcd-efgh-jkmn')).toBe('DEEPABCDEFGHJKMN');
    expect(normalizeRedeemCode('DEEP ABCD EFGH JKMN')).toBe('DEEPABCDEFGHJKMN');
    expect(normalizeRedeemCode('deepabcdefghjkmn')).toBe('DEEPABCDEFGHJKMN');
    expect(normalizeRedeemCode('deep_abcd!efgh@jkmn#')).toBe('DEEPABCDEFGHJKMN');
  });

  it('drops 0 and 1 (not in the code alphabet) and other junk', () => {
    expect(normalizeRedeemCode('DEEP-0011-ABCD')).toBe('DEEPABCD');
    expect(normalizeRedeemCode('  d e e p  ')).toBe('DEEP');
    expect(normalizeRedeemCode('')).toBe('');
  });
});

describe('lookupRedeemCodeWithTable (synthetic salt + table, fake codes only)', () => {
  const SALT = 'synthetic-test-salt-not-shipped';
  // Obviously-fake codes; hashes computed in-test so no real code is ever needed.
  const CODE_MONEY = 'DEEP-TEST-TEST-TEST';
  const CODE_PROD = 'DEEP-ABCD-EFGH-JKMN';
  const rewardMoney: RedeemReward = { m: 500 };
  const rewardProd: RedeemReward = { p: 'deeplife_gems_100' };
  const table: Record<string, RedeemReward> = {
    [sha256Hex(normalizeRedeemCode(CODE_MONEY) + SALT)]: rewardMoney,
    [sha256Hex(normalizeRedeemCode(CODE_PROD) + SALT)]: rewardProd,
  };

  it('returns the hash + reward on a hit (money and product)', () => {
    const money = lookupRedeemCodeWithTable(CODE_MONEY, SALT, table);
    expect(money).not.toBeNull();
    expect(money?.reward).toEqual(rewardMoney);
    expect(money?.hash).toBe(sha256Hex(normalizeRedeemCode(CODE_MONEY) + SALT));

    // Normalization means dashes/case don't matter.
    const prod = lookupRedeemCodeWithTable('deepabcdefghjkmn', SALT, table);
    expect(prod?.reward).toEqual(rewardProd);
  });

  it('returns null for a well-shaped code that is not in the table', () => {
    expect(lookupRedeemCodeWithTable('DEEP-ZZZZ-ZZZZ-ZZZZ', SALT, table)).toBeNull();
  });

  it('returns null for codes that fail the DEEP + 12 shape check', () => {
    expect(lookupRedeemCodeWithTable('DEEP-TEST', SALT, table)).toBeNull();
    expect(lookupRedeemCodeWithTable('NOPE-TEST-TEST-TEST', SALT, table)).toBeNull();
    expect(lookupRedeemCodeWithTable('', SALT, table)).toBeNull();
  });
});

describe('lookupRedeemCode (real shipped table)', () => {
  it('a fake TEST code is not present in the real table', () => {
    expect(lookupRedeemCode('DEEP-TEST-TEST-TEST')).toBeNull();
  });

  it('returns null for malformed input without throwing', () => {
    expect(lookupRedeemCode('')).toBeNull();
    expect(lookupRedeemCode('hello world')).toBeNull();
  });
});

describe('REDEEM_HASHES shape audit', () => {
  const entries = Object.entries(REDEEM_HASHES);
  const productIds = new Set<string>(Object.values(IAP_PRODUCTS));

  it('has exactly 108 entries', () => {
    expect(entries.length).toBe(108);
  });

  it('every key is a 64-char lowercase hex digest', () => {
    for (const [hash] of entries) {
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('every value carries exactly one of p | m, with valid contents', () => {
    for (const [, reward] of entries) {
      const hasP = 'p' in reward;
      const hasM = 'm' in reward;
      expect(hasP).not.toBe(hasM); // exactly one
      if (hasP) {
        expect(productIds.has((reward as { p: string }).p)).toBe(true);
      } else {
        const amount = (reward as { m: number }).m;
        expect(Number.isInteger(amount)).toBe(true);
        expect(amount).toBeGreaterThan(0);
      }
    }
  });
});

describe('per-device ledger (begin / finalize / read round-trip)', () => {
  it('absent ledger reads as empty + not-corrupt', async () => {
    const ledger = await readRedeemLedger();
    expect(ledger).toEqual({ finalized: [], pending: null, corrupt: false });
    expect(await isCodeRedeemedOnDevice('anything')).toBe(false);
  });

  it('begin writes a frozen pending marker; isCodeRedeemedOnDevice sees it', async () => {
    const reward: RedeemReward = { m: 1000 };
    const ok = await beginRedeemClaim('hashA', reward);
    expect(ok).toBe(true);

    const ledger = await readRedeemLedger();
    expect(ledger.pending).toEqual({ hash: 'hashA', reward });
    expect(ledger.finalized).toEqual([]);
    expect(await isCodeRedeemedOnDevice('hashA')).toBe(true);
  });

  it('finalize moves the hash to finalized and clears pending (idempotent)', async () => {
    await beginRedeemClaim('hashA', { p: 'deeplife_remove_ads' });
    await finalizeRedeemClaim('hashA');

    let ledger = await readRedeemLedger();
    expect(ledger.finalized).toEqual(['hashA']);
    expect(ledger.pending).toBeNull();
    expect(await isCodeRedeemedOnDevice('hashA')).toBe(true);

    // Idempotent: a second finalize doesn't duplicate the hash.
    await finalizeRedeemClaim('hashA');
    ledger = await readRedeemLedger();
    expect(ledger.finalized).toEqual(['hashA']);
  });

  it('begin preserves prior finalized history', async () => {
    await beginRedeemClaim('h1', { m: 1 });
    await finalizeRedeemClaim('h1');
    await beginRedeemClaim('h2', { m: 2 });

    const ledger = await readRedeemLedger();
    expect(ledger.finalized).toEqual(['h1']);
    expect(ledger.pending).toEqual({ hash: 'h2', reward: { m: 2 } });
  });

  it('malformed JSON reads as corrupt -> every code treated as already redeemed', async () => {
    store[REDEEM_LEDGER_KEY] = '{ this is not json';
    const ledger = await readRedeemLedger();
    expect(ledger.corrupt).toBe(true);
    expect(await isCodeRedeemedOnDevice('whatever')).toBe(true);
  });

  it('a present-but-malformed pending reads as no pending (never granted)', async () => {
    store[REDEEM_LEDGER_KEY] = JSON.stringify({ finalized: ['h1'], pending: { hash: 42 } });
    const ledger = await readRedeemLedger();
    expect(ledger.corrupt).toBe(false);
    expect(ledger.finalized).toEqual(['h1']);
    expect(ledger.pending).toBeNull();
  });

  it('begin returns false (grants nothing) when the write fails', async () => {
    mockSetItem.mockRejectedValueOnce(new Error('disk full'));
    expect(await beginRedeemClaim('hashX', { m: 5 })).toBe(false);
  });
});

describe('applyRedeemReward', () => {
  it('{ m } grants cash via the canonical path and appends the hash exactly once', () => {
    const base = createTestGameState({ stats: { money: 1000 } });
    const before = base.stats.money;

    const once = applyRedeemReward(base, 'moneyHash', { m: 5000 });
    expect(once.stats.money).toBe(before + 5000);
    expect(once.redeemedCodeHashes).toEqual(['moneyHash']);

    // Idempotent: re-applying the same hash is a no-op (same reference, no re-grant).
    const twice = applyRedeemReward(once, 'moneyHash', { m: 5000 });
    expect(twice).toBe(once);
    expect(twice.stats.money).toBe(before + 5000);
    expect(twice.redeemedCodeHashes).toEqual(['moneyHash']);
  });

  it('{ p } gems grants grant-parity gems (matches PRODUCT_CONFIGS) and flags the hash', () => {
    const base = createTestGameState({ stats: { gems: 0 } });
    const before = base.stats.gems;
    const configGems = (PRODUCT_CONFIGS[IAP_PRODUCTS.GEMS_100] as { gems: number }).gems;

    const next = applyRedeemReward(base, 'gemsHash', { p: IAP_PRODUCTS.GEMS_100 });
    expect(next.stats.gems - before).toBe(configGems);
    expect(next.redeemedCodeHashes).toEqual(['gemsHash']);

    // Original state is not mutated (pure).
    expect(base.stats.gems).toBe(before);
    expect(base.redeemedCodeHashes).toBeUndefined();
  });

  it('{ p } deeplife_remove_ads sets settings.adsRemoved the same way IAP does', () => {
    const base = createTestGameState();
    const next = applyRedeemReward(base, 'adsHash', { p: IAP_PRODUCTS.REMOVE_ADS });
    expect(next.settings.adsRemoved).toBe(true);
    expect(next.redeemedCodeHashes).toEqual(['adsHash']);
  });
});

describe('rewardLabel', () => {
  it('formats money and names products', () => {
    expect(rewardLabel({ m: 100000 })).toBe('$100K');
    expect(rewardLabel({ p: IAP_PRODUCTS.GEMS_100 })).toBe(
      (PRODUCT_CONFIGS[IAP_PRODUCTS.GEMS_100] as { name: string }).name,
    );
  });
});

describe('attempt throttle', () => {
  it('allows 5 lookups per rolling 60s, then blocks', () => {
    // Fresh module window: the only consumer of the throttle in the suite.
    for (let i = 0; i < 5; i++) {
      expect(canAttemptRedeem()).toBe(true);
      recordRedeemAttempt();
    }
    expect(canAttemptRedeem()).toBe(false);
  });
});

describe('reconcileRedeemClaim', () => {
  // Any real table hash works here — the hashes are public (they ship in the
  // bundle); only the plaintext codes are secret. The stored marker's reward is
  // deliberately DIFFERENT from the table's so these tests prove the table wins.
  const REAL_HASH = Object.keys(REDEEM_HASHES)[0];
  const REAL_REWARD = REDEEM_HASHES[REAL_HASH];

  it('pending + hash NOT yet in state -> grants the TABLE reward, saves, finalizes', async () => {
    await beginRedeemClaim(REAL_HASH, { m: 500 }); // stored copy is tampered/stale
    const grant = jest.fn();
    const save = jest.fn().mockResolvedValue(true);

    await reconcileRedeemClaim({ hasHash: () => false, grant, save });

    expect(grant).toHaveBeenCalledTimes(1);
    expect(grant).toHaveBeenCalledWith(REAL_HASH, REAL_REWARD); // table, not the stored copy
    expect(save).toHaveBeenCalledTimes(1);
    const ledger = await readRedeemLedger();
    expect(ledger.pending).toBeNull();
    expect(ledger.finalized).toContain(REAL_HASH);
  });

  it('a pending hash that is NOT in the table is discarded without granting', async () => {
    await beginRedeemClaim('not-a-real-table-hash', { m: 10_000_000 });
    const grant = jest.fn();
    const save = jest.fn().mockResolvedValue(true);

    await reconcileRedeemClaim({ hasHash: () => false, grant, save });

    expect(grant).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    const ledger = await readRedeemLedger();
    expect(ledger.pending).toBeNull();
    expect(ledger.finalized).toContain('not-a-real-table-hash'); // consumed, never granted
  });

  it('pending + hash already in state -> finalize only (no duplicate grant)', async () => {
    await beginRedeemClaim('recon2', { m: 500 });
    const grant = jest.fn();
    const save = jest.fn().mockResolvedValue(true);

    await reconcileRedeemClaim({ hasHash: (h) => h === 'recon2', grant, save });

    expect(grant).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    const ledger = await readRedeemLedger();
    expect(ledger.pending).toBeNull();
    expect(ledger.finalized).toContain('recon2');
  });

  it('no pending -> no-op', async () => {
    const grant = jest.fn();
    const save = jest.fn();
    await reconcileRedeemClaim({ hasHash: () => false, grant, save });
    expect(grant).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('save rejection leaves the pending marker for the next launch (not finalized)', async () => {
    await beginRedeemClaim(REAL_HASH, { m: 500 });
    const grant = jest.fn();
    const save = jest.fn().mockRejectedValue(new Error('save failed'));

    await reconcileRedeemClaim({ hasHash: () => false, grant, save });

    expect(grant).toHaveBeenCalledTimes(1);
    const ledger = await readRedeemLedger();
    expect(ledger.pending).toEqual({ hash: REAL_HASH, reward: { m: 500 } });
    expect(ledger.finalized).not.toContain(REAL_HASH);
  });

  it('save resolving FALSE (not durably written) also leaves the pending marker', async () => {
    await beginRedeemClaim(REAL_HASH, { m: 500 });
    const grant = jest.fn();
    const save = jest.fn().mockResolvedValue(false);

    await reconcileRedeemClaim({ hasHash: () => false, grant, save });

    expect(grant).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
    const ledger = await readRedeemLedger();
    expect(ledger.pending).toEqual({ hash: REAL_HASH, reward: { m: 500 } });
    expect(ledger.finalized).not.toContain(REAL_HASH);
  });

  it('entitlement-persistence failure leaves the claim pending (retried next launch)', async () => {
    // REAL_HASH's table reward is a {p} product, so the reconciler runs the
    // cross-slot persistence — force it to fail and the claim must NOT finalize
    // even though the save itself succeeded.
    const spy = jest.spyOn(iapService, 'persistPermanentPerks').mockRejectedValue(new Error('disk'));
    await beginRedeemClaim(REAL_HASH, { m: 500 });
    const grant = jest.fn();
    const save = jest.fn().mockResolvedValue(true);

    await reconcileRedeemClaim({ hasHash: () => false, grant, save });

    expect(grant).toHaveBeenCalledTimes(1); // reward granted + saved...
    const ledger = await readRedeemLedger();
    expect(ledger.pending).toEqual({ hash: REAL_HASH, reward: { m: 500 } }); // ...but NOT finalized
    expect(ledger.finalized).not.toContain(REAL_HASH);
  });

  it('finalize-only path also requires entitlement persistence to succeed', async () => {
    const spy = jest.spyOn(iapService, 'persistPermanentPerks').mockRejectedValue(new Error('disk'));
    await beginRedeemClaim(REAL_HASH, { m: 500 });
    const grant = jest.fn();
    const save = jest.fn().mockResolvedValue(true);

    // Hash already committed in state → finalize-only branch → persistence
    // fails → stays pending; nothing granted, nothing saved.
    await reconcileRedeemClaim({ hasHash: (h) => h === REAL_HASH, grant, save });

    expect(grant).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    const ledger = await readRedeemLedger();
    expect(ledger.pending).toEqual({ hash: REAL_HASH, reward: { m: 500 } });
    expect(ledger.finalized).not.toContain(REAL_HASH);
  });
});

describe('persistRedeemedPerkEntitlements', () => {
  it('runs the same cross-slot persistence a real purchase runs for {p} rewards → true', async () => {
    const spy = jest.spyOn(iapService, 'persistPermanentPerks').mockResolvedValue(undefined);
    await expect(persistRedeemedPerkEntitlements({ p: 'deeplife_unlock_all_perks' })).resolves.toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(getProductConfig('deeplife_unlock_all_perks'));
  });

  it('no-ops (true) for {m} rewards; returns false — never throws — when persistence fails', async () => {
    const spy = jest.spyOn(iapService, 'persistPermanentPerks').mockRejectedValue(new Error('disk'));
    await expect(persistRedeemedPerkEntitlements({ m: 500 })).resolves.toBe(true);
    expect(spy).not.toHaveBeenCalled();
    // Persistence threw → false, so callers keep the claim pending and retry.
    await expect(persistRedeemedPerkEntitlements({ p: 'deeplife_mindset_perk' })).resolves.toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
