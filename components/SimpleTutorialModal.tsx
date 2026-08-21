import React from 'react';
import { Modal, View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { X, ArrowRight, Lightbulb } from 'lucide-react-native';
import { responsiveSpacing, responsiveFontSize, responsiveBorderRadius, scale } from '@/utils/scaling';
import { useGameState } from '@/contexts/game/GameStateContext';
import { logger } from '@/utils/logger';
import type { TutorialStep } from '@/types/tutorial';
const LinearGradient = Gradient;

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
  // Use useGameState directly (only requires GameStateProvider, not GameActionsProvider)
  // This component is rendered inside AppProviders which includes GameProvider,
  // so GameStateProvider should be available
  const { gameState } = useGameState();
  const darkMode = gameState?.settings?.darkMode ?? false;

  logger.debug('[SimpleTutorialModal] Render:', { visible, stepTitle: step?.title, currentStep, totalSteps });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      onShow={() => logger.debug('[SimpleTutorialModal] Modal shown!')}
    >
      <View style={styles.overlay}>
        <View style={[styles.modal, darkMode && styles.modalDark]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.progressContainer}>
              <Text style={[styles.stepCounter, darkMode && styles.textDark]}>
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
              <X size={24} color={darkMode ? '#FFFFFF' : '#000000'} />
            </TouchableOpacity>
          </View>

          {/* ── The scroll surface ───────────────────────────────────────
              The card is capped at `maxHeight: '80%'`, and the step body is
              free-form copy: a long `step.description` (or a large system font
              scale) pushes the footer — Skip Tour and Next, the two controls
              that move the tour along — past that cap. Only the header X would
              be left, which quits the tour rather than continuing it.

              `flexShrink: 1` against the cap, not `flex: 1` — see the note in
              `WeddingPopup`/`ApplyCardModal`. */}
          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={true}
            bounces={false}
          >
            <View style={styles.iconContainer}>
              <Lightbulb size={32} color="#F59E0B" />
            </View>
            <Text style={[styles.title, darkMode && styles.textDark]}>
              {step.title}
            </Text>
            <Text style={[styles.message, darkMode && styles.messageDark]}>
              {step.description}
            </Text>
          </ScrollView>

          {/* Footer — pinned outside the scroller so Next is on screen from
              the moment the step opens. */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
              <Text style={[styles.skipText, darkMode && styles.skipTextDark]}>
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
    backgroundColor: '#1E293B',
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
  scrollArea: {
    flexShrink: 1,
  },
  // Now the ScrollView's contentContainerStyle, which is what it has always
  // effectively been: a padded, centred column.
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
    color: '#0F172A',
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
    color: '#94A3B8',
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

