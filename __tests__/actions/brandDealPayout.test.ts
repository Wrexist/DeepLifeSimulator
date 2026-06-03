/**
 * Round 8 correctness regression (M-batch-B): Pulse brand-deal money actually
 * reaches stats.money.
 *
 * Before: acceptBrandDeal computed a 25% signing bonus, added it to a display
 * counter, and left a `prev => prev` no-op where the payment should be — the
 * player was never paid. deliverBrandDealPost completing a deal early removed it
 * (stopping the tick's weekly installments) without paying the remainder.
 */
import { acceptBrandDeal, deliverBrandDealPost } from '@/contexts/game/actions/PulseActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

function makeBatchedSetState(initial: GameState) {
  let state = initial;
  const setState = ((update: unknown) => {
    state = typeof update === 'function' ? update(state) : (update as GameState);
  }) as React.Dispatch<React.SetStateAction<GameState>>;
  return { setState, get: () => state };
}

const baseSocial = {
  followers: 1000,
  influenceLevel: 'rising',
  totalPosts: 0,
  viralPosts: 0,
  brandPartnerships: 0,
  engagementRate: 0,
};

describe('Brand-deal payout regressions (R8 M-batch-B)', () => {
  it('acceptBrandDeal pays the 25% signing bonus into stats.money', () => {
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
              weeklyPayment: 100,
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

    const res = acceptBrandDeal(setState, 'd1');
    expect(res.success).toBe(true);
    expect(get().stats.money).toBe(250); // floor(1000 * 0.25), actually paid
  });

  it('deliverBrandDealPost pays the remaining balance when a deal is completed early', () => {
    const snapshot = createTestGameState({
      stats: { money: 0 } as never,
      weeksLived: 0,
      socialMedia: {
        ...baseSocial,
        recentPosts: [],
        activeBrandDeals: [
          {
            id: 'd2',
            brandName: 'Beta',
            payment: 1000,
            expiresAt: 10,
            expiresIn: 10,
            postsRequired: 1,
            postsDelivered: 0,
            weeklyPayment: 100,
            category: 'tech',
            riskOfBreach: 0,
          },
        ],
      } as never,
    });
    const { setState, get } = makeBatchedSetState(snapshot);

    const res = deliverBrandDealPost(setState, 'd2', 'p1');
    expect(res.success).toBe(true);
    // remainingWeeks = expiresAt(10) - weeksLived(0) = 10; weeklyPay 100 → 1000.
    expect(get().stats.money).toBe(1000);
    // Deal removed from active on completion.
    expect((get().socialMedia?.activeBrandDeals ?? []).length).toBe(0);
  });
});
