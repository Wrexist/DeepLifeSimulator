import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, ArrowRight, Lightbulb } from 'lucide-react-native';
import { responsiveSpacing, responsiveFontSize, responsiveBorderRadius, scale } from '@/utils/scaling';
import { useGame } from '@/contexts/GameContext';
import { getTutorialSteps } from '@/utils/tutorialData';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TUTORIAL_COMPLETED_KEY = 'tutorial_completed';

interface TutorialOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export default function TutorialOverlay({ visible, onClose }: TutorialOverlayProps) {
  const { gameState } = useGame();
  const { settings } = gameState;
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const steps = getTutorialSteps('game');
  const currentStep = steps[currentStepIndex];

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
      setCurrentStepIndex(0);
      onClose();
    } catch (error) {
      console.error('Error saving tutorial completion:', error);
    }
  };

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
      setCurrentStepIndex(0);
      onClose();
    } catch (error) {
      console.error('Error saving tutorial completion:', error);
    }
  };

  if (!visible || !currentStep) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={[styles.modal, settings.darkMode && styles.modalDark]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.progressContainer}>
              <Text style={[styles.stepCounter, settings.darkMode && styles.textDark]}>
                {currentStepIndex + 1} of {steps.length}
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${((currentStepIndex + 1) / steps.length) * 100}%` }
                  ]} 
                />
              </View>
            </View>
            <TouchableOpacity onPress={handleComplete} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Lightbulb size={32} color="#F59E0B" />
            </View>
            <Text style={[styles.title, settings.darkMode && styles.textDark]}>
              {currentStep.title}
            </Text>
            <Text style={[styles.message, settings.darkMode && styles.messageDark]}>
              {currentStep.description}
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
              <Text style={[styles.skipText, settings.darkMode && styles.skipTextDark]}>
                Skip Tour
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleNext} style={styles.nextButton}>
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.nextButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.nextText}>
                  {currentStepIndex < steps.length - 1 ? 'Next' : 'Finish'}
                </Text>
                <ArrowRight size={16} color="#FFFFFF" />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: responsiveSpacing.lg,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: responsiveBorderRadius.xl,
    width: '100%',
    maxWidth: scale(400),
    maxHeight: '80%',
  },
  modalDark: {
    backgroundColor: '#1F2937',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsiveSpacing.lg,
    paddingBottom: responsiveSpacing.md,
  },
  progressContainer: {
    flex: 1,
  },
  stepCounter: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: responsiveSpacing.xs,
  },
  progressBar: {
    height: scale(4),
    backgroundColor: '#E5E7EB',
    borderRadius: scale(2),
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: scale(2),
  },
  closeButton: {
    padding: responsiveSpacing.sm,
    marginLeft: responsiveSpacing.md,
  },
  content: {
    padding: responsiveSpacing.lg,
    alignItems: 'center',
  },
  iconContainer: {
    marginBottom: responsiveSpacing.lg,
  },
  title: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: responsiveSpacing.md,
  },
  message: {
    fontSize: responsiveFontSize.base,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: responsiveFontSize.base * 1.5,
  },
  textDark: {
    color: '#FFFFFF',
  },
  messageDark: {
    color: '#D1D5DB',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: responsiveSpacing.lg,
    paddingTop: responsiveSpacing.md,
  },
  skipButton: {
    padding: responsiveSpacing.md,
  },
  skipText: {
    fontSize: responsiveFontSize.base,
    color: '#6B7280',
    fontWeight: '500',
  },
  skipTextDark: {
    color: '#9CA3AF',
  },
  nextButton: {
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: responsiveSpacing.xl,
    paddingVertical: responsiveSpacing.md,
    gap: responsiveSpacing.sm,
  },
  nextText: {
    fontSize: responsiveFontSize.base,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
