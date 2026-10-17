/**
 * Pulse brand deals pay for POSTS, at a bounded rate (2026-10-17).
 *
 * Measured on the real tick + actions before the fix (accept every offer,
 * audience held fixed, weeks 13-60):
 *
 *                 post nothing      4 posts/wk     concurrent deals
 *     50K         $82,524/wk        $105,024/wk          5
 *     100K       $618,226/wk        $663,226/wk         13
 *     1M      $15,556,744/wk     $16,006,744/wk         25
 *
 * against a best-ladder career top of $6,000/wk. An undelivered contract kept
 * 81-94% of its value (25% on accept + a weekly stream that ignored delivery),
 * contracts stacked without limit, and the rates were $0.67-$0.83 per follower
 * per post. After: posting nothing earns exactly what an account with no deals
 * earns, and 4 posts/wk pays $100 / $2,300 / $4,600 / $40,000 at
 * 10K / 50K / 100K / 1M followers, never more than $50,000 in a week.
 *
 * The suites here drive the production tick (`processPulseWeeklyTick`) and the
 * production actions, not a model of them.
 */
import {
  acceptBrandDeal,
  deliverBrandDealPost,
} from '@/contexts/game/actions/PulseActions';
import {
  BRAND_PAY_PER_POST_CAP,
  brandPayPerPost,
  generateBrandOffersExtended,
} from '@/lib/social/brandPartnerships';
import { processPulseWeeklyTick } from '@/lib/social/pulseTick';
import type { GameState, PulseBrandOffer, PulseRecentPost } from '@/contexts/game/types';
import { createTestGameState } from '../helpers/createTestGameState';
import { createSetGameStateStub } from '../helpers/setGameStateStub';

const START_WEEK = 500;

function influencer(followers: number): GameState {
  const s = createTestGameState({ weeksLived: START_WEEK, stats: { money: 0, reputation: 60 } });
  return {
    ...s,
    socialMedia: {
      ...s.socialMedia!,
      followers,
      totalPosts: 100,
      lastPostWeek: START_WEEK,
      recentPosts: [],
      brandInbox: { pending: [], declined: [], history: [] },
      activeBrandDeals: [],
    },
  };
}

/** Pin the audience so every week offers the same tiers, and keep scandals out. */
function holdAudience(s: GameState, followers: number): GameState {
  return {
    ...s,
    socialMedia: {
      ...s.socialMedia!,
      followers,
      lastPostWeek: s.weeksLived ?? 0,
      activeScandal: null,
      scandalRiskScore: 0,
    },
  };
}

/** One production Pulse tick, its earnings credited the way the week loop sums them. */
function tick(s: GameState): GameState {
  const ws = s.weeksLived ?? 0;
  const r = processPulseWeeklyTick(s, ws + 1);
  return {
    ...s,
    weeksLived: ws + 1,
    socialMedia: r.socialMedia,
    stats: { ...s.stats, money: s.stats.money + r.pulseEarnings },
  };
}

function fakePost(id: string, week: number): PulseRecentPost {
  return { id, content: 'sponsored', likes: 0, comments: 0, timestamp: 0, gameWeek: week, contentType: 'photo' };
}

type Strategy = 'no-deals' | 'accept-all-post-nothing' | 'accept-all-post-5';

/** Total cash after `weeks` weeks of `strategy` at a fixed audience. */
function runInfluencer(followers: number, weeks: number, strategy: Strategy): number {
  let s = influencer(followers);
  for (let w = 0; w < weeks; w++) {
    s = holdAudience(s, followers);
    const stub = createSetGameStateStub(s);
    if (strategy !== 'no-deals') {
      for (const o of [...(stub.current().socialMedia?.brandInbox?.pending ?? [])]) {
        acceptBrandDeal(stub.current(), stub.setGameState, o.id);
      }
    }
    if (strategy === 'accept-all-post-5') {
      // Five posts - one per content type, the most the weekly cap allows -
      // each delivered to the open deal paying most per post.
      const ws = stub.current().weeksLived ?? 0;
      for (let k = 0; k < 5; k++) {
        const id = `bd-${ws}-${k}`;
        stub.setGameState((p) => ({
          ...p,
          socialMedia: { ...p.socialMedia!, recentPosts: [fakePost(id, ws), ...(p.socialMedia!.recentPosts ?? [])].slice(0, 50) },
        }));
        const open = (stub.current().socialMedia?.activeBrandDeals ?? [])
          .filter((d) => (d.postsDelivered ?? 0) < (d.postsRequired ?? 1))
          .sort((a, b) => b.payment / (b.postsRequired ?? 1) - a.payment / (a.postsRequired ?? 1));
        if (open.length > 0) deliverBrandDealPost(stub.current(), stub.setGameState, open[0].id, id);
      }
    }
    s = tick(stub.current());
  }
  return s.stats.money;
}

describe('brand deals: posting nothing earns nothing', () => {
  it.each([50_000, 100_000, 1_000_000])(
    'at %i followers, accepting every offer for 30 weeks and posting nothing earns exactly what no deals earn',
    (followers) => {
      const baseline = runInfluencer(followers, 30, 'no-deals'); // impression earnings only
      const ghost = runInfluencer(followers, 30, 'accept-all-post-nothing');
      // Was +$82K / +$618K / +$15.6M a week on top of the baseline.
      expect(ghost).toBe(baseline);
    },
  );
});

describe('brand deals: what the work pays', () => {
  it.each([
    // followers, the most a 5-post week can pay at that audience
    [10_000, 100],              // one sponsored post a week is all that is offered
    [100_000, 5 * 1_500],       // long-campaign rate, $0.015/follower/post
    [1_000_000, 5 * BRAND_PAY_PER_POST_CAP],
  ])('at %i followers, five delivered posts a week pay at most $%i', (followers, weeklyCeiling) => {
    const weeks = 30;
    const baseline = runInfluencer(followers, weeks, 'no-deals');
    const worked = runInfluencer(followers, weeks, 'accept-all-post-5');
    const brandPerWeek = (worked - baseline) / weeks;
    expect(brandPerWeek).toBeGreaterThan(0);
    // Was $663,226/wk at 100K and $16.0M/wk at 1M.
    expect(brandPerWeek).toBeLessThanOrEqual(weeklyCeiling);
  });

  it('pins the rate card: $0.01-$0.02 per follower per post, capped at $10,000 a post', () => {
    expect(brandPayPerPost('sponsored_post', 100_000)).toBe(1_000);
    expect(brandPayPerPost('brand_deal', 100_000)).toBe(1_200);
    expect(brandPayPerPost('long_campaign', 100_000)).toBe(1_500);
    expect(brandPayPerPost('ambassador', 1_000_000)).toBe(10_000);
    for (const followers of [1e4, 1e5, 1e6, 1e7, 1e9]) {
      for (const type of ['sponsored_post', 'brand_deal', 'long_campaign', 'ambassador'] as const) {
        expect(brandPayPerPost(type, followers)).toBeLessThanOrEqual(BRAND_PAY_PER_POST_CAP);
      }
    }
    // Five content types, one post each a week: the weekly ceiling is the
    // $50K/wk `socialMedia` per-source cap in calcWeeklyPassiveIncome.
    expect(5 * BRAND_PAY_PER_POST_CAP).toBe(50_000);
  });

  it('an offer card quotes the per-post pay that delivery actually credits', () => {
    const s = influencer(100_000);
    s.socialMedia!.engagementRate = 20;
    const offers = generateBrandOffersExtended(s, START_WEEK);
    const campaign = offers.find((o) => o.type === 'long_campaign')!;
    expect(campaign.payment).toBe(9_000);
    expect(campaign.description).toContain('$1,500 per post');

    s.socialMedia!.brandInbox = { pending: [campaign], declined: [], history: [] };
    s.socialMedia!.recentPosts = Array.from({ length: 6 }, (_, i) => fakePost(`p${i}`, START_WEEK));
    const stub = createSetGameStateStub(s);
    expect(acceptBrandDeal(stub.current(), stub.setGameState, campaign.id).success).toBe(true);
    expect(stub.current().stats.money).toBe(0);
    for (let i = 0; i < 6; i++) {
      const r = deliverBrandDealPost(stub.current(), stub.setGameState, campaign.id, `p${i}`);
      expect(r.success).toBe(true);
      expect(stub.current().stats.money).toBe(1_500 * (i + 1));
    }
  });
});

describe('brand deals: no farmable edges', () => {
  it('a delivery naming a post that does not exist pays nothing and counts nothing', () => {
    const s = influencer(100_000);
    s.socialMedia!.activeBrandDeals = [
      { id: 'd', brandName: 'Acme', payment: 3_600, expiresAt: START_WEEK + 4, expiresIn: 4, postsRequired: 3, postsDelivered: 0 },
    ];
    const stub = createSetGameStateStub(s);
    deliverBrandDealPost(stub.current(), stub.setGameState, 'd', 'no-such-post');
    expect(stub.current().stats.money).toBe(0);
    expect(stub.current().socialMedia!.activeBrandDeals![0].postsDelivered).toBe(0);
  });

  it('a backlog of old posts cannot be cashed in - only posts from this week deliver', () => {
    // Any unsponsored post used to count, so up to 50 old posts could be paid
    // against new deals in one sitting, past the one-post-per-content-type
    // weekly limit that bounds sponsored pay.
    const s = influencer(1_000_000);
    s.socialMedia!.recentPosts = Array.from({ length: 40 }, (_, i) => fakePost(`old-${i}`, START_WEEK - 1 - i));
    s.socialMedia!.activeBrandDeals = [
      { id: 'd', brandName: 'Acme', payment: 120_000, expiresAt: START_WEEK + 12, expiresIn: 12, postsRequired: 12, postsDelivered: 0 },
    ];
    const stub = createSetGameStateStub(s);
    for (let i = 0; i < 40; i++) {
      const r = deliverBrandDealPost(stub.current(), stub.setGameState, 'd', `old-${i}`);
      expect(r.success).toBe(false);
    }
    expect(stub.current().stats.money).toBe(0);
    expect(stub.current().socialMedia!.activeBrandDeals![0].postsDelivered).toBe(0);

    // A post from this week still delivers.
    stub.setGameState((p) => ({
      ...p,
      socialMedia: { ...p.socialMedia!, recentPosts: [fakePost('fresh', START_WEEK), ...(p.socialMedia!.recentPosts ?? [])] },
    }));
    expect(deliverBrandDealPost(stub.current(), stub.setGameState, 'd', 'fresh').success).toBe(true);
    expect(stub.current().stats.money).toBe(10_000);
  });

  it('the same post delivered twice from one stale snapshot is paid once', () => {
    const s = influencer(100_000);
    s.socialMedia!.recentPosts = [fakePost('p1', START_WEEK)];
    s.socialMedia!.activeBrandDeals = [
      { id: 'd', brandName: 'Acme', payment: 3_600, expiresAt: START_WEEK + 4, expiresIn: 4, postsRequired: 3, postsDelivered: 0 },
    ];
    const stub = createSetGameStateStub(s);
    const stale = stub.current();
    deliverBrandDealPost(stale, stub.setGameState, 'd', 'p1');
    deliverBrandDealPost(stale, stub.setGameState, 'd', 'p1');
    expect(stub.current().stats.money).toBe(1_200);
    expect(stub.current().socialMedia!.activeBrandDeals![0].postsDelivered).toBe(1);
  });

  it('an expired, part-delivered contract keeps exactly what its posts earned - and the history says so', () => {
    const s = influencer(100_000);
    s.socialMedia!.activeBrandDeals = [
      { id: 'd', brandName: 'Acme', payment: 9_000, expiresAt: START_WEEK + 1, expiresIn: 1, postsRequired: 6, postsDelivered: 2 },
    ];
    const r = processPulseWeeklyTick(holdAudience(s, 100_000), START_WEEK + 1);
    const noDeals = processPulseWeeklyTick(holdAudience(influencer(100_000), 100_000), START_WEEK + 1);
    expect(r.pulseEarnings).toBe(noDeals.pulseEarnings); // nothing streamed, nothing clawed
    expect(r.reputationDelta).toBe(noDeals.reputationDelta - 5);
    expect(r.socialMedia.brandInbox!.history.slice(-1)[0]).toMatchObject({ result: 'failed', totalPaid: 3_000 });
    expect(r.socialMedia.notifications![0].text).toContain('2/6 posts delivered');
  });

  it('an offer priced on the old rate card is withdrawn by the tick and refused by accept', () => {
    const legacy: PulseBrandOffer = {
      id: 'legacy', brandName: 'Acme', type: 'long_campaign', payment: 500_000, weeklyPayment: 46_875,
      postsRequired: 6, duration: 8, category: 'tech',
      requirements: { minFollowers: 100_000, minEngagementRate: 20 },
      description: 'old', expiresInWeeks: 3, offeredWeek: START_WEEK,
    };
    const s = influencer(5_000); // below the offer gate: the tick mints nothing new
    s.socialMedia!.brandInbox = { pending: [legacy], declined: [], history: [] };

    const stub = createSetGameStateStub(s);
    const res = acceptBrandDeal(stub.current(), stub.setGameState, 'legacy');
    expect(res.success).toBe(false);
    expect(stub.current().stats.money).toBe(0);
    expect(stub.current().socialMedia!.activeBrandDeals).toHaveLength(0);

    const r = processPulseWeeklyTick(s, START_WEEK + 1);
    expect(r.socialMedia.brandInbox!.pending).toHaveLength(0);
  });

  it('a contract ACCEPTED under the old streamed terms is honoured to its end', () => {
    const s = influencer(5_000);
    s.socialMedia!.activeBrandDeals = [
      { id: 'old', brandName: 'Acme', payment: 4_000, weeklyPayment: 750, expiresAt: START_WEEK + 4, expiresIn: 4, postsRequired: 3, postsDelivered: 0 },
    ];
    const withDeal = processPulseWeeklyTick(s, START_WEEK + 1);
    const without = processPulseWeeklyTick(influencer(5_000), START_WEEK + 1);
    expect(withDeal.pulseEarnings - without.pulseEarnings).toBe(750);
  });
});
