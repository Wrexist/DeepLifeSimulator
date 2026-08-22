/**
 * useSubscriptionPrices — live, localized DeepLife+ prices for the paywall.
 *
 * THE PROBLEM THIS SOLVES. Every price the paywall rendered came from
 * `SUBSCRIPTION_CONFIGS` — static strings '$4.99' and '$49.99'. A player whose
 * App Store account is German, Japanese or Brazilian was shown a US-dollar
 * figure they would never be charged, on the one screen selling a RECURRING
 * charge, next to a working purchase button. The derived claims were worse: the
 * "SAVE 17%" badge and the "just $0.96/week" line were both computed from those
 * USD constants, and Apple's monthly and yearly price tiers are not in a fixed
 * ratio across storefronts, so both could be simply false abroad.
 *
 * ── TWO SOURCES, ON PURPOSE ─────────────────────────────────────────────────
 * 1. RevenueCat's current offering, when RC is enabled. RC owns billing in the
 *    production profile, and its `storeProduct` carries the localized price plus
 *    a numeric amount and ISO currency.
 * 2. `iapService.getState().products` — the expo-iap catalog, which already
 *    merges the 'subs' query.
 *
 * Neither alone is sufficient. The expo-iap catalog is only populated when the
 * `iap` feature flag is on, so an RC-driven build with expo-iap off would have
 * no prices at all — in exactly the configuration that CAN take a payment. RC
 * meanwhile is off by default. Whichever answers first wins; RC is preferred
 * because it is the transport that will actually charge the card.
 *
 * ── THE STATES MATTER AS MUCH AS THE PRICES ─────────────────────────────────
 * The hook reports WHY it has no price, because the paywall must behave
 * differently in each case (see `PriceLoadState`). What it never does is hand
 * back a config price dressed as a store price: `PlanPrice.fromStore` is the
 * flag the UI gates its purchase CTA on.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { iapService } from '@/services/IAPService';
import { revenueCatService } from '@/services/RevenueCatService';
import { logger } from '@/utils/logger';
import { resolvePlanPrice, type PlanPrice, type StoreProductLike } from '@/lib/subscription/planPricing';

export type PriceLoadState =
  /** A load is in flight. Show a placeholder; the CTA must not be tappable. */
  | 'loading'
  /** Real store prices are in hand for the plans that matter. */
  | 'ready'
  /**
   * No store in this build at all — Expo Go, the web preview, or a profile with
   * the `iap` flag off and RevenueCat disabled. Nothing can be purchased here,
   * so no wrong price can lead to a wrong charge; the paywall may show the
   * config prices for layout review with its CTA disabled. This mirrors how
   * `GemShopModal` degrades to "Unavailable".
   */
  | 'store-disabled'
  /**
   * A store IS present but did not return these products (propagation delay, a
   * misconfigured subscription group, a network failure). This is the dangerous
   * one: a purchase could still be attempted, so the paywall must show no price
   * and offer a retry rather than a buy button.
   */
  | 'unavailable';

export interface SubscriptionPrices {
  /** Resolved price per app product id. Missing ids resolve to an empty PlanPrice. */
  priceFor: (productId: string) => PlanPrice;
  /** The raw store product per app product id — needed for intro-offer details. */
  productFor: (productId: string) => StoreProductLike | null;
  state: PriceLoadState;
  /** Re-run the lookup. Wired to the retry CTA in the `unavailable` state. */
  reload: () => void;
}

/** How long to wait for a first answer before calling the catalog unavailable. */
const LOAD_TIMEOUT_MS = 8000;

export function useSubscriptionPrices(
  /** The product ids the caller needs priced. Prices are resolved for these only. */
  productIds: string[],
  /** Only work while the paywall is open — no store traffic behind a closed sheet. */
  active: boolean,
): SubscriptionPrices {
  const [products, setProducts] = useState<Record<string, StoreProductLike>>({});
  const [state, setState] = useState<PriceLoadState>('loading');
  const [reloadToken, setReloadToken] = useState(0);

  // The ids are usually an inline array literal at the call site, which would be
  // a new reference every render. Key the effect off their contents instead so
  // it does not re-run (and re-hit the store) on every parent re-render.
  const idsKey = productIds.join('|');

  const reload = useCallback(() => {
    setState('loading');
    setReloadToken((n) => n + 1);
  }, []);

  useEffect(() => {
    if (!active) return;
    const ids = idsKey.split('|').filter(Boolean);
    if (ids.length === 0) {
      setState('ready');
      return;
    }

    let cancelled = false;
    let settled = false;

    /** Index the expo-iap catalog by product id. */
    const fromIapCatalog = (): Record<string, StoreProductLike> => {
      const out: Record<string, StoreProductLike> = {};
      try {
        const loaded = iapService.getState().products ?? [];
        for (const p of loaded) {
          if (p && typeof p.productId === 'string') out[p.productId] = p as StoreProductLike;
        }
      } catch (error) {
        logger.warn('[useSubscriptionPrices] could not read the IAP catalog', { error });
      }
      return out;
    };

    /**
     * True when this build has no store to ask. Distinguished from "the store
     * answered with nothing" because only the latter can precede a real charge.
     */
    const storeDisabled = (): boolean => {
      try {
        return !revenueCatService.isEnabled() && !iapService.getState().isConnected;
      } catch {
        return true;
      }
    };

    const publish = (found: Record<string, StoreProductLike>) => {
      if (cancelled) return;
      setProducts(found);
      // "Ready" means every id the caller asked about resolved to a real store
      // price. A partial catalog is treated as unavailable rather than shown
      // half-priced: a plan selector where one card has a price and the other
      // does not is worse than one that admits it cannot price anything.
      const allPriced = ids.every((id) => resolvePlanPrice(id, found[id]).fromStore);
      if (allPriced) {
        settled = true;
        setState('ready');
        return;
      }
      if (storeDisabled()) {
        settled = true;
        setState('store-disabled');
      }
      // Otherwise: leave it in 'loading' and let the IAP listener or the timeout
      // resolve it — the catalog often lands a beat after the sheet opens.
    };

    // 1. Whatever the expo-iap catalog already holds, synchronously.
    publish(fromIapCatalog());

    // 2. RevenueCat's offering, when it drives billing. Preferred where both
    //    answer: RC is the transport that will actually charge the card.
    void revenueCatService
      .getSubscriptionStoreProducts()
      .then((rcProducts) => {
        if (cancelled || Object.keys(rcProducts).length === 0) return;
        publish({ ...fromIapCatalog(), ...rcProducts });
      })
      .catch((error) => {
        logger.warn('[useSubscriptionPrices] RevenueCat offering lookup failed', { error });
      });

    // 3. The catalog can finish loading after the sheet opens; re-resolve then.
    const unsubscribe = iapService.addListener(() => {
      if (cancelled) return;
      publish(fromIapCatalog());
    });

    // 4. Bounded wait. Without this the sheet could sit on a placeholder forever
    //    when the store never answers, which is its own kind of dead end.
    const timer = setTimeout(() => {
      if (cancelled || settled) return;
      setState(storeDisabled() ? 'store-disabled' : 'unavailable');
    }, LOAD_TIMEOUT_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [active, idsKey, reloadToken]);

  const priceFor = useCallback(
    (productId: string) => resolvePlanPrice(productId, products[productId]),
    [products],
  );
  const productFor = useCallback(
    (productId: string) => products[productId] ?? null,
    [products],
  );

  return useMemo(
    () => ({ priceFor, productFor, state, reload }),
    [priceFor, productFor, state, reload],
  );
}

/**
 * A ref-backed "have we already fired this once" latch, for the funnel events
 * that must be emitted at most once per paywall session (`paywall_viewed`,
 * `paywall_intro_offer_shown`). Kept here so the paywall's effects stay readable.
 */
export function useOnceLatch(): { fire: (key: string) => boolean; reset: () => void } {
  const seen = useRef<Set<string>>(new Set());
  const fire = useCallback((key: string) => {
    if (seen.current.has(key)) return false;
    seen.current.add(key);
    return true;
  }, []);
  const reset = useCallback(() => {
    seen.current = new Set();
  }, []);
  return { fire, reset };
}
