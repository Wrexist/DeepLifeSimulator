import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Users } from 'lucide-react-native';
import { responsiveFontSize, responsiveSpacing, responsiveBorderRadius, scale } from '@/utils/scaling';
import { getThemeColors, accent } from '@/lib/config/theme';

interface Props {
  approval: number;
  darkMode: boolean;
  compact?: boolean;
}

function bandColor(approval: number): string {
  if (approval >= 75) return accent.success;
  if (approval >= 55) return accent.info;
  if (approval >= 35) return accent.warning;
  return accent.danger;
}

function bandLabel(approval: number): string {
  if (approval >= 75) return 'Beloved';
  if (approval >= 55) return 'Popular';
  if (approval >= 35) return 'Divisive';
  if (approval >= 15) return 'Unpopular';
  return 'Reviled';
}

export default function ApprovalGauge({ approval, darkMode, compact }: Props) {
  const theme = getThemeColors(darkMode);
  const color = bandColor(approval);
  const fill = Math.max(0, Math.min(1, approval / 100));
  return (
    <View
      style={[
        styles.card,
        compact && styles.cardCompact,
        { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
      ]}
    >
      <View style={styles.header}>
        <Users size={scale(compact ? 14 : 18)} color={color} />
        <Text style={[styles.label, { color: theme.textSecondary }]}>Approval rating</Text>
      </View>
      <View style={styles.row}>
        <Text style={[styles.value, { color: theme.text, fontSize: responsiveFontSize[compact ? '2xl' : '4xl'] }]}>
          {Math.round(approval)}%
        </Text>
        <Text style={[styles.band, { color }]}>{bandLabel(approval)}</Text>
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
  cardCompact: { padding: responsiveSpacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: responsiveSpacing.xs },
  label: { fontSize: responsiveFontSize.sm, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: responsiveSpacing.xs },
  value: { fontWeight: '800' },
  band: { fontSize: responsiveFontSize.md, fontWeight: '700' },
  track: { height: scale(6), borderRadius: responsiveBorderRadius.full, overflow: 'hidden', marginTop: responsiveSpacing.sm },
  fill: { height: '100%', borderRadius: responsiveBorderRadius.full },
});
