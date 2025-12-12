import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useUIUX } from '@/contexts/UIUXContext';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

export default function UIUXOverlay() {
  const {
    loadingStates,
    errorStates,
    hideError,
  } = useUIUX();

  // Find the highest priority loading state (overlay > default > inline)
  const getHighestPriorityLoading = () => {
    const overlay = loadingStates.find(loading => loading.variant === 'overlay');
    if (overlay) return overlay;
    
    const default_ = loadingStates.find(loading => loading.variant === 'default');
    if (default_) return default_;
    
    return loadingStates[0];
  };

  const highestPriorityLoading = getHighestPriorityLoading();

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Loading Overlay */}
      {highestPriorityLoading && (
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
