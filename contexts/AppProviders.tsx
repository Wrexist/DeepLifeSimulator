/**
 * Consolidated App Providers
 *
 * Groups all app-level providers into a single component to reduce nesting
 * and improve initialization order. This replaces the deep nesting in _layout.tsx.
 *
 * Provider order (from outer to inner):
 * 1. UIUXProvider - UI/UX state (theme, modals, etc.)
 * 2. GameProvider - Game state and actions (wraps GameData, GameState, GameUI, GameActions)
 * 3. ToastProvider - Toast notifications
 * 4. OnboardingProvider - Onboarding flow state
 * 6. GemStoreProvider - IAP store, reachable inside full-screen phone apps
 * 7. InterruptionProvider - single priority queue for interrupting surfaces
 */

import React, { ReactNode } from 'react';
import { UIUXProvider } from './UIUXContext';
import { GameProvider } from './GameContext';
import { ToastProvider } from './ToastContext';
import { OnboardingProvider } from '@/src/features/onboarding/OnboardingContext';
import { SettingsProvider } from './SettingsContext';
import { StatChangeProvider } from './StatChangeContext';
import { GemStoreProvider } from './GemStoreContext';
import { InterruptionProvider } from './InterruptionContext';

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Consolidated app providers component
 *
 * STAGE 4: Hardened to prevent crashes on missing data
 * - All providers handle undefined/null state gracefully
 * - No non-null assertions at root level
 * - Error boundaries protect each provider layer
 */
export function AppProviders({ children }: AppProvidersProps) {
  return (
    <SettingsProvider>
      <UIUXProvider>
        <GameProvider>
          <StatChangeProvider>
            <ToastProvider>
              <OnboardingProvider>
                  {/* Inside GameProvider (the store reads game state/actions) and
                      mounted app-wide so the IAP store stays reachable inside
                      full-screen phone apps where TopStatsBar unmounts. */}
                  <GemStoreProvider>
                    {/* One queue for every interrupting surface. Must sit above
                        both the tabs layer and the root-level popups, since the
                        whole point is that they can finally see each other. */}
                    <InterruptionProvider>
                      {children}
                    </InterruptionProvider>
                  </GemStoreProvider>
              </OnboardingProvider>
            </ToastProvider>
          </StatChangeProvider>
        </GameProvider>
      </UIUXProvider>
    </SettingsProvider>
  );
}

