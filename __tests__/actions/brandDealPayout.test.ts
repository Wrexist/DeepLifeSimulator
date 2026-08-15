/**
 * Round 8 correctness regression (M-batch-B): Pulse brand-deal money actually
 * reaches stats.money.
 *
 * Before: acceptBrandDeal computed a 25% signing bonus, added it to a display
 * counter, and left a `prev => prev` no-op where the payment should be — the
 * player was never paid. deliverBrandDealPost completing a deal early removed it
 * (stopping the tick's weekly installments) without paying the remainder.
 *
 * Round 9 (P0-1): the payout model was 25% signing bonus ON TOP OF a full 100%
 * weekly stream = 125% of every contract (a money printer). Fixed so the bonus
 * is an advance: 25% on accept + 75% streamed = 100% total. weeklyPayment now
 * represents the 75% stream installment.
 */
import { acceptBrandDeal, deliverBrandDealPost } from '@/contexts/game/actions/PulseActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';
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

describe('Brand-deal payout regressions (R8 M-batch-B / R9 P0-1)', () => {
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

    const res = acceptBrandDeal(get(), setState, 'd1');
    expect(res.success).toBe(true);
    expect(get().stats.money).toBe(250); // floor(1000 * 0.25), actually paid
  });

  it('deliverBrandDealPost pays the remaining 75% stream when a deal completes early', () => {
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

  it('P0-1: total payout (signing bonus + completion) equals 100% of the contract, not 125%', () => {
    const payment = 1000;
    const duration = 10;
    const snapshot = createTestGameState({
      stats: { money: 0 } as never,
      weeksLived: 0,
      socialMedia: {
        ...baseSocial,
        recentPosts: [],
        brandInbox: {
          pending: [
            {
              id: 'd3',
              brandName: 'Gamma',
              payment,
              duration,
              postsRequired: 1,
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

    // Accept → 25% signing bonus, deal becomes active with a 75% stream.
    expect(acceptBrandDeal(get(), setState, 'd3').success).toBe(true);
    const afterAccept = get().stats.money;
    expect(afterAccept).toBe(Math.floor(payment * 0.25)); // 250

    // Deliver the single required post → pays the remaining streamed balance.
    expect(deliverBrandDealPost(get(), setState, 'd3', 'p1').success).toBe(true);
    const total = get().stats.money;

    // Total must be 100% of the contract (allow a few $ of floor rounding), and
    // must NOT exceed `payment` (the old 125% bug paid 1250 here).
    expect(total).toBeLessThanOrEqual(payment);
    expect(total).toBeGreaterThanOrEqual(payment - duration); // rounding tolerance
  });
});
