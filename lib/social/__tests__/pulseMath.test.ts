/**
 * Pulse pure-math unit tests.
 *
 * Covers:
 *   - calculateFollowerDecay (with/without Verified Pro)
 *   - getEngagementMultiplierFromVerifiedPro
 *   - generateBrandOffersExtended (4-tier gating, determinism)
 *   - generateNpcPostsForFeed (eligibility, cap, 2-week cooldown)
 *   - generateScandalPileOnComments (count, sentiment, determinism)
 *
 * No React, no state mutations — these are pure functions on input data.
 */

import {
  calculateFollowerDecay,
  getEngagementMultiplierFromVerifiedPro,
} from '@/lib/social/socialMedia';
import { generateBrandOffersExtended } from '@/lib/social/brandPartnerships';
import { generateNpcPostsForFeed } from '@/lib/social/npcPosts';
import { generateScandalPileOnComments } from '@/lib/social/randomProfiles';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { PulseActiveScandal } from '@/contexts/game/types';

describe('calculateFollowerDecay', () => {
  it('returns 0 when posted within 2 weeks', () => {
    expect(calculateFollowerDecay(10_000, 1)).toBe(0);
    expect(calculateFollowerDecay(10_000, 0)).toBe(0);
  });

  it('decays 1% per week after the first inactive week', () => {
    // 1 week of decay at 1% on 10,000 = 100
    expect(calculateFollowerDecay(10_000, 2)).toBe(100);
    // 2 weeks of decay at 1% = 200
    expect(calculateFollowerDecay(10_000, 3)).toBe(200);
  });

  it('caps decay at 10% of current followers', () => {
    // 50 weeks inactive would mathematically be 49% — must cap at 10%
    expect(calculateFollowerDecay(10_000, 50)).toBe(1_000);
  });

  it('Verified Pro reduces decay (loyalty bonus)', () => {
    const without = calculateFollowerDecay(100_000, 5, false);
    const withPro = calculateFollowerDecay(100_000, 5, true);
    expect(withPro).toBeLessThan(without);
  });

  it('never returns negative values', () => {
    expect(calculateFollowerDecay(0, 100)).toBe(0);
  });
});

describe('getEngagementMultiplierFromVerifiedPro', () => {
  it('returns 1.0 when socialMedia is absent', () => {
    const state = createTestGameState();
    // Clear socialMedia to simulate worst-case
    (state as any).socialMedia = undefined;
    expect(getEngagementMultiplierFromVerifiedPro(state)).toBe(1.0);
  });

  it('returns 1.0 when Pro is inactive', () => {
    const state = createTestGameState();
    expect(getEngagementMultiplierFromVerifiedPro(state)).toBe(1.0);
  });

  it('returns the multiplier when Pro is active', () => {
    const state = createTestGameState();
    state.socialMedia!.verifiedPro = {
      active: true,
      perksUnlocked: {
        blueCheckmark: true,
        postBoostMultiplier: 1.25,
        analyticsUnlocked: true,
        noAdsInFeed: true,
        longerPosts: true,
      },
    };
    expect(getEngagementMultiplierFromVerifiedPro(state)).toBe(1.25);
  });
});

describe('generateBrandOffersExtended', () => {
  it('returns no offers below 10K followers', () => {
    const state = createTestGameState();
    state.socialMedia!.followers = 5_000;
    state.socialMedia!.engagementRate = 20;
    expect(generateBrandOffersExtended(state, 10)).toEqual([]);
  });

  it('returns Tier 1 (sponsored) at 10K + 10% engagement', () => {
    const state = createTestGameState();
    state.socialMedia!.followers = 10_000;
    state.socialMedia!.engagementRate = 10;
    const offers = generateBrandOffersExtended(state, 10);
    expect(offers).toHaveLength(1);
    expect(offers[0].type).toBe('sponsored_post');
    expect(offers[0].postsRequired).toBe(1);
    expect(offers[0].category).toBeDefined();
  });

  it('returns 4 tiers at 1M followers + good rep', () => {
    const state = createTestGameState();
    state.socialMedia!.followers = 1_500_000;
    state.socialMedia!.engagementRate = 25;
    state.stats.reputation = 60;
    const offers = generateBrandOffersExtended(state, 10);
    const types = offers.map((o) => o.type);
    expect(types).toContain('sponsored_post');
    expect(types).toContain('brand_deal');
    expect(types).toContain('long_campaign');
    expect(types).toContain('ambassador');
  });

  it('omits ambassador tier when reputation too low', () => {
    const state = createTestGameState();
    state.socialMedia!.followers = 1_500_000;
    state.socialMedia!.engagementRate = 25;
    state.stats.reputation = 10; // below 30
    const offers = generateBrandOffersExtended(state, 10);
    expect(offers.find((o) => o.type === 'ambassador')).toBeUndefined();
  });

  it('is deterministic for the same (handle, week) seed', () => {
    const state = createTestGameState();
    state.userProfile.handle = 'maya';
    state.socialMedia!.followers = 100_000;
    state.socialMedia!.engagementRate = 20;
    const a = generateBrandOffersExtended(state, 50);
    const b = generateBrandOffersExtended(state, 50);
    expect(a.map((o) => o.brandName)).toEqual(b.map((o) => o.brandName));
  });

  it('weeklyPayment = floor(payment / duration)', () => {
    const state = createTestGameState();
    state.socialMedia!.followers = 100_000;
    state.socialMedia!.engagementRate = 25;
    const offers = generateBrandOffersExtended(state, 5);
    for (const o of offers) {
      if (o.weeklyPayment !== undefined && o.duration > 1) {
        expect(o.weeklyPayment).toBe(Math.floor(o.payment / o.duration));
      }
    }
  });

  it('attaches logo color pair for the UI', () => {
    const state = createTestGameState();
    state.socialMedia!.followers = 50_000;
    state.socialMedia!.engagementRate = 16;
    const offers = generateBrandOffersExtended(state, 5);
    expect(offers.length).toBeGreaterThan(0);
    for (const o of offers) {
      expect(o.logoColor1).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(o.logoColor2).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('generateNpcPostsForFeed', () => {
  it('returns empty when there are no relationships', () => {
    const state = createTestGameState();
    state.relationships = [];
    expect(generateNpcPostsForFeed(state, 10)).toEqual([]);
  });

  it('skips NPCs with relationshipScore < 30', () => {
    const state = createTestGameState();
    state.relationships = [
      {
        id: 'r1',
        name: 'Cold Friend',
        type: 'friend',
        relationshipScore: 10,
        personality: 'friendly',
      } as any,
    ];
    expect(generateNpcPostsForFeed(state, 10)).toEqual([]);
  });

  it('respects the 2-week cooldown via existing socialPosts history', () => {
    const state = createTestGameState();
    state.relationships = [
      {
        id: 'r1',
        name: 'Recent Poster',
        type: 'friend',
        relationshipScore: 70,
        personality: 'friendly',
      } as any,
    ];
    state.socialPosts = [
      {
        id: 'p-old',
        authorId: 'r1',
        authorName: 'Recent Poster',
        authorHandle: '@rp',
        content: 'old',
        timestamp: 0,
        gameWeek: 10,
        likes: 0,
        reposts: 0,
        replies: 0,
        bookmarks: 0,
        views: 0,
        isLiked: false,
        isReposted: false,
        isBookmarked: false,
        isPlayerPost: false,
        contentType: 'text',
      } as any,
    ];
    // Within 2 weeks → must not post
    expect(generateNpcPostsForFeed(state, 11)).toEqual([]);
    // 3 weeks later → eligible (subject to 25% deterministic gate)
  });

  it('caps total posts at maxPosts', () => {
    const state = createTestGameState();
    state.relationships = Array.from({ length: 50 }, (_, i) => ({
      id: `npc-${i}`,
      name: `NPC ${i}`,
      type: 'friend',
      relationshipScore: 80,
      personality: 'friendly',
    } as any));
    state.socialPosts = [];
    const posts = generateNpcPostsForFeed(state, 100, 3);
    expect(posts.length).toBeLessThanOrEqual(3);
  });

  it('all returned posts carry gameWeek = nextWeeksLived', () => {
    const state = createTestGameState();
    state.relationships = Array.from({ length: 20 }, (_, i) => ({
      id: `npc-${i}`,
      name: `NPC ${i}`,
      type: 'friend',
      relationshipScore: 90,
      personality: 'ambitious',
    } as any));
    state.socialPosts = [];
    const week = 42;
    const posts = generateNpcPostsForFeed(state, week, 10);
    for (const p of posts) {
      expect(p.gameWeek).toBe(week);
    }
  });
});

describe('generateScandalPileOnComments', () => {
  const baseScandal: PulseActiveScandal = {
    id: 's1',
    type: 'cancel',
    severity: 70,
    weeksRemaining: 3,
    startedWeek: 10,
    reputationLossThisWeek: 0,
    followerLossThisWeek: 0,
    headline: 'A scandal',
  };

  it('returns the requested count', () => {
    const c = generateScandalPileOnComments(baseScandal, 'post1', 12, 5);
    expect(c).toHaveLength(5);
  });

  it('all comments tagged hostile + isFromHater', () => {
    const c = generateScandalPileOnComments(baseScandal, 'post1', 12, 3);
    for (const com of c) {
      expect(com.sentiment).toBe('hostile');
      expect(com.isFromHater).toBe(true);
      expect(com.isPlayerComment).toBe(false);
    }
  });

  it('is deterministic for the same (scandal, post, week, index) tuple', () => {
    const a = generateScandalPileOnComments(baseScandal, 'post1', 12, 3);
    const b = generateScandalPileOnComments(baseScandal, 'post1', 12, 3);
    expect(a.map((c) => c.content)).toEqual(b.map((c) => c.content));
  });

  it('uses scandal-type-specific templates', () => {
    const dmScandal = { ...baseScandal, type: 'leaked_dm' as const };
    const c = generateScandalPileOnComments(dmScandal, 'post1', 12, 3);
    const contents = c.map((com) => com.content).join('|');
    // Must reference at least one DM-specific phrase, not the generic templates
    expect(contents).toMatch(/DMs|screenshots|trusted/i);
  });

  it('likes scale with scandal severity', () => {
    const lowSeverity = generateScandalPileOnComments(
      { ...baseScandal, severity: 10, id: 'low' },
      'p',
      12,
      3,
    );
    const highSeverity = generateScandalPileOnComments(
      { ...baseScandal, severity: 100, id: 'high' },
      'p',
      12,
      3,
    );
    const sumLow = lowSeverity.reduce((s, c) => s + c.likes, 0);
    const sumHigh = highSeverity.reduce((s, c) => s + c.likes, 0);
    expect(sumHigh).toBeGreaterThan(sumLow);
  });
});
