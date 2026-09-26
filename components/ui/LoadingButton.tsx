import { actionColors, uiPalette } from '@/lib/config/theme';
import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { responsiveSpacing, responsiveFontSize, responsiveBorderRadius } from '@/utils/scaling';
import { getButtonAccessibilityProps } from '@/utils/accessibility';
import { haptic } from '@/utils/haptics';

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
  /** Screen-reader hint. Defaults to none - the title is usually self-describing.
   *  Pass e.g. ACCESSIBILITY_HINTS.BUTTONS.BUY for purchase buttons. */
  accessibilityHint?: string;
  /** Screen-reader label override (defaults to `title`). */
  accessibilityLabel?: string;
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
  accessibilityHint,
  accessibilityLabel,
}: LoadingButtonProps) {
  const { theme } = useTheme();
  const isDisabled = disabled || loading;
  const foreground = isDisabled ? theme.textMuted : variant === 'secondary' ? theme.text : uiPalette.white;

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
  const fill = isDisabled ? theme.surfaceElevated : variant === 'secondary' ? theme.surfaceInteractive : actionColors[variant];

  // R10-UX: don't hard-code the "Tap to purchase" hint for every button - a Sell
  // or generic action button announced the wrong intent. Use the caller's hint
  // (or none) and let the label default to the title.
  const accessibilityProps = getButtonAccessibilityProps({
    label: accessibilityLabel ?? title,
    hint: accessibilityHint,
    disabled: isDisabled,
    loading: loading,
  });

  return (
    <TouchableOpacity
      onPress={() => {
        haptic.light();
        return onPress();
      }}
      disabled={isDisabled}
      activeOpacity={0.85}
      style={[
        styles.button,

        style,
      ]}
      accessibilityLabel={accessibilityProps.accessibilityLabel}
      accessibilityRole={accessibilityProps.accessibilityRole as any}
      accessibilityHint={accessibilityProps.accessibilityHint}
      accessibilityState={accessibilityProps.accessibilityState}
    >
      <View
        style={[
          styles.gradient,

          {
            backgroundColor: fill,
            borderColor: theme.border,
            paddingVertical: sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
          },
        ]}
      >
        <View style={styles.content}>
          {loading && (
            <ActivityIndicator
              size="small"
              color={foreground}
              style={styles.spinner}
            />
          )}
          {icon && !loading && <View style={styles.iconContainer}>{icon}</View>}
          <Text
            style={[
              styles.text,
              { color: foreground },
              { fontSize: sizeStyles.fontSize },
              textStyle,
            ]}
          >
            {loading ? (loadingText || 'Loading...') : title}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: responsiveBorderRadius.md,
    overflow: 'hidden',
  },
  gradient: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: responsiveBorderRadius.md,
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
    flexShrink: 1,
    color: uiPalette.white,
    fontWeight: '600',
    textAlign: 'center',
  },

});

