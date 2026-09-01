import React, { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useGame } from '@/contexts/GameContext';
import { useNavigationReady } from '@/hooks/useNavigationReady';
import ErrorBoundary from '@/components/ErrorBoundary';
// The launcher grid, sub-app host and app catalog live in components/launcher.
// The catalog keeps every sub-app as an EAGER static import - React.lazy in
// this launcher path shipped an "Element type is invalid" production crash
// (R6) and is pinned out by __tests__/startup/screenImports.test.ts.
import AppLauncher from '@/components/launcher/AppLauncher';
import NoDeviceState from '@/components/launcher/NoDeviceState';

/**
 * Computer - the desktop launcher route.
 *
 * A thin wrapper: everything shared with the phone launcher (the grid, the
 * fullscreen sub-app host, deep links, hardware back, badges, locks) lives in
 * `components/launcher/AppLauncher`. This file keeps only what is specific to
 * the desktop ROUTE: the ownership check and the redirects.
 */
function ComputerScreen() {
  return (
    <ErrorBoundary>
      <ComputerScreenContent />
    </ErrorBoundary>
  );
}

export function ComputerScreenContent({
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
  const segments = useSegments();
  const currentRoute = segments.length > 0 ? segments[segments.length - 1] : null;
  // Both redirects below run on this screen's first commit. When this screen IS
  // the entry route the root navigator does not exist yet and `router.replace`
  // throws "Attempted to navigate before mounting the Root Layout component",
  // which reaches the ErrorBoundary and shows the crash screen instead of the
  // redirect. Gating on the navigator defers them by one render. See
  // hooks/useNavigationReady.ts.
  const navReady = useNavigationReady();

  // Prevent staying on computer screen when in prison - redirect to work tab.
  // Embedded (inside the Apps tab) the layout owns the jail redirect, so skip it.
  useEffect(() => {
    if (embedded || !navReady) return;
    if (gameState.jailWeeks > 0) {
      router.replace('/(tabs)/work');
    }
  }, [embedded, navReady, gameState.jailWeeks, router]);

  const ownsComputer = (gameState.items || []).find((item) => item.id === 'computer')?.owned;

  // Redirect away from computer screen if computer is sold. Embedded, the Apps
  // tab already falls back to the phone launcher when the computer is gone, so
  // skip the redirect (currentRoute is 'apps', never 'computer', here anyway).
  useEffect(() => {
    if (embedded || !navReady) return;
    if (!ownsComputer && currentRoute === 'computer') {
      router.replace('/(tabs)/home');
    }
  }, [embedded, navReady, ownsComputer, router, currentRoute]);

  if (!ownsComputer) {
    return <NoDeviceState device="computer" />;
  }

  return <AppLauncher host="computer" initialApp={initialApp} onInitialAppConsumed={onInitialAppConsumed} />;
}

export default React.memo(ComputerScreen);
