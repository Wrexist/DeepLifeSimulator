/**
 * pulseTick — weekly tick unit tests.
 *
 * Exercises the 13-step recipe at a focused level: engagement math, follower
 * decay, scandal cascade, brand-deal expiry, trending rotation, Verified Pro
 * expiry, and the all-important `weeksLived` invariant.
 */
import { processPulseWeeklyTick } from '@/lib/social/pulseTick';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/** Shallow-clone socialMedia so tests don't share nested references. */
function freshState(overrides: Partial<GameState> = {}): GameState {
  const s = createTestGameState(overrides);
  if (s.socialMedia) {
    s.socialMedia = JSON.parse(JSON.stringify(s.socialMedia));
  }
  return s;
}

describe('processPulseWeeklyTick', () => {
  it('returns a structured result with socialMedia + earnings + deltas', () => {
    const state = freshState({ weeksLived: 10 });
    const r = processPulseWeeklyTick(state, 11);
    expect(r.socialMedia).toBeDefined();
    expect(typeof r.pulseEarnings).toBe('number');
    expect(typeof r.reputationDelta).toBe('number');
    expect(typeof r.scandalFollowerLoss).toBe('number');
  });

  it('uses nextWeeksLived for time math (not state.week)', () => {
    const state = freshState({ weeksLived: 47, week: 1 });
    state.socialMedia!.totalPosts = 5;
    state.socialMedia!.lastPostWeek = 47;
    const r = processPulseWeeklyTick(state, 48);
    // Engagement rate is derived from (totalPosts, weeksSinceLastPost=48-47=1).
    // If the tick used state.week (1) instead of 48-47, the result would still
    // happen to be 1 here — but the trending hashtag decayWeek must reflect 48.
    expect(r.socialMedia.trendingHashtags!.every(t => t.decayWeek > 47)).toBe(true);
  });

  it('decays followers after 2 weeks of inactivity', () => {
    const state = freshState({ weeksLived: 0 });
    state.socialMedia!.followers = 10_000;
    state.socialMedia!.lastPostWeek = 0; // 5 weeks ago at tick 5
    const r = processPulseWeeklyTick(state, 5);
    expect(r.socialMedia.followers).toBeLessThan(10_000);
  });

  it('does NOT decay followers when player posted last week', () => {
    const state = freshState({ weeksLived: 4 });
    state.socialMedia!.followers = 10_000;
    state.socialMedia!.lastPostWeek = 5; // posted "next week" — no decay
    const r = processPulseWeeklyTick(state, 5);
    expect(r.socialMedia.followers).toBe(10_000);
  });

  it('rotates trending: organic injection + scandal injection', () => {
    const state = freshState({ weeksLived: 3 });
    state.socialMedia!.trendingHashtags = [];
    state.socialMedia!.activeScandal = {
      id: 's1',
      type: 'cancel',
      severity: 60,
      weeksRemaining: 3,
      startedWeek: 2,
      reputationLossThisWeek: 0,
      followerLossThisWeek: 0,
      headline: 'meltdown',
    };
    const r = processPulseWeeklyTick(state, 4);
    const tags = r.socialMedia.trendingHashtags!;
    expect(tags.some(t => t.source === 'organic')).toBe(true);
    expect(tags.some(t => t.source === 'scandal')).toBe(true);
    expect(tags.length).toBeLessThanOrEqual(10);
  });

  it('scandal cascade: severity drops, reputation loses, follower loss applied', () => {
    const state = freshState({ weeksLived: 5 });
    state.socialMedia!.followers = 100_000;
    state.socialMedia!.activeScandal = {
      id: 's1',
      type: 'bad_take',
      severity: 50,
      weeksRemaining: 3,
      startedWeek: 4,
      reputationLossThisWeek: 0,
      followerLossThisWeek: 0,
      headline: 'oops',
    };
    const r = processPulseWeeklyTick(state, 6);
    expect(r.reputationDelta).toBeLessThan(0);
    expect(r.scandalFollowerLoss).toBeGreaterThan(0);
    expect(r.socialMedia.followers).toBeLessThan(100_000);
    expect(r.socialMedia.activeScandal!.severity).toBeLessThan(50);
  });

  it('apology resolution accelerates scandal recovery', () => {
    const state = freshState({ weeksLived: 5 });
    state.socialMedia!.followers = 50_000;
    state.socialMedia!.activeScandal = {
      id: 's1',
      type: 'cancel',
      severity: 30,
      weeksRemaining: 3,
      startedWeek: 4,
      reputationLossThisWeek: 0,
      followerLossThisWeek: 0,
      headline: '',
      resolutionMethod: 'apology',
    };
    const r = processPulseWeeklyTick(state, 6);
    // 30 - 25 (apology bonus) = 5, but the decay is 25 absolute, so >= 25 drop.
    expect(r.socialMedia.activeScandal === null || r.socialMedia.activeScandal.severity <= 5).toBe(true);
  });

  it('auto-clears scandal when severity reaches 0 and folds to history', () => {
    const state = freshState({ weeksLived: 5 });
    state.socialMedia!.activeScandal = {
      id: 's1',
      type: 'cancel',
      severity: 5,
      weeksRemaining: 1,
      startedWeek: 4,
      reputationLossThisWeek: 0,
      followerLossThisWeek: 0,
      headline: '',
    };
    state.socialMedia!.scandalHistory = [];
    const r = processPulseWeeklyTick(state, 6);
    expect(r.socialMedia.activeScandal).toBeNull();
    expect(r.socialMedia.scandalHistory).toHaveLength(1);
    expect(r.socialMedia.lifetimeStats!.totalScandalsSurvived).toBe(1);
  });

  it('pays weekly brand deal installments and removes expired-completed deals', () => {
    const state = freshState({ weeksLived: 5 });
    state.socialMedia!.activeBrandDeals = [
      {
        id: 'd1',
        brandName: 'Acme',
        payment: 1000,
        expiresAt: 10,    // still active
        expiresIn: 5,
        weeklyPayment: 200,
        postsRequired: 1,
        postsDelivered: 0,
      },
      {
        id: 'd2',
        brandName: 'Expired',
        payment: 500,
        expiresAt: 5,     // expires this tick
        expiresIn: 0,
        postsRequired: 1,
        postsDelivered: 1, // delivered
      },
    ];
    state.socialMedia!.brandInbox = { pending: [], declined: [], history: [] };
    const r = processPulseWeeklyTick(state, 6);
    expect(r.pulseEarnings).toBeGreaterThanOrEqual(200);
    expect(r.socialMedia.activeBrandDeals).toHaveLength(1);
    expect(r.socialMedia.activeBrandDeals![0].id).toBe('d1');
    expect(r.socialMedia.brandInbox!.history.some(h => h.id === 'd2' && h.result === 'success')).toBe(true);
  });

  it('marks expired-undelivered deals as failed with reputation penalty', () => {
    const state = freshState({ weeksLived: 5 });
    state.socialMedia!.activeBrandDeals = [
      {
        id: 'd1',
        brandName: 'Acme',
        payment: 1000,
        expiresAt: 5,
        expiresIn: 0,
        postsRequired: 2,
        postsDelivered: 0,  // not delivered
      },
    ];
    state.socialMedia!.brandInbox = { pending: [], declined: [], history: [] };
    const r = processPulseWeeklyTick(state, 6);
    expect(r.socialMedia.brandInbox!.history[0].result).toBe('failed');
    expect(r.reputationDelta).toBeLessThanOrEqual(-5);
  });

  it('deactivates Verified Pro after its expires timestamp passes', () => {
    const state = freshState({ weeksLived: 1 });
    state.socialMedia!.verifiedPro = {
      active: true,
      subscribedTimestamp: Date.now() - 2 * 86400_000,
      expiresTimestamp: Date.now() - 86400_000, // expired yesterday
      sku: 'sub',
      perksUnlocked: {
        blueCheckmark: true,
        postBoostMultiplier: 1.25,
        analyticsUnlocked: true,
        noAdsInFeed: true,
        longerPosts: true,
      },
    };
    const r = processPulseWeeklyTick(state, 2);
    expect(r.socialMedia.verifiedPro!.active).toBe(false);
    expect(r.socialMedia.verifiedPro!.perksUnlocked.postBoostMultiplier).toBe(1.0);
  });

  it('caps notifications to 100', () => {
    const state = freshState({ weeksLived: 5 });
    state.socialMedia!.notifications = Array.from({ length: 99 }, (_, i) => ({
      id: `n${i}`,
      type: 'like' as const,
      timestamp: 0,
      gameWeek: 0,
      read: true,
      text: `${i}`,
    }));
    // Force at least 3 new notifications via scandal + brand offers + active scandal.
    state.socialMedia!.followers = 10_000;
    state.socialMedia!.activeScandal = {
      id: 's1',
      type: 'cancel',
      severity: 5,
      weeksRemaining: 1,
      startedWeek: 4,
      reputationLossThisWeek: 0,
      followerLossThisWeek: 0,
      headline: '',
    };
    const r = processPulseWeeklyTick(state, 6);
    expect(r.socialMedia.notifications!.length).toBeLessThanOrEqual(100);
  });

  it('pulseTick is pure: same input → same socialMedia followers / scandal severity', () => {
    const state1 = freshState({ weeksLived: 5 });
    state1.socialMedia!.followers = 10_000;
    state1.socialMedia!.lastPostWeek = 0;
    const state2 = freshState({ weeksLived: 5 });
    state2.socialMedia!.followers = 10_000;
    state2.socialMedia!.lastPostWeek = 0;
    const r1 = processPulseWeeklyTick(state1, 6);
    const r2 = processPulseWeeklyTick(state2, 6);
    expect(r1.socialMedia.followers).toBe(r2.socialMedia.followers);
  });
});

describe('lint guard: pulseTick does not reference state.week', () => {
  it('source contains no actual references to state.week', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'lib', 'social', 'pulseTick.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/state\.week\b/);
  });
});
