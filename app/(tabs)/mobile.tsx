import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { useNavigationReady } from '@/hooks/useNavigationReady';
import { usePerformanceMonitor } from '@/utils/performanceOptimization';
import ErrorBoundary from '@/components/ErrorBoundary';
// Shared launcher - see the note in computer.tsx: the catalog keeps every
// sub-app as an EAGER static import (the R6 React.lazy production crash),
// pinned by __tests__/startup/screenImports.test.ts.
import AppLauncher from '@/components/launcher/AppLauncher';
import NoDeviceState from '@/components/launcher/NoDeviceState';

/**
 * Mobile - the phone launcher route.
 *
 * A thin wrapper around `components/launcher/AppLauncher` (host="phone"),
 * keeping only what is specific to this ROUTE: the ownership check and the
 * redirects.
 */
function MobileScreen() {
  return (
    <ErrorBoundary>
      <MobileScreenContent />
    </ErrorBoundary>
  );
}

export function MobileScreenContent({
  embedded = false,
  initialApp,
  onInitialAppConsumed,
}: {
  embedded?: boolean;
  /** App id to open straight away - see the Apps tab's `?app=` deep link. */
  initialApp?: string;
  onInitialAppConsumed?: () => void;
}) {
  const { gameState } = useGame();
  const router = useRouter();
  // Redirects that run on this screen's first commit throw "Attempted to
  // navigate before mounting the Root Layout component" when this screen IS
  // the entry route (restored URL / deep link), which surfaces as the crash
  // screen. See hooks/useNavigationReady.ts.
  const navReady = useNavigationReady();
  const { logRender } = usePerformanceMonitor();

  useEffect(() => {
    logRender('MobileScreen');
  }, [logRender]);

  // Prevent staying on mobile screen when in prison - redirect to work tab.
  // Embedded (inside the Apps tab) the layout owns the jail redirect, so skip it.
  useEffect(() => {
    if (embedded || !navReady) return;
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [embedded, navReady, gameState.jailWeeks, router]);

  // R10-UX: once a computer is owned the layout hides the Mobile tab
  // (showMobileTab = ownsSmartphone && !ownsComputer), but expo-router keeps this
  // screen mounted until the user navigates - leaving them stranded on a tab
  // that's no longer in the bar. Mirror computer.tsx and redirect to home.
  // Embedded, the Apps tab chooses Computer-vs-Mobile by ownership, so this
  // stranding can't happen - skip the redirect to avoid fighting the parent.
  useEffect(() => {
    if (embedded || !navReady) return;
    const ownsComputer = (gameState.items || []).find((item) => item.id === 'computer')?.owned;
    if (ownsComputer) {
      router.replace('/(tabs)/home');
    }
  }, [embedded, navReady, gameState.items, router]);

  if (!(gameState.items ?? []).find((item) => item.id === 'smartphone')?.owned) {
    return <NoDeviceState device="phone" />;
  }

  return <AppLauncher host="phone" initialApp={initialApp} onInitialAppConsumed={onInitialAppConsumed} />;
}

export default React.memo(MobileScreen);
