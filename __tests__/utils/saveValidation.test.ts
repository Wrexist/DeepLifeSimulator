import {
  calculateChecksum,
  validateGameState,
  createSaveData,
  verifySaveData,
  parseSaveData,
  repairGameState,
} from '@/utils/saveValidation';
import { scoreToBand } from '@/lib/banking/creditScore';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';

describe('saveValidation', () => {
  describe('repairGameState - legacy IAP subscription expiry', () => {
    const HOUR = 3_600_000;

    it('expires an active legacy Verified Pro grant past its term and clears the blue check', () => {
      const state = createTestGameState() as any;
      state.userProfile.verified = true;
      // Legacy IAP grant: active, has expiresTimestamp, NO weeklyPrice.
      state.socialMedia.verifiedPro = {
        active: true,
        expiresTimestamp: Date.now() - HOUR,
        perksUnlocked: {
          blueCheckmark: true,
          postBoostMultiplier: 1.25,
          analyticsUnlocked: true,
          noAdsInFeed: true,
          longerPosts: true,
        },
      };
      const { repaired } = repairGameState(state);
      expect(repaired).toBe(true);
      expect(state.socialMedia.verifiedPro.active).toBe(false);
      expect(state.socialMedia.verifiedPro.perksUnlocked.blueCheckmark).toBe(false);
      expect(state.userProfile.verified).toBe(false);
    });

    it('leaves a NEW in-game Verified Pro sub (has weeklyPrice) untouched even if expiresTimestamp is stale', () => {
      const state = createTestGameState() as any;
      state.socialMedia.verifiedPro = {
        active: true,
        weeklyPrice: 20,
        plan: 'weekly',
        expiresTimestamp: Date.now() - HOUR,
        perksUnlocked: { blueCheckmark: true, postBoostMultiplier: 1.25, analyticsUnlocked: true, noAdsInFeed: true, longerPosts: true },
      };
      repairGameState(state);
      expect(state.socialMedia.verifiedPro.active).toBe(true);
    });

    it('leaves an unexpired legacy Verified Pro grant untouched', () => {
      const state = createTestGameState() as any;
      state.socialMedia.verifiedPro = {
        active: true,
        expiresTimestamp: Date.now() + HOUR,
        perksUnlocked: { blueCheckmark: true, postBoostMultiplier: 1.25, analyticsUnlocked: true, noAdsInFeed: true, longerPosts: true },
      };
      repairGameState(state);
      expect(state.socialMedia.verifiedPro.active).toBe(true);
    });

    it('expires an active legacy Spark Premium grant past its term (drops to free)', () => {
      const state = createTestGameState() as any;
      state.sparkApp.premium = {
        active: true,
        tier: 'ultra',
        expiresTimestamp: Date.now() - HOUR,
        perks: { unlimitedSwipes: true, seeWhoLikedYou: true, rewindLastSwipe: true, boostMultiplier: 2.5, superLikesPerDay: 10, verifiedBadge: true, travelMode: true },
      };
      const { repaired } = repairGameState(state);
      expect(repaired).toBe(true);
      expect(state.sparkApp.premium.active).toBe(false);
      expect(state.sparkApp.premium.tier).toBe('free');
      expect(state.sparkApp.premium.perks.unlimitedSwipes).toBe(false);
    });

    it('leaves a NEW in-game Spark Premium sub (has weeklyPrice) untouched', () => {
      const state = createTestGameState() as any;
      state.sparkApp.premium = {
        active: true,
        tier: 'plus',
        weeklyPrice: 12,
        plan: 'weekly',
        expiresTimestamp: Date.now() - HOUR,
        perks: { unlimitedSwipes: true, seeWhoLikedYou: false, rewindLastSwipe: true, boostMultiplier: 1.5, superLikesPerDay: 5, verifiedBadge: false, travelMode: false },
      };
      repairGameState(state);
      expect(state.sparkApp.premium.active).toBe(true);
      expect(state.sparkApp.premium.tier).toBe('plus');
    });
  });

  describe('repairGameState - credit band backfill', () => {
    it('backfills a missing band from the score (source of truth: scoreToBand)', () => {
      const state = createTestGameState() as any;
      state.banking = {
        ...state.banking,
        creditScore: { ...state.banking.creditScore, score: 810 },
      };
      delete state.banking.creditScore.band;

      const { repaired } = repairGameState(state);
      expect(repaired).toBe(true);
      expect(state.banking.creditScore.band).toBe(scoreToBand(810)); // 'excellent'
    });

    it('replaces an invalid band value with the score-derived band', () => {
      const state = createTestGameState() as any;
      state.banking = {
        ...state.banking,
        creditScore: { ...state.banking.creditScore, score: 650, band: 'garbage' },
      };

      repairGameState(state);
      expect(state.banking.creditScore.band).toBe(scoreToBand(650)); // 'fair'
    });

    it('leaves an existing valid band untouched (never clobbers)', () => {
      const state = createTestGameState() as any;
      // Score would map to 'excellent', but a present valid band is preserved.
      state.banking = {
        ...state.banking,
        creditScore: { ...state.banking.creditScore, score: 810, band: 'good' },
      };

      repairGameState(state);
      expect(state.banking.creditScore.band).toBe('good');
    });
  });

  describe('repairGameState - checkpoint re-slim on load', () => {
    it('strips heavy collections from stored (fat) checkpoints, keeps gameplay data', () => {
      const state = createTestGameState() as any;
      state.checkpoints = [
        {
          id: 'cp_fat',
          label: 'Year 1',
          weeksLived: 52,
          age: 19,
          timestamp: 1,
          snapshot: {
            stats: { money: 100 },
            eventLog: Array.from({ length: 200 }, (_, i) => ({
              id: `e${i}`,
              description: 'x'.repeat(60),
            })),
            socialMedia: {
              followers: 3,
              recentPosts: [{ id: 'p1' }],
              notifications: [{ id: 'n1' }],
              commentThreads: { p1: [] },
            },
          },
        },
      ];

      const { repaired } = repairGameState(state);
      expect(repaired).toBe(true);

      const cp = state.checkpoints.find((c: any) => c.id === 'cp_fat');
      expect(cp).toBeTruthy();
      expect(cp.snapshot.eventLog).toBeUndefined();
      expect(cp.snapshot.socialMedia.recentPosts).toBeUndefined();
      expect(cp.snapshot.socialMedia.notifications).toBeUndefined();
      expect(cp.snapshot.socialMedia.commentThreads).toBeUndefined();
      // Gameplay-critical data survives the re-slim.
      expect(cp.snapshot.stats.money).toBe(100);
      expect(cp.snapshot.socialMedia.followers).toBe(3);
    });

    it('drops an unparseable checkpoint snapshot without throwing', () => {
      const state = createTestGameState() as any;
      state.checkpoints = [
        {
          id: 'cp_ok',
          label: 'ok',
          weeksLived: 10,
          age: 18,
          timestamp: 1,
          snapshot: { stats: { money: 5 }, eventLog: [{ id: 'e' }] },
        },
        {
          id: 'cp_bad',
          label: 'bad',
          weeksLived: 5,
          age: 18,
          timestamp: 2,
          snapshot: '{ not valid json',
        },
      ];

      expect(() => repairGameState(state)).not.toThrow();
      expect(state.checkpoints.find((c: any) => c.id === 'cp_ok')).toBeTruthy();
      // Malformed snapshot dropped rather than crashing the load.
      expect(state.checkpoints.find((c: any) => c.id === 'cp_bad')).toBeUndefined();
    });
  });

  describe('calculateChecksum', () => {
    it('calculates stable checksums for equal payloads', () => {
      const data = 'test data';
      expect(calculateChecksum(data)).toBe(calculateChecksum(data));
    });

    it('produces different checksums for different payloads', () => {
      expect(calculateChecksum('data1')).not.toBe(calculateChecksum('data2'));
    });
  });

  describe('validateGameState', () => {
    it('accepts a valid game state from factory', () => {
      const state = createTestGameState();
      const result = validateGameState(state);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('rejects states without stats', () => {
      const stateWithoutStats = { ...createTestGameState(), stats: undefined } as any;
      const result = validateGameState(stateWithoutStats);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('reports out-of-range stat values as warnings (non-critical)', () => {
      const invalidState = createTestGameState({
        stats: {
          ...createTestGameState().stats,
          health: 150,
        },
      });
      const result = validateGameState(invalidState);
      expect(result.valid).toBe(true);
      expect(result.warnings.some((w) => w.toLowerCase().includes('health'))).toBe(true);
    });
  });

  describe('createSaveData', () => {
    it('creates save data with checksum and signature material', () => {
      const state = createTestGameState();
      const save = createSaveData(state, 1);
      expect(save.data).toBeTruthy();
      expect(save.checksum).toBeTruthy();
      expect(typeof save.checksum).toBe('string');
      expect(save.hmac).toBeTruthy();
    });
  });

  describe('verifySaveData', () => {
    it('verifies created save data', () => {
      const save = createSaveData(createTestGameState(), 1);
      expect(verifySaveData(save.data, save.checksum, save.signature, save.hmac)).toBe(true);
    });

    it('rejects incorrect checksums', () => {
      const save = createSaveData(createTestGameState(), 1);
      expect(verifySaveData(save.data, 'wrong', save.signature, save.hmac)).toBe(false);
    });
  });

  describe('parseSaveData', () => {
    it('parses valid save payloads', () => {
      const save = createSaveData(createTestGameState(), 1);
      const result = parseSaveData(save.data, save.checksum, save.signature, save.hmac);
      expect(result.valid).toBe(true);
      expect(result.state).toBeTruthy();
    });

    it('rejects corrupted payloads', () => {
      const result = parseSaveData('invalid json');
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });
  });
});
