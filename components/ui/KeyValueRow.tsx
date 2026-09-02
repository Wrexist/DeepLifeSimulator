/**
 * KeyValueRow - "label on the left, value on the right", once.
 *
 * The 19 phone apps carried this as DetailRow (Statistics, Garage), DetailStat
 * (Real Estate), fareRow (Travel), effectRow (Political), ownershipRow
 * (Luxury), KV (Pets), FactCell (Bank) - the same space-between line with a
 * muted label and a tabular value. It is the shape every "All specs" /
 * "All stats" fold in this program uses, so it lives here.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { fontScale, responsiveSpacing, scale } from '@/utils/scaling';

export default function KeyValueRow({
  label,
  value,
  tint,
  sub,
  divider = true,
  style,
}: {
  label: string;
  value: string | number;
  /** Colours the value only, for meaning (green = fine, red = failing). */
  tint?: string;
  /** Optional second line under the label. */
  sub?: string;
  /** Hairline under the row. Default on; turn off for the last row in a group. */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[styles.row, divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border }, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label} ${value}`}
    >
      <View style={styles.labelBlock}>
        <Text style={[styles.label, { color: theme.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text style={[styles.sub, { color: theme.textMuted }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.value, { color: tint ?? theme.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: responsiveSpacing.sm,
    paddingVertical: scale(8),
  },
  labelBlock: { flex: 1, gap: 2 },
  label: { fontSize: fontScale(13) },
  sub: { fontSize: fontScale(11) },
  value: {
    fontSize: fontScale(13),
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    flexShrink: 0,
  },
});
