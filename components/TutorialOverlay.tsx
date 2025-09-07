import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView } from 'moti';
import { ChevronLeft, ChevronRight, X, HelpCircle, Play, XCircle } from 'lucide-react-native';
import { TutorialStep } from '@/types/tutorial';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface TutorialOverlayProps {
  visible: boolean;
  steps: TutorialStep[];
  onComplete: () => void;
  onSkip: () => void;
  currentStep?: number;
}

export default function TutorialOverlay({
  visible,
  steps,
  onComplete,
  onSkip,
  currentStep = 0,
}: TutorialOverlayProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState(currentStep);
  const scrollViewRef = useRef<ScrollView>(null);

  if (!visible || steps.length === 0) return null;

  const currentStepData = steps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      setCurrentStepIndex(currentStepIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      setCurrentStepIndex(currentStepIndex - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  const getProgressPercentage = () => {
    return ((currentStepIndex + 1) / steps.length) * 100;
  };

  return (
    <View style={styles.overlay}>
      <LinearGradient
        colors={['rgba(0,0,0,0.8)', 'rgba(0,0,0,0.6)'] as [string, string]}
        style={styles.background}
      >
        {/* Skip button */}
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
          <XCircle size={20} color="#fff" />
          <Text style={styles.skipText}>Skip Tutorial</Text>
        </TouchableOpacity>

        {/* Main content */}
        <View style={styles.content}>
          <MotiView
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 300 }}
            style={styles.card}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.iconContainer}>
                <HelpCircle size={24} color="#3B82F6" />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.stepIndicator}>
                  Step {currentStepIndex + 1} of {steps.length}
                </Text>
                <Text style={styles.title}>{currentStepData.title}</Text>
              </View>
            </View>

            {/* Progress bar */}
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${getProgressPercentage()}%` }]}
                />
              </View>
            </View>

            {/* Description */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.descriptionContainer}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.description}>{currentStepData.description}</Text>
            </ScrollView>

            {/* Navigation */}
            <View style={styles.navigation}>
              <TouchableOpacity
                onPress={handlePrevious}
                disabled={isFirstStep}
                style={[styles.navButton, isFirstStep && styles.navButtonDisabled]}
              >
                <ChevronLeft size={20} color={isFirstStep ? '#9CA3AF' : '#3B82F6'} />
                <Text style={[styles.navText, isFirstStep && styles.navTextDisabled]}>
                  Previous
                </Text>
              </TouchableOpacity>

                             <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
                 <LinearGradient
                   colors={['#3B82F6', '#1D4ED8'] as [string, string]}
                   start={{ x: 0, y: 0 }}
                   end={{ x: 1, y: 1 }}
                   style={styles.nextButtonGradient}
                 >
                  {isLastStep ? (
                    <>
                      <Play size={20} color="#fff" />
                      <Text style={styles.nextButtonText}>Start Playing</Text>
                    </>
                  ) : (
                    <>
                      <Text style={styles.nextButtonText}>Next</Text>
                      <ChevronRight size={20} color="#fff" />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </MotiView>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 2000,
  },
  background: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  skipText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  content: {
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  headerText: {
    flex: 1,
  },
  stepIndicator: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  progressContainer: {
    marginBottom: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 2,
  },
  descriptionContainer: {
    maxHeight: 200,
    marginBottom: 24,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#4B5563',
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navButtonDisabled: {
    opacity: 0.5,
  },
  navText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
    marginLeft: 4,
  },
  navTextDisabled: {
    color: '#9CA3AF',
  },
  nextButton: {
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginHorizontal: 8,
  },
});
