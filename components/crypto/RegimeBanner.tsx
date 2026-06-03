import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Activity, TrendingUp, TrendingDown, Zap } from 'lucide-react-native';
import { CryptoRegime } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  regime: CryptoRegime;
  weeksRemaining: number;
  darkMode: boolean;
}

const REGIME_META: Record<CryptoRegime, { label: string; color: string; icon: React.ComponentType<{ size: number; color: string }>; description: string }> = {
  stable:   { label: 'Stable',   color: accent.info, icon: Activity,      description: 'Low volatility. Steady price action.' },
  volatile: { label: 'Volatile', color: accent.warning, icon: Zap,           description: 'Wide swings. Spreads widen.' },
  bull:     { label: 'Bull Run', color: accent.success, icon: TrendingUp,    description: 'Positive drift. Up-trend dominant.' },
  bear:     { label: 'Bear',     color: accent.danger, icon: TrendingDown,  description: 'Negative drift. Down-trend dominant.' },
};

export default function RegimeBanner({ regime, weeksRemaining, darkMode }: Props) {
  const theme = getThemeColors(darkMode);
  const meta = REGIME_META[regime];
  const Icon = meta.icon;
  return (
    <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: meta.color }]}>
      <View style={[styles.iconBubble, { backgroundColor: meta.color }]}>
        <Icon size={scale(16)} color="white" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.label, { color: meta.color }]}>{meta.label}</Text>
        <Text style={[styles.desc, { color: theme.textSecondary }]}>{meta.description}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.weeksValue, { color: theme.text }]}>{weeksRemaining}</Text>
        <Text style={[styles.weeksLabel, { color: theme.textMuted }]}>weeks left</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.lg,
    borderWidth: 1,
    gap: responsiveSpacing.sm,
  },
  iconBubble: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: responsiveFontSize.md,
    fontWeight: '800',
  },
  desc: {
    fontSize: responsiveFontSize.xs,
    marginTop: 2,
  },
  weeksValue: {
    fontSize: responsiveFontSize.lg,
    fontWeight: '800',
  },
  weeksLabel: {
    fontSize: responsiveFontSize.xs,
  },
});
