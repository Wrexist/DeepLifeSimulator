import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Shield } from 'lucide-react-native';
import { CreditBand, bandLabel } from '@/lib/banking/creditScore';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';
import { getGlassCard } from '@/utils/glassmorphismStyles';

interface Props {
  score: number;
  band: CreditBand;
  darkMode: boolean;
  compact?: boolean;
}

const BAND_COLOR: Record<CreditBand, string> = {
  poor: accent.danger,
  fair: accent.warning,
  good: '#eab308',
  veryGood: '#22c55e',
  excellent: accent.success,
};

export default function CreditScoreGauge({ score, band, darkMode, compact = false }: Props) {
  const theme = getThemeColors(darkMode);
  const color = BAND_COLOR[band];
  // Map 300-850 â†’ 0-1 for the fill bar.
  const fill = Math.max(0, Math.min(1, (score - 300) / (850 - 300)));

  return (
    <View
      style={[
        getGlassCard(darkMode, 6),
        styles.card,
        compact && styles.cardCompact,
        { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1, borderRadius: responsiveBorderRadius.xl },
      ]}
    >
      <View style={styles.header}>
        <Shield size={scale(compact ? 14 : 18)} color={color} />
        <Text style={[styles.label, { color: theme.textSecondary }]}>Credit Score</Text>
      </View>
      <View style={styles.scoreRow}>
        <Text style={[styles.score, { color: theme.text, fontSize: responsiveFontSize[compact ? '2xl' : '4xl'] }]}>
          {score}
        </Text>
        <Text style={[styles.band, { color }]}>{bandLabel(band)}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
        <View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: color }]} />
      </View>
      <View style={styles.scaleRow}>
        <Text style={[styles.scaleText, { color: theme.textMuted }]}>300</Text>
        <Text style={[styles.scaleText, { color: theme.textMuted }]}>850</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: responsiveSpacing.md,
  },
  cardCompact: {
    padding: responsiveSpacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: responsiveSpacing.xs,
  },
  label: {
    fontSize: responsiveFontSize.sm,
    fontWeight: '600',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.xs,
  },
  score: {
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  band: {
    fontSize: responsiveFontSize.md,
    fontWeight: '700',
  },
  track: {
    height: scale(6),
    borderRadius: responsiveBorderRadius.full,
    overflow: 'hidden',
    marginTop: responsiveSpacing.sm,
  },
  fill: {
    height: '100%',
    borderRadius: responsiveBorderRadius.full,
  },
  scaleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.xs,
  },
  scaleText: {
    fontSize: responsiveFontSize.xs,
    fontVariant: ['tabular-nums'],
  },
});
