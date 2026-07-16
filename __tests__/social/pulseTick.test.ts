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

  it('keeps Verified Pro active regardless of the legacy expires timestamp (in-game billing owns lapse)', () => {
    // Verified Pro is now an IN-GAME cash subscription. Wall-clock expiry is
    // removed from the pure tick — weekly billing + lapse (on insufficient cash)
    // is handled by applySubscriptionsForWeek in the nextWeek orchestrator. So a
    // stale legacy `expiresTimestamp` must NOT deactivate the sub here.
    const state = freshState({ weeksLived: 1 });
    state.socialMedia!.verifiedPro = {
      active: true,
      plan: 'weekly',
      weeklyPrice: 20,
      startedWeek: 0,
      subscribedTimestamp: Date.now() - 2 * 86400_000,
      expiresTimestamp: Date.now() - 86400_000, // legacy field — no longer consulted
      perksUnlocked: {
        blueCheckmark: true,
        postBoostMultiplier: 1.25,
        analyticsUnlocked: true,
        noAdsInFeed: true,
        longerPosts: true,
      },
    };
    const r = processPulseWeeklyTick(state, 2);
    expect(r.socialMedia.verifiedPro!.active).toBe(true);
    expect(r.socialMedia.verifiedPro!.perksUnlocked.postBoostMultiplier).toBe(1.25);
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

describe('processPulseWeeklyTick — Wave A additions', () => {
  // ── Scandal risk accrual ──────────────────────────────────────────────
  it('accrues scandal risk for popular+ accounts and keeps novices at zero', () => {
    const novice = freshState({ weeksLived: 5 });
    novice.socialMedia!.followers = 500;
    novice.socialMedia!.scandalRiskScore = 0;
    novice.socialMedia!.lastPostWeek = 6;
    const rn = processPulseWeeklyTick(novice, 6);
    expect(rn.socialMedia.scandalRiskScore).toBe(0);

    const famous = freshState({ weeksLived: 5 });
    famous.socialMedia!.followers = 200_000; // influencer tier
    famous.socialMedia!.scandalRiskScore = 0;
    famous.socialMedia!.lastPostWeek = 6;
    const rf = processPulseWeeklyTick(famous, 6);
    expect(rf.socialMedia.scandalRiskScore).toBeGreaterThan(0);
  });

  it('decays scandal risk multiplicatively and clamps to the cap', () => {
    const state = freshState({ weeksLived: 5 });
    state.socialMedia!.followers = 500; // novice → zero accrual, pure decay
    state.socialMedia!.scandalRiskScore = 100;
    state.socialMedia!.lastPostWeek = 6;
    const r = processPulseWeeklyTick(state, 6);
    expect(r.socialMedia.scandalRiskScore).toBeLessThan(100);
    expect(r.socialMedia.scandalRiskScore).toBeGreaterThanOrEqual(0);
  });

  // ── Scandal spawn gating ──────────────────────────────────────────────
  it('never spawns a scandal below the popular follower gate', () => {
    let state = freshState({ weeksLived: 0 });
    state.socialMedia!.followers = 5_000; // under 10K gate
    state.socialMedia!.scandalRiskScore = 100;
    state.socialMedia!.scandalHistory = [];
    for (let w = 1; w <= 120; w++) {
      const r = processPulseWeeklyTick(state, w);
      expect(r.socialMedia.activeScandal ?? null).toBeNull();
      state = freshState({ weeksLived: w });
      state.socialMedia = JSON.parse(JSON.stringify(r.socialMedia));
      state.socialMedia!.followers = 5_000; // hold under the gate
    }
  });

  it('does not spawn during the post-resolution cooldown', () => {
    const state = freshState({ weeksLived: 20 });
    state.socialMedia!.followers = 2_000_000; // celebrity
    state.socialMedia!.scandalRiskScore = 100;
    state.socialMedia!.activeScandal = null;
    // Survived a scandal last week → cooldown (6wk) not elapsed.
    state.socialMedia!.scandalHistory = [
      {
        id: 'old',
        type: 'cancel',
        severity: 50,
        survivedAtWeek: 20,
        finalReputationLoss: 5,
        resolutionMethod: 'silence',
      },
    ];
    const r = processPulseWeeklyTick(state, 21);
    expect(r.socialMedia.activeScandal ?? null).toBeNull();
  });

  it('eventually spawns an organic scandal for a famous account, one at a time', () => {
    let state = freshState({ weeksLived: 0 });
    state.socialMedia!.followers = 2_000_000; // celebrity → highest accrual
    state.socialMedia!.scandalRiskScore = 100;
    state.socialMedia!.scandalHistory = [];
    let spawnCount = 0;
    let maxConcurrent = 0;
    for (let w = 1; w <= 400; w++) {
      const r = processPulseWeeklyTick(state, w);
      const active = r.socialMedia.activeScandal ?? null;
      maxConcurrent = Math.max(maxConcurrent, active ? 1 : 0);
      // Detect a fresh spawn (organic id) that wasn't present before.
      if (active && active.id.startsWith('scandal_organic_') && active.startedWeek === w) {
        spawnCount++;
      }
      state = freshState({ weeksLived: w });
      state.socialMedia = JSON.parse(JSON.stringify(r.socialMedia));
      state.socialMedia!.followers = 2_000_000;
      state.socialMedia!.lastPostWeek = w; // keep posting so followers don't decay off tier
    }
    expect(spawnCount).toBeGreaterThan(0);
    expect(maxConcurrent).toBeLessThanOrEqual(1);
  });

  it('trend injection + impression earnings are deterministic across re-runs (seeded)', () => {
    // Determinism guard: same state + week must yield byte-identical trending
    // hashtags (postCount/velocity were Math.random) and earnings (±20% was
    // Math.random). Two independent runs on equal state must deep-equal.
    const build = () => {
      const s = freshState({ weeksLived: 20 });
      s.socialMedia!.followers = 250_000;
      s.socialMedia!.totalPosts = 40;
      s.socialMedia!.viralPosts = 2;
      s.socialMedia!.lastPostWeek = 21;
      s.socialMedia!.trendingHashtags = [];
      return s;
    };
    const r1 = processPulseWeeklyTick(build(), 21);
    const r2 = processPulseWeeklyTick(build(), 21);
    expect(r1.socialMedia.trendingHashtags).toEqual(r2.socialMedia.trendingHashtags);
    expect(r1.socialMedia.notifications).toEqual(r2.socialMedia.notifications);
    expect(r1.pulseEarnings).toBe(r2.pulseEarnings);
  });

  it('scandal spawn is deterministic (pure) for identical inputs', () => {
    const build = () => {
      const s = freshState({ weeksLived: 41 });
      s.socialMedia!.followers = 2_000_000;
      s.socialMedia!.scandalRiskScore = 100;
      s.socialMedia!.activeScandal = null;
      s.socialMedia!.scandalHistory = [];
      return s;
    };
    const r1 = processPulseWeeklyTick(build(), 42);
    const r2 = processPulseWeeklyTick(build(), 42);
    expect(r1.socialMedia.activeScandal?.id ?? null).toBe(r2.socialMedia.activeScandal?.id ?? null);
    expect(r1.socialMedia.scandalRiskScore).toBe(r2.socialMedia.scandalRiskScore);
  });

  // ── Pile-on comments ──────────────────────────────────────────────────
  it('seeds bounded hostile pile-on comments on recent posts during a scandal', () => {
    const state = freshState({ weeksLived: 5 });
    state.socialMedia!.followers = 100_000;
    state.socialMedia!.activeScandal = {
      id: 's1',
      type: 'cancel',
      severity: 60,
      weeksRemaining: 3,
      startedWeek: 4,
      reputationLossThisWeek: 0,
      followerLossThisWeek: 0,
      headline: 'meltdown',
    };
    state.socialMedia!.recentPosts = [
      { id: 'p1', content: 'hi', likes: 1, comments: 0, timestamp: 0, contentType: 'text' },
      { id: 'p2', content: 'yo', likes: 1, comments: 0, timestamp: 0, contentType: 'text' },
    ];
    state.socialMedia!.commentThreads = {};
    const r = processPulseWeeklyTick(state, 6);
    const threads = r.socialMedia.commentThreads ?? {};
    expect((threads['p1'] ?? []).some(c => c.isFromHater)).toBe(true);
    for (const list of Object.values(threads)) {
      expect(list.length).toBeLessThanOrEqual(50);
    }
  });

  it('pile-on is idempotent per week (no re-seed on a second tick for the same week)', () => {
    const state = freshState({ weeksLived: 5 });
    state.socialMedia!.followers = 100_000;
    state.socialMedia!.activeScandal = {
      id: 's1',
      type: 'cancel',
      severity: 60,
      weeksRemaining: 3,
      startedWeek: 4,
      reputationLossThisWeek: 0,
      followerLossThisWeek: 0,
      headline: 'meltdown',
    };
    state.socialMedia!.recentPosts = [
      { id: 'p1', content: 'hi', likes: 1, comments: 0, timestamp: 0, contentType: 'text' },
    ];
    state.socialMedia!.commentThreads = {};
    const r1 = processPulseWeeklyTick(state, 6);
    const count1 = (r1.socialMedia.commentThreads?.['p1'] ?? []).filter(c => c.isFromHater).length;
    // Feed the result back and re-run the SAME week — must not add more haters.
    const state2 = freshState({ weeksLived: 5 });
    state2.socialMedia = JSON.parse(JSON.stringify(r1.socialMedia));
    const r2 = processPulseWeeklyTick(state2, 6);
    const count2 = (r2.socialMedia.commentThreads?.['p1'] ?? []).filter(
      c => c.isFromHater && c.gameWeek === 6,
    ).length;
    expect(count2).toBe(count1);
  });

  it('injects a scandal trending tag with a "why" reason', () => {
    const state = freshState({ weeksLived: 3 });
    state.socialMedia!.trendingHashtags = [];
    state.socialMedia!.activeScandal = {
      id: 's1',
      type: 'leaked_dm',
      severity: 60,
      weeksRemaining: 3,
      startedWeek: 2,
      reputationLossThisWeek: 0,
      followerLossThisWeek: 0,
      headline: 'leak',
    };
    const r = processPulseWeeklyTick(state, 4);
    const scandalTag = r.socialMedia.trendingHashtags!.find(t => t.source === 'scandal');
    expect(scandalTag?.whyReason).toBeTruthy();
  });

  // ── Follower history ──────────────────────────────────────────────────
  it('appends a follower-history sample and caps it at 52 points', () => {
    const state = freshState({ weeksLived: 100 });
    state.socialMedia!.followers = 1234;
    state.socialMedia!.lastPostWeek = 101;
    state.socialMedia!.followerHistory = Array.from({ length: 52 }, (_, i) => ({ week: i, followers: i }));
    const r = processPulseWeeklyTick(state, 101);
    const hist = r.socialMedia.followerHistory!;
    expect(hist.length).toBeLessThanOrEqual(52);
    expect(hist[hist.length - 1]).toEqual({ week: 101, followers: 1234 });
  });

  it('replaces an existing same-week follower-history sample (idempotent)', () => {
    const state = freshState({ weeksLived: 9 });
    state.socialMedia!.followers = 5000;
    state.socialMedia!.lastPostWeek = 10;
    state.socialMedia!.followerHistory = [{ week: 10, followers: 111 }];
    const r = processPulseWeeklyTick(state, 10);
    const hist = r.socialMedia.followerHistory!;
    const week10 = hist.filter(h => h.week === 10);
    expect(week10).toHaveLength(1);
    expect(week10[0].followers).toBe(5000);
  });

  // ── Pending boosts pruning ────────────────────────────────────────────
  it('prunes expired pendingBoosts and keeps recent ones', () => {
    const state = freshState({ weeksLived: 9 });
    state.socialMedia!.lastPostWeek = 10;
    state.socialMedia!.pendingBoosts = [
      { type: 'post', postId: 'old', appliedWeek: 2 },   // expired (>2 weeks old)
      { type: 'post', postId: 'fresh', appliedWeek: 10 }, // current
    ];
    const r = processPulseWeeklyTick(state, 10);
    const ids = (r.socialMedia.pendingBoosts ?? []).map(b => b.postId);
    expect(ids).toContain('fresh');
    expect(ids).not.toContain('old');
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
