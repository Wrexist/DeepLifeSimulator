import React, { useCallback } from 'react';
import { Alert, View, StyleSheet } from 'react-native';
import { useUIUX } from '@/contexts/UIUXContext';
import { useGameState } from '@/contexts/GameContext';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import { Z_INDEX } from '@/utils/zIndexConstants';
import { emailDiagnosticReport, openSupportDiscord } from '@/utils/diagnosticReport';

export default function UIUXOverlay() {
  const {
    loadingStates,
    errorStates,
    hideError,
  } = useUIUX();
  
  // Get game state to check for death popup
  const { gameState } = useGameState();

  // Find the highest priority loading state (overlay > default > inline)
  const getHighestPriorityLoading = () => {
    const overlay = loadingStates.find(loading => loading.variant === 'overlay');
    if (overlay) return overlay;
    
    const default_ = loadingStates.find(loading => loading.variant === 'default');
    if (default_) return default_;
    
    return loadingStates[0];
  };

  const highestPriorityLoading = getHighestPriorityLoading();
  
  // CRITICAL: Don't show loading overlay if death popup is showing
  // This ensures the death popup can render on top
  const shouldShowLoading = highestPriorityLoading && !gameState?.showDeathPopup;

  // Real errors get a one-tap "Report" that emails us a comprehensive
  // diagnostic (build, game position, validation, recent logs). We also offer
  // Discord so players can follow up. Built from the LIVE game state so the
  // report we receive is rich enough to debug without any back-and-forth.
  const reportError = useCallback(
    (message: string, title?: string) => {
      const error = new Error(title ? `${title}: ${message}` : message);
      emailDiagnosticReport({ gameState, error, source: 'In-game error banner' })
        .then((opened) => {
          if (!opened) {
            Alert.alert(
              'Report sent another way',
              'We could not open your email app. Tap "Join Discord" to report it there instead.',
              [
                { text: 'Join Discord', onPress: () => { void openSupportDiscord(); } },
                { text: 'OK', style: 'cancel' },
              ]
            );
          }
        })
        .catch(() => { /* never throw from the report path */ });
    },
    [gameState]
  );

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Loading Overlay */}
      {shouldShowLoading && (
        <LoadingSpinner
          visible={true}
          message={highestPriorityLoading.message}
          variant={highestPriorityLoading.variant}
        />
      )}

      {/* Error Messages */}
      {errorStates.map((error, index) => (
        <ErrorMessage
          key={error.id}
          visible={true}
          title={error.title}
          message={error.message}
          severity={error.severity}
          onDismiss={() => hideError(error.id)}
          onRetry={error.onRetry}
          onReport={() => reportError(error.message, error.title)}
          autoDismiss={error.autoDismiss}
          stackIndex={index}
        />
      ))}

      {/* Tutorial is handled by TutorialManager component - disabled here to prevent overlap */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: Z_INDEX.LOADING,
  },
});
