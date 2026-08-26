/**
 * A lapsed subscription must not take a paid purchase down with it.
 *
 * `reconcileSubscriptionBenefits` writes `adsRemoved: ownsRemoveAds` whenever
 * DeepLife+ has lapsed, and its own docstring says `ownsRemoveAds` "MUST be the
 * authoritative union of ALL non-subscription ad-free entitlements — otherwise
 * a lapse would wrongly revoke it".
 *
 * It wasn't. The caller passed `iapService.isAdsRemoved()`, which reads
 * `state.purchases` — and nothing populates that on a cold start:
 * `initialize()` never calls `loadPurchases()`, and `loadPurchasesFromStorage()`
 * returns [] in production because it is gated on
 * ALLOW_LEGACY_LOCAL_ENTITLEMENTS. So for a player who had bought Remove Ads
 * AND had ever had DeepLife+ active, the first launch after the subscription
 * lapsed wrote `adsRemoved: false` over their purchase.
 *
 * Permanently: the same write sets `deepLifePlusActivated: false`, and the
 * branch is gated on that being true, so it never runs again to undo itself.
 * Banners and interstitials come back forever, and the only recovery is
 * manually tapping Restore Purchases, which the game never prompts.
 * `BannerAd.tsx` even documents the cold-start emptiness and falls back to the
 * persisted flag — the flag this had just zeroed.
 *
 * It also ignored `lifetimePremium` and `everythingUnlocked`, both of which
 * grant ad-free in `applyProductBenefitsToState`. 2026-07-30 audit MON-1.
 */
import { reconcileSubscriptionBenefits } from '@/contexts/game/actions/SubscriptionActions';
import { createTestGameState } from '../helpers/createTestGameState';
import type { GameState } from '@/contexts/game/types';

/** A player whose DeepLife+ has lapsed, with the given purchased entitlements. */
function lapsed(settings: Record<string, unknown>): GameState {
  const base = createTestGameState();
  return createTestGameState({
    settings: {
      ...base.settings,
      deepLifePlusActivated: true,
      adsRemoved: true,
      ...settings,
    } as never,
  });
}

const adFree = (s: GameState): boolean => s.settings?.adsRemoved === true;

describe('the cold-start case that revoked a paid purchase', () => {
  it('KEEPS ad-free when the entitlement check could not run', () => {
    // The exact shape: bought Remove Ads, subscription lapsed, ledger empty
    // because this is the first launch of the process.
    const state = lapsed({});

    const out = reconcileSubscriptionBenefits(state, false, false, /* authoritative */ false);

    expect(adFree(out)).toBe(true);
    // 2026-08-26: the whole lapse is HELD, not just ad-free. This used to
    // assert `deepLifePlusActivated === false` - clearing the activation on a
    // check that could not run stripped an offline subscriber's salary
    // multiplier, 250-gem drop and member discount until the next successful
    // fetch, against the very principle the parameter documents. "Could not
    // ask" is not "lapsed".
    expect(out.settings?.deepLifePlusActivated).toBe(true);
    expect(out).toBe(state); // held wholesale, no partial write
  });

  it('still revokes when the check DID run and really found nothing', () => {
    // A player who only ever had the subscription must lose ad-free — that is
    // what this branch is for, and the fix must not disable it.
    const out = reconcileSubscriptionBenefits(lapsed({}), false, false, /* authoritative */ true);

    expect(adFree(out)).toBe(false);
    expect(out.settings?.deepLifePlusActivated).toBe(false);
  });

  it('keeps ad-free when the check ran and found the purchase', () => {
    const out = reconcileSubscriptionBenefits(lapsed({}), false, true, true);

    expect(adFree(out)).toBe(true);
  });

  it('does not resurrect ad-free for someone who never had it', () => {
    // "Unknown" means keep what is persisted — not grant.
    const never = lapsed({ adsRemoved: false });

    expect(adFree(reconcileSubscriptionBenefits(never, false, false, false))).toBe(false);
  });
});

describe('the union the docstring always promised', () => {
  it('honours lifetimePremium', () => {
    const out = reconcileSubscriptionBenefits(lapsed({ lifetimePremium: true }), false, false, true);

    expect(adFree(out)).toBe(true);
  });

  it('honours everythingUnlocked', () => {
    const out = reconcileSubscriptionBenefits(lapsed({ everythingUnlocked: true }), false, false, true);

    expect(adFree(out)).toBe(true);
  });
});

describe('the branch is otherwise unchanged', () => {
  it('is a no-op for a player who never activated DeepLife+', () => {
    const base = createTestGameState();
    const plain = createTestGameState({
      settings: { ...base.settings, adsRemoved: true, deepLifePlusActivated: false } as never,
    });

    expect(reconcileSubscriptionBenefits(plain, false, false, true)).toBe(plain);
  });

  it('re-applies benefits while the subscription is active', () => {
    const out = reconcileSubscriptionBenefits(lapsed({ adsRemoved: false }), true, false, true);

    expect(adFree(out)).toBe(true);
    expect(out.settings?.deepLifePlusActivated).toBe(true);
  });

  it('defaults to authoritative when the argument is omitted (old callers)', () => {
    // Back-compat: the parameter is optional, and an omitted value must keep
    // the original revoke-on-false behaviour for any caller not yet updated.
    const out = reconcileSubscriptionBenefits(lapsed({}), false, false);

    expect(adFree(out)).toBe(false);
  });
});
