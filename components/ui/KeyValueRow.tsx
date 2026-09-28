import { textStyles } from '@/lib/config/hierarchy';
import { responsiveSpacing as layoutSpace , responsiveSpacing } from '@/utils/scaling';
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
      accessibilityLabel={`${label} ${value}${sub ? `, ${sub}` : ''}`}
    >
      <View style={styles.labelBlock}>
        <Text style={[styles.label, { color: theme.textSecondary }]}>
          {label}
        </Text>
        {sub ? (
          <Text style={[styles.sub, { color: theme.textMuted }]}>
            {sub}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.value, { color: tint ?? theme.text }]}>
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
    paddingVertical: layoutSpace.sm,
  },
  labelBlock: { flex: 1, gap: 2 },
  label: { ...textStyles.body },
  sub: { ...textStyles.caption },
  value: {
    ...textStyles.bodyStrong,
    fontVariant: ['tabular-nums'],
    flexShrink: 1,
    maxWidth: '55%',
    textAlign: 'right',
  },
});
