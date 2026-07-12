import React from 'react';
import ErrorBoundary from '@/components/ErrorBoundary';
import { useGame } from '@/contexts/GameContext';
import { ComputerScreenContent } from './computer';
import { MobileScreenContent } from './mobile';

/**
 * Apps — the merged device tab.
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
 * _layout.tsx via `href`. Rendering the launchers here — rather than routing
 * to the mobile/computer routes — keeps those routes unmounted, so there's no
 * double-mount and the full-screen-app / tab-reset hooks key off THIS tab.
 */
function AppsScreen() {
  const { gameState } = useGame();
  const items = gameState?.items ?? [];
  const ownsComputer = items.some((item) => item.id === 'computer' && item.owned);

  return (
    <ErrorBoundary>
      {ownsComputer ? <ComputerScreenContent embedded /> : <MobileScreenContent embedded />}
    </ErrorBoundary>
  );
}

export default React.memo(AppsScreen);
