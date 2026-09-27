import { uiPalette , accent, shadows, typography, withAlpha } from '@/lib/config/theme';
import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Easing,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react-native';

import {
  responsiveSpacing,
  responsiveFontSize,
  responsiveBorderRadius,
  responsiveIconSize,
  scale,
} from '@/utils/scaling';
import { useFeedback } from '@/utils/feedbackSystem';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Z_INDEX } from '@/utils/zIndexConstants';

interface ToastNotificationProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onDismiss: (id: string) => void;
  position?: 'top' | 'bottom';
  hapticEnabled?: boolean;
  action?: { label: string; onPress: () => void };
  persistent?: boolean;
  /** Index in the visible stack - offsets each toast so they don't overlap. */
  stackIndex?: number;
  /** Provider lays out notifications at their measured natural height. */
  inStack?: boolean;
}

export default function ToastNotification({
  id,
  message,
  type,
  duration = 3000,
  onDismiss,
  position = 'top',
  hapticEnabled = false,
  action,
  persistent = false,
  stackIndex = 0,
  inStack = false,
}: ToastNotificationProps) {
  const { buttonPress } = useFeedback();
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  const tint = type === 'success' ? accent.success
    : type === 'error' ? accent.danger
    : type === 'warning' ? accent.warning : accent.info;
  const IconComponent = type === 'success' ? CheckCircle : type === 'info' ? Info : AlertCircle;

  const dismiss = useCallback(() => {
    // Reduced motion: fade out in place - no slide/scale movement.
    if (reducedMotion) {
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        onDismiss(id);
      });
      return;
    }
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: position === 'top' ? -100 : 100,
        duration: 250,
        useNativeDriver: true,
        easing: Easing.in(Easing.ease),
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        // Mirror the entry scale so exit contracts to the same start point.
        toValue: 0.92,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(id);
    });
  }, [slideAnim, opacityAnim, scaleAnim, position, onDismiss, id, reducedMotion]);

  useEffect(() => {
    // Animate in
    if (reducedMotion) {
      // Reduced motion: opacity only - snap slide/scale to their settled values
      // so the toast appears in place without sliding or scaling.
      slideAnim.setValue(0);
      scaleAnim.setValue(1);
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
          easing: Easing.out(Easing.ease),
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
          // Ease-out settle instead of elastic overshoot - a utility surface
          // shouldn't bounce.
          easing: Easing.out(Easing.cubic),
        }),
      ]).start();
    }

    // Auto dismiss (unless persistent)
    if (!persistent) {
      const timer = setTimeout(() => {
        dismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
    return undefined;
  }, [slideAnim, opacityAnim, scaleAnim, duration, dismiss, persistent, reducedMotion]);

  const handleDismiss = () => {
    buttonPress();
    dismiss();
  };

  // Nothing to say - an empty toast renders as a bare icon-only pill.
  // (After the hooks so hook order stays stable.)
  if (!message?.trim()) return null;

  const containerStyle = [
    inStack ? styles.stackedContainer : styles.container,
    {
      // Respect the safe-area inset so a top toast sits BELOW the status bar /
      // notch instead of overlapping the clock and battery (the old flat 50px
      // landed right in the notch on modern phones). stackIndex offsets each
      // toast so multiple don't pile on top of each other.
      // The stack step tracks the toast HEIGHT - it was 72 for a toast whose
      // padding, icon and font were each a step larger. Left at 72 the denser
      // toasts would sit in a column with a visible gap between them.
      top: !inStack && position === 'top' ? insets.top + scale(8) + stackIndex * scale(TOAST_STACK_STEP) : undefined,
      bottom: !inStack && position === 'bottom' ? insets.bottom + scale(8) + stackIndex * scale(TOAST_STACK_STEP) : undefined,
      transform: [
        { translateY: slideAnim },
        { scale: scaleAnim },
      ],
      opacity: opacityAnim,
    },
  ];

  return (
    <Animated.View 
      style={containerStyle}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <View style={styles.toast}>
        <View style={styles.content}>
          <View style={[styles.iconContainer, { backgroundColor: withAlpha(tint, 0.15) }]}>
            <IconComponent
              size={responsiveIconSize.sm}
              color={tint}
              accessibilityLabel={`${type} icon`}
            />
          </View>
          <Text
            style={styles.message}
            // 3, not 2: game copy regularly runs to two full lines, and a
            // 2-line clamp cut mid-sentence with an ellipsis (the satiety
            // toast screenshot, 2026-08-24). Three lines fits every current
            // message; the clamp stays so a runaway string cannot fill the
            // screen.
            numberOfLines={3}
            accessibilityLabel={message}
          >
            {message}
          </Text>
          {action && (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={action.onPress}
              activeOpacity={0.7}
              accessibilityLabel={action.label}
              accessibilityRole="button"
            >
              <Text style={styles.actionButtonText}>{action.label}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.dismissButton}
            onPress={handleDismiss}
            activeOpacity={0.7}
            accessibilityLabel="Dismiss notification"
            accessibilityRole="button"
            accessibilityHint="Double tap to dismiss this notification"
          >
            <X size={responsiveIconSize.xs} color={tint} />
          </TouchableOpacity>
        </View>
      </View>
    </Animated.View>
  );
}

// Legacy standalone positioning; the app provider uses natural-height stacks.
const TOAST_STACK_STEP = 56;

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: responsiveSpacing.md,
    right: responsiveSpacing.md,
    zIndex: Z_INDEX.TOAST,
  },
  stackedContainer: {
    marginBottom: responsiveSpacing.sm,
  },
  toast: {
    backgroundColor: uiPalette.surface,
    borderWidth: 1,
    borderColor: uiPalette.raised,
    borderRadius: responsiveBorderRadius.lg,
    ...shadows.md,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: responsiveSpacing.sm,
    paddingLeft: responsiveSpacing.md,
    paddingRight: responsiveSpacing.xs,
  },
  iconContainer: {
    width: scale(32),
    height: scale(32),
    borderRadius: responsiveBorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: responsiveSpacing.sm,
  },
  message: {
    flex: 1,
    color: uiPalette.white,
    fontSize: responsiveFontSize.sm,
    fontFamily: Platform.OS === 'web' ? 'system-ui' : Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontWeight: typography.weight.semibold,
    // 1.4x the font size - kept as a ratio so it tracks the scaled font size.
    lineHeight: Math.round(responsiveFontSize.sm * 1.4),
  },
  actionButton: {
    marginLeft: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.sm,
    minHeight: scale(44),
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: responsiveBorderRadius.sm,
  },
  actionButtonText: {
    color: uiPalette.white,
    fontSize: responsiveFontSize.xs,
    fontWeight: typography.weight.semibold,
  },
  dismissButton: {
    marginLeft: responsiveSpacing.xs,
    width: scale(44),
    height: scale(44),
    alignItems: 'center',
    justifyContent: 'center',
  },
});

