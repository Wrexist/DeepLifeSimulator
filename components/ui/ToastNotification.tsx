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
import Gradient from '@/components/ui/Gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react-native';
import { accent, shadows, typography } from '@/lib/config/theme';
import {
  responsiveSpacing,
  responsiveFontSize,
  responsiveBorderRadius,
} from '@/utils/scaling';
import { useFeedback } from '@/utils/feedbackSystem';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { Z_INDEX } from '@/utils/zIndexConstants';
const LinearGradient = Gradient;

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

  // The toast paints its OWN surface — a saturated accent gradient with white
  // content on top — so it reads identically in light and dark mode and takes
  // no `darkMode` dependency. The second stop of each gradient is the darker
  // shade of the same hue; the theme has no token for those, so they stay as
  // literals here rather than inventing one.
  const getTypeStyles = () => {
    switch (type) {
      case 'success':
        return {
          gradient: [accent.success, '#059669'],
          icon: CheckCircle,
          iconColor: '#FFFFFF',
        };
      case 'error':
        return {
          gradient: [accent.danger, '#DC2626'],
          icon: AlertCircle,
          iconColor: '#FFFFFF',
        };
      case 'warning':
        return {
          gradient: [accent.warning, '#D97706'],
          // Friendly rounded icon instead of the alarming warning triangle.
          icon: AlertCircle,
          iconColor: '#FFFFFF',
        };
      case 'info':
        return {
          gradient: [accent.info, '#1D4ED8'],
          icon: Info,
          iconColor: '#FFFFFF',
        };
      default:
        return {
          gradient: [accent.info, '#1D4ED8'],
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
    left: responsiveSpacing.md,
    right: responsiveSpacing.md,
    zIndex: Z_INDEX.TOAST,
  },
  toast: {
    borderRadius: responsiveBorderRadius.lg,
    ...shadows.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
  },
  iconContainer: {
    marginRight: responsiveSpacing.sm,
  },
  message: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: responsiveFontSize.base,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto-Medium',
    fontWeight: typography.weight.medium,
    // 1.5x the font size — kept as a ratio so it tracks the scaled font size.
    lineHeight: Math.round(responsiveFontSize.base * 1.5),
  },
  actionButton: {
    marginLeft: responsiveSpacing.sm,
    paddingHorizontal: responsiveSpacing.sm,
    paddingVertical: responsiveSpacing.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: responsiveBorderRadius.sm,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: responsiveFontSize.sm,
    fontWeight: typography.weight.semibold,
  },
  dismissButton: {
    marginLeft: responsiveSpacing.sm,
    padding: responsiveSpacing.xs,
  },
});

