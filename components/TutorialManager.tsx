import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useUIUX } from '@/contexts/UIUXContext';
import SimpleTutorialModal from './SimpleTutorialModal';
import { logger } from '@/utils/logger';

interface TutorialManagerProps {
  children: React.ReactNode;
}

export default function TutorialManager({ children }: TutorialManagerProps) {
  const context = useUIUX();
  const { 
    showTutorial, 
    tutorialSteps, 
    currentTutorialStep,
    completeTutorial,
    skipTutorial,
    setTutorialStep 
  } = context;

  const currentStep = tutorialSteps && tutorialSteps.length > 0 ? tutorialSteps[currentTutorialStep] : null;

  if (__DEV__) {
    logger.debug('[TutorialManager] State:', { 
      showTutorial, 
      stepsCount: tutorialSteps?.length || 0, 
      currentTutorialStep,
      hasCurrentStep: !!currentStep 
    });
  }

  const handleNext = () => {
    if (__DEV__) {
      logger.debug('[TutorialManager] Next button pressed');
    }
    if (currentTutorialStep < tutorialSteps.length - 1) {
      setTutorialStep(currentTutorialStep + 1);
    } else {
      completeTutorial();
    }
  };

  // Only show modal if we have a valid step and showTutorial is true
  const shouldShowModal = showTutorial && currentStep && tutorialSteps.length > 0;
  if (__DEV__) {
    logger.debug('[TutorialManager] shouldShowModal:', { shouldShowModal });
  }

  useEffect(() => {
    if (__DEV__) {
      if (shouldShowModal) {
        logger.debug('[TutorialManager] Modal should be visible now!', { currentStep });
      } else {
        logger.debug('[TutorialManager] Modal should NOT be visible');
      }
    }
  }, [shouldShowModal, currentStep]);

  return (
    <View style={styles.container}>
      {/* Main app content */}
      {children}

      {/* Simple tutorial modal */}
      {shouldShowModal && (
        <SimpleTutorialModal
          visible={true}
          step={currentStep}
          currentStep={currentTutorialStep + 1}
          totalSteps={tutorialSteps.length}
          onNext={handleNext}
          onClose={completeTutorial}
          onSkip={skipTutorial}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});