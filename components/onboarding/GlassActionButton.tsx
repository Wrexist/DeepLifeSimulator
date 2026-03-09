import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { useGame } from '@/contexts/GameContext';
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
}

export default function GlassActionButton({
  title,
  subtitle,
  icon,
  onPress,
  highlighted = false,
  disabled = false,
}: GlassActionButtonProps) {
  const { gameState } = useGame();
  const isDarkMode = Boolean(gameState?.settings?.darkMode);
  const theme = getOnboardingTheme(isDarkMode);
  const blurTint = isDarkMode ? 'dark' : 'light';
  const glassStyle = getGlassButton(isDarkMode, highlighted);

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      disabled={disabled}
      onPress={onPress}
      style={[styles.touchable, disabled ? styles.touchableDisabled : undefined]}
    >
      <BlurViewFallback
        intensity={highlighted ? 32 : 24}
        tint={blurTint}
        style={[
          styles.card,
          glassStyle,
          { borderColor: theme.glassBorder },
          highlighted ? styles.highlightedCard : undefined,
        ]}
      >
        <View style={[styles.topHighlight, { backgroundColor: theme.glassHighlight }]} />
        <View style={styles.content}>
          <View style={styles.iconWrap}>{icon}</View>
          <View style={styles.textWrap}>
            <Text numberOfLines={1} style={[styles.title, { color: theme.title }]}>
              {title}
            </Text>
            <Text numberOfLines={2} style={[styles.subtitle, { color: theme.subtitle }]}>
              {subtitle}
            </Text>
          </View>
          <ChevronRight size={responsiveIconSize.md} color={theme.accentText} />
        </View>
      </BlurViewFallback>
    </TouchableOpacity>
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
