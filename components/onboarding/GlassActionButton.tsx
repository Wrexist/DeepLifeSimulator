import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import usePressableScale from '@/hooks/usePressableScale';
import { useGameSelector } from '@/contexts/game/useGameSelector';
import { getOnboardingTheme } from '@/lib/config/onboardingTheme';
import { getGlassButton } from '@/utils/glassmorphismStyles';
import {
  fontScale,
  responsiveBorderRadius,
  responsiveIconSize,
  responsiveSpacing,
  scale,
  verticalScale,
} from '@/utils/scaling';

interface GlassActionButtonProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
  highlighted?: boolean;
  disabled?: boolean;
  loading?: boolean;
  loadingText?: string;
  /**
   * Optional hex accent (e.g. '#60A5FA'). When provided the icon orb and the
   * trailing chevron are tinted with it (matching the color-coded main-menu
   * cards). Omit for the original neutral-glass look.
   */
  accentColor?: string;
}

/** Expand a #RGB / #RRGGBB hex into an rgba() string at the given alpha. */
function hexToRgba(hex: string, alpha: number): string {
  let h = hex.replace('#', '');
  if (h.length === 3) {
    h = h
      .split('')
      .map((c) => c + c)
      .join('');
  }
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return hex;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export default function GlassActionButton({
  title,
  subtitle,
  icon,
  onPress,
  highlighted = false,
  disabled = false,
  loading = false,
  loadingText,
  accentColor,
}: GlassActionButtonProps) {
  const isDarkMode = useGameSelector((s) => Boolean(s?.settings?.darkMode));
  const theme = getOnboardingTheme(isDarkMode);
  const blurTint = isDarkMode ? 'dark' : 'light';
  const glassStyle = getGlassButton(isDarkMode, highlighted);

  // Accent-tinted surfaces for the icon orb + chevron circle (color-coded cards).
  const accentOrbStyle = accentColor
    ? {
        backgroundColor: hexToRgba(accentColor, 0.16),
        borderColor: hexToRgba(accentColor, 0.55),
        shadowColor: accentColor,
        shadowOpacity: 0.6,
        shadowRadius: scale(12),
        shadowOffset: { width: 0, height: 0 },
        elevation: 6,
      }
    : undefined;
  const chevronColor = accentColor ?? theme.accentText;

  const isDisabled = disabled || loading;
  // Native-driver press scale for instant tactile feedback.
  const { AnimatedView, animatedStyle, onPressIn, onPressOut } = usePressableScale({ haptic: false });

  return (
    <AnimatedView style={animatedStyle}>
    <TouchableOpacity
      accessibilityLabel={title}
      accessibilityHint={subtitle}
      accessibilityRole="button"
      activeOpacity={0.9}
      disabled={isDisabled}
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={[styles.touchable, isDisabled ? styles.touchableDisabled : undefined]}
    >
      <BlurViewFallback
        intensity={highlighted ? 32 : 24}
        tint={blurTint}
        style={[
          styles.card,
          glassStyle,
          { borderColor: accentColor ? hexToRgba(accentColor, 0.4) : theme.glassBorder },
          highlighted ? styles.highlightedCard : undefined,
        ]}
      >
        <View
          style={[
            styles.topHighlight,
            { backgroundColor: accentColor ? hexToRgba(accentColor, 0.5) : theme.glassHighlight },
          ]}
        />
        <View style={styles.content}>
          <View style={[styles.iconWrap, accentOrbStyle]}>{loading ? null : icon}</View>
          <View style={styles.textWrap}>
            <Text numberOfLines={1} style={[styles.title, { color: theme.title }]}>
              {loading ? (loadingText ?? 'Loading...') : title}
            </Text>
            <Text numberOfLines={2} style={[styles.subtitle, { color: theme.subtitle }]}>
              {loading ? 'Please wait' : subtitle}
            </Text>
          </View>
          {loading ? (
            <ActivityIndicator color={chevronColor} size="small" />
          ) : (
            <View style={[styles.chevronCircle, { borderColor: hexToRgba(chevronColor, 0.5) }]}>
              <ChevronRight size={responsiveIconSize.md} color={chevronColor} />
            </View>
          )}
        </View>
      </BlurViewFallback>
    </TouchableOpacity>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  touchable: {
    width: '100%',
    marginBottom: responsiveSpacing.md,
  },
  touchableDisabled: {
    opacity: 0.6,
  },
  card: {
    overflow: 'hidden',
    borderRadius: responsiveBorderRadius.xl,
    paddingVertical: verticalScale(14),
    paddingHorizontal: responsiveSpacing.lg,
    borderWidth: 1.2,
  },
  highlightedCard: {
    transform: [{ scale: 1.005 }],
  },
  topHighlight: {
    position: 'absolute',
    left: scale(16),
    right: scale(16),
    top: 0,
    height: verticalScale(1),
  },
  content: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: responsiveSpacing.md,
  },
  iconWrap: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  chevronCircle: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    flex: 1,
    minHeight: verticalScale(48),
    justifyContent: 'center',
  },
  title: {
    fontSize: fontScale(18),
    fontWeight: '700',
    marginBottom: verticalScale(2),
  },
  subtitle: {
    fontSize: fontScale(12),
    fontWeight: '500',
    lineHeight: fontScale(16),
  },
});
