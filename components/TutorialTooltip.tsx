import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, ArrowRight } from 'lucide-react-native';
import { responsiveSpacing, responsiveFontSize, responsiveBorderRadius } from '@/utils/scaling';

interface TutorialTooltipProps {
  visible: boolean;
  title: string;
  message: string;
  position?: 'top' | 'bottom' | 'center';
  onNext?: () => void;
  onClose: () => void;
  showNextButton?: boolean;
  darkMode?: boolean;
}

export default function TutorialTooltip({
  visible,
  title,
  message,
  position = 'center',
  onNext,
  onClose,
  showNextButton = false,
  darkMode = false,
}: TutorialTooltipProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 50,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getPositionStyle = () => {
    switch (position) {
      case 'top':
        return { justifyContent: 'flex-start', paddingTop: 100 };
      case 'bottom':
        return { justifyContent: 'flex-end', paddingBottom: 100 };
      default:
        return { justifyContent: 'center' };
    }
  };

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={[styles.overlay, getPositionStyle()]}>
        <Animated.View
          style={[
            styles.container,
            darkMode && styles.containerDark,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <LinearGradient
            colors={darkMode ? ['#1F2937', '#111827'] : ['#FFFFFF', '#F9FAFB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={[styles.title, darkMode && styles.titleDark]}>
                💡 {title}
              </Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <X size={20} color={darkMode ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
            </View>

            {/* Message */}
            <Text style={[styles.message, darkMode && styles.messageDark]}>
              {message}
            </Text>

            {/* Actions */}
            <View style={styles.actions}>
              {showNextButton && onNext ? (
                <>
                  <TouchableOpacity onPress={onClose} style={styles.skipButton}>
                    <Text style={[styles.skipText, darkMode && styles.skipTextDark]}>
                      Skip Tutorial
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onNext} style={styles.nextButton}>
                    <LinearGradient
                      colors={['#3B82F6', '#2563EB']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.nextButtonGradient}
                    >
                      <Text style={styles.nextText}>Next</Text>
                      <ArrowRight size={16} color="#FFFFFF" />
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity onPress={onClose} style={styles.gotItButton}>
                  <LinearGradient
                    colors={['#10B981', '#059669']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.gotItButtonGradient}
                  >
                    <Text style={styles.gotItText}>Got it!</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    padding: responsiveSpacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    borderRadius: responsiveBorderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  containerDark: {
    shadowColor: '#000',
    shadowOpacity: 0.5,
  },
  gradient: {
    padding: responsiveSpacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: responsiveSpacing.md,
  },
  title: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '700',
    color: '#1F2937',
    flex: 1,
  },
  titleDark: {
    color: '#F9FAFB',
  },
  closeButton: {
    padding: responsiveSpacing.xs,
  },
  message: {
    fontSize: responsiveFontSize.base,
    lineHeight: responsiveFontSize.base * 1.5,
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
  gotItButton: {
    flex: 1,
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  gotItButtonGradient: {
    alignItems: 'center',
    paddingVertical: responsiveSpacing.md,
    paddingHorizontal: responsiveSpacing.lg,
  },
  gotItText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: responsiveFontSize.base,
  },
});
