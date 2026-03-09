import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { useGame } from '@/contexts/GameContext';
import { getOnboardingTheme } from '@/lib/config/onboardingTheme';
import { responsiveBorderRadius, responsiveSpacing } from '@/utils/scaling';

interface GlassPanelProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
}

export default function GlassPanel({ children, style, strong = false }: GlassPanelProps) {
  const { gameState } = useGame();
  const isDarkMode = Boolean(gameState?.settings?.darkMode);
  const theme = getOnboardingTheme(isDarkMode);

  return (
    <BlurViewFallback
      intensity={strong ? 30 : 22}
      tint={isDarkMode ? 'dark' : 'light'}
      style={[
        styles.base,
        {
          borderColor: theme.glassBorder,
          backgroundColor: strong ? 'rgba(15, 23, 42, 0.4)' : 'rgba(15, 23, 42, 0.3)',
        },
        style,
      ]}
    >
      {children}
    </BlurViewFallback>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1.2,
    padding: responsiveSpacing.lg,
    overflow: 'hidden',
  },
});
