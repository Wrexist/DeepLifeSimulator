import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, ArrowRight, Lightbulb } from 'lucide-react-native';
import { responsiveSpacing, responsiveFontSize, responsiveBorderRadius, scale, verticalScale } from '@/utils/scaling';
import { useGame } from '@/contexts/GameContext';
import { logger } from '@/utils/logger';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
}

interface SimpleTutorialModalProps {
  visible: boolean;
  step: TutorialStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onClose: () => void;
  onSkip: () => void;
}

export default function SimpleTutorialModal({
  visible,
  step,
  currentStep,
  totalSteps,
  onNext,
  onClose,
  onSkip,
}: SimpleTutorialModalProps) {
  const { gameState } = useGame();
  const { settings } = gameState;

  logger.debug('[SimpleTutorialModal] Render:', { visible, stepTitle: step?.title, currentStep, totalSteps });

  return (
    <Modal visible={visible} transparent animationType="fade" onShow={() => logger.debug('[SimpleTutorialModal] Modal shown!')}>
      <View style={styles.overlay}>
        <View style={[styles.modal, settings.darkMode && styles.modalDark]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.progressContainer}>
              <Text style={[styles.stepCounter, settings.darkMode && styles.textDark]}>
                {currentStep} of {totalSteps}
              </Text>
              <View style={styles.progressBar}>
                <View 
                  style={[
                    styles.progressFill, 
                    { width: `${(currentStep / totalSteps) * 100}%` }
                  ]} 
                />
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color={settings.darkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <Lightbulb size={32} color="#F59E0B" />
            </View>
            <Text style={[styles.title, settings.darkMode && styles.textDark]}>
              {step.title}
            </Text>
            <Text style={[styles.message, settings.darkMode && styles.messageDark]}>
              {step.description}
            </Text>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
              <Text style={[styles.skipText, settings.darkMode && styles.skipTextDark]}>
                Skip Tour
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={onNext} style={styles.nextButton}>
              <LinearGradient
                colors={['#3B82F6', '#2563EB']}
                style={styles.nextButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.nextText}>Next</Text>
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
