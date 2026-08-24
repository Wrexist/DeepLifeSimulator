import React, { useCallback } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useGame } from '@/contexts/GameContext';
import { ComputerScreenContent } from './computer';
import { MobileScreenContent } from './mobile';

/**
 * Apps - the merged device tab.
 *
 * Replaces the old Mobile/Computer tabs that swapped identity as you upgraded
 * (the Mobile tab vanished the moment you bought a computer). This is one
 * stable tab that always shows your best device's launcher:
 *   • own a computer → the desktop launcher (which itself carries a
 *     Desktop / Mobile sub-toggle, so no mini-app is lost), otherwise
 *   • the phone app grid (which renders its own "no phone yet" empty state
 *     if you somehow reach here before owning any device).
 *
 * The tab BUTTON's visibility (hidden until a device is owned) lives in
 * _layout.tsx via `href`. Rendering the launchers here - rather than routing
 * to the mobile/computer routes - keeps those routes unmounted, so there's no
 * double-mount and the full-screen-app / tab-reset hooks key off THIS tab.
 *
 * `?app=<id>` opens one app directly. Which launcher is showing depends on
 * device ownership, and the two launchers file the same app under different
 * categories - the Family tab's "Open the dating app" landed on the desktop
 * grid, where Dating is not even in the visible category. The param removes
 * that guesswork from the caller: it names the app, this screen finds it.
 */
function AppsScreen() {
  const { gameState } = useGame();
  const router = useRouter();
  const { app } = useLocalSearchParams<{ app?: string }>();
  const items = gameState?.items ?? [];
  const ownsComputer = items.some((item) => item.id === 'computer' && item.owned);

  // Clear the param once the launcher has opened the app, so coming back to
  // this tab later shows the grid instead of re-opening it.
  const clearInitialApp = useCallback(() => {
    router.setParams({ app: undefined });
  }, [router]);

  return (
    <ErrorBoundary>
      {ownsComputer ? (
        <ComputerScreenContent embedded initialApp={app} onInitialAppConsumed={clearInitialApp} />
      ) : (
        <MobileScreenContent embedded initialApp={app} onInitialAppConsumed={clearInitialApp} />
      )}
    </ErrorBoundary>
  );
}

export default React.memo(AppsScreen);
