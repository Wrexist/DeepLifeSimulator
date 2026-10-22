/**
 * MON-2 (2026-10 audit): Pulse Verified Pro granted by a DeepLife+ STORE
 * subscription must end when the subscription lapses. Before the fix nothing
 * ever lapsed it - the weekly biller only bills the in-game cash plan and the
 * perk gate is the bare `active` flag - so a cancelled 7-day free trial kept
 * the blue check and the 1.25x boost for the rest of the save.
 */
import { createTestGameState } from '../helpers/createTestGameState';
import { applyVerifiedProSubscriptionToState } from '@/services/IAPService';
import { reconcileSubscriptionBenefits } from '@/contexts/game/actions/SubscriptionActions';
import { SUBSCRIPTION_PRODUCTS } from '@/utils/iapConfig';
import type { GameState } from '@/contexts/game/types';

const storeSku = Object.values(SUBSCRIPTION_PRODUCTS)[0] as string;

function subscribedViaStore(): GameState {
  const s = createTestGameState();
  expect(applyVerifiedProSubscriptionToState(s, storeSku)).toBe(true);
  // The subscription also activated DeepLife+ on this save.
  return reconcileSubscriptionBenefits(s, true, false);
}

describe('Verified Pro from a DeepLife+ store subscription (MON-2)', () => {
  it('is revoked on an authoritative lapse', () => {
    const active = subscribedViaStore();
    expect(active.socialMedia?.verifiedPro?.active).toBe(true);
    expect(active.userProfile.verified).toBe(true);

    const lapsed = reconcileSubscriptionBenefits(active, false, false, true);
    expect(lapsed.socialMedia?.verifiedPro?.active).toBe(false);
    expect(lapsed.socialMedia?.verifiedPro?.perksUnlocked?.postBoostMultiplier).toBe(1.0);
    expect(lapsed.userProfile.verified).toBe(false);
  });

  it('is revoked even when an earlier non-authoritative pass already cleared deepLifePlusActivated', () => {
    const active = subscribedViaStore();
    const offline = reconcileSubscriptionBenefits(active, false, false, false);
    // "Could not ask" never strips the perk...
    expect(offline.socialMedia?.verifiedPro?.active).toBe(true);
    expect(offline.settings.deepLifePlusActivated).toBe(false);
    // ...but the first authoritative "not entitled" does.
    const settled = reconcileSubscriptionBenefits(offline, false, false, true);
    expect(settled.socialMedia?.verifiedPro?.active).toBe(false);
  });

  it('stays active while the subscription is active', () => {
    const active = subscribedViaStore();
    const again = reconcileSubscriptionBenefits(active, true, false, true);
    expect(again.socialMedia?.verifiedPro?.active).toBe(true);
  });

  it('leaves the in-game cash Verified Pro plan alone', () => {
    const s = createTestGameState();
    s.socialMedia = {
      ...(s.socialMedia ?? { followers: 0, influenceLevel: 'novice', totalPosts: 0, viralPosts: 0, brandPartnerships: 0, engagementRate: 0 }),
      verifiedPro: {
        active: true,
        plan: 'weekly',
        weeklyPrice: 50,
        startedWeek: s.weeksLived,
        subscribedTimestamp: 0,
        perksUnlocked: {
          blueCheckmark: true,
          postBoostMultiplier: 1.25,
          analyticsUnlocked: true,
          noAdsInFeed: true,
          longerPosts: true,
        },
      },
    };
    const next = reconcileSubscriptionBenefits(s, false, false, true);
    expect(next.socialMedia?.verifiedPro?.active).toBe(true);
  });
});
