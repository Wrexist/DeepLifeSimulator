/**
 * Global gem-store launcher.
 *
 * The IAP store (GemShopModal) was previously mounted only inside TopStatsBar,
 * which unmounts inside full-screen phone apps (Pulse/Spark/Hustle/Banking)
 * and during onboarding — so the store was unreachable exactly where
 * high-intent moments happen (death popup, out-of-gems rejections, in-app
 * currency sinks). This context owns a single app-level mount and exposes
 * `openStore(tab?)` so any surface can deep-link into a specific store tab
 * without mounting its own copy of the modal.
 *
 * Default tab is 'gems' (the purchase surface) — entry points that mean
 * something else (e.g. the HUD cart showing the whole shop) pass their tab
 * explicitly.
 */
import React, { createContext, lazy, Suspense, useCallback, useContext, useMemo, useState } from 'react';

const GemShopModal = lazy(() => import('@/components/GemShopModal'));

export type GemStoreTab = 'upgrades' | 'store' | 'perks' | 'gems';

interface GemStoreContextValue {
  openStore: (tab?: GemStoreTab) => void;
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
  const [openTab, setOpenTab] = useState<GemStoreTab | null>(null);

  const openStore = useCallback((tab: GemStoreTab = 'gems') => setOpenTab(tab), []);
  const closeStore = useCallback(() => setOpenTab(null), []);

  const value = useMemo(
    () => ({ openStore, closeStore, isStoreOpen: openTab !== null }),
    [openStore, closeStore, openTab],
  );

  return (
    <GemStoreContext.Provider value={value}>
      {children}
      <Suspense fallback={null}>
        {openTab !== null && <GemShopModal visible initialTab={openTab} onClose={closeStore} />}
      </Suspense>
    </GemStoreContext.Provider>
  );
}

export function useGemStore(): GemStoreContextValue {
  return useContext(GemStoreContext);
}
