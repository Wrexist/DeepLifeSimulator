import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useUIUX } from '@/contexts/UIUXContext';
import { useGameState } from '@/contexts/GameContext';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

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
      {errorStates.map((error) => (
        <ErrorMessage
          key={error.id}
          visible={true}
          title={error.title}
          message={error.message}
          severity={error.severity}
          onDismiss={() => hideError(error.id)}
          onRetry={error.onRetry}
          autoDismiss={error.autoDismiss}
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
    zIndex: 1000,
  },
});
