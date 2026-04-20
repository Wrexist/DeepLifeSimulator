import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFeedback } from '@/utils/feedbackSystem';
import { DesignSystem } from '@/utils/designSystem';

interface EnhancedButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  hapticFeedback?: boolean;
  animationType?: 'bounce' | 'scale' | 'pulse';
}

export default function EnhancedButton({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
  hapticFeedback = false,
  animationType = 'scale',
}: EnhancedButtonProps) {
  const { buttonPress, animation } = useFeedback(hapticFeedback);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    if (disabled || loading) return;

    if (hapticFeedback) {
      buttonPress();
    }

    // Trigger animation
    animation(scaleAnim, animationType, { duration: 150 });

    onPress();
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return {
          gradient: DesignSystem.colors.primary[500],
          textColor: '#FFFFFF',
          shadowColor: DesignSystem.colors.primary[500],
        };
      case 'secondary':
        return {
          gradient: DesignSystem.colors.neutral[200],
          textColor: DesignSystem.colors.neutral[800],
          shadowColor: DesignSystem.colors.neutral[400],
        };
      case 'success':
        return {
          gradient: DesignSystem.colors.accent.success,
          textColor: '#FFFFFF',
          shadowColor: DesignSystem.colors.accent.success,
        };
      case 'warning':
        return {
          gradient: DesignSystem.colors.accent.warning,
          textColor: '#FFFFFF',
          shadowColor: DesignSystem.colors.accent.warning,
        };
      case 'error':
        return {
          gradient: DesignSystem.colors.accent.error,
          textColor: '#FFFFFF',
          shadowColor: DesignSystem.colors.accent.error,
        };
      default:
        return {
          gradient: DesignSystem.colors.primary[500],
          textColor: '#FFFFFF',
          shadowColor: DesignSystem.colors.primary[500],
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: DesignSystem.spacing.xs,
          paddingHorizontal: DesignSystem.spacing.sm,
          fontSize: DesignSystem.typography.fontSize.sm,
          borderRadius: DesignSystem.borderRadius.sm,
        };
      case 'md':
        return {
          paddingVertical: DesignSystem.spacing.sm,
          paddingHorizontal: DesignSystem.spacing.md,
          fontSize: DesignSystem.typography.fontSize.base,
          borderRadius: DesignSystem.borderRadius.md,
        };
      case 'lg':
        return {
          paddingVertical: DesignSystem.spacing.md,
          paddingHorizontal: DesignSystem.spacing.lg,
          fontSize: DesignSystem.typography.fontSize.lg,
          borderRadius: DesignSystem.borderRadius.lg,
        };
      default:
        return {
          paddingVertical: DesignSystem.spacing.sm,
          paddingHorizontal: DesignSystem.spacing.md,
          fontSize: DesignSystem.typography.fontSize.base,
          borderRadius: DesignSystem.borderRadius.md,
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  const buttonStyle = [
    styles.button,
    {
      paddingVertical: sizeStyles.paddingVertical,
      paddingHorizontal: sizeStyles.paddingHorizontal,
      borderRadius: sizeStyles.borderRadius,
      opacity: disabled ? 0.6 : 1,
    },
    style,
  ];

  const textStyleCombined = [
    styles.text,
    {
      fontSize: sizeStyles.fontSize,
      color: variantStyles.textColor,
    },
    textStyle,
  ];

  return (
    <Animated.View
      style={[
        {
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <TouchableOpacity
        style={buttonStyle}
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={[variantStyles.gradient, variantStyles.gradient]}
          style={[
            styles.gradient,
            {
              borderRadius: sizeStyles.borderRadius,
            },
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={textStyleCombined}>
            {loading ? 'Loading...' : title}
          </Text>
          {icon && !loading && (
            <Text style={styles.icon}>{icon}</Text>
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    ...DesignSystem.shadows.md,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44, // Minimum touch target
  },
  text: {
    fontFamily: DesignSystem.typography.fontFamily.medium,
    fontWeight: DesignSystem.typography.fontWeight.medium,
    textAlign: 'center',
  },
  icon: {
    marginLeft: DesignSystem.spacing.xs,
  },
});
