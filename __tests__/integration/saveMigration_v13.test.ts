/**
 * Save Migration v13 — Pulse social platform
 *
 * Verifies the v12 → v13 migration is:
 *   1. Additive — every existing socialMedia field is preserved verbatim
 *   2. Idempotent — running twice is a no-op
 *   3. Defensive — handles missing socialMedia, missing arrays, partial state
 *   4. Chained — v10 → v11 → v12 → v13 runs end-to-end and lands clean
 */

import { runMigrations, CURRENT_STATE_VERSION } from '@/utils/saveMigrations';
import { repairGameState } from '@/utils/saveValidation';

describe('Save migration → v13 (Pulse social platform)', () => {
  describe('additive preservation', () => {
    it('preserves every existing socialMedia field exactly', () => {
      const v12 = {
        version: 12,
        weeksLived: 42,
        socialMedia: {
          followers: 12_345,
          influenceLevel: 'popular',
          totalPosts: 87,
          viralPosts: 4,
          brandPartnerships: 3,
          engagementRate: 7.2,
          lastPostWeek: 41,
          totalLiveStreams: 6,
          totalLiveViewers: 18_200,
          totalLiveDuration: 240,
          peakLiveViewers: 4_800,
          totalEarnings: 9_975.5,
          activeBrandDeals: [
            { id: 'd1', brandName: 'NebulaCola', payment: 5000, expiresAt: 50, expiresIn: 4 },
          ],
          recentPosts: [
            {
              id: 'p1',
              content: 'hi',
              likes: 12,
              comments: 3,
              timestamp: 1_000_000,
              contentType: 'text',
            },
          ],
        },
      };

      const { state, errors } = runMigrations(v12);
      expect(errors).toEqual([]);
      expect(state.version).toBe(CURRENT_STATE_VERSION);
      expect(state.version).toBeGreaterThanOrEqual(13);

      // Every legacy field preserved
      expect(state.socialMedia.followers).toBe(12_345);
      expect(state.socialMedia.influenceLevel).toBe('popular');
      expect(state.socialMedia.totalPosts).toBe(87);
      expect(state.socialMedia.viralPosts).toBe(4);
      expect(state.socialMedia.brandPartnerships).toBe(3);
      expect(state.socialMedia.engagementRate).toBe(7.2);
      expect(state.socialMedia.lastPostWeek).toBe(41);
      expect(state.socialMedia.totalLiveStreams).toBe(6);
      expect(state.socialMedia.totalEarnings).toBe(9_975.5);
      expect(state.socialMedia.recentPosts[0].id).toBe('p1');
    });

    it('upgrades activeBrandDeals[] in-place with new optional fields', () => {
      const v12 = {
        version: 12,
        weeksLived: 10,
        socialMedia: {
          followers: 5_000,
          influenceLevel: 'rising',
          totalPosts: 12,
          viralPosts: 0,
          brandPartnerships: 1,
          engagementRate: 4.0,
          activeBrandDeals: [
            { id: 'd1', brandName: 'MoonAudio', payment: 4_000, expiresAt: 18, expiresIn: 8 },
          ],
        },
      };

      const { state } = runMigrations(v12);
      const deal = state.socialMedia.activeBrandDeals[0];

      // Legacy fields untouched
      expect(deal.id).toBe('d1');
      expect(deal.brandName).toBe('MoonAudio');
      expect(deal.payment).toBe(4_000);
      expect(deal.expiresAt).toBe(18);
      expect(deal.expiresIn).toBe(8);

      // New fields defaulted
      expect(deal.postsRequired).toBe(1);
      expect(deal.postsDelivered).toBe(0);
      expect(deal.weeklyPayment).toBe(Math.floor(4_000 / 8));
      expect(deal.category).toBe('lifestyle');
      expect(deal.riskOfBreach).toBe(0);
    });
  });

  describe('idempotency', () => {
    it('running v13 migration twice is a no-op', () => {
      const v12 = {
        version: 12,
        weeksLived: 5,
        socialMedia: {
          followers: 100,
          influenceLevel: 'novice',
          totalPosts: 2,
          viralPosts: 0,
          brandPartnerships: 0,
          engagementRate: 1,
        },
      };

      const first = runMigrations(v12);
      const snapshot = JSON.parse(JSON.stringify(first.state));

      // Re-running on already-migrated state should not change it
      const second = runMigrations(first.state);
      expect(second.state).toEqual(snapshot);
      expect(second.migrationsApplied).toEqual([]);
    });
  });

  describe('defensive defaults', () => {
    it('initializes a missing socialMedia block', () => {
      const partial = { version: 12, weeksLived: 0 };
      const { state, errors } = runMigrations(partial);
      expect(errors).toEqual([]);
      expect(state.socialMedia).toBeDefined();
      expect(state.socialMedia.followers).toBe(0);
      expect(state.socialMedia.influenceLevel).toBe('novice');
      expect(state.socialMedia.followGraph.followingNpcIds).toEqual([]);
      expect(state.socialMedia.brandInbox.pending).toEqual([]);
      expect(state.socialMedia.verifiedPro.active).toBe(false);
      expect(state.socialMedia.notifications).toEqual([]);
      expect(state.socialMedia.lifetimeStats.peakFollowers).toBe(0);
    });

    it('seeds lifetimeStats from current values when present', () => {
      const v12 = {
        version: 12,
        weeksLived: 100,
        socialMedia: {
          followers: 50_000,
          influenceLevel: 'influencer',
          totalPosts: 200,
          viralPosts: 10,
          brandPartnerships: 7,
          engagementRate: 6,
        },
      };
      const { state } = runMigrations(v12);
      expect(state.socialMedia.lifetimeStats.peakFollowers).toBe(50_000);
      expect(state.socialMedia.lifetimeStats.peakInfluenceLevel).toBe('influencer');
      expect(state.socialMedia.lifetimeStats.totalBrandDealsCompleted).toBe(7);
    });

    it('all new v13 sub-objects exist with correct types', () => {
      const { state } = runMigrations({ version: 12, weeksLived: 0 });
      const sm = state.socialMedia;

      expect(typeof sm.commentThreads).toBe('object');
      expect(Array.isArray(sm.trendingHashtags)).toBe(true);
      expect(typeof sm.followGraph).toBe('object');
      expect(Array.isArray(sm.followGraph.followingNpcIds)).toBe(true);
      expect(Array.isArray(sm.followGraph.followedByNpcIds)).toBe(true);
      expect(sm.activeScandal === null).toBe(true);
      expect(Array.isArray(sm.scandalHistory)).toBe(true);
      expect(typeof sm.brandInbox).toBe('object');
      expect(Array.isArray(sm.brandInbox.pending)).toBe(true);
      expect(Array.isArray(sm.brandInbox.declined)).toBe(true);
      expect(Array.isArray(sm.brandInbox.history)).toBe(true);
      expect(typeof sm.verifiedPro).toBe('object');
      expect(typeof sm.verifiedPro.perksUnlocked).toBe('object');
      expect(sm.verifiedPro.perksUnlocked.postBoostMultiplier).toBe(1.0);
      expect(Array.isArray(sm.notifications)).toBe(true);
      expect(sm.liveSession === null).toBe(true);
      expect(Array.isArray(sm.pendingBoosts)).toBe(true);
      expect(typeof sm.lifetimeStats).toBe('object');
      expect(typeof sm.lastViralBoostBySkill).toBe('object');
    });
  });

  describe('chained migration from older versions', () => {
    it('migrates a minimal v10 save end-to-end to current version', () => {
      const v10 = {
        version: 10,
        weeksLived: 3,
        socialMedia: {
          followers: 250,
          influenceLevel: 'novice',
          totalPosts: 5,
          viralPosts: 0,
          brandPartnerships: 0,
          engagementRate: 2,
        },
      };

      const { state, errors, migrationsApplied } = runMigrations(v10);
      expect(errors).toEqual([]);
      expect(state.version).toBe(CURRENT_STATE_VERSION);
      // Chain crossed every version-step from 11 onward
      expect(migrationsApplied).toEqual(expect.arrayContaining([11, 12, 13]));

      // v11+v12 fields exist
      expect(state.playStreak).toBeDefined();
      expect(state.legacyPoints).toBe(0);
      expect(state.activeChapterId).toBe('ch1_fresh_start');
      expect(Array.isArray(state.discoveredSecrets)).toBe(true);
      expect(state.ribbonCollection).toBeDefined();

      // v13 Pulse fields exist
      expect(state.socialMedia.commentThreads).toBeDefined();
      expect(state.socialMedia.followGraph).toBeDefined();
      expect(state.socialMedia.brandInbox).toBeDefined();
      expect(state.socialMedia.verifiedPro).toBeDefined();
      expect(state.socialMedia.lifetimeStats).toBeDefined();

      // Pre-migration values preserved
      expect(state.socialMedia.followers).toBe(250);
      expect(state.socialMedia.totalPosts).toBe(5);
    });
  });

  describe('save → load → save roundtrip stability', () => {
    it('roundtrip via JSON is stable at v13', () => {
      const v12 = {
        version: 12,
        weeksLived: 20,
        socialMedia: {
          followers: 1_500,
          influenceLevel: 'rising',
          totalPosts: 30,
          viralPosts: 1,
          brandPartnerships: 0,
          engagementRate: 5,
        },
      };

      const first = runMigrations(v12).state;
      const serialized = JSON.stringify(first);
      const reparsed = JSON.parse(serialized);
      const second = runMigrations(reparsed).state;

      expect(second.socialMedia).toEqual(first.socialMedia);
      expect(second.version).toBe(first.version);
    });
  });

  describe('repairGameState fills v13 defaults for corrupted saves', () => {
    it('rebuilds socialMedia when it is missing entirely', () => {
      const corrupted: any = { version: 13, weeksLived: 0 };
      const { repaired, repairs } = repairGameState(corrupted);
      expect(repaired).toBe(true);
      expect(repairs.length).toBeGreaterThan(0);
      expect(corrupted.socialMedia).toBeDefined();
      expect(corrupted.socialMedia.commentThreads).toEqual({});
      expect(corrupted.socialMedia.followGraph.followingNpcIds).toEqual([]);
      expect(corrupted.socialMedia.brandInbox.pending).toEqual([]);
      expect(corrupted.socialMedia.verifiedPro.active).toBe(false);
      expect(corrupted.socialMedia.lifetimeStats.peakFollowers).toBe(0);
    });

    it('fills only the missing v13 sub-objects, leaving existing ones alone', () => {
      const partial: any = {
        version: 13,
        weeksLived: 50,
        socialMedia: {
          followers: 99,
          influenceLevel: 'rising',
          totalPosts: 4,
          viralPosts: 0,
          brandPartnerships: 0,
          engagementRate: 3,
          // already-present sub-object
          notifications: [{ id: 'n1', type: 'system', timestamp: 0, gameWeek: 0, read: false, text: 'hi' }],
          // missing: commentThreads, trendingHashtags, followGraph, etc.
        },
      };
      repairGameState(partial);
      expect(partial.socialMedia.notifications).toHaveLength(1);
      expect(partial.socialMedia.notifications[0].id).toBe('n1');
      expect(partial.socialMedia.commentThreads).toEqual({});
      expect(partial.socialMedia.followGraph).toBeDefined();
    });
  });
});
