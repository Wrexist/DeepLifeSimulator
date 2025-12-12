import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react-native';
import { DesignSystem } from '@/utils/designSystem';
import { useFeedback } from '@/utils/feedbackSystem';

interface ToastNotificationProps {
  id: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onDismiss: (id: string) => void;
  position?: 'top' | 'bottom';
  hapticEnabled?: boolean;
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
}: ToastNotificationProps) {
  const { buttonPress } = useFeedback(hapticEnabled);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

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
          icon: AlertTriangle,
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
        toValue: 0.8,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onDismiss(id);
    });
  }, [slideAnim, opacityAnim, scaleAnim, position, onDismiss, id]);

  useEffect(() => {
    // Animate in
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.out(Easing.ease),
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
        easing: Easing.elastic(1),
      }),
    ]).start();

    // Auto dismiss (unless persistent)
    if (!persistent) {
      const timer = setTimeout(() => {
        dismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [slideAnim, opacityAnim, scaleAnim, duration, dismiss, persistent]);

  const handleDismiss = () => {
    buttonPress();
    dismiss();
  };

  const containerStyle = [
    styles.container,
    {
      top: position === 'top' ? 50 : undefined,
      bottom: position === 'bottom' ? 50 : undefined,
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
        colors={typeStyles.gradient}
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

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: DesignSystem.spacing.md,
    right: DesignSystem.spacing.md,
    zIndex: 1000,
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
