import React from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import BlurViewFallback from '@/components/fallbacks/BlurViewFallback';
import { useOnboardingTheme } from '@/lib/config/onboardingTheme';
import { responsiveBorderRadius, responsiveSpacing } from '@/utils/scaling';

interface GlassPanelProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
}

export default function GlassPanel({ children, style, strong = false }: GlassPanelProps) {
  // Menu is always dark amber — no darkMode subscription needed (avoids a
  // re-render on theme toggle and keeps the card style constant).
  const theme = useOnboardingTheme();

  return (
    <BlurViewFallback
      intensity={strong ? 30 : 22}
      tint="dark"
      style={[
        styles.base,
        {
          borderColor: theme.cardBorder,
          backgroundColor: strong ? 'rgba(20, 17, 13, 0.92)' : theme.card,
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
