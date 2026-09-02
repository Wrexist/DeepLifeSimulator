import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle, TextStyle, View } from 'react-native';
import Gradient from '@/components/ui/Gradient';
import { responsiveSpacing, responsiveFontSize, responsiveBorderRadius } from '@/utils/scaling';
import { getButtonAccessibilityProps } from '@/utils/accessibility';
import { haptic } from '@/utils/haptics';
const LinearGradient = Gradient;

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
  const isDisabled = disabled || loading;

  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return ['#3B82F6', '#2563EB'];
      case 'secondary':
        // Tonal, not red. 'secondary' used to alias 'danger', so a routine
        // sale wore the destructive treatment and nothing was left for real
        // destruction. The flat surface is drawn below; these colours are
        // only read by the gradient path.
        return ['transparent', 'transparent'];
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
        { opacity: isDisabled ? 0.6 : 1 },
        style,
      ]}
      accessibilityLabel={accessibilityProps.accessibilityLabel}
      accessibilityRole={accessibilityProps.accessibilityRole as any}
      accessibilityHint={accessibilityProps.accessibilityHint}
      accessibilityState={accessibilityProps.accessibilityState}
    >
      <LinearGradient
        colors={(isDisabled ? ['#94A3B8', '#64748B'] : colors) as unknown as readonly [string, string]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.gradient,
          variant === 'secondary' && !isDisabled && styles.tonal,
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
              variant === 'secondary' && !isDisabled && styles.textTonal,
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
  /** The flat secondary: a tinted surface and a rim, the label in the text
   *  colour. Sits a tier under the saturated primary beside it. */
  tonal: {
    backgroundColor: 'rgba(148, 163, 184, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  textTonal: {
    color: '#E2E8F0',
  },
});

