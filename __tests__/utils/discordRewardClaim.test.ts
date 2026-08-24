import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  readDiscordClaim,
  beginDiscordClaim,
  finalizeDiscordClaim,
  applyDiscordRewardGrant,
  DISCORD_CLAIM_KEY,
} from '@/utils/discordRewardClaim';
import type { GameState } from '@/contexts/game/types';

// Mock AsyncStorage (safeStorage lazily require()s it — see storageWrapper.test.ts).
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

// Minimal GameState stub — applyDiscordRewardGrant only touches stats.money,
// dailySummary and the discordRewardGranted flag (via applyMoneyDelta).
function stubState(money = 1000, granted?: boolean): GameState {
  // Was a three-field object asserted whole. `applyDiscordRewardGrant` only
  // reads stats.money / dailySummary / discordRewardGranted today — but the
  // cast is what let that stay true silently, and a real state costs nothing.
  return createTestGameState({
    stats: { money },
    // `dailySummary` requires moneyChange / statsChange / events. `{}` only
    // compiled because the whole state was cast.
    dailySummary: { moneyChange: 0, statsChange: {}, events: [] },
    discordRewardGranted: granted,
  });
}

describe('discordRewardClaim - exactly-once claim protocol', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Safe defaults; individual tests override as needed.
    mockGetItem.mockResolvedValue(null);
    mockSetItem.mockResolvedValue(undefined);
  });

  describe('readDiscordClaim', () => {
    it('absent marker -> unclaimed', async () => {
      mockGetItem.mockResolvedValue(null);
      expect(await readDiscordClaim()).toBe('unclaimed');
    });

    it("legacy 'true' -> finalized (never re-grant existing players)", async () => {
      mockGetItem.mockResolvedValue('true');
      expect(await readDiscordClaim()).toBe('finalized');
    });

    it('valid pending JSON -> { pendingAmount }', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify({ granted: false, amount: 12345 }));
      expect(await readDiscordClaim()).toEqual({ pendingAmount: 12345 });
    });

    it('malformed JSON marker -> treated as finalized (safe no-dupe direction)', async () => {
      mockGetItem.mockResolvedValue('{ not valid json');
      expect(await readDiscordClaim()).toBe('finalized');
    });

    it('well-formed JSON but wrong shape -> finalized', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify({ granted: true, amount: 5 }));
      expect(await readDiscordClaim()).toBe('finalized');
    });

    it('negative pending amount -> finalized (rejected defensively)', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify({ granted: false, amount: -1 }));
      expect(await readDiscordClaim()).toBe('finalized');
    });
  });

  describe('beginDiscordClaim', () => {
    it('writes the pending marker with the FROZEN amount and returns true', async () => {
      mockSetItem.mockResolvedValue(undefined);
      const ok = await beginDiscordClaim(9000);
      expect(ok).toBe(true);
      expect(mockSetItem).toHaveBeenCalledWith(
        DISCORD_CLAIM_KEY,
        JSON.stringify({ granted: false, amount: 9000 })
      );
    });

    it('begin failure grants nothing: returns false when the write fails', async () => {
      mockSetItem.mockRejectedValue(new Error('write failed'));
      const ok = await beginDiscordClaim(9000);
      expect(ok).toBe(false);
      // Caller contract: on false, the grant is skipped entirely.
    });
  });

  describe('finalizeDiscordClaim', () => {
    it("collapses the marker to legacy 'true'", async () => {
      await finalizeDiscordClaim();
      expect(mockSetItem).toHaveBeenCalledWith(DISCORD_CLAIM_KEY, 'true');
    });
  });

  describe('applyDiscordRewardGrant', () => {
    it('adds the money AND sets the flag in one update', () => {
      const next = applyDiscordRewardGrant(stubState(1000), 5000);
      expect(next.stats.money).toBe(6000);
      expect(next.discordRewardGranted).toBe(true);
    });

    it('grants once: a second application is a no-op (idempotent)', () => {
      const once = applyDiscordRewardGrant(stubState(1000), 5000);
      const twice = applyDiscordRewardGrant(once, 5000);
      expect(twice).toBe(once); // same reference — no second grant
      expect(twice.stats.money).toBe(6000); // money added exactly once
    });

    it('granted-flag short-circuit: already-granted state returns unchanged (no grant)', () => {
      const granted = stubState(7777, true);
      const next = applyDiscordRewardGrant(granted, 5000);
      expect(next).toBe(granted);
      expect(next.stats.money).toBe(7777);
    });
  });

  // The home reconciler wires the primitives together; these assert the two
  // interrupted-claim recoveries are each exactly-once.
  describe('reconcile behavior (pending marker + in-state flag)', () => {
    it('pending + flag FALSE -> grants the frozen amount once, then finalizes', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify({ granted: false, amount: 8000 }));

      const claim = await readDiscordClaim();
      expect(claim).toEqual({ pendingAmount: 8000 });

      const loaded = stubState(1000, false);
      const alreadyGranted = loaded.discordRewardGranted === true;
      expect(alreadyGranted).toBe(false);

      const granted = applyDiscordRewardGrant(loaded, (claim as { pendingAmount: number }).pendingAmount);
      expect(granted.stats.money).toBe(9000); // 1000 + frozen 8000
      expect(granted.discordRewardGranted).toBe(true);

      await finalizeDiscordClaim();
      expect(mockSetItem).toHaveBeenLastCalledWith(DISCORD_CLAIM_KEY, 'true');
    });

    it('pending + flag TRUE -> finalizes WITHOUT granting (no duplicate)', async () => {
      mockGetItem.mockResolvedValue(JSON.stringify({ granted: false, amount: 8000 }));

      const claim = await readDiscordClaim();
      const loaded = stubState(50000, true);
      const alreadyGranted = loaded.discordRewardGranted === true;
      expect(alreadyGranted).toBe(true);

      // Reconciler short-circuit: when the flag is already set, skip the grant.
      if (!alreadyGranted) {
        applyDiscordRewardGrant(loaded, (claim as { pendingAmount: number }).pendingAmount);
      }
      await finalizeDiscordClaim();

      expect(loaded.stats.money).toBe(50000); // untouched — no second grant
      expect(mockSetItem).toHaveBeenLastCalledWith(DISCORD_CLAIM_KEY, 'true');
    });

    it("legacy 'true' marker never reconciles (no re-grant)", async () => {
      mockGetItem.mockResolvedValue('true');
      const claim = await readDiscordClaim();
      // 'finalized' is not an object, so the reconciler never enters the grant path.
      expect(typeof claim).toBe('string');
      expect(claim).toBe('finalized');
    });
  });
});
