import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { responsiveSpacing, responsiveFontSize, responsiveBorderRadius } from '@/utils/scaling';
import { getButtonAccessibilityProps, ACCESSIBILITY_HINTS } from '@/utils/accessibility';

interface LoadingButtonProps {
  onPress: () => void | Promise<void>;
  title: string;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'small' | 'medium' | 'large';
  style?: ViewStyle;
  textStyle?: TextStyle;
  loadingText?: string;
  icon?: React.ReactNode;
}

export default function LoadingButton({
  onPress,
  title,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'medium',
  style,
  textStyle,
  loadingText,
  icon,
}: LoadingButtonProps) {
  const isDisabled = disabled || loading;

  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return ['#3B82F6', '#2563EB'];
      case 'secondary':
        return ['#EF4444', '#DC2626']; // Red for sell buttons
      case 'danger':
        return ['#EF4444', '#DC2626'];
      case 'success':
        return ['#10B981', '#059669'];
      default:
        return ['#3B82F6', '#2563EB'];
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: responsiveSpacing.sm,
          paddingHorizontal: responsiveSpacing.md,
          fontSize: responsiveFontSize.sm,
        };
      case 'large':
        return {
          paddingVertical: responsiveSpacing.lg,
          paddingHorizontal: responsiveSpacing.xl,
          fontSize: responsiveFontSize.lg,
        };
      default: // medium
        return {
          paddingVertical: responsiveSpacing.md,
          paddingHorizontal: responsiveSpacing.lg,
          fontSize: responsiveFontSize.base,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const colors = getVariantColors();

  const accessibilityProps = getButtonAccessibilityProps({
    label: title,
    hint: ACCESSIBILITY_HINTS.BUTTONS.BUY, // Default hint, can be customized
    disabled: isDisabled,
    loading: loading,
  });

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      style={[
        styles.button,
        { opacity: isDisabled ? 0.6 : 1 },
        style,
      ]}
      accessibilityLabel={accessibilityProps.accessibilityLabel}
      accessibilityRole={accessibilityProps.accessibilityRole}
      accessibilityHint={accessibilityProps.accessibilityHint}
      accessibilityState={accessibilityProps.accessibilityState}
    >
      <LinearGradient
        colors={isDisabled ? ['#9CA3AF', '#6B7280'] : colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          {
            paddingVertical: sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
          },
        ]}
      >
        <View style={styles.content}>
          {loading && (
            <ActivityIndicator
              size="small"
              color="#FFFFFF"
              style={styles.spinner}
            />
          )}
          {icon && !loading && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.text,
              { fontSize: sizeStyles.fontSize },
              textStyle,
            ]}
          >
            {loading ? (loadingText || 'Loading...') : title}
          </Text>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  gradient: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    marginRight: responsiveSpacing.xs,
  },
  iconContainer: {
    marginRight: responsiveSpacing.xs,
  },
  text: {
    color: '#FFFFFF',
    fontWeight: '600',
    textAlign: 'center',
  },
});
