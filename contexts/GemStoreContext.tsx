/**
 * Global gem-store launcher.
 *
 * The IAP store (GemShopModal) was previously mounted only inside TopStatsBar,
 * which unmounts inside full-screen phone apps (Pulse/Spark/Hustle/Banking)
 * and during onboarding - so the store was unreachable exactly where
 * high-intent moments happen (death popup, out-of-gems rejections, in-app
 * currency sinks). This context owns a single app-level mount and exposes
 * `openStore(tab?)` so any surface can deep-link into a specific store tab
 * without mounting its own copy of the modal.
 *
 * Default tab is 'gems' (the purchase surface) - entry points that mean
 * something else (e.g. the HUD cart showing the whole shop) pass their tab
 * explicitly.
 */
import React, { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState } from 'react';

const GemShopModal = lazy(() => import('@/components/GemShopModal'));

export type GemStoreTab = 'upgrades' | 'store' | 'perks' | 'gems';

export interface GemStoreOpenOptions {
  /**
   * Deep-link straight to one product's purchase confirm (the death screen's
   * Revival Pack row). The modal still owns the whole purchase flow - this
   * only opens its standard confirm for the given SKU once the catalog is
   * ready, exactly as if the player had tapped that product's Buy button.
   */
  purchaseProductId?: string;
}

interface GemStoreContextValue {
  openStore: (tab?: GemStoreTab, options?: GemStoreOpenOptions) => void;
  closeStore: () => void;
  isStoreOpen: boolean;
}

// Safe no-op default so a stray consumer outside the provider (tests, isolated
// renders) degrades to "button does nothing" instead of crashing.
const GemStoreContext = createContext<GemStoreContextValue>({
  openStore: () => {},
  closeStore: () => {},
  isStoreOpen: false,
});

export function GemStoreProvider({ children }: { children: React.ReactNode }) {
  const [openRequest, setOpenRequest] = useState<{
    tab: GemStoreTab;
    purchaseProductId?: string;
  } | null>(null);

  const openStore = useCallback(
    (tab: GemStoreTab = 'gems', options?: GemStoreOpenOptions) =>
      setOpenRequest({ tab, purchaseProductId: options?.purchaseProductId }),
    [],
  );
  const closeStore = useCallback(() => setOpenRequest(null), []);

  const value = useMemo(
    () => ({ openStore, closeStore, isStoreOpen: openRequest !== null }),
    [openStore, closeStore, openRequest],
  );

  return (
    <GemStoreContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        {openRequest !== null && (
          <GemShopModal
            visible
            initialTab={openRequest.tab}
            initialPurchaseId={openRequest.purchaseProductId}
            onClose={closeStore}
          />
        )}
      </Suspense>
    </GemStoreContext.Provider>
  );
}

export function useGemStore(): GemStoreContextValue {
  return useContext(GemStoreContext);
}
