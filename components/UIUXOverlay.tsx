import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useUIUX } from '@/contexts/UIUXContext';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import TutorialOverlay from './TutorialOverlay';
import ImmersiveTutorial from './ImmersiveTutorial';

export default function UIUXOverlay() {
  const {
    loadingStates,
    errorStates,
    showTutorial,
    tutorialSteps,
    currentTutorialStep,
    hideError,
    completeTutorial,
    skipTutorial,
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
    <View style={styles.container} style={{ pointerEvents: 'box-none' }}>
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

      {/* Tutorial Overlay - Use Immersive Tutorial for enhanced experience */}
      <ImmersiveTutorial
        visible={showTutorial}
        steps={tutorialSteps}
        onComplete={completeTutorial}
        onSkip={skipTutorial}
        currentStep={currentTutorialStep}
      />
      
      {/* Fallback to basic tutorial if needed */}
      {!showTutorial && (
        <TutorialOverlay
          visible={false}
          steps={[]}
          onComplete={completeTutorial}
          onSkip={skipTutorial}
          currentStep={currentTutorialStep}
        />
      )}
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
