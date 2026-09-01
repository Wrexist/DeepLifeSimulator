/**
 * SectionTitle - a section's one-line heading with an optional trailing
 * control (a count, a "See all", an "Add" chip).
 *
 * Twelve apps declared the same `sectionTitle` style (md, weight 700,
 * letterSpacing 0.2) and five wrapped it in a local `SectionTitle` /
 * `SectionHead` / `SectionHeader` component. This is the one heading; it is
 * semibold, not bold, because the audit's type rule is that weight carries
 * hierarchy only when most text is regular.
 *
 * For a foldable band use `CollapsibleSection`; for a labelled group of cards
 * use `SectionGroup`. This is the plain heading inside either.
 */
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '@/hooks/useTheme';
import { fontScale, responsiveSpacing } from '@/utils/scaling';

export default function SectionTitle({
  title,
  subtitle,
  right,
  style,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.row, style]}>
      <View style={styles.text}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textMuted }]} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: responsiveSpacing.sm,
    marginTop: responsiveSpacing.sm,
    marginBottom: responsiveSpacing.xs,
  },
  text: { flex: 1, gap: 2 },
  title: {
    fontSize: fontScale(15),
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  subtitle: {
    fontSize: fontScale(12),
    lineHeight: fontScale(16),
  },
  right: { flexShrink: 0 },
});
