import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Easing,
} from 'react-native';
import LinearGradientFallback from '@/components/fallbacks/LinearGradientFallback';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react-native';
import { DesignSystem } from '@/utils/designSystem';
import { useFeedback } from '@/utils/feedbackSystem';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Z_INDEX } from '@/utils/zIndexConstants';
const LinearGradient = LinearGradientFallback;

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
  /** Index in the visible stack — offsets each toast so they don't overlap. */
  stackIndex?: number;
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
}: ToastNotificationProps) {
  const { buttonPress } = useFeedback(hapticEnabled);
  const reducedMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          gradient: [DesignSystem.colors.accent.success, '#059669'],
          icon: CheckCircle,
          iconColor: '#FFFFFF',
        };
      case 'error':
        return {
          gradient: [DesignSystem.colors.accent.error, '#DC2626'],
          icon: AlertCircle,
          iconColor: '#FFFFFF',
        };
      case 'warning':
        return {
          gradient: [DesignSystem.colors.accent.warning, '#D97706'],
          // Friendly rounded icon instead of the alarming warning triangle.
          icon: AlertCircle,
          iconColor: '#FFFFFF',
        };
      case 'info':
        return {
          gradient: [DesignSystem.colors.accent.info, '#1D4ED8'],
          icon: Info,
          iconColor: '#FFFFFF',
        };
      default:
        return {
          gradient: [DesignSystem.colors.primary[500], '#1D4ED8'],
          icon: Info,
          iconColor: '#FFFFFF',
        };
    }
  };

  const typeStyles = getTypeStyles();
  const IconComponent = typeStyles.icon;

  const dismiss = useCallback(() => {
    // Reduced motion: fade out in place — no slide/scale movement.
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
      // Reduced motion: opacity only — snap slide/scale to their settled values
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
          // Ease-out settle instead of elastic overshoot — a utility surface
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

  // Nothing to say — an empty toast renders as a bare icon-only pill.
  // (After the hooks so hook order stays stable.)
  if (!message?.trim()) return null;

  const containerStyle = [
    styles.container,
    {
      // Respect the safe-area inset so a top toast sits BELOW the status bar /
      // notch instead of overlapping the clock and battery (the old flat 50px
      // landed right in the notch on modern phones). stackIndex offsets each
      // toast so multiple don't pile on top of each other.
      top: position === 'top' ? insets.top + 8 + stackIndex * 72 : undefined,
      bottom: position === 'bottom' ? insets.bottom + 8 + stackIndex * 72 : undefined,
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
      <LinearGradient
        colors={typeStyles.gradient as unknown as readonly [string, string]}
        style={styles.toast}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <IconComponent 
              size={20} 
              color={typeStyles.iconColor}
              accessibilityLabel={`${type} icon`}
            />
          </View>
          <Text 
            style={styles.message} 
            numberOfLines={2}
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
            <X size={16} color={typeStyles.iconColor} />
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// Width not used - removed to fix TS6133

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: DesignSystem.spacing.md,
    right: DesignSystem.spacing.md,
    zIndex: Z_INDEX.TOAST,
  },
  toast: {
    borderRadius: DesignSystem.borderRadius.lg,
    ...DesignSystem.shadows.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: DesignSystem.spacing.md,
  },
  iconContainer: {
    marginRight: DesignSystem.spacing.sm,
  },
  message: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: DesignSystem.typography.fontSize.sm,
    fontFamily: DesignSystem.typography.fontFamily.medium,
    fontWeight: DesignSystem.typography.fontWeight.medium,
    lineHeight: DesignSystem.typography.lineHeight.normal * DesignSystem.typography.fontSize.sm,
  },
  actionButton: {
    marginLeft: DesignSystem.spacing.sm,
    paddingHorizontal: DesignSystem.spacing.sm,
    paddingVertical: DesignSystem.spacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: DesignSystem.borderRadius.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: DesignSystem.typography.fontSize.xs,
    fontWeight: DesignSystem.typography.fontWeight.semibold,
  },
  dismissButton: {
    marginLeft: DesignSystem.spacing.sm,
    padding: DesignSystem.spacing.xs,
  },
});

