import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Flame } from 'lucide-react-native';
import { heatBand, heatBandLabel } from '@/lib/darkweb/heat';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  heat: number;
  darkMode: boolean;
  compact?: boolean;
}

const BAND_COLOR: Record<string, string> = {
  cold: accent.info,
  warm: accent.warning,
  hot: '#f97316',
  burning: accent.danger,
};

export default function HeatGauge({ heat, darkMode, compact }: Props) {
  const theme = getThemeColors(darkMode);
  const band = heatBand(heat);
  const color = BAND_COLOR[band];
  const fill = Math.max(0, Math.min(1, heat / 100));

  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
      ]}
    >
      <View style={styles.header}>
        <Flame size={scale(compact ? 14 : 18)} color={color} />
        <Text style={[styles.label, { color: theme.textSecondary }]}>Heat</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.value, { color: theme.text, fontSize: responsiveFontSize[compact ? '2xl' : '4xl'] }]}>
          {Math.round(heat)}
        </Text>
        <Text style={[styles.band, { color }]}>{heatBandLabel(band)}</Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.border }]}>
        <View style={[styles.fill, { width: `${fill * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: responsiveSpacing.md,
    borderRadius: responsiveBorderRadius.xl,
    borderWidth: 1,
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
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: responsiveSpacing.xs,
  },
  value: {
    fontWeight: '800',
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
});
