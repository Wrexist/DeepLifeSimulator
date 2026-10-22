import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Activity, TrendingUp, TrendingDown, Zap } from 'lucide-react-native';
import { CryptoRegime } from '@/contexts/game/types';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

/**
 * Shows the coin's CURRENT regime and nothing about how long it will last
 * (ECO-1). The banner used to print the regime's countdown, and since the tick
 * only re-rolled a regime when that countdown ran out, "Bull Run, 6 weeks
 * left" was a guaranteed bull draw next week. The countdown is gone and a
 * regime can now turn in any week (`REGIME_HAZARD_WEEKLY`).
 */
interface Props {
  regime: CryptoRegime;
  darkMode: boolean;
}

const REGIME_META: Record<CryptoRegime, { label: string; color: string; icon: React.ComponentType<{ size: number; color: string }>; description: string }> = {
  stable:   { label: 'Stable',   color: accent.info, icon: Activity,      description: 'Low volatility. Steady price action.' },
  volatile: { label: 'Volatile', color: accent.warning, icon: Zap,           description: 'Wide swings. Spreads widen.' },
  bull:     { label: 'Bull Run', color: accent.success, icon: TrendingUp,    description: 'Positive drift. Up-trend dominant.' },
  bear:     { label: 'Bear',     color: accent.danger, icon: TrendingDown,  description: 'Negative drift. Down-trend dominant.' },
};

export default function RegimeBanner({ regime, darkMode }: Props) {
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
      <Text style={[styles.turnNote, { color: theme.textMuted }]}>Can turn{'\n'}any week</Text>
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
  turnNote: {
    fontSize: responsiveFontSize.xs,
    textAlign: 'right',
  },
});
