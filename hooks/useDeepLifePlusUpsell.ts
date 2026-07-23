/**
 * useDeepLifePlusUpsell — the shared "open the DeepLife+ paywall" behavior,
 * extracted so every upsell surface (player card, gem shop, ad-reward sheet,
 * the Home crown) behaves identically:
 *
 *   • opens the in-app SubscriptionModal — the app's own fully-designed
 *     DeepLife+ paywall (purchases still route through RevenueCat/StoreKit);
 *   • tracks WHICH surface opened the paywall, so we can see what converts;
 *   • exposes `active` (already a member) so a surface can hide itself — never
 *     upsell someone who already owns DeepLife+.
 *
 * Entitlements load async on cold start, so `active` is re-checked once
 * initialization finishes and on every foreground.
 *
 * Usage:
 *   const { active, present, open, close } = useDeepLifePlusUpsell('gem_shop');
 *   if (active) return null;
 *   // <Trigger onPress={present} /> and render <SubscriptionModal visible={open} onClose={close} />
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { haptic } from '@/utils/haptics';
import { track } from '@/lib/analytics';
import { subscriptionService } from '@/services/SubscriptionService';
import { isDeepLifePlusActive } from '@/lib/subscription/deepLifePlus';

export function useDeepLifePlusUpsell(surface: string) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<boolean>(() => isDeepLifePlusActive());

  useEffect(() => {
    let mounted = true;
    const refresh = () => {
      if (mounted) setActive(isDeepLifePlusActive());
    };
    void subscriptionService.waitForInitialization().then(refresh).catch(refresh);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') refresh();
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  const present = useCallback(() => {
    haptic.light();
    try {
      track('paywall_viewed', { surface });
    } catch {
      /* analytics is best-effort — never block the paywall on it */
    }
    // Always open the app's own DeepLife+ paywall (SubscriptionModal): it's the
    // fully-designed, conversion-optimized surface with the value stack, trial
    // hook, plan anchoring and legal disclosures. Purchases still flow through
    // RevenueCat/StoreKit via subscriptionService, so we keep RC's billing
    // without RC's barebones dashboard-template UI.
    setOpen(true);
  }, [surface]);

  const close = useCallback(() => {
    setOpen(false);
    setActive(isDeepLifePlusActive());
  }, []);

  return { active, open, present, close };
}
