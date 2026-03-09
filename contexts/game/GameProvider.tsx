/**
 * Combined GameProvider component
 * This maintains backward compatibility with existing code
 */
import React, { Component, ReactNode, ErrorInfo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { logger } from '@/utils/logger';
import { GameStateProvider } from './GameStateContext';
import { GameActionsProvider } from './GameActionsContext';
import { GameUIProvider } from './GameUIContext';
import { GameDataProvider } from './GameDataContext';
import { MoneyActionsProvider } from './MoneyActionsContext';
import { JobActionsProvider } from './JobActionsContext';
import { ItemActionsProvider } from './ItemActionsContext';
import { SocialActionsProvider } from './SocialActionsContext';
import { CompanyActionsProvider } from './CompanyActionsContext';
import { initialGameState, STATE_VERSION } from './initialState';
import { GameState } from './types';
import { IAPHandler } from '@/components/IAPHandler';

/**
 * Lightweight error boundary for individual provider isolation.
 * Catches crashes in a specific provider and shows which one failed,
 * rather than letting the error propagate to the app-level boundary
 * with no context about which provider caused the crash.
 */
class ProviderBoundary extends Component<
  { children: ReactNode; name: string },
  { hasError: boolean; error: Error | null }
> {
  state: { hasError: boolean; error: Error | null } = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error(`[GameProvider] ${this.props.name} crashed:`, error, {
      componentStack: info.componentStack?.slice(0, 500),
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ProviderErrorFallback
          error={this.state.error || new Error(`${this.props.name} initialization failed`)}
          providerName={this.props.name}
        />
      );
    }
    return this.props.children;
  }
}

/**
 * Error fallback component for provider failures
 */
function ProviderErrorFallback({ error, providerName }: { error: Error; providerName?: string }) {
  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>Game Initialization Error</Text>
      {providerName && (
        <Text style={styles.errorProvider}>Failed component: {providerName}</Text>
      )}
      <Text style={styles.errorMessage}>{error.message}</Text>
      <Text style={styles.errorHint}>
        Please restart the app. If the issue persists, contact support.
      </Text>
    </View>
  );
}

/**
 * Combined GameProvider that wraps all game contexts
 * This maintains backward compatibility with existing code
 * Each provider is wrapped in a ProviderBoundary so crashes report
 * exactly which provider failed instead of a generic error.
 */
export function GameProvider({
  children,
  initialState = initialGameState
}: {
  children: ReactNode;
  initialState?: GameState;
}) {
  // Validate initialState synchronously (no delay needed)
  React.useEffect(() => {
    if (initialState && typeof initialState !== 'object') {
      logger.error('[GameProvider] Invalid initialState provided:', { type: typeof initialState });
    }
  }, [initialState]);

  return (
    <ProviderBoundary name="GameDataProvider">
      <GameDataProvider initialState={initialState} stateVersion={STATE_VERSION}>
        <ProviderBoundary name="GameStateProvider">
          <GameStateProvider initialState={initialState}>
            <ProviderBoundary name="GameUIProvider">
              <GameUIProvider>
                <ProviderBoundary name="MoneyActionsProvider">
                  <MoneyActionsProvider>
                    <ProviderBoundary name="JobActionsProvider">
                      <JobActionsProvider>
                        <ProviderBoundary name="ItemActionsProvider">
                          <ItemActionsProvider>
                            <ProviderBoundary name="SocialActionsProvider">
                              <SocialActionsProvider>
                                <ProviderBoundary name="CompanyActionsProvider">
                                  <CompanyActionsProvider>
                                    <ProviderBoundary name="GameActionsProvider">
                                      <GameActionsProvider>
                                        <IAPHandler />
                                        {children}
                                      </GameActionsProvider>
                                    </ProviderBoundary>
                                  </CompanyActionsProvider>
                                </ProviderBoundary>
                              </SocialActionsProvider>
                            </ProviderBoundary>
                          </ItemActionsProvider>
                        </ProviderBoundary>
                      </JobActionsProvider>
                    </ProviderBoundary>
                  </MoneyActionsProvider>
                </ProviderBoundary>
              </GameUIProvider>
            </ProviderBoundary>
          </GameStateProvider>
        </ProviderBoundary>
      </GameDataProvider>
    </ProviderBoundary>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#0f172a',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
    textAlign: 'center',
  },
  errorProvider: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#f97316',
    marginBottom: 8,
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: 14,
    color: '#fca5a5',
    marginBottom: 16,
    textAlign: 'center',
  },
  errorHint: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
    lineHeight: 18,
  },
});

