import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, ArrowRight, Target } from 'lucide-react-native';
import { responsiveSpacing, responsiveFontSize, responsiveBorderRadius } from '@/utils/scaling';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface InteractiveTutorialProps {
  visible: boolean;
  step: TutorialStep;
  onNext: () => void;
  onClose: () => void;
  onSkip: () => void;
  currentStep: number;
  totalSteps: number;
  darkMode?: boolean;
}

export interface TutorialStep {
  id: string;
  title: string;
  message: string;
  highlightArea?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  arrowPosition?: 'top' | 'bottom' | 'left' | 'right';
  tooltipPosition?: 'top' | 'bottom' | 'center';
}

export default function InteractiveTutorial({
  visible,
  step,
  onNext,
  onClose,
  onSkip,
  currentStep,
  totalSteps,
  darkMode = false,
}: InteractiveTutorialProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const arrowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();

      // Pulsing animation for highlight
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // Arrow bounce animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(arrowAnim, {
            toValue: 10,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(arrowAnim, {
            toValue: 0,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [visible]);

  const getTooltipPosition = () => {
    if (step.highlightArea) {
      const { y, height } = step.highlightArea;
      const centerY = y + height / 2;
      
      if (centerY < SCREEN_HEIGHT / 3) {
        // Highlight is in top third - show tooltip below
        return { top: y + height + 20 };
      } else if (centerY > (SCREEN_HEIGHT * 2) / 3) {
        // Highlight is in bottom third - show tooltip above
        return { bottom: SCREEN_HEIGHT - y + 20 };
      } else {
        // Highlight is in middle - show based on tooltipPosition prop
        if (step.tooltipPosition === 'top') {
          return { bottom: SCREEN_HEIGHT - y + 20 };
        } else {
          return { top: y + height + 20 };
        }
      }
    }

    // Default: center of screen
    return { top: SCREEN_HEIGHT / 2 - 150 };
  };

  const getArrowStyle = () => {
    if (!step.highlightArea || !step.arrowPosition) return {};

    const { x, y, width, height } = step.highlightArea;
    const baseStyle: any = { position: 'absolute' };

    switch (step.arrowPosition) {
      case 'top':
        return {
          ...baseStyle,
          top: y - 60,
          left: x + width / 2 - 15,
          transform: [{ translateY: arrowAnim }, { rotate: '180deg' }],
        };
      case 'bottom':
        return {
          ...baseStyle,
          top: y + height + 10,
          left: x + width / 2 - 15,
          transform: [{ translateY: arrowAnim }],
        };
      case 'left':
        return {
          ...baseStyle,
          top: y + height / 2 - 15,
          left: x - 60,
          transform: [{ translateX: arrowAnim.interpolate({
            inputRange: [0, 10],
            outputRange: [0, 10],
          }) }, { rotate: '90deg' }],
        };
      case 'right':
        return {
          ...baseStyle,
          top: y + height / 2 - 15,
          left: x + width + 10,
          transform: [{ translateX: arrowAnim.interpolate({
            inputRange: [0, 10],
            outputRange: [0, 10],
          }) }, { rotate: '-90deg' }],
        };
      default:
        return baseStyle;
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onSkip}
    >
      <View style={styles.overlay}>
        {/* Dark overlay with cutout for highlighted area - NO BLUR on highlighted area */}
        <View style={styles.darkOverlay}>
          {step.highlightArea ? (
            <>
              {/* Top dark area */}
              <View
                style={[
                  styles.darkSection,
                  {
                    top: 0,
                    left: 0,
                    right: 0,
                    height: step.highlightArea.y,
                  },
                ]}
              />
              
              {/* Left dark area */}
              <View
                style={[
                  styles.darkSection,
                  {
                    top: step.highlightArea.y,
                    left: 0,
                    width: step.highlightArea.x,
                    height: step.highlightArea.height,
                  },
                ]}
              />
              
              {/* Right dark area */}
              <View
                style={[
                  styles.darkSection,
                  {
                    top: step.highlightArea.y,
                    left: step.highlightArea.x + step.highlightArea.width,
                    right: 0,
                    height: step.highlightArea.height,
                  },
                ]}
              />
              
              {/* Bottom dark area */}
              <View
                style={[
                  styles.darkSection,
                  {
                    top: step.highlightArea.y + step.highlightArea.height,
                    left: 0,
                    right: 0,
                    bottom: 0,
                  },
                ]}
              />

              {/* White glow background for highlighted area */}
              <View
                style={[
                  styles.highlightGlow,
                  {
                    top: step.highlightArea.y - 8,
                    left: step.highlightArea.x - 8,
                    width: step.highlightArea.width + 16,
                    height: step.highlightArea.height + 16,
                  },
                ]}
              />

              {/* Pulsing border around highlight */}
              <Animated.View
                style={[
                  styles.highlightBorder,
                  {
                    top: step.highlightArea.y - 4,
                    left: step.highlightArea.x - 4,
                    width: step.highlightArea.width + 8,
                    height: step.highlightArea.height + 8,
                    transform: [{ scale: pulseAnim }],
                  },
                ]}
              />

              {/* Animated arrow pointing to highlight */}
              {step.arrowPosition && (
                <Animated.View style={getArrowStyle()}>
                  <View style={styles.arrowContainer}>
                    <Target size={30} color="#3B82F6" />
                  </View>
                </Animated.View>
              )}
            </>
          ) : (
            // No highlight - full dark overlay for intro/outro screens
            <View style={[styles.darkSection, { top: 0, left: 0, right: 0, bottom: 0 }]} />
          )}
        </View>

        {/* Tutorial tooltip */}
        <Animated.View
          style={[
            styles.tooltip,
            getTooltipPosition(),
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F9FAFB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.tooltipGradient}
          >
            {/* Progress indicator */}
            <View style={styles.progressContainer}>
              <Text style={[styles.progressText, darkMode && styles.progressTextDark]}>
                {currentStep} of {totalSteps}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(currentStep / totalSteps) * 100}%` },
                  ]}
                />
              </View>
            </View>

            {/* Close button */}
            <TouchableOpacity onPress={onSkip} style={styles.closeButton}>
              <X size={20} color={darkMode ? '#9CA3AF' : '#6B7280'} />
            </TouchableOpacity>

            {/* Title */}
            <Text style={[styles.title, darkMode && styles.titleDark]}>
              💡 {step.title}
            </Text>

            {/* Message */}
            <Text style={[styles.message, darkMode && styles.messageDark]}>
              {step.message}
            </Text>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity onPress={onSkip} style={styles.skipButton}>
                <Text style={[styles.skipText, darkMode && styles.skipTextDark]}>
                  Skip Tour
                </Text>
              </TouchableOpacity>
              
              <TouchableOpacity onPress={onNext} style={styles.nextButton}>
                <LinearGradient
                  colors={['#3B82F6', '#2563EB']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.nextButtonGradient}
                >
                  <Text style={styles.nextText}>
                    {currentStep === totalSteps ? 'Finish' : 'Next'}
                  </Text>
                  <ArrowRight size={16} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  darkOverlay: {
    flex: 1,
  },
  darkSection: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.75)', // Slightly less dark for better visibility
  },
  highlightGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(59, 130, 246, 0.15)', // Subtle blue glow behind highlight
    borderRadius: responsiveBorderRadius.md,
  },
  highlightBorder: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: '#3B82F6',
    borderRadius: responsiveBorderRadius.md,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  arrowContainer: {
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  tooltip: {
    position: 'absolute',
    left: responsiveSpacing.lg,
    right: responsiveSpacing.lg,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  tooltipGradient: {
    padding: responsiveSpacing.xl,
  },
  progressContainer: {
    marginBottom: responsiveSpacing.md,
  },
  progressText: {
    fontSize: responsiveFontSize.xs,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: responsiveSpacing.xs,
  },
  progressTextDark: {
    color: '#9CA3AF',
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
  closeButton: {
    position: 'absolute',
    top: responsiveSpacing.md,
    right: responsiveSpacing.md,
    padding: responsiveSpacing.xs,
    zIndex: 10,
  },
  title: {
    fontSize: responsiveFontSize.xl,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: responsiveSpacing.md,
    paddingRight: responsiveSpacing.xl,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  message: {
    fontSize: responsiveFontSize.base,
    lineHeight: responsiveFontSize.base * 1.6,
    color: '#4B5563',
    marginBottom: responsiveSpacing.lg,
  },
  messageDark: {
    color: '#D1D5DB',
  },
  actions: {
    flexDirection: 'row',
    gap: responsiveSpacing.md,
  },
  skipButton: {
    flex: 1,
    paddingVertical: responsiveSpacing.md,
    alignItems: 'center',
  },
  skipText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: responsiveFontSize.sm,
  },
  skipTextDark: {
    color: '#9CA3AF',
  },
  nextButton: {
    flex: 1,
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  nextButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: responsiveSpacing.xs,
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.lg,
  },
  nextText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: responsiveFontSize.base,
  },
});
