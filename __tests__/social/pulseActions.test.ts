/**
 * PulseActions — action-level unit tests.
 *
 * Each test wires the actions to a fake setGameState/state pair and asserts
 * the resulting state plus the returned {success, message, …}.
 */
import {
  composePost,
  likePost,
  commentOnPost,
  followNpc,
  unfollowNpc,
  recoverFromScandal,
  acceptBrandDeal,
  declineBrandDeal,
  deliverBrandDealPost,
  breachBrandDeal,
  startLiveStream,
  endLiveStream,
  boostPostWithGems,
  subscribeVerifiedPro,
  cancelVerifiedPro,
  watchAdForFollowerBoost,
  markNotificationRead,
  markAllNotificationsRead,
} from '@/contexts/game/actions/PulseActions';
import { createTestGameState } from '@/__tests__/helpers/createTestGameState';
import type {
  GameState,
  PulseBrandOffer,
  PulseActiveScandal,
} from '@/contexts/game/types';

/**
 * Tiny in-memory setGameState/getGameState pair that mirrors how React's
 * useState behaves: the updater receives the most recent state.
 *
 * NOTE: freshState() shallow-spreads initialGameState, so nested
 * objects like socialMedia are shared by reference across tests. Anything
 * inside `socialMedia` we touch must be cloned at test entry to avoid
 * cross-test pollution. The helpers below do that.
 */
function makeStateHarness(initial: GameState) {
  let current = initial;
  const setGameState = (updater: any) => {
    current = typeof updater === 'function' ? updater(current) : updater;
  };
  const getState = () => current;
  return { setGameState, getState };
}

/** Snapshot-clone socialMedia so a test's mutations don't leak into initialGameState. */
function freshState(overrides: Partial<GameState> = {}): GameState {
  const s = createTestGameState(overrides);
  if (s.socialMedia) {
    s.socialMedia = JSON.parse(JSON.stringify(s.socialMedia));
  }
  if (s.userProfile) {
    s.userProfile = { ...s.userProfile };
  }
  if (s.relationships) {
    s.relationships = s.relationships.map((r) => ({ ...r }));
  }
  return s;
}

describe('composePost', () => {
  it('refuses empty content', () => {
    const state = freshState({ weeksLived: 5 });
    const { setGameState } = makeStateHarness(state);
    const r = composePost(setGameState, state, { content: '   ', contentType: 'text' });
    expect(r.success).toBe(false);
  });

  it('appends to recentPosts and increments totalPosts', () => {
    const state = freshState({ weeksLived: 5 });
    state.stats.energy = 100;
    state.socialMedia!.followers = 1000;
    const { setGameState, getState } = makeStateHarness(state);
    const r = composePost(setGameState, state, { content: 'hello world', contentType: 'text' });
    expect(r.success).toBe(true);
    const sm = getState().socialMedia!;
    expect(sm.totalPosts).toBe(1);
    expect(sm.recentPosts!.length).toBe(1);
    expect(sm.recentPosts![0].content).toBe('hello world');
    expect(sm.recentPosts![0].gameWeek).toBe(5);
  });

  it('registers player hashtags as trending', () => {
    const state = freshState({ weeksLived: 5 });
    state.stats.energy = 100;
    state.socialMedia!.followers = 1000;
    const { setGameState, getState } = makeStateHarness(state);
    composePost(setGameState, state, {
      content: 'feeling good',
      contentType: 'text',
      hashtags: ['#mood', 'gratitude'],
    });
    const trending = getState().socialMedia!.trendingHashtags!;
    expect(trending.find((t) => t.tag === '#mood')).toBeDefined();
    expect(trending.find((t) => t.tag === '#gratitude')).toBeDefined();
    expect(trending[0].source).toBe('player');
  });

  it('stores lastPostWeek = weeksLived (NOT the cyclic 1-4 counter)', () => {
    const state = freshState({ weeksLived: 17, week: 1 });
    state.stats.energy = 100;
    const { setGameState, getState } = makeStateHarness(state);
    composePost(setGameState, state, { content: 'x', contentType: 'text' });
    const sm = getState().socialMedia!;
    expect(sm.lastPostWeek).toBe(17); // weeksLived, not state.week
    expect(sm.lastPostWeeks!.text).toBe(17);
  });
});

describe('like / comment', () => {
  it('like toggles isLiked on a player post', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.energy = 100;
    const harness = makeStateHarness(state);
    composePost(harness.setGameState, harness.getState(), { content: 'a', contentType: 'text' });
    const postId = harness.getState().socialMedia!.recentPosts![0].id;
    likePost(harness.setGameState, postId);
    expect(harness.getState().socialMedia!.recentPosts![0].isLiked).toBe(true);
    likePost(harness.setGameState, postId);
    expect(harness.getState().socialMedia!.recentPosts![0].isLiked).toBe(false);
  });

  it('commentOnPost rejects empty / low-energy', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.energy = 1;
    const { setGameState } = makeStateHarness(state);
    expect(commentOnPost(setGameState, state, 'p1', '   ').success).toBe(false);
    expect(commentOnPost(setGameState, state, 'p1', 'hi').success).toBe(false);
  });

  it('commentOnPost appends a comment to the thread', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.energy = 100;
    const { setGameState, getState } = makeStateHarness(state);
    const r = commentOnPost(setGameState, state, 'somePost', 'great post');
    expect(r.success).toBe(true);
    const thread = getState().socialMedia!.commentThreads!['somePost'];
    expect(thread).toHaveLength(1);
    expect(thread[0].isPlayerComment).toBe(true);
  });
});

describe('follow graph', () => {
  it('followNpc adds to followingNpcIds (mutual is probabilistic)', () => {
    const state = freshState({ weeksLived: 1 });
    state.relationships = [
      { id: 'r1', name: 'Alex', type: 'friend', relationshipScore: 70 } as any,
    ];
    const { setGameState, getState } = makeStateHarness(state);
    followNpc(setGameState, 'r1');
    expect(getState().socialMedia!.followGraph!.followingNpcIds).toContain('r1');
  });

  it('unfollowNpc removes from followingNpcIds and may drop relationship score', () => {
    const state = freshState({ weeksLived: 1 });
    state.relationships = [
      { id: 'r1', name: 'Alex', type: 'friend', relationshipScore: 80 } as any,
    ];
    state.socialMedia!.followGraph = {
      followingNpcIds: ['r1'],
      followedByNpcIds: ['r1'],
      lastUpdatedWeek: 0,
    };
    const { setGameState, getState } = makeStateHarness(state);
    unfollowNpc(setGameState, 'r1');
    expect(getState().socialMedia!.followGraph!.followingNpcIds).not.toContain('r1');
    expect(getState().relationships[0].relationshipScore).toBeLessThanOrEqual(78);
  });
});

describe('scandal recovery', () => {
  function withScandal(s: GameState, type: PulseActiveScandal['type'] = 'cancel'): GameState {
    s.socialMedia!.activeScandal = {
      id: 's1',
      type,
      severity: 70,
      weeksRemaining: 3,
      startedWeek: 5,
      reputationLossThisWeek: 0,
      followerLossThisWeek: 0,
      headline: 'bad take',
    };
    return s;
  }

  it('apology costs energy, gives +5 reputation, drops a small follower %', () => {
    const state = withScandal(freshState({ weeksLived: 6 }));
    state.stats.energy = 50;
    state.socialMedia!.followers = 10_000;
    const { setGameState, getState } = makeStateHarness(state);
    const r = recoverFromScandal(setGameState, state, 'apology');
    expect(r.success).toBe(true);
    expect(r.reputationDelta).toBe(5);
    expect(getState().socialMedia!.activeScandal!.resolutionMethod).toBe('apology');
    expect(getState().socialMedia!.followers).toBeLessThan(10_000);
  });

  it('gems method clears scandal instantly and deducts 500 gems', () => {
    const state = withScandal(freshState({ weeksLived: 6 }));
    state.stats.gems = 600;
    const { setGameState, getState } = makeStateHarness(state);
    const r = recoverFromScandal(setGameState, state, 'gems');
    expect(r.success).toBe(true);
    expect(getState().socialMedia!.activeScandal).toBeNull();
    expect(getState().socialMedia!.scandalHistory).toHaveLength(1);
    expect(getState().stats.gems).toBe(100);
    expect(getState().socialMedia!.lifetimeStats!.totalScandalsSurvived).toBe(1);
  });

  it('gems method fails when insufficient gems', () => {
    const state = withScandal(freshState({ weeksLived: 6 }));
    state.stats.gems = 100;
    const { setGameState } = makeStateHarness(state);
    const r = recoverFromScandal(setGameState, state, 'gems');
    expect(r.success).toBe(false);
  });

  it('lawsuit only valid for deepfake / cancel scandals', () => {
    const state = withScandal(freshState({ weeksLived: 6 }), 'bad_take');
    state.stats.money = 10_000;
    const { setGameState } = makeStateHarness(state);
    const r = recoverFromScandal(setGameState, state, 'lawsuit');
    expect(r.success).toBe(false);
  });

  it('silence sets resolutionMethod and leaves scandal in place for tick to resolve', () => {
    const state = withScandal(freshState({ weeksLived: 6 }));
    const { setGameState, getState } = makeStateHarness(state);
    const r = recoverFromScandal(setGameState, state, 'silence');
    expect(r.success).toBe(true);
    expect(getState().socialMedia!.activeScandal).not.toBeNull();
    expect(getState().socialMedia!.activeScandal!.resolutionMethod).toBe('silence');
  });

  it('returns success: false when no active scandal', () => {
    const state = freshState({ weeksLived: 1 });
    const { setGameState } = makeStateHarness(state);
    expect(recoverFromScandal(setGameState, state, 'apology').success).toBe(false);
  });
});

describe('brand deals', () => {
  function addOffer(state: GameState, override?: Partial<PulseBrandOffer>): PulseBrandOffer {
    const offer: PulseBrandOffer = {
      id: 'offer1',
      brandName: 'NebulaCola',
      type: 'brand_deal',
      payment: 4000,
      weeklyPayment: 1000,
      postsRequired: 2,
      duration: 4,
      category: 'food',
      requirements: { minFollowers: 10_000, minEngagementRate: 10 },
      description: 'demo',
      expiresInWeeks: 3,
      offeredWeek: 1,
      ...override,
    };
    state.socialMedia!.brandInbox = {
      pending: [offer],
      declined: [],
      history: [],
    };
    return offer;
  }

  it('acceptBrandDeal moves offer to activeBrandDeals and bumps brandPartnerships', () => {
    const state = freshState({ weeksLived: 5 });
    addOffer(state);
    const { setGameState, getState } = makeStateHarness(state);
    const r = acceptBrandDeal(setGameState, 'offer1');
    expect(r.success).toBe(true);
    expect(getState().socialMedia!.activeBrandDeals).toHaveLength(1);
    expect(getState().socialMedia!.activeBrandDeals![0].expiresAt).toBe(5 + 4);
    expect(getState().socialMedia!.brandInbox!.pending).toHaveLength(0);
    expect(getState().socialMedia!.brandPartnerships).toBe(1);
  });

  it('declineBrandDeal moves offer to declined (capped at 20)', () => {
    const state = freshState({ weeksLived: 5 });
    addOffer(state);
    const { setGameState, getState } = makeStateHarness(state);
    declineBrandDeal(setGameState, 'offer1');
    expect(getState().socialMedia!.brandInbox!.pending).toHaveLength(0);
    expect(getState().socialMedia!.brandInbox!.declined).toHaveLength(1);
  });

  it('deliverBrandDealPost increments postsDelivered, completes when threshold hit', () => {
    const state = freshState({ weeksLived: 5 });
    addOffer(state, { postsRequired: 2 });
    const { setGameState, getState } = makeStateHarness(state);
    acceptBrandDeal(setGameState, 'offer1');
    // TWO posts, because a 2-post contract needs two. This used to deliver the
    // SAME post ('p1') twice and expect completion — the test encoded the
    // exploit: one post satisfied a whole multi-post contract and triggered the
    // early-completion payout. 2026-07-30 audit ECON-4.
    getState().socialMedia!.recentPosts = [
      {
        id: 'p1',
        content: 'sponsored',
        likes: 0,
        comments: 0,
        timestamp: 0,
        contentType: 'text',
      } as any,
      {
        id: 'p2',
        content: 'sponsored again',
        likes: 0,
        comments: 0,
        timestamp: 0,
        contentType: 'text',
      } as any,
    ];
    let r = deliverBrandDealPost(setGameState, 'offer1', 'p1');
    expect(r.success).toBe(true);
    expect(r.message).toMatch(/1\/2/);
    // Re-submitting the same post is refused, and does NOT advance the count.
    expect(deliverBrandDealPost(setGameState, 'offer1', 'p1').success).toBe(false);
    r = deliverBrandDealPost(setGameState, 'offer1', 'p2');
    expect(r.message).toMatch(/completed/i);
    expect(getState().socialMedia!.activeBrandDeals).toHaveLength(0);
    expect(getState().socialMedia!.brandInbox!.history).toHaveLength(1);
    expect(getState().socialMedia!.brandInbox!.history[0].result).toBe('success');
  });

  it('breachBrandDeal removes deal, applies penalty, drops reputation', () => {
    const state = freshState({ weeksLived: 5 });
    state.stats.money = 50_000;
    state.stats.reputation = 50;
    addOffer(state);
    const { setGameState, getState } = makeStateHarness(state);
    acceptBrandDeal(setGameState, 'offer1');
    const r = breachBrandDeal(setGameState, 'offer1');
    expect(r.success).toBe(true);
    expect(r.penalty).toBeGreaterThan(0);
    expect(getState().socialMedia!.activeBrandDeals).toHaveLength(0);
    expect(getState().socialMedia!.brandInbox!.history[0].result).toBe('breached');
    expect(getState().stats.reputation).toBe(40);
  });
});

describe('live streaming', () => {
  it('startLiveStream gates on followers and energy', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.energy = 100;
    state.socialMedia!.followers = 50;
    const { setGameState } = makeStateHarness(state);
    expect(startLiveStream(setGameState, state, 'music').success).toBe(false);
    state.socialMedia!.followers = 500;
    state.stats.energy = 10;
    expect(startLiveStream(setGameState, state, 'music').success).toBe(false);
  });

  it('startLiveStream → endLiveStream awards donations + followers', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.energy = 100;
    state.socialMedia!.followers = 5_000;
    const harness = makeStateHarness(state);
    const r1 = startLiveStream(harness.setGameState, harness.getState(), 'music');
    expect(r1.success).toBe(true);
    // Simulate 100 viewers locked in
    harness.getState().socialMedia!.liveSession = {
      ...harness.getState().socialMedia!.liveSession!,
      peakViewers: 200,
      donationsEarned: 75,
      minutesElapsed: 12,
    };
    const r2 = endLiveStream(harness.setGameState, harness.getState());
    expect(r2.success).toBe(true);
    expect(r2.newFollowers).toBe(10); // 200 * 0.05
    expect(r2.totalDonations).toBe(75);
    expect(harness.getState().socialMedia!.liveSession).toBeNull();
    expect(harness.getState().socialMedia!.totalLiveStreams).toBe(1);
  });
});

describe('monetization', () => {
  it('boostPostWithGems fails on insufficient gems, succeeds otherwise', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.gems = 50;
    state.socialMedia!.recentPosts = [{
      id: 'p1', content: 'x', likes: 1, comments: 0, contentType: 'text', timestamp: 0,
    } as any];
    const { setGameState, getState } = makeStateHarness(state);
    expect(boostPostWithGems(setGameState, state, 'p1', 200).success).toBe(false);

    state.stats.gems = 300;
    expect(boostPostWithGems(setGameState, state, 'p1', 200).success).toBe(true);
    expect(getState().stats.gems).toBe(100);
    expect(getState().socialMedia!.lifetimeStats!.totalGemsBoostsUsed).toBe(1);
  });

  it('subscribeVerifiedPro debits in-game cash, flips perks + userProfile.verified + grants signup boost', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.money = 1000;
    const { setGameState, getState } = makeStateHarness(state);
    const r = subscribeVerifiedPro(setGameState, state, 'weekly');
    expect(r.success).toBe(true);
    const sm = getState().socialMedia!;
    expect(sm.verifiedPro!.active).toBe(true);
    expect(sm.verifiedPro!.plan).toBe('weekly');
    expect(sm.verifiedPro!.weeklyPrice).toBe(20);
    expect(sm.verifiedPro!.perksUnlocked.blueCheckmark).toBe(true);
    expect(sm.verifiedPro!.perksUnlocked.postBoostMultiplier).toBe(1.25);
    expect(sm.followers).toBe(500);
    expect(getState().userProfile.verified).toBe(true);
    // $20 weekly fee debited from stats.money (canonical applyMoneyDelta).
    expect(getState().stats.money).toBe(980);
  });

  it('subscribeVerifiedPro rejects (no perks, no debit) when the player cannot afford it', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.money = 5;
    const { setGameState, getState } = makeStateHarness(state);
    const r = subscribeVerifiedPro(setGameState, state, 'weekly');
    expect(r.success).toBe(false);
    expect(getState().socialMedia!.verifiedPro?.active ?? false).toBe(false);
    expect(getState().stats.money).toBe(5); // untouched
  });

  it('subscribeVerifiedPro annual prepays 52 weeks and stamps paidThroughWeek', () => {
    const state = freshState({ weeksLived: 4 });
    state.stats.money = 5000;
    const { setGameState, getState } = makeStateHarness(state);
    const r = subscribeVerifiedPro(setGameState, state, 'annual');
    expect(r.success).toBe(true);
    const sm = getState().socialMedia!;
    expect(sm.verifiedPro!.plan).toBe('annual');
    expect(sm.verifiedPro!.paidThroughWeek).toBe(56); // startedWeek 4 + 52
    expect(getState().stats.money).toBe(5000 - 865);
  });

  // 2026-07-16 weekly audit (LOW): subscribing while already subscribed charged
  // the price again — a pure anti-player double-charge.
  it('subscribeVerifiedPro refuses to re-charge the plan the player already holds', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.money = 1000;
    const { setGameState, getState } = makeStateHarness(state);
    expect(subscribeVerifiedPro(setGameState, state, 'weekly').success).toBe(true);
    expect(getState().stats.money).toBe(980);

    const again = subscribeVerifiedPro(setGameState, getState(), 'weekly');
    expect(again.success).toBe(false);
    expect(again.message).toMatch(/already active/i);
    expect(getState().stats.money).toBe(980); // no second debit
  });

  it('subscribeVerifiedPro double-tap in one batch charges exactly once', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.money = 1000;
    const { setGameState, getState } = makeStateHarness(state);
    // Both taps read the SAME pre-dispatch snapshot — only the in-updater
    // re-check against `prev` can stop the second charge.
    subscribeVerifiedPro(setGameState, state, 'weekly');
    subscribeVerifiedPro(setGameState, state, 'weekly');
    expect(getState().stats.money).toBe(980);
    expect(getState().socialMedia!.verifiedPro!.active).toBe(true);
  });

  it('subscribeVerifiedPro still allows switching weekly → annual', () => {
    const state = freshState({ weeksLived: 4 });
    state.stats.money = 5000;
    const { setGameState, getState } = makeStateHarness(state);
    subscribeVerifiedPro(setGameState, state, 'weekly');
    const r = subscribeVerifiedPro(setGameState, getState(), 'annual');
    expect(r.success).toBe(true);
    expect(getState().socialMedia!.verifiedPro!.plan).toBe('annual');
  });

  it('cancelVerifiedPro disables perks and clears the blue check (userProfile.verified)', () => {
    const state = freshState({ weeksLived: 1 });
    state.stats.money = 1000;
    const { setGameState, getState } = makeStateHarness(state);
    subscribeVerifiedPro(setGameState, state, 'weekly');
    expect(getState().userProfile.verified).toBe(true);
    cancelVerifiedPro(setGameState);
    const sm = getState().socialMedia!;
    expect(sm.verifiedPro!.active).toBe(false);
    expect(sm.verifiedPro!.perksUnlocked.postBoostMultiplier).toBe(1.0);
    // Blue check no longer survives cancellation.
    expect(getState().userProfile.verified).toBe(false);
  });

  it('watchAdForFollowerBoost enforces 1-per-week cap using weeksLived', () => {
    const state = freshState({ weeksLived: 5 });
    const { setGameState, getState } = makeStateHarness(state);
    const r1 = watchAdForFollowerBoost(setGameState, state);
    expect(r1.success).toBe(true);
    expect(r1.followersGained).toBe(50);

    const r2 = watchAdForFollowerBoost(setGameState, getState());
    expect(r2.success).toBe(false);
  });

  it('Verified Pro triples ad reward', () => {
    const state = freshState({ weeksLived: 5 });
    state.socialMedia!.verifiedPro!.active = true;
    const { setGameState } = makeStateHarness(state);
    const r = watchAdForFollowerBoost(setGameState, state);
    expect(r.followersGained).toBe(150);
  });
});

describe('notifications', () => {
  it('markNotificationRead flips a single notification', () => {
    const state = freshState({ weeksLived: 1 });
    state.socialMedia!.notifications = [
      { id: 'n1', type: 'like', timestamp: 0, gameWeek: 1, read: false, text: 'hi' },
    ];
    const { setGameState, getState } = makeStateHarness(state);
    markNotificationRead(setGameState, 'n1');
    expect(getState().socialMedia!.notifications![0].read).toBe(true);
  });

  it('markAllNotificationsRead flips all to read', () => {
    const state = freshState({ weeksLived: 1 });
    state.socialMedia!.notifications = [
      { id: 'n1', type: 'like', timestamp: 0, gameWeek: 1, read: false, text: 'a' },
      { id: 'n2', type: 'follow', timestamp: 0, gameWeek: 1, read: false, text: 'b' },
    ];
    const { setGameState, getState } = makeStateHarness(state);
    markAllNotificationsRead(setGameState);
    expect(getState().socialMedia!.notifications!.every((n) => n.read)).toBe(true);
  });
});

describe('lint guard: PulseActions does not reference state.week', () => {
  it('source contains no actual references to state.week', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', '..', 'contexts', 'game', 'actions', 'PulseActions.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/state\.week\b/);
  });
});
