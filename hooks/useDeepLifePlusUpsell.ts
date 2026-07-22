/**
 * useDeepLifePlusUpsell — the shared "open the DeepLife+ paywall" behavior,
 * extracted so every upsell surface (player card, gem shop, ad-reward sheet,
 * the Home crown) behaves identically:
 *
 *   • prefers RevenueCat's dashboard-designed paywall when available, and falls
 *     back to the in-app SubscriptionModal otherwise (same rule the original
 *     PremiumCrownButton used);
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
import { revenueCatService } from '@/services/RevenueCatService';
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

  const present = useCallback(async () => {
    haptic.light();
    try {
      track('paywall_viewed', { surface });
    } catch {
      /* analytics is best-effort — never block the paywall on it */
    }
    // Prefer RevenueCat's prebuilt paywall when configured; otherwise open the
    // app's custom DeepLife+ paywall.
    if (revenueCatService.hasPaywallUI()) {
      await revenueCatService.presentPaywall();
      setActive(isDeepLifePlusActive());
      return;
    }
    setOpen(true);
  }, [surface]);

  const close = useCallback(() => {
    setOpen(false);
    setActive(isDeepLifePlusActive());
  }, []);

  return { active, open, present, close };
}
