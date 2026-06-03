/**
 * SectionHeader — reusable header row (title + optional right-aligned action).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { fontScale, responsiveSpacing } from '@/utils/scaling';
import { useTheme } from '@/hooks/useTheme';

interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export default function SectionHeader({ title, actionLabel, onActionPress }: SectionHeaderProps) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      {actionLabel ? (
        <Pressable onPress={onActionPress} accessibilityRole="button" accessibilityLabel={actionLabel} hitSlop={8}>
          <Text style={[styles.action, { color: theme.textSecondary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: responsiveSpacing.md,
    paddingVertical: responsiveSpacing.sm,
  },
  title: {
    fontSize: fontScale(16),
    fontWeight: '600',
  },
  action: {
    fontSize: fontScale(13),
    fontWeight: '500',
  },
});
