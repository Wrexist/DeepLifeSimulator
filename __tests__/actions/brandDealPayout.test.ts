/**
 * Pulse brand-deal money actually reaches stats.money - and only for work done.
 *
 * History, because each round fixed a real defect and the next round's model
 * has to keep those fixes:
 *
 *   R8 M-batch-B: acceptBrandDeal computed a 25% signing bonus, added it to a
 *   display counter and left a `prev => prev` no-op - the player was never
 *   paid. deliverBrandDealPost completing a deal early removed it (stopping the
 *   tick's weekly installments) without paying the remainder.
 *
 *   R9 P0-1: the payout model was 25% signing bonus ON TOP OF a full 100%
 *   weekly stream = 125% of every contract. Fixed to 25% + 75% streamed.
 *
 *   2026-10-17: the 25% + 75%-streamed model paid the stream whether or not a
 *   post was delivered, so an undelivered contract kept 81-94% of its value.
 *   Contracts are now paid PER DELIVERED POST, inside the delivery updater; the
 *   shares sum to exactly 100%. Contracts signed under the old streamed terms
 *   (they carry `weeklyPayment`) are honoured to the end - the last case below.
 */
import { acceptBrandDeal, deliverBrandDealPost } from '@/contexts/game/actions/PulseActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState, PulseRecentPost } from '@/contexts/game/types';
import { createSetGameStateStub } from '../helpers/setGameStateStub';

/**
 * Thin adapter over the shared stub in `helpers/setGameStateStub`.
 *
 * This was one of eight byte-identical hand-rolled copies. Each took
 * `(update: unknown)` and cast twice — `update as GameState` on the value
 * branch, then the whole function `as React.Dispatch<SetStateAction<GameState>>`
 * — which is exactly the shape that makes a stub's behaviour unverifiable:
 * `unknown` in means nothing about the dispatch is checked, and the outer cast
 * asserts the result matches React's type without anything proving it does.
 */
function makeBatchedSetState(initial: GameState) {
  const stub = createSetGameStateStub(initial);
  return { setState: stub.setGameState, get: stub.current };
}

const baseSocial = {
  followers: 1000,
  influenceLevel: 'rising',
  totalPosts: 0,
  viralPosts: 0,
  brandPartnerships: 0,
  engagementRate: 0,
};

const post = (id: string): PulseRecentPost => ({
  id, content: 'sponsored', likes: 0, comments: 0, timestamp: 0, gameWeek: 0, contentType: 'photo',
});

describe('Brand-deal payout regressions (R8 M-batch-B / R9 P0-1 / 2026-10-17 per-post)', () => {
  it('acceptBrandDeal pays nothing up front - the signing advance is gone', () => {
    const snapshot = createTestGameState({
      stats: { money: 0 } as never,
      weeksLived: 0,
      socialMedia: {
        ...baseSocial,
        brandInbox: {
          pending: [
            {
              id: 'd1',
              brandName: 'Acme',
              payment: 1000,
              duration: 10,
              postsRequired: 1,
              category: 'tech',
              logoColor1: '#000',
              logoColor2: '#fff',
            },
          ],
          declined: [],
          history: [],
        },
      } as never,
    });
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = acceptBrandDeal(get(), setState, 'd1');
    expect(res.success).toBe(true);
    expect(res.message).toMatch(/\$1,000 per post/);
    expect(get().stats.money).toBe(0);
    // The active deal carries no weekly stream.
    expect(get().socialMedia?.activeBrandDeals?.[0]?.weeklyPayment).toBeUndefined();
  });

  it('total payout over a whole contract equals 100% of it, paid post by post', () => {
    const payment = 1000;
    const snapshot = createTestGameState({
      stats: { money: 0 } as never,
      weeksLived: 0,
      socialMedia: {
        ...baseSocial,
        // Three posts against a $1,000 contract: shares 333 / 333 / 334.
        recentPosts: [post('p1'), post('p2'), post('p3')],
        brandInbox: {
          pending: [
            {
              id: 'd3',
              brandName: 'Gamma',
              payment,
              duration: 10,
              postsRequired: 3,
              category: 'tech',
              logoColor1: '#000',
              logoColor2: '#fff',
            },
          ],
          declined: [],
          history: [],
        },
        activeBrandDeals: [],
      } as never,
    });
    const { setState, get } = makeBatchedSetState(snapshot);

    expect(acceptBrandDeal(get(), setState, 'd3').success).toBe(true);
    expect(get().stats.money).toBe(0);

    expect(deliverBrandDealPost(get(), setState, 'd3', 'p1').success).toBe(true);
    expect(get().stats.money).toBe(333);
    expect(deliverBrandDealPost(get(), setState, 'd3', 'p2').success).toBe(true);
    expect(get().stats.money).toBe(666);
    expect(deliverBrandDealPost(get(), setState, 'd3', 'p3').success).toBe(true);

    // Exactly the contract - never the old 125%, never a rounding shortfall.
    expect(get().stats.money).toBe(payment);
    expect(get().socialMedia?.activeBrandDeals ?? []).toHaveLength(0);
    expect((get().socialMedia?.brandInbox?.history ?? []).slice(-1)[0]).toMatchObject({ result: 'success', totalPaid: payment });
  });

  it('a contract signed under the OLD streamed terms still pays its remaining stream on completion', () => {
    const snapshot = createTestGameState({
      stats: { money: 0 } as never,
      weeksLived: 0,
      socialMedia: {
        ...baseSocial,
        recentPosts: [post('p1')],
        activeBrandDeals: [
          {
            id: 'd2',
            brandName: 'Beta',
            payment: 1000,
            expiresAt: 10,
            expiresIn: 10,
            postsRequired: 1,
            postsDelivered: 0,
            // 75% of 1000 streamed over 10 weeks = 75/wk (P0-1 model).
            weeklyPayment: 75,
            category: 'tech',
            riskOfBreach: 0,
          },
        ],
      } as never,
    });
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = deliverBrandDealPost(get(), setState, 'd2', 'p1');
    expect(res.success).toBe(true);
    // remainingWeeks = expiresAt(10) - weeksLived(0) = 10; weeklyPay 75 → 750.
    expect(get().stats.money).toBe(750);
    // Deal removed from active on completion.
    expect((get().socialMedia?.activeBrandDeals ?? []).length).toBe(0);
  });
});
